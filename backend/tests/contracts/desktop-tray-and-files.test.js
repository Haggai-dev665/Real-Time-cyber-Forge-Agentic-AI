// The desktop's tray, background protection, file scanning and command palette.
// The Rust side is tested in desktop/src-tauri (file_scan.rs tests); these checks
// keep the rules that span files: what may run while the window is hidden, what
// is sent before the user allowed it, and what the pages may write as HTML.
const fs = require('fs');
const path = require('path');

const desktop = path.resolve(__dirname, '../../../desktop');
const read = relative => fs.readFileSync(path.join(desktop, relative), 'utf8').replace(/\r\n/g, '\n');

describe('the tray', () => {
  const lib = read('src-tauri/src/lib.rs');
  const tray = read('src-tauri/src/tray.rs');

  test('closing the window hides it only when the tray icon exists and the user kept the setting on', () => {
    expect(lib).toMatch(/CloseRequested[\s\S]{0,200}crate::tray::ready\(\) && crate::tray::close_to_tray\(\)[\s\S]{0,80}api\.prevent_close\(\)/);
  });

  test('the window starts hidden only for a background start with the tray icon present', () => {
    expect(JSON.parse(read('src-tauri/tauri.conf.json')).app.windows[0].visible).toBe(false);
    expect(lib).toMatch(/if !\(crate::tray::started_in_background\(\) && crate::tray::ready\(\)\) \{\s*let _ = window\.show\(\);/);
  });

  test('the menu can always bring the window back and quit', () => {
    for (const id of ['"open"', '"scan-file"', '"close-to-tray"', '"autostart"', '"quit"']) expect(tray).toContain(id);
    expect(tray).toContain('"quit" => app.exit(0)');
  });

  test('start with Windows writes only the current user\'s Run entry, with the background flag', () => {
    expect(tray).toContain('const RUN_KEY: &str = r"HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";');
    expect(tray).toMatch(/format!\("\\"\{\}\\" \{\}", exe\.display\(\), BACKGROUND_FLAG\)/);
    expect(tray).not.toMatch(/HKLM/);
  });

  test('uninstalling removes the start-up entry', () => {
    expect(read('src-tauri/installer/hooks.nsh')).toMatch(/!macro NSIS_HOOK_PREUNINSTALL[\s\S]*DeleteRegValue HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Run" "CyberForge"[\s\S]*!macroend/);
  });
});

describe('background protection while the window is hidden', () => {
  const tray = read('src-tauri/src/tray.rs');
  const watcher = tray.split('pub fn start_watcher')[1];

  test('it runs only while the window is not on screen, through the same privacy-checked commands', () => {
    expect(watcher).toMatch(/if !main_hidden\(&app\) \{\s*continue;/);
    // get_active_urls refuses without the active-tab permission (agent.rs)
    expect(read('src-tauri/src/agent.rs')).toMatch(/pub async fn get_active_urls[\s\S]{0,120}privacy::require\(crate::privacy::Feature::ActiveTab\)\?/);
    expect(watcher).toContain('crate::agent::get_active_urls(state.clone())');
  });

  test('it scans on this computer only (no deep scan) and at most once a minute per address', () => {
    expect(watcher).toContain('crate::agent::scan_url(app.clone(), state.clone(), url.clone(), None, None)');
    expect(watcher).toContain('last_at.elapsed() < Duration::from_secs(60)');
  });

  test('its alert uses the usual bar and says that only the address was checked', () => {
    const helper = read('src-tauri/src/agent.rs').split('pub(crate) async fn alert_from_background')[1];
    expect(helper).toContain('risk < alert_floor(host_reputation(&host))');
    expect(helper).toContain('Only the address was checked, not the page.');
    expect(helper).toContain('Duration::from_secs(600)');
  });

  test('the telemetry broadcast does no work while the window is hidden', () => {
    expect(read('src-tauri/src/lib.rs')).toMatch(/loop \{[\s\S]{0,200}if crate::tray::main_hidden\(&handle\) \{[\s\S]{0,120}continue;/);
  });
});

describe('scanning a file', () => {
  const rust = read('src-tauri/src/file_scan.rs');

  test('nothing leaves the computer before the cloud-scanning permission and a sign-in', () => {
    const consent = rust.indexOf('crate::privacy::require(crate::privacy::Feature::CloudScanning)');
    const signedIn = rust.indexOf('if !signed_in');
    const send = rust.indexOf('.post(format!("{base}/api/sandbox/analyze/file"))');
    expect(consent).toBeGreaterThan(0);
    expect(signedIn).toBeGreaterThan(consent);
    expect(send).toBeGreaterThan(signedIn);
  });

  test('the size limit is the backend\'s', () => {
    const backend = fs.readFileSync(path.resolve(__dirname, '../../src/routes/sandbox.js'), 'utf8');
    expect(backend).toContain('const MAX_UPLOAD_MB = 25;');
    expect(rust).toContain('pub const MAX_FILE_BYTES: usize = 25 * 1024 * 1024;');
    expect(read('ui/scripts/pages/analyzer.js')).toContain('file.size>25*1024*1024');
  });

  test('the page sends the bytes as the raw body and says the file was not run', () => {
    const page = read('ui/scripts/pages/analyzer.js');
    expect(page).toContain("CF.invoke('scan_file',bytes,{headers:{'x-cf-file-name':encodeURIComponent(file.name)}})");
    expect(page).toContain('The file was parsed on the server, not run.');
    expect(read('ui/scripts/cyberforge-shared.js')).toContain('T.core.invoke(cmd, args||{}, options)');
  });

  test('pages receive dropped files, and a page that does not take them stops the drop', () => {
    expect(JSON.parse(read('src-tauri/tauri.conf.json')).app.windows[0].dragDropEnabled).toBe(false);
    const palette = read('ui/scripts/cf-palette.js');
    expect(palette).toMatch(/if\(!onAnalyzer\)\{[\s\S]{0,400}addEventListener\('drop',function\(e\)\{ if\(!isFiles\(e\)\) return; e\.preventDefault\(\);/);
    expect(read('ui/scripts/pages/analyzer.js')).toMatch(/document\.addEventListener\('drop',function\(e\)\{ if\(!hasFiles\(e\)\) return; e\.preventDefault\(\);/);
  });
});

describe('the command palette', () => {
  const palette = read('ui/scripts/cf-palette.js');

  test('it builds its rows from DOM nodes and text, never HTML strings', () => {
    expect(palette).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  });

  test('every workspace page loads it right after the sidebar', () => {
    const pages = fs.readdirSync(path.join(desktop, 'ui/pages')).filter(name => name.endsWith('.html'));
    const shells = pages.filter(name => read(`ui/pages/${name}`).includes('cf-sidebar.js'));
    expect(shells.length).toBeGreaterThanOrEqual(18);
    for (const name of shells) {
      expect(read(`ui/pages/${name}`)).toContain('<script src="../scripts/cf-sidebar.js"></script>\n<script src="../scripts/cf-palette.js"></script>');
    }
  });

  test('Ctrl+K opens the palette; the domain lookup moved to "/" outside text fields', () => {
    expect(palette).toMatch(/\(e\.ctrlKey\|\|e\.metaKey\)&&!e\.altKey&&\(e\.key==='k'\|\|e\.key==='K'\)/);
    const header = read('ui/scripts/cf-header.js');
    expect(header).not.toMatch(/\(e\.ctrlKey\|\|e\.metaKey\)&&\(e\.key==='k'/);
    expect(header).toContain("if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName||'')");
  });

  test('an address typed into it is analysed on the Analyze page, encoded', () => {
    expect(palette).toContain("go('analyzer.html?q='+encodeURIComponent(q))");
    expect(read('ui/scripts/pages/analyzer.js')).toContain("input.value=q.slice(0,2048)");
  });
});
