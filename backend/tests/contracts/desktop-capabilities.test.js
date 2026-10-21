// The desktop's own commands are checked per window (SEC-05). These checks keep
// the four places that name them in agreement: the handler list in lib.rs, the
// manifest list in build.rs, the capability files, and the pages that call them.
// The runtime check itself is the Rust test desktop/src-tauri/src/acl_tests.rs.
const fs = require('fs');
const path = require('path');

const tauri = path.resolve(__dirname, '../../../desktop/src-tauri');
const ui = path.resolve(__dirname, '../../../desktop/ui');
const read = relative => fs.readFileSync(path.join(tauri, relative), 'utf8').replace(/\r\n/g, '\n');
const capability = name => JSON.parse(read(`capabilities/${name}`));
const allow = command => `allow-${command.replace(/_/g, '-')}`;

const handlerCommands = () => {
  const block = read('src/lib.rs').split('generate_handler![')[1].split('])')[0];
  return block.split('\n').map(line => line.replace(/\/\/.*$/, '').trim()).filter(Boolean)
    .map(entry => entry.replace(/,$/, '').split('::').pop()).sort();
};
const manifestCommands = () => [...read('build.rs').split('const COMMANDS')[1].split('];')[0].matchAll(/"([a-z_]+)"/g)].map(m => m[1]).sort();

// command names the page code passes to invoke helpers
function calledFrom(files) {
  const names = new Set();
  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');
    for (const match of code.matchAll(/\b(?:invoke|cfInvoke|inv|act|wire)\(\s*(?:[\w.]+\s*,\s*)?['"]([a-z]+(?:_[a-z]+)+)['"]/g)) names.add(match[1]);
  }
  return names;
}
function filesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'vendor' ? [] : filesUnder(full);
    return /\.(js|html)$/.test(entry.name) ? [full] : [];
  });
}

const POPUP_COMMANDS = ['get_pending_threat', 'block_site', 'protect_site', 'allow_site'];

test('build.rs lists exactly the commands lib.rs registers', () => {
  expect(manifestCommands()).toEqual(handlerCommands());
  expect(manifestCommands().length).toBeGreaterThan(50);
});

test('there are two capabilities, one per window, and no catch-all', () => {
  expect(fs.readdirSync(path.join(tauri, 'capabilities')).sort()).toEqual(['main.json', 'threat-alert.json']);
  expect(capability('main.json').windows).toEqual(['main']);
  expect(capability('threat-alert.json').windows).toEqual(['cf-threat-alert']);
  expect(read('src/agent.rs')).toMatch(/const LABEL: &str = "cf-threat-alert";/);
});

test('the main window may call every command', () => {
  const granted = capability('main.json').permissions;
  expect(manifestCommands().filter(command => !granted.includes(allow(command)))).toEqual([]);
});

test('the popup may call its four commands and close itself, nothing else', () => {
  expect(capability('threat-alert.json').permissions.slice().sort())
    .toEqual(['core:window:allow-close', ...POPUP_COMMANDS.map(allow)].sort());
});

test('the popup page calls only what its capability grants', () => {
  const used = calledFrom([path.join(ui, 'scripts/pages/threat-alert.js')]);
  expect([...used].sort()).toEqual(POPUP_COMMANDS.slice().sort());
  // its own script, plus the keyboard layer every page loads, which calls no command
  expect(fs.readFileSync(path.join(ui, 'pages/threat-alert.html'), 'utf8').match(/<script src="[^"]+"/g))
    .toEqual(['<script src="../scripts/cf-a11y.js"', '<script src="../scripts/pages/threat-alert.js"']);
  expect([...calledFrom([path.join(ui, 'scripts/cf-a11y.js')])]).toEqual([]);
  expect(fs.readFileSync(path.join(ui, 'scripts/cf-a11y.js'), 'utf8')).not.toMatch(/invoke|__TAURI__/);
});

test('every command a page calls is registered (an unlisted one would be refused)', () => {
  const registered = new Set(manifestCommands());
  const used = calledFrom(filesUnder(ui));
  expect(used.size).toBeGreaterThan(40);
  expect([...used].filter(command => !registered.has(command))).toEqual([]);
});
