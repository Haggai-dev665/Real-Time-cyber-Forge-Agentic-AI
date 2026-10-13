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

// ---------------------------------------------------------------------------
// The mobile app against the guarded backend (B03.2c). Every call it makes must
// exist in the backend, and may go out without the session only where the
// backend route is public.

function mobileCalls() {
  const source = read('mobile-app/src/api/endpoints.ts');
  const starts = [...source.matchAll(/\bapi\.(get|post)\b/g)];
  return starts.map((match, index) => {
    const call = source.slice(match.index, index + 1 < starts.length ? starts[index + 1].index : source.length);
    return {
      method: match[1],
      route: call.match(/[`'"](\/[^`'"$?]*)/)[1],
      anonymous: /anonymous:\s*true/.test(call)
    };
  });
}

function backendDefines(method, route) {
  const server = read('backend/src/server.js');
  if (route === '/health') return method === 'get' && /this\.app\.get\('\/health'/.test(server);
  const files = Object.fromEntries([...server.matchAll(/const (\w+) = require\('\.\/routes\/([\w-]+)'\)/g)].map(m => [m[1], m[2]]));
  const mounts = [...server.matchAll(/this\.app\.use\('([^']+)',\s*(\w+)\)/g)]
    .filter(m => files[m[2]] && (route === m[1] || route.startsWith(`${m[1]}/`)))
    .sort((a, b) => b[1].length - a[1].length);
  if (!mounts.length) return false;
  const rest = route.slice(mounts[0][1].length) || '/';
  const routes = read(`backend/src/routes/${files[mounts[0][2]]}.js`);
  return [...routes.matchAll(/^router\.(\w+)\(\s*['"`]([^'"`]*)['"`]/gm)].some(match => match[1] === method && match[2] === rest);
}

test('every backend call the mobile app makes exists in the backend with that method', () => {
  const calls = mobileCalls();
  expect(calls.length).toBeGreaterThan(15);
  expect(calls.filter(call => !backendDefines(call.method, call.route)).map(call => `${call.method} ${call.route}`)).toEqual([]);
});

test('the mobile app sends its session on every call except sign-in, registration and the health check', () => {
  const tokenless = mobileCalls().filter(call => call.anonymous).map(call => call.route).sort();
  expect(tokenless).toEqual(['/api/auth/login', '/api/auth/register', '/health']);
});

test('the mobile app makes requests only through its API client and calls no restricted control route', () => {
  const files = [...sourceFiles('mobile-app/src', ['.ts', '.tsx']), ...sourceFiles('mobile-app/app', ['.ts', '.tsx'])];
  const direct = files.filter(file => /\bfetch\(/.test(read(file))).map(file => file.split(path.sep).join('/'));
  expect(direct).toEqual(['mobile-app/src/api/client.ts']);

  const restricted = /\/api\/(otx\/(start|stop)-polling|distributed\/|audit\/|policy\b)/;
  expect(files.filter(file => restricted.test(read(file)))).toEqual([]);
});

// The live feed (B04): the backend refuses a session token in the stream URL,
// so each client has to authenticate the way the backend accepts.
test('no client puts its session token in the live-feed URL', () => {
  const clients = [
    ...sourceFiles('mobile-app/src', ['.ts', '.tsx']),
    ...sourceFiles('desktop/ui/scripts', ['.js'])
  ];
  const inUrl = clients.filter(file => /[?&]token=/.test(read(file))).map(file => file.split(path.sep).join('/'));
  expect(inUrl).toEqual([]);

  const mobile = read('mobile-app/src/api/sse.ts');
  expect(mobile).toMatch(/headers:\s*token\s*\?\s*\{\s*Authorization:/);

  const desktop = read('desktop/ui/scripts/cf-realtime.js');
  expect(desktop).toContain('/api/stream/ticket');
  expect(desktop).toMatch(/ticket=\$\{encodeURIComponent\(ticket\)\}/);
  expect(desktop).toContain('lastEventId');
});

test('the backend offers the stream ticket the desktop asks for', () => {
  const stream = read('backend/src/routes/stream.js');
  expect(stream).toMatch(/router\.post\('\/ticket', auth,/);
  expect(stream).toContain('req.query.ticket');
  expect(stream).toContain('req.query.lastEventId');
});
