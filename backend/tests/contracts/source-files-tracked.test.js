// Every source file the apps load is in the repository (16.72). The root
// .gitignore's `data/` rule matched mobile-app/src/data/, so the mobile app's
// screen catalogue was never committed and a clean checkout could not build.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repo = path.resolve(__dirname, '../../..');

function filesUnder(dir, extensions) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return ['node_modules', 'vendor', '.expo'].includes(entry.name) ? [] : filesUnder(full, extensions);
    return extensions.some(ext => entry.name.endsWith(ext)) ? [full] : [];
  });
}

/** The file a relative import names, trying the extensions the bundler tries. */
function resolveImport(from, spec) {
  const base = path.resolve(path.dirname(from), spec);
  const candidates = [base, ...['.ts', '.tsx', '.js', '.json'].map(ext => base + ext), ...['index.ts', 'index.tsx', 'index.js'].map(f => path.join(base, f))];
  return candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
}

function loadedFiles() {
  const loaded = new Map(); // target -> first file that loads it
  const mobile = [...filesUnder(path.join(repo, 'mobile-app/app'), ['.ts', '.tsx']), ...filesUnder(path.join(repo, 'mobile-app/src'), ['.ts', '.tsx'])];
  for (const file of mobile) {
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
      loaded.set(resolveImport(file, match[1]) || `${path.resolve(path.dirname(file), match[1])} (missing)`, file);
    }
  }
  for (const file of filesUnder(path.join(repo, 'desktop/ui'), ['.html'])) {
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/<script src="([^"]+)"|<link[^>]+href="(\.\.?\/[^"]+)"/g)) {
      const target = path.resolve(path.dirname(file), match[1] || match[2]);
      loaded.set(fs.existsSync(target) ? target : `${target} (missing)`, file);
    }
  }
  return loaded;
}

test('every file the mobile app imports and every script a desktop page loads exists', () => {
  const loaded = loadedFiles();
  expect(loaded.size).toBeGreaterThan(60);
  const missing = [...loaded.entries()].filter(([target]) => target.endsWith('(missing)'))
    .map(([target, by]) => `${path.relative(repo, target)} <- ${path.relative(repo, by)}`);
  expect(missing).toEqual([]);
});

test('none of them is git-ignored, so a clean checkout has them', () => {
  const targets = [...loadedFiles().keys()].filter(target => !target.endsWith('(missing)')).map(target => path.relative(repo, target));
  const git = spawnSync('git', ['check-ignore', '--no-index', ...targets], { cwd: repo, encoding: 'utf8' });
  if (git.error) return; // no git here: nothing to compare against
  expect(git.stdout.split('\n').filter(Boolean)).toEqual([]);
});
