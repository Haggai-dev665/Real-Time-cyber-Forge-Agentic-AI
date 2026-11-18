// SEC-07 on the phone: what the app collects and sends is behind its own
// privacy control, checked by the code that collects or sends.
const fs = require('fs');
const path = require('path');

const repo = path.join(__dirname, '..', '..', '..');
const read = file => fs.readFileSync(path.join(repo, file), 'utf8');

function sourceFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(path.join(repo, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...sourceFiles(rel));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(rel);
  }
  return out;
}
const files = [...sourceFiles('mobile-app/src'), ...sourceFiles('mobile-app/app')];

// Endpoints that send what the user did or asked, and the one file allowed to call each.
const SENDING = {
  pushNetworkCapture: 'mobile-app/src/context/VpnContext.tsx',
  securityChat: 'mobile-app/src/sections/AssistantSection.tsx',
  orchestratorAnalyze: 'mobile-app/src/sections/ScanSection.tsx'
};

test('each sending endpoint is called from one place only', () => {
  for (const [name, owner] of Object.entries(SENDING)) {
    const callers = files.filter(file => file !== 'mobile-app/src/api/endpoints.ts' && read(file).includes(`endpoints.${name}(`));
    expect({ name, callers }).toEqual({ name, callers: [owner] });
  }
});

test('captures are sent only while sync is on, and turning sync off drops the queue', () => {
  const vpn = read('mobile-app/src/context/VpnContext.tsx');
  const flush = vpn.slice(vpn.indexOf('const flush = useCallback'), vpn.indexOf('endpoints.pushNetworkCapture('));
  expect(flush).toMatch(/!allowsNow\('capture_sync'\)\)\s*\{\s*queue\.current = \[\];\s*return;/);
  expect(vpn).toMatch(/if \(!syncing\) queue\.current = \[\];/);
});

test('capture starts only when allowed, and stops when the control is turned off', () => {
  const vpn = read('mobile-app/src/context/VpnContext.tsx');
  const start = vpn.slice(vpn.indexOf('const start = useCallback'), vpn.indexOf('vpn.prepare()'));
  expect(start).toMatch(/if \(!allowsNow\('capture'\)\)/);
  expect(vpn).toMatch(/if \(!captureAllowed && privacy\.ready[^\n]*void vpn\.stop\(\)/);
});

test('addresses are redacted before they leave the phone, and the native engine gets no session token', () => {
  const vpn = read('mobile-app/src/context/VpnContext.tsx');
  expect(vpn).toMatch(/url: f\.url \? redactUrl\(f\.url\) : f\.url,/);
  expect(vpn).toMatch(/vpn\.start\(\{ backendUrl: API_BASE_URL, token: null, userId: null \}\)/);
  expect(vpn).not.toMatch(/getItem\(TOKEN_KEY\)/);
});

test('the assistant sends nothing while its control is off, streamed or not', () => {
  const assistant = read('mobile-app/src/sections/AssistantSection.tsx');
  const send = assistant.slice(assistant.indexOf('const send = async'), assistant.indexOf('endpoints.securityChat('));
  expect(send).toMatch(/if \(!privacy\.allowsNow\('llm_processing'\)\) return;/);
  // the streamed question goes out after the same check, and only from the assistant
  const stream = assistant.slice(assistant.indexOf('const send = async'), assistant.indexOf('openChatStream('));
  expect(stream).toMatch(/if \(!privacy\.allowsNow\('llm_processing'\)\) return;/);
  const callers = files.filter(file => file !== 'mobile-app/src/api/sse.ts' && read(file).includes('openChatStream('));
  expect(callers).toEqual(['mobile-app/src/sections/AssistantSection.tsx']);
});

test('an address is sent for scanning only while cloud scanning is on, and only when the user asks', () => {
  const scan = read('mobile-app/src/sections/ScanSection.tsx');
  const run = scan.slice(scan.indexOf('const scan = async'), scan.indexOf('endpoints.orchestratorAnalyze('));
  expect(run).toMatch(/if \(!privacy\.allowsNow\('cloud_scanning'\)\) return;/);
  // a link only fills the field: the scan runs from the button or the keyboard's Go
  expect(scan).not.toMatch(/useEffect\([^)]*scan\(/);
});

test('waiting captures are kept redacted, dropped when sync is turned off, and removed at sign-out', () => {
  const vpn = read('mobile-app/src/context/VpnContext.tsx');
  // only records made by toRecord (which redacts) enter the outbox
  expect(vpn).toMatch(/outbox\.current\.push\(\.\.\.queue\.current\.splice\(0, queue\.current\.length\)\.map\(toRecord\)\)/);
  expect(vpn).toMatch(/if \(!syncing && outbox\.current\.length\) \{\s*outbox\.current = \[\];/);
  // sign-out removes what the phone kept for the account
  const auth = read('mobile-app/src/context/AuthContext.tsx');
  expect(auth).toMatch(/leaving \? clearAccount\(leaving\)/);
  // kept data is keyed by account
  expect(read('mobile-app/src/api/userStore.ts')).toMatch(/const keyOf = \(userId: string, name: string\) => `\$\{PREFIX\}\$\{userId\}:\$\{name\}`;/);
});

test('every control is off until the user decides, and a new consent version asks again', () => {
  const privacy = read('mobile-app/src/context/PrivacyContext.tsx');
  expect(privacy).toMatch(/if \(stored\.consentVersion !== CONSENT_VERSION \|\| !stored\.decidedAt\) return \{ \.\.\.OFF \};/);
  expect(privacy).toMatch(/const OFF: Record<PrivacyFeature, boolean> = \{ capture: false, capture_sync: false, cloud_scanning: false, llm_processing: false \};/);
  const ids = [...privacy.matchAll(/id: '([a-z_]+)'/g)].map(m => m[1]);
  expect(ids.sort()).toEqual(['capture', 'capture_sync', 'cloud_scanning', 'llm_processing']);
  // adding a control raised the consent version, so earlier choices do not carry over
  expect(privacy).toMatch(/export const CONSENT_VERSION = 2;/);
});

test('Settings offers export, deletion by kind and account deletion, against the backend routes', () => {
  const endpoints = read('mobile-app/src/api/endpoints.ts');
  for (const route of ["'/api/v1/me/export'", '/api/v1/me/data?scope=', "'/api/v1/me/delete-account'", '/api/v1/account-deletions/']) {
    expect(endpoints).toContain(route);
  }
  const settings = read('mobile-app/src/sections/SettingsSection.tsx');
  for (const call of ['endpoints.accountExport()', 'endpoints.accountDataDelete(scope)', 'endpoints.accountDelete(typed.trim())']) expect(settings).toContain(call);
  // the account is deleted only once the typed address matches
  expect(settings).toMatch(/const deleteAccount = async \(\) => \{\s*if \(!emailMatches\) return;/);
});
