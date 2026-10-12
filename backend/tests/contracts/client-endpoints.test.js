const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..', '..', '..');
const read = file => fs.readFileSync(path.join(repoRoot, file), 'utf8');

function sourceFiles(directory, extensions) {
  const absolute = path.join(repoRoot, directory);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap(entry => {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) return ['node_modules', 'vendor', 'target', 'gen'].includes(entry.name) ? [] : sourceFiles(relative, extensions);
    return extensions.includes(path.extname(entry.name)) ? [relative] : [];
  });
}

// Lines that carry a deployment host as a value, ignoring comments.
function hostLiterals(files) {
  return files.flatMap(file => read(file).split(/\r?\n/)
    .filter(line => /https?:\/\/[a-z0-9.-]*herokuapp\.com/i.test(line) && !/^\s*(\/\/|\*|\/\*|#)/.test(line))
    .map(line => `${file.replace(/\\/g, '/')}: ${line.trim()}`));
}

const DEAD_HOST = 'cyberforge-ddd97655464f';

test('the retired backend address is gone from client, backend and manifest sources', () => {
  const files = [
    ...sourceFiles('backend/src', ['.js']),
    ...sourceFiles('desktop/src-tauri/src', ['.rs']),
    ...sourceFiles('desktop/ui', ['.js', '.html']),
    ...sourceFiles('mobile-app/src', ['.ts', '.tsx']),
    'desktop/src-tauri/tauri.conf.json', 'mobile-app/app.json', 'app.json', 'ml-services/deploy_hf_space.sh'
  ];
  expect(files.length).toBeGreaterThan(100);
  expect(files.filter(file => read(file).includes(DEAD_HOST))).toEqual([]);
});

test('the desktop has one default backend address, overridable at launch, and the UI asks the native layer for it', () => {
  const literals = hostLiterals(sourceFiles('desktop/src-tauri/src', ['.rs']));
  expect(literals).toHaveLength(1);
  expect(literals[0]).toMatch(/^desktop\/src-tauri\/src\/state\.rs: pub const DEFAULT_BACKEND_URL: &str = "https:\/\/[a-z0-9-]+\.herokuapp\.com";$/);

  const state = read('desktop/src-tauri/src/state.rs');
  expect(state).toContain('std::env::var("CYBERFORGE_BACKEND_URL")');
  expect(state).toContain('backend_url: backend_url(),');
  expect(read('desktop/src-tauri/src/system.rs')).toContain('crate::state::backend_url()');
  expect(read('desktop/src-tauri/src/commands.rs')).toMatch(/#\[tauri::command\]\s*pub async fn get_backend_url\(/);
  expect(read('desktop/src-tauri/src/lib.rs')).toContain('commands::get_backend_url,');

  expect(hostLiterals(sourceFiles('desktop/ui', ['.js', '.html']))).toEqual([]);
  expect(read('desktop/ui/scripts/cyberforge-shared.js')).toContain("CF.invoke('get_backend_url')");
  const realtime = read('desktop/ui/scripts/cf-realtime.js');
  expect(realtime).toContain('await CF.backendUrl()');
  expect(realtime).not.toContain('API_BASE');
});

test('the mobile app takes its backend address from configuration only', () => {
  expect(hostLiterals(sourceFiles('mobile-app/src', ['.ts', '.tsx']))).toEqual([]);
  const config = read('mobile-app/src/api/config.ts');
  expect(config).toContain('process.env.EXPO_PUBLIC_API_BASE_URL');
  expect(config).toContain('apiBaseUrl');
  expect(JSON.parse(read('mobile-app/app.json')).expo.extra.apiBaseUrl).toMatch(/^https:\/\/[a-z0-9.-]+$/);
});

test('the backend holds no deployment address; web origins come from ALLOWED_ORIGINS', () => {
  expect(hostLiterals(sourceFiles('backend/src', ['.js']))).toEqual([]);
  const server = read('backend/src/server.js');
  expect(server).toContain('process.env.ALLOWED_ORIGINS');
  expect(server).not.toContain('productionOrigins');
});

test('every client default and the deploy manifest name the same backend', () => {
  const desktop = read('desktop/src-tauri/src/state.rs').match(/DEFAULT_BACKEND_URL: &str = "([^"]+)"/)[1];
  const manifest = JSON.parse(read('app.json'));
  expect(JSON.parse(read('mobile-app/app.json')).expo.extra.apiBaseUrl).toBe(desktop);
  expect(JSON.parse(read('desktop/src-tauri/tauri.conf.json')).bundle.homepage).toBe(desktop);
  expect(manifest.env.ALLOWED_ORIGINS.value).toBe(desktop);
  expect(manifest.website).toBe(`${desktop}/`);
});
