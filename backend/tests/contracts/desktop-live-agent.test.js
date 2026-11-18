// The Live Agent screen (desktop/src-tauri/src/live_browse.rs): the agent checks a page in
// its own browser while the user watches. These checks keep its limits in place: what it
// may do to a page, where it may go, and what the screen may write as HTML. The browser
// itself is exercised by the Rust test `the_agent_catches_a_deceptive_page_in_a_real_browser`
// (cargo test -p cyberforge-console live_browse -- --ignored).
const fs = require('fs');
const path = require('path');

const desktop = path.resolve(__dirname, '../../../desktop');
const read = relative => fs.readFileSync(path.join(desktop, relative), 'utf8').replace(/\r\n/g, '\n');
const rust = read('src-tauri/src/live_browse.rs');
const code = rust.split('#[cfg(test)]')[0];

test('the agent never types, presses keys or submits a form itself', () => {
  expect(code).not.toMatch(/Input\.insertText|Input\.dispatchKeyEvent|keyDown|\.submit\(|requestSubmit/);
  // the only input it sends is the mouse
  const inputs = [...code.matchAll(/"Input\.(\w+)"/g)].map(m => m[1]);
  expect([...new Set(inputs)]).toEqual(['dispatchMouseEvent']);
  // buttons inside a form that asks for a password are never chosen
  expect(code).toMatch(/\.filter\(\|b\| b\["inPasswordForm"\] != true/);
});

test('once the page has loaded, a click cannot take the browser anywhere: the navigation is stopped and recorded', () => {
  expect(code).toMatch(/if main && seen\.intercepting\.load\(Ordering::SeqCst\) \{\s*lock\(&seen\.stopped\)\.push\(url\);\s*cdp\.notify\("Fetch\.failRequest"/);
  expect(code).toContain('seen.intercepting.store(true, Ordering::SeqCst);');
  expect(code).toContain('"Fetch.enable", json!({ "patterns": [{ "resourceType": "Document", "requestStage": "Request" }] })');
  expect(code).toContain('"Browser.setDownloadBehavior", json!({ "behavior": "deny" })');
  expect(code).toContain('window.open=function(u){');
  expect(code).toContain('"Page.handleJavaScriptDialog", json!({ "accept": false })');
});

test('it uses a new, empty profile that is deleted afterwards, and the browser listens on this computer only', () => {
  expect(code).toContain('std::env::temp_dir().join(format!("cyberforge-agent-browser-{}"');
  expect(code).toContain('.arg(format!("--user-data-dir={}", profile.display()))');
  expect(code).toContain('"--remote-debugging-address=127.0.0.1"');
  expect(code).toMatch(/async fn close\(&mut self\) \{\s*let _ = self\.child\.kill\(\)\.await;[\s\S]{0,200}remove_dir_all\(&self\.profile\)/);
  expect(code).toContain('const RUN_LIMIT: Duration = Duration::from_secs(120);');
});

test('the address is cleaned of sign-in codes, and local-network addresses are refused before anything starts', () => {
  const start = code.split('pub async fn live_browse_start')[1].split('pub async fn live_browse_stop')[0];
  const order = ['crate::system::redact_url(&raw)', 'if local_host(&host)', 'tokio::net::lookup_host', 'private_ip(a.ip())', 'tauri::async_runtime::spawn(run_live('];
  const at = order.map(needle => start.indexOf(needle));
  expect(at.every(i => i >= 0)).toBe(true);
  expect(at).toEqual([...at].sort((a, b) => a - b));
});

test('the history read behind "follow my browsing" needs the history permission', () => {
  expect(code).toMatch(/pub async fn live_browse_recent[\s\S]{0,200}crate::privacy::require\(crate::privacy::Feature::HistoryAccess\)\?/);
});

test('the screen writes nothing from the page as HTML, and stops the browser when it is left', () => {
  const page = read('ui/scripts/pages/live-browser.js');
  expect(page).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  expect(page).toContain("frame.src='data:image/jpeg;base64,'+p.data");
  expect(page).toContain("window.addEventListener('pagehide',stop);");
  // events from an older run are ignored
  expect(page).toContain("if(!p||typeof p!=='object'||!(p.run>=run)) return;");
});

test('the screen is in the sidebar, the permission set, and the build manifest', () => {
  expect(read('ui/scripts/cf-sidebar.js')).toContain("['livebrowser','Live Agent','live-browser.html',I.live]");
  const main = JSON.parse(read('src-tauri/capabilities/main.json')).permissions;
  for (const p of ['allow-live-browse-start', 'allow-live-browse-stop', 'allow-live-browse-recent']) expect(main).toContain(p);
  expect(read('src-tauri/src/lib.rs')).toContain('live_browse::live_browse_start,');
});
