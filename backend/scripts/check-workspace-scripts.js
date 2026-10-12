const fs = require('fs');
const path = require('path');

const NPM_BUILTINS = new Set(['install', 'ci']);

function packageScripts(directory) {
  const filename = path.join(directory, 'package.json');
  if (!fs.existsSync(filename)) return null;
  return JSON.parse(fs.readFileSync(filename, 'utf8')).scripts || {};
}

// One shell step ("cd backend", "npm run dev", "node scripts/x.js", ...).
function checkStep(step, state, problems) {
  const words = step.trim().split(/\s+/);
  const [command, ...args] = words;
  const here = path.relative(state.root, state.directory) || '.';

  if (command === 'cd') {
    state.directory = path.resolve(state.directory, args[0]);
    if (!fs.existsSync(state.directory)) problems.push(`directory ${args[0]} does not exist`);
  } else if (command === 'concurrently') {
    for (const quoted of step.matchAll(/"([^"]+)"/g)) checkCommand(quoted[1], { ...state }, problems);
  } else if (command === 'npm') {
    let directory = state.directory;
    const prefix = args.indexOf('--prefix');
    if (prefix !== -1) directory = path.resolve(state.directory, args.splice(prefix, 2)[1]);
    const scripts = packageScripts(directory);
    const where = path.relative(state.root, directory) || '.';
    const name = args[0] === 'run' ? args[1] : args[0];
    if (!scripts) problems.push(`${where} has no package.json`);
    else if (name && !NPM_BUILTINS.has(name) && !scripts[name]) problems.push(`${where} has no "${name}" script`);
  } else if (command === 'node' || command === 'python') {
    const file = args.find(arg => !arg.startsWith('-'));
    if (file && !fs.existsSync(path.resolve(state.directory, file))) problems.push(`${here}/${file} does not exist`);
  } else if (command === 'pip') {
    const file = args[args.indexOf('-r') + 1];
    if (args.includes('-r') && !fs.existsSync(path.resolve(state.directory, file))) {
      problems.push(`${here}/${file} does not exist`);
    }
  }
}

// Split on && outside double quotes: concurrently takes whole commands as quoted arguments.
function steps(command) {
  const result = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];
    if (character === '"') quoted = !quoted;
    if (!quoted && character === '&' && command[index + 1] === '&') {
      result.push(current);
      current = '';
      index += 1;
    } else {
      current += character;
    }
  }
  return [...result, current];
}

function checkCommand(command, state, problems) {
  for (const step of steps(command)) checkStep(step, state, problems);
}

/** Root scripts that name a directory, package script or file that is not there. */
function brokenWorkspaceScripts(root) {
  const scripts = packageScripts(root);
  if (!scripts) return null;
  const broken = {};
  for (const [name, command] of Object.entries(scripts)) {
    const problems = [];
    checkCommand(command, { root, directory: root }, problems);
    if (problems.length) broken[name] = [...new Set(problems)];
  }
  return broken;
}

if (require.main === module) {
  const root = path.join(__dirname, '..', '..');
  const broken = brokenWorkspaceScripts(root);
  if (broken === null) {
    console.log('No workspace package.json above the backend; skipping the workspace script check.');
  } else if (Object.keys(broken).length) {
    for (const [name, problems] of Object.entries(broken)) console.error(`${name}: ${problems.join('; ')}`);
    process.exit(1);
  } else {
    console.log(`Checked ${Object.keys(packageScripts(root)).length} workspace scripts; every target exists.`);
  }
}

module.exports = { brokenWorkspaceScripts };
