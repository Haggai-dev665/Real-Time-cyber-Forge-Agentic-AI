const fs = require('fs');
const os = require('os');
const path = require('path');
const { brokenWorkspaceScripts } = require('../../scripts/check-workspace-scripts');

const repoRoot = path.join(__dirname, '..', '..', '..');

function workspace(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-workspace-'));
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), typeof content === 'string' ? content : JSON.stringify(content));
  }
  return root;
}

test('every root script in this repository points at something that exists', () => {
  expect(brokenWorkspaceScripts(repoRoot)).toEqual({});
});

test('the deploy hook installs only the backend and the engines match the tested Node version', () => {
  const root = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const backend = JSON.parse(fs.readFileSync(path.join(repoRoot, 'backend', 'package.json'), 'utf8'));
  expect(root.scripts['heroku-postbuild']).toBe('cd backend && npm ci --omit=dev');
  expect(root.engines).toEqual({ node: '24.x' });
  expect(backend.engines).toEqual({ node: '24.x' });
});

test('missing directories, packages, scripts and files are each reported', () => {
  const root = workspace({
    'package.json': { scripts: {
      'ok': 'cd app && npm run build && node tools/make.js',
      'ok:prefix': 'npm --prefix app run build',
      'ok:parallel': 'concurrently "npm run ok" "cd app && npm install"',
      'ok:other': 'echo done && docker-compose up -d',
      'no-dir': 'cd missing && npm install',
      'no-package': 'cd static && npm run build',
      'no-script': 'cd app && npm run lint',
      'no-root-script': 'npm run absent',
      'no-file': 'node tools/absent.js',
      'no-requirements': 'cd static && pip install -r requirements.txt',
      'no-nested': 'concurrently "npm run ok" "cd static && npm start"'
    } },
    'app/package.json': { scripts: { build: 'true' } },
    'app/tools/make.js': '',
    'static/index.html': ''
  });
  try {
    const broken = brokenWorkspaceScripts(root);
    expect(Object.keys(broken).sort()).toEqual(
      ['no-dir', 'no-file', 'no-nested', 'no-package', 'no-requirements', 'no-root-script', 'no-script']);
    expect(broken['no-package']).toEqual(['static has no package.json']);
    expect(broken['no-script']).toEqual(['app has no "lint" script']);
    expect(broken['no-root-script']).toEqual(['. has no "absent" script']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a checkout without a workspace package.json is skipped, not failed', () => {
  const root = workspace({ 'readme.txt': '' });
  try {
    expect(brokenWorkspaceScripts(root)).toBeNull();
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the root package declares only what something here uses', () => {
  const root = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  // heroku: the fallback command-line tool for scripts/push-heroku-config.js
  expect(Object.keys(root.dependencies || {})).toEqual(['heroku']);
  expect(root.devDependencies).toBeUndefined();
  expect(fs.readFileSync(path.join(repoRoot, 'backend', 'scripts', 'push-heroku-config.js'), 'utf8')).toContain('npx --no-install heroku');
});

test('every document the README links to in this repository exists', () => {
  const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
  const linked = [...readme.matchAll(/\]\((?!https?:|#|mailto:)([^)#\s]+)/g)].map(match => match[1]);
  const named = [...readme.matchAll(/`((?:desktop|backend|ml-services|mobile-app|docs)\/[A-Za-z0-9_./-]+\.(?:md|yml|json|example))`/g)].map(match => match[1]);
  const missing = [...new Set([...linked, ...named])].filter(file => !fs.existsSync(path.join(repoRoot, file)));
  expect(missing).toEqual([]);
  expect(fs.existsSync(path.join(repoRoot, 'desktop', 'BUILD.md'))).toBe(true);

  // A file can exist here and still never reach a clone: this repository
  // ignores Markdown by default, which is how the build guide went missing.
  const { spawnSync } = require('child_process');
  if (spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: repoRoot }).status !== 0) return;
  const ignored = [...new Set([...linked, ...named])]
    .filter(file => spawnSync('git', ['check-ignore', '-q', file], { cwd: repoRoot }).status === 0);
  expect(ignored).toEqual([]);
});
