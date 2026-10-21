// What the desktop sends follows the user's Privacy choices (SEC-07). Every
// desktop command that sends to the network either checks a privacy control in
// Rust (privacy::require) or is on the reviewed list below with the reason it
// needs no separate consent. A new sending command fails here until someone
// decides which.
const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '../../../desktop/src-tauri/src');

// command → the control it must check
const GATED = {
  scan_url: 'CloudScanning',
  ml_classify_url: 'CloudScanning',
  ml_detect_dga: 'CloudScanning',
  ml_ioc_scan: 'CloudScanning',
  ml_url_enrich: 'CloudScanning',
  ml_security_chat: 'LlmProcessing',
  memory_sync: 'Sync',
  browser_intel_report: 'Sync'
};

// commands that send and need no separate privacy control, with the reason
const REVIEWED = {
  auth_login: 'signing in is the user\'s explicit act', auth_register: 'creating an account', auth_logout: 'signing out', auth_google: 'signing in with Google',
  agent_alerts: 'reads the account\'s own alerts', otx_fetch: 'reads public threat intelligence; sends no user data', ml_status: 'service health only',
  list_allowed: 'detected only because the public IP lookup is next to it; sends nothing about the user',
  agents_call: 'agent definitions the user creates and runs on the account, for that purpose',
  account_call: 'the user\'s own export and deletion of their account data, each an explicit act',
  finding_state: 'the user\'s own decision about one of their findings (acknowledge, resolve, …), an explicit act',
  finding_exception: 'the user\'s own exception for one of their findings, with a reason and an expiry, an explicit act',
  alert_state: 'the user\'s own decision about one of their agent alerts (acknowledge, escalate, …), an explicit act',
  device_enroll_this: 'enrolling is the user\'s explicit act', device_enrollment_create: 'device management', device_approve: 'device management',
  device_rename: 'device management', device_revoke: 'device management', devices_list: 'device management',
  device_command_send: 'device management', device_commands_list: 'device management',
  policy_create: 'policy management', policy_update: 'policy management', policy_delete: 'policy management', policy_list: 'policy management',
  policy_meta: 'policy management', policy_stats: 'policy management', policy_response_log: 'policy management', policy_evaluate: 'sends numeric risk metrics only'
};

// local reads of sensitive data, gated too though they send nothing
const LOCAL_GATED = { get_browser_history: 'HistoryAccess', get_collected_history: 'HistoryAccess', get_active_urls: 'ActiveTab' };

function commands() {
  const found = {};
  for (const file of fs.readdirSync(src).filter(f => f.endsWith('.rs'))) {
    const text = fs.readFileSync(path.join(src, file), 'utf8').replace(/\r\n/g, '\n');
    for (const part of text.split('#[tauri::command]').slice(1)) {
      const name = (part.match(/pub async fn (\w+)/) || [])[1];
      if (!name) continue;
      // the function itself: up to its closing brace at the start of a line
      const start = part.indexOf('pub async fn');
      const end = part.indexOf('\n}', start);
      const body = part.slice(start, end < 0 ? undefined : end);
      found[name] = {
        file,
        sends: /\.post\(|\.get\(format!|\.patch\(|\.put\(|\.delete\(|ml_post\(|ml_get\(|deepseek_chat\(|\.send\(\)/.test(body),
        gate: (body.match(/privacy::require\(crate::privacy::Feature::(\w+)\)/) || [])[1] || null
      };
    }
  }
  return found;
}

test('every command that sends checks its privacy control, or is reviewed as needing none', () => {
  const all = commands();
  const sending = Object.entries(all).filter(([, c]) => c.sends).map(([name]) => name);
  expect(sending.length).toBeGreaterThan(20);
  const unaccounted = sending.filter(name => !GATED[name] && !REVIEWED[name]);
  expect(unaccounted).toEqual([]);
  for (const [name, feature] of Object.entries(GATED)) {
    expect({ name, gate: all[name] && all[name].gate }).toEqual({ name, gate: feature });
  }
});

test('reading browser history and the active tab checks its control too', () => {
  const all = commands();
  for (const [name, feature] of Object.entries(LOCAL_GATED)) {
    expect({ name, gate: all[name] && all[name].gate }).toEqual({ name, gate: feature });
  }
  const system = fs.readFileSync(path.join(src, 'system.rs'), 'utf8');
  // the background collector reads nothing and saves nothing without consent
  expect(system).toMatch(/pub async fn refresh_history[\s\S]{0,300}privacy::require\(crate::privacy::Feature::HistoryAccess\)/);
  expect(system).toMatch(/pub fn persist_history_snapshot[\s\S]{0,200}privacy::allowed\(crate::privacy::Feature::HistoryAccess\)/);
});

test('a scanned address is redacted before it leaves the computer', () => {
  const agent = fs.readFileSync(path.join(src, 'agent.rs'), 'utf8');
  expect(agent).toMatch(/pub async fn scan_url[\s\S]{0,900}let url = crate::system::redact_url\(&url\);[\s\S]{0,600}"url": url/);
});

test('memory sync uploads only the signed-in account\'s own memories, and marks only what went up', () => {
  const memory = fs.readFileSync(path.join(src, 'memory.rs'), 'utf8');
  expect(memory).toMatch(/upload_candidates\(&store, &uid\)/);
  expect(memory).toMatch(/filter\(\|m\| pushed_ids\.contains\(&m\.id\)\)/);
});
