// The desktop renders outside text as text, and its content policy runs no
// script that is not one of the app's own files (SEC-05, F18).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const parser = require('@babel/parser');
const { unescapedValues } = require('../helpers/htmlSinks');
const reviewed = require('./fixtures/desktop-html-reviewed.json');

const desktop = path.resolve(__dirname, '../../../desktop');
const ui = path.join(desktop, 'ui');
const read = relative => fs.readFileSync(path.join(ui, relative), 'utf8');

function filesUnder(dir, extension) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'vendor' ? [] : filesUnder(full, extension);
    return entry.name.endsWith(extension) ? [full] : [];
  });
}
const rel = file => path.relative(ui, file).replace(/\\/g, '/');

// Named top-level functions of a page script, run on their own with stand-ins for what they use.
function pageFunctions(relative, names, globals) {
  const code = read(relative);
  const ast = parser.parse(code, { sourceType: 'script', errorRecovery: true });
  const source = ast.program.body
    .filter(node => node.type === 'FunctionDeclaration' && names.includes(node.id.name))
    .map(node => code.slice(node.start, node.end)).join('\n');
  const context = vm.createContext({ ...globals });
  vm.runInContext(`${source}\n;({ ${names.join(', ')} })`, context);
  return vm.runInContext(`({ ${names.join(', ')} })`, context);
}

// CF.esc as the app defines it
function appEscaper() {
  const code = read('scripts/cyberforge-shared.js');
  const match = code.match(/CF\.esc = function\(s\)\{[\s\S]*?\n\};/);
  const context = vm.createContext({ CF: {} });
  vm.runInContext(match[0], context);
  return context.CF.esc;
}

const HOSTILE = [
  '<img src=x onerror=alert(1)>',
  '"><svg onload=alert(1)>',
  "' onmouseover='alert(1)",
  '<script>alert(1)</script>'
];
// Inert: the only tags are the renderer's own, and none of them carries an event handler
// outside a quoted value. (Escaped text may still read "onerror=alert(1)"; as text, or
// inside a quoted attribute value, it does nothing.)
const isInert = html => (html.match(/<[a-z][^>]*>/gi) || [])
  .map(tag => tag.replace(/"[^"]*"|'[^']*'/g, '""'))
  .every(tag => !/^<(img|svg|script|iframe)\b/i.test(tag) && !/\son[a-z]+\s*=/i.test(tag));

describe('the content policy', () => {
  const csp = JSON.parse(fs.readFileSync(path.join(desktop, 'src-tauri/tauri.conf.json'), 'utf8')).app.security.csp;
  const directive = name => (csp.split(';').map(part => part.trim()).find(part => part.startsWith(`${name} `)) || '').split(/\s+/).slice(1);

  test("scripts are the app's own files only: no inline or evaluated code", () => {
    expect(directive('script-src')).toEqual(["'self'"]);
  });

  test('plugins, base changes and form submission are refused', () => {
    expect(directive('object-src')).toEqual(["'none'"]);
    expect(directive('base-uri')).toEqual(["'self'"]);
    expect(directive('form-action')).toEqual(["'none'"]);
  });

  test('no page needs what the policy refuses', () => {
    const offenders = [];
    for (const file of filesUnder(ui, '.html')) {
      const html = fs.readFileSync(file, 'utf8');
      if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) offenders.push(`${rel(file)}: inline <script>`);
      if (/<[a-z][^>]*\son[a-z]+\s*=/i.test(html)) offenders.push(`${rel(file)}: inline event handler`);
      if (/javascript:/i.test(html)) offenders.push(`${rel(file)}: javascript: address`);
      if (/<link[^>]+href="https?:/i.test(html)) offenders.push(`${rel(file)}: stylesheet from another origin`);
    }
    for (const file of filesUnder(ui, '.js')) {
      const code = fs.readFileSync(file, 'utf8');
      if (/<[a-z][^<>'"]*\son[a-z]+\s*=/i.test(code)) offenders.push(`${rel(file)}: event handler in built HTML`);
      if (/\beval\(|new Function\(|set(Timeout|Interval)\(\s*['"`]/.test(code)) offenders.push(`${rel(file)}: evaluated code`);
      if (/javascript:/i.test(code)) offenders.push(`${rel(file)}: javascript: address`);
    }
    expect(offenders).toEqual([]);
  });
});

describe('outside text is rendered as text', () => {
  test('CF.esc escapes everything that can end text or a quoted attribute', () => {
    const esc = appEscaper();
    expect(esc(`<a href="x" title='y'>&</a>`)).toBe('&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
    expect(esc(null)).toBe('');
    expect(esc(42)).toBe('42');
  });

  test.each(HOSTILE)('a memory holding %s is shown as text', hostile => {
    const { memRow } = pageFunctions('scripts/pages/memory.js', ['memRow'], { CF: { esc: appEscaper() }, memTypes: {} });
    const html = memRow([hostile, `Scanned ${hostile}`, `category ${hostile}`, `risk ${hostile}`]);
    expect(isInert(html)).toBe(true);
  });

  test.each(HOSTILE)('an incident titled %s is shown as text', hostile => {
    const { evRow } = pageFunctions('scripts/pages/incident-timeline.js', ['evRow'], { CF: { esc: appEscaper() }, evIco: {} });
    expect(isInert(evRow(['10:00', hostile, hostile, hostile, hostile, hostile]))).toBe(true);
  });

  test('an assistant answer cannot add attributes through a link address', () => {
    const { mdToHtml } = pageFunctions('scripts/pages/ai-assistance.js', ['mdToHtml', 'escHtml'], { CF: { esc: appEscaper() } });
    const html = mdToHtml('See [the report](https://example.com/"onmouseover="alert(1)) and <img src=x onerror=alert(1)>');
    expect(html).toContain('href="https://example.com/&quot;onmouseover=&quot;alert(1"');
    expect(isInert(html)).toBe(true);
    expect(mdToHtml('**bold** and `code`')).toBe('<div><b>bold</b> and <code>code</code></div>');
  });
});

test('every value written into HTML without an escaper has been reviewed', () => {
  // Reviewed in plan-update.md 16.61: what remains unescaped is the pages' own
  // icons, SVG geometry, labels and counts, or HTML built from escaped parts.
  // A new entry here means a new value reaches innerHTML without CF.esc: escape
  // it, or review it and add it to fixtures/desktop-html-reviewed.json.
  const found = unescapedValues(ui);
  const unreviewed = {};
  const gone = {};
  for (const file of new Set([...Object.keys(found), ...Object.keys(reviewed)])) {
    const now = found[file] || [];
    const before = reviewed[file] || [];
    const added = now.filter(value => !before.includes(value));
    const removed = before.filter(value => !now.includes(value));
    if (added.length) unreviewed[file] = added;
    if (removed.length) gone[file] = removed;
  }
  expect(unreviewed).toEqual({});
  expect(gone).toEqual({}); // keeps the reviewed list exact: drop entries the code no longer has
});
