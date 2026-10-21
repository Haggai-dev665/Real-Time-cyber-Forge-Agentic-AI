// UX-02 / UX-04: keyboard operation, visible focus, reduced motion, dialogs that
// keep focus, and text scaling that is not undone, on the desktop and the phone.
const fs = require('fs');
const path = require('path');

const repo = path.join(__dirname, '..', '..', '..');
const read = file => fs.readFileSync(path.join(repo, file), 'utf8');
const list = (dir, pattern) => fs.readdirSync(path.join(repo, dir)).filter(f => pattern.test(f)).map(f => `${dir}/${f}`);
function walk(dir, pattern) {
  const out = [];
  for (const entry of fs.readdirSync(path.join(repo, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walk(rel, pattern));
    else if (pattern.test(entry.name)) out.push(rel);
  }
  return out;
}

describe('desktop', () => {
  const pages = [...list('desktop/ui/pages', /\.html$/), ...list('desktop/ui/components', /\.html$/)];

  test('every page loads the keyboard layer before any other script', () => {
    for (const page of pages) {
      const first = (read(page).match(/<script src="([^"]+)"/) || [])[1];
      expect({ page, first }).toEqual({ page, first: '../scripts/cf-a11y.js' });
    }
  });

  test('a clickable element that is not a native control becomes a focusable button that answers Enter and Space', () => {
    const layer = read('desktop/ui/scripts/cf-a11y.js');
    expect(layer).toMatch(/EventTarget\.prototype\.addEventListener = function \(type, listener, options\)/);
    expect(layer).toMatch(/if \(type === 'click' && this instanceof Element\)/);
    expect(layer).toMatch(/el\.setAttribute\('tabindex', '0'\)/);
    expect(layer).toMatch(/el\.setAttribute\('role', 'button'\)/);
    expect(layer).toMatch(/if \(e\.key === 'Enter' \|\| e\.key === ' '\) \{ e\.preventDefault\(\); el\.click\(\); \}/);
  });

  test('keyboard focus is always visible, and reduced motion stops animation', () => {
    const layer = read('desktop/ui/scripts/cf-a11y.js');
    expect(layer).toContain(':focus-visible{outline:2px solid');
    expect(layer).toContain('@media (prefers-reduced-motion: reduce)');
  });

  test('the layout does not undo the system\'s text scaling', () => {
    const shared = read('desktop/ui/scripts/cyberforge-shared.js');
    expect(shared).toMatch(/const scaled=\(window\.devicePixelRatio\|\|1\)>=1\.75;/);
    expect(shared).toMatch(/const floor=scaled\?1:MIN_FIT;/);
    expect(shared).toMatch(/if\(scroll\)\{ s=Math\.max\(1,floor\);/);
    expect(shared).toMatch(/document\.body\.style\.overflowX=scroll\?'auto':'';/);
  });

  test('Settings is a dialog that takes focus, keeps it, and gives it back', () => {
    const header = read('desktop/ui/scripts/cf-header.js');
    expect(header).toMatch(/ov\.setAttribute\('role','dialog'\); ov\.setAttribute\('aria-modal','true'\);/);
    expect(header).toMatch(/if\(e\.key!=='Tab'\) return;/);
    expect(header).toMatch(/ov\.querySelector\('#cfSetClose'\)\.focus\(\)/);
    expect(header).toMatch(/if\(cfSetReturn&&document\.contains\(cfSetReturn\)\) try\{ cfSetReturn\.focus\(\); \}/);
  });
});

describe('phone', () => {
  const files = [...walk('mobile-app/app', /\.tsx$/), ...walk('mobile-app/src', /\.tsx$/)];

  test('every pressable control is announced as a button or a switch', () => {
    for (const file of files) {
      const source = read(file);
      for (const match of source.matchAll(/<Pressable\b/g)) {
        const opening = source.slice(match.index, match.index + 400);
        expect({ file, at: match.index, role: /accessibilityRole=/.test(opening.split(/>\s*\n/)[0]) }).toEqual({ file, at: match.index, role: true });
      }
    }
  });

  test('icon-only controls have a name, and the switch says whether it is on', () => {
    expect(read('mobile-app/app/capture.tsx')).toContain('accessibilityLabel="Back"');
    expect(read('mobile-app/src/components/SubHeader.tsx')).toContain('accessibilityLabel="Back"');
    expect(read('mobile-app/src/sections/AssistantSection.tsx')).toContain('accessibilityLabel="Send"');
    expect(read('mobile-app/app/login.tsx')).toContain("accessibilityLabel={showPw ? 'Hide password' : 'Show password'}");
    expect(read('mobile-app/src/components/ui.tsx')).toMatch(/accessibilityRole="switch"\s+accessibilityState=\{\{ checked: on \}\}/);
  });

  test('text follows the system font size everywhere', () => {
    for (const file of files) expect({ file, off: /allowFontScaling=\{false\}/.test(read(file)) }).toEqual({ file, off: false });
  });
});
