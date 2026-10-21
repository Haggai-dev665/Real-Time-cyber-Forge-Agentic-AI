// Address redaction (SEC-07): the backend's redactUrl and the phone's copy give
// the same answer for every example, and those are the desktop's examples.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { redactUrl } = require('../../src/utils/redactUrl');

const repo = path.join(__dirname, '..', '..', '..');
const vectors = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'redact-url-vectors.json'), 'utf8'));

function phoneRedactUrl() {
  // the phone's TypeScript, transpiled with the phone's own compiler
  const ts = require(path.join(repo, 'mobile-app', 'node_modules', 'typescript'));
  const source = fs.readFileSync(path.join(repo, 'mobile-app', 'src', 'utils', 'redact.ts'), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } });
  const module = { exports: {} };
  vm.runInNewContext(outputText, { module, exports: module.exports });
  return module.exports.redactUrl;
}
const phoneCompiler = fs.existsSync(path.join(repo, 'mobile-app', 'node_modules', 'typescript'));

const implementations = [['backend', () => redactUrl]];
if (phoneCompiler) implementations.push(['phone', phoneRedactUrl]);
else console.warn('mobile-app/node_modules is not installed: the phone\'s redactUrl is not checked (run npm install in mobile-app)');

describe.each(implementations)('%s redactUrl', (_, load) => {
  const redact = load();

  test.each(vectors.redacted)('%s', (input, expected) => {
    expect(redact(input)).toBe(expected);
  });

  test('ordinary addresses are unchanged', () => {
    for (const url of vectors.unchanged) expect(redact(url)).toBe(url);
  });

  test('nothing in, nothing out', () => {
    expect(redact(undefined)).toBe('');
    expect(redact(null)).toBe('');
  });
});

test('the examples are the desktop\'s examples', () => {
  const rust = fs.readFileSync(path.join(repo, 'desktop', 'src-tauri', 'src', 'system.rs'), 'utf8');
  for (const [input, expected] of vectors.redacted.filter(([url]) => url.startsWith('http') && !url.includes('eyJ') && !url.includes('a1b2c3'))) {
    expect(rust).toContain(input);
    expect(rust).toContain(expected);
  }
  for (const url of vectors.unchanged.filter(u => !u.startsWith('/'))) expect(rust).toContain(`"${url}"`);
});
