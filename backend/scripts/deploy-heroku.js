#!/usr/bin/env node
/**
 * Deploy the backend directory to the Heroku app.
 *
 *   npm --prefix backend run heroku:deploy                 build and push
 *   npm --prefix backend run heroku:deploy -- --dry-run    build the deploy commit, push nothing
 *   npm --prefix backend run heroku:deploy -- --app NAME   target another app
 *
 * Heroku needs package.json at the top of what it receives, so this pushes the
 * backend directory on its own. It takes the directory as it is on disk
 * (tracked and new files, .gitignore respected), which means uncommitted work
 * is deployed too. Your branch, index and stash are not touched; the deploy
 * commit is a separate object. The push replaces whatever the app was running.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { herokuApp, herokuToken } = require('./push-heroku-config');

const workspace = path.join(__dirname, '..', '..');

function git(args, { env, input } = {}) {
  const result = spawnSync('git', args, { cwd: workspace, encoding: 'utf8', env: { ...process.env, ...env }, input });
  if (result.status !== 0) throw new Error(`git ${args[0]} failed: ${(result.stderr || '').trim().split('\n').pop()}`);
  return result.stdout.trim();
}

/** A parentless commit holding the backend directory's current contents. */
function buildDeployCommit() {
  const index = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cf-deploy-')), 'index');
  const env = { GIT_INDEX_FILE: index };
  try {
    git(['read-tree', 'HEAD'], { env });
    git(['add', '-A', '--', 'backend'], { env });
    const tree = git(['write-tree', '--prefix=backend/'], { env });
    const files = git(['ls-tree', '-r', '--name-only', tree]).split('\n');
    if (!files.includes('package.json')) throw new Error('The backend tree has no package.json.');
    const leaked = files.filter(file => /(^|\/)\.env(\.|$)/.test(file) && !file.endsWith('.env.example'));
    if (leaked.length) throw new Error(`Refusing to deploy environment files: ${leaked.join(', ')}`);
    const head = git(['rev-parse', '--short', 'HEAD']);
    const dirty = git(['status', '--short', '--', 'backend']) !== '';
    const message = `Deploy backend (based on ${head}${dirty ? ', with uncommitted changes' : ''})`;
    return { commit: git(['commit-tree', tree], { input: message }), files: files.length, message };
  } finally {
    fs.rmSync(path.dirname(index), { recursive: true, force: true });
  }
}

function main(argv) {
  const args = argv.slice(2);
  const option = name => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const app = herokuApp(option('--app'));
  const { commit, files, message } = buildDeployCommit();
  console.log(`${message}\n  commit ${commit}, ${files} files, target app "${app}"`);
  if (args.includes('--dry-run')) return console.log('Dry run: nothing was pushed.');

  // The token travels as a request header, so it is not written to git config
  // and does not appear in the push output.
  const basic = Buffer.from(`:${herokuToken()}`).toString('base64');
  const push = spawnSync('git', [
    '-c', 'credential.helper=', '-c', `http.extraHeader=Authorization: Basic ${basic}`,
    'push', '--force', `https://git.heroku.com/${app}.git`, `${commit}:refs/heads/main`
  ], { cwd: workspace, stdio: 'inherit' });
  if (push.status !== 0) throw new Error('The push or the Heroku build failed; see the output above.');
  console.log(`\nDeployed. Check: heroku logs --tail -a ${app}`);
}

if (require.main === module) {
  try {
    main(process.argv);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { buildDeployCommit };
