#!/usr/bin/env node
/**
 * Copy backend/.env to the Heroku app's config vars.
 *
 *   npm --prefix backend run heroku:config                 push usable values
 *   npm --prefix backend run heroku:config -- --dry-run    show what would happen
 *   npm --prefix backend run heroku:config -- --all        also push placeholders and localhost values
 *   npm --prefix backend run heroku:config -- --app NAME   target another app
 *
 * Values are never printed. They are sent in one request to the Heroku API
 * rather than as command-line arguments, so quotes, ampersands and multi-line
 * keys arrive exactly as dotenv reads them locally. Requires `heroku login`
 * (or HEROKU_API_KEY).
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const dotenv = require('dotenv');

const PLACEHOLDER = /^your[-_ ]|your-.*-here|BEGIN PRIVATE KEY-----\s*(\\n)?\.\.\./i;
const LOCAL_ADDRESS = /(^|[/@,\s])(localhost|127\.0\.0\.1)([:/,\s]|$)/i;

/** Decide, per variable, whether it belongs on Heroku. Returns { push, skip }. */
function selectConfig(env, { all = false } = {}) {
  const push = {};
  const skip = {};
  for (const [name, value] of Object.entries(env)) {
    if (name === 'PORT') skip[name] = 'Heroku assigns the port';
    else if (value === '') skip[name] = 'empty';
    else if (all) push[name] = value;
    else if (name === 'NODE_ENV' && value !== 'production') skip[name] = `local value "${value}"; Heroku defaults to production`;
    else if (PLACEHOLDER.test(value)) skip[name] = 'still the template placeholder';
    else if (LOCAL_ADDRESS.test(value)) skip[name] = 'points at this machine';
    else push[name] = value;
  }
  return { push, skip };
}

function herokuApp(explicit) {
  if (explicit) return explicit;
  const remote = spawnSync('git', ['remote', 'get-url', 'heroku'], { encoding: 'utf8' });
  const match = /git\.heroku\.com\/(.+?)\.git/.exec(remote.stdout || '');
  if (!match) throw new Error('No "heroku" git remote found; pass --app NAME.');
  return match[1];
}

function herokuToken() {
  if (process.env.HEROKU_API_KEY) return process.env.HEROKU_API_KEY;
  // heroku is a .cmd shim on Windows, hence the shell. The globally installed
  // CLI and the one in the workspace's node_modules keep separate logins.
  const workspace = path.join(__dirname, '..', '..');
  for (const command of ['heroku auth:token', 'npx --no-install heroku auth:token']) {
    const result = spawnSync(command, { encoding: 'utf8', shell: true, cwd: workspace });
    const token = (result.stdout || '').trim().split(/\s+/).pop();
    if (result.status === 0 && token) return token;
  }
  throw new Error('Not logged in to Heroku. Run "heroku login" (or "npx heroku login") and try again.');
}

async function setConfigVars(app, token, vars) {
  const response = await fetch(`https://api.heroku.com/apps/${encodeURIComponent(app)}/config-vars`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/vnd.heroku+json; version=3',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(vars)
  });
  if (response.ok) return;
  const body = await response.json().catch(() => ({}));
  throw new Error(`Heroku refused the update (HTTP ${response.status}): ${body.message || body.id || 'no details'}`);
}

function list(title, names, describe = name => name) {
  console.log(`${title} (${names.length}):`);
  for (const name of names.sort()) console.log(`  ${describe(name)}`);
}

async function main(argv) {
  const args = argv.slice(2);
  const option = name => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const envFile = path.resolve(option('--env-file') || path.join(__dirname, '..', '.env'));
  if (!fs.existsSync(envFile)) throw new Error(`${envFile} does not exist.`);

  const { push, skip } = selectConfig(dotenv.parse(fs.readFileSync(envFile)), { all: args.includes('--all') });
  const app = herokuApp(option('--app'));

  list(`Variables to set on "${app}"`, Object.keys(push));
  list('Skipped', Object.keys(skip), name => `${name}: ${skip[name]}`);
  if (args.includes('--dry-run')) return console.log('\nDry run: nothing was sent.');
  if (!Object.keys(push).length) return console.log('\nNothing to send.');

  await setConfigVars(app, herokuToken(), push);
  console.log(`\nSet ${Object.keys(push).length} config vars on "${app}". Heroku restarts the app with the new values.`);
}

if (require.main === module) {
  main(process.argv).catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { selectConfig, herokuApp, herokuToken };
