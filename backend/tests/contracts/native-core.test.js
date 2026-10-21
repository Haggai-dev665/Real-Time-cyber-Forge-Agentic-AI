// V2-01: the shared native core and the cyberforge CLI. Behaviour is tested in
// Rust (crates/*/src tests and crates/cyberforge-cli/tests/cli.rs, run with
// `cargo test -p cyberforge-core -p cyberforge-cli` in desktop/src-tauri);
// this suite holds the boundaries the gate can check without a Rust toolchain.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const beforeTests = source => source.split('#[cfg(test)]')[0];

test('one workspace, rooted at the desktop crate, holds the core, the CLI and the MCP server', () => {
  const desktop = read('desktop/src-tauri/Cargo.toml');
  expect(desktop).toMatch(/\[workspace\]\s*\nmembers = \["\.", "\.\.\/\.\.\/crates\/cyberforge-core", "\.\.\/\.\.\/crates\/cyberforge-cli", "\.\.\/\.\.\/crates\/cyberforge-mcp"\]/);
  expect(desktop).toMatch(/^cyberforge-core = \{ path = "\.\.\/\.\.\/crates\/cyberforge-core" \}$/m);
  for (const crate of ['cyberforge-core', 'cyberforge-cli', 'cyberforge-mcp']) {
    expect(read(`crates/${crate}/Cargo.toml`)).toMatch(/^workspace = "\.\.\/\.\.\/desktop\/src-tauri"$/m);
  }
  expect(read('desktop/src-tauri/Cargo.lock')).toMatch(/name = "cyberforge-cli"/);
});

test('the core uses the real credential store on every platform', () => {
  const line = read('crates/cyberforge-core/Cargo.toml').split('\n').find(l => /^keyring\s*=/.test(l));
  for (const feature of ['windows-native', 'apple-native', 'sync-secret-service', 'crypto-rust']) {
    expect(line).toContain(`"${feature}"`);
  }
});

test('the desktop uses the shared credential store, config directory and HTTP client', () => {
  const auth = beforeTests(read('desktop/src-tauri/src/auth.rs'));
  expect(auth).toContain('pub use cyberforge_core::credentials::SecretStore;');
  expect(auth).toContain('const OS_CREDENTIAL_STORE: OsCredentialStore = KeyringStore::new(SERVICE_NAME);');
  expect(auth).toContain('cyberforge_core::credentials::app_config_dir(SERVICE_NAME)');
  expect(auth).not.toMatch(/keyring::Entry/);
  const http = read('desktop/src-tauri/src/http.rs');
  expect(http).toContain('cyberforge_core::http::client(USER_AGENT, timeout)');
  expect(http).toContain('pub const USER_AGENT: &str = "cyber-forge-desktop/1.0";');
});

test('a CLI session is not the desktop session: separate service and config directory', () => {
  const cli = read('crates/cyberforge-cli/src/main.rs');
  const desktopService = read('desktop/src-tauri/src/auth.rs').match(/const SERVICE_NAME: &str = "([^"]+)"/)[1];
  const cliService = cli.match(/const APP_ID: &str = "([^"]+)"/)[1];
  expect(desktopService).toBe('com.cyberforge.console');
  expect(cliService).toBe('com.cyberforge.cli');
  expect(cli).toContain('KeyringStore::new(APP_ID)');
  // A profile's session entry names the profile and its origin.
  expect(read('crates/cyberforge-core/src/profile.rs')).toContain('format!("session:{}:{}", self.name, self.origin)');
});

test('status only reads: no credential write, no backend write', () => {
  const status = beforeTests(read('crates/cyberforge-core/src/status.rs'));
  expect(status).not.toMatch(/store\.(set|delete)\(|\.(post|put|patch|delete)\(/);
  expect(status).toMatch(/client\.get\(profile\.origin\.join\("\/health"\)\)/);
  expect(status).toMatch(/client\.get\(profile\.origin\.join\("\/api\/auth\/profile"\)\)\.bearer_auth\(token\)/);
});

test('the CLI pins its parser, follows the planned exit codes and envelope, and advertises only what works', () => {
  expect(read('crates/cyberforge-cli/Cargo.toml')).toMatch(/^clap = \{ version = "=\d+\.\d+\.\d+"/m);
  const cli = read('crates/cyberforge-cli/src/main.rs');
  const out = read('crates/cyberforge-cli/src/out.rs');
  for (const [name, code] of [['OK', 0], ['FAILURE', 1], ['USAGE', 2], ['AUTH', 3], ['UNAVAILABLE', 4]]) {
    expect(out).toContain(`pub const ${name}: u8 = ${code};`);
  }
  expect(out).toContain('pub const SCHEMA: &str = "cyberforge.cli.v1";');
  for (const key of ['"schema"', '"command"', '"ok"', '"data"', '"error"', '"warnings"', '"correlation_id"']) {
    expect(out).toContain(`${key}:`);
  }
  const variants = name => {
    const start = cli.indexOf(`enum ${name} {`);
    return [...cli.slice(start, cli.indexOf('\n}', start)).matchAll(/^ {4}([A-Z]\w*)/gm)].map(m => m[1]);
  };
  expect(variants('Command')).toEqual(['Version', 'Status', 'Auth', 'Profile', 'Config', 'Broker', 'Models', 'Scan', 'Mcp']);
  expect(variants('McpCommand')).toEqual(['Serve', 'Grant', 'Config']);
  expect(variants('GrantCommand')).toEqual(['Create', 'List', 'Revoke']);
  expect(variants('ModelsCommand')).toEqual(['Status']);
  expect(variants('ScanCommand')).toEqual(['Url']);
  expect(variants('BrokerCommand')).toEqual(['Status', 'Hold']);
  expect(variants('AuthCommand')).toEqual(['Login', 'Status', 'Logout']);
  expect(variants('ProfileCommand')).toEqual(['List', 'Use']);
  expect(variants('ConfigCommand')).toEqual(['List', 'Get', 'Set']);
});

test('sign-in takes no password argument, keeps the token only in the credential store, and says what sign-out cannot do', () => {
  const cli = read('crates/cyberforge-cli/src/main.rs');
  const login = cli.slice(cli.indexOf('    Login {'), cli.indexOf('    },', cli.indexOf('    Login {')));
  expect(login.match(/^\s+(\w+): /gm).map(s => s.trim().replace(':', ''))).toEqual(['email', 'password_stdin']);
  expect(read('crates/cyberforge-cli/Cargo.toml')).toMatch(/^rpassword = "=\d+\.\d+\.\d+"$/m);
  const session = beforeTests(read('crates/cyberforge-core/src/session.rs'));
  expect(session).toMatch(/store\.set\(&entry, &login\.token\)[\s\S]*?store\.get\(&entry\)/);
  expect(session).not.toMatch(/fs::write|File::create/);
  expect(session).toContain('.field("token", &"<hidden>")');
  const auth = read('crates/cyberforge-cli/src/auth.rs');
  expect(auth).toContain('It cannot revoke session tokens yet, so the old token stays valid until it expires.');
  // A profile moved to another origin loses the session kept for the old one.
  expect(read('crates/cyberforge-cli/src/profiles.rs')).toMatch(/old\.origin != profile\.origin[\s\S]*?session::forget\(&ctx\.store\(\), old\)/);
});

test('the operation registry lists only working operations, and the broker offers only its read-only status', () => {
  const registry = beforeTests(read('crates/cyberforge-core/src/operations.rs'));
  const ids = [...registry.matchAll(/^\s+id: "([a-z._]+)",$/gm)].map(m => m[1]);
  expect(ids).toEqual(['version', 'status', 'auth.login', 'auth.status', 'auth.logout', 'profile.list', 'profile.use', 'config.list', 'config.get', 'config.set', 'broker.status', 'models.status', 'scan.url', 'broker.hold', 'mcp.serve', 'mcp.grant.create', 'mcp.grant.list', 'mcp.grant.revoke', 'mcp.config']);
  // the CLI's command tree is checked against this list by its own Rust test
  expect(read('crates/cyberforge-cli/src/main.rs')).toContain('fn the_cli_offers_exactly_the_registry_operations_for_the_cli()');
  const broker = beforeTests(read('crates/cyberforge-core/src/broker.rs'));
  expect(broker).toMatch(/op == "broker\.status"/);
  expect(broker).toContain('"NOT_GRANTED"');
});

describe('MCP server (V2-03)', () => {
  test('its tools are the registry\'s MCP operations, all read-only, and the SDK is pinned', () => {
    const registry = beforeTests(read('crates/cyberforge-core/src/operations.rs'));
    expect(registry).toContain('"status" => Some("cyberforge_status")');
    expect(registry).toContain('"models.status" => Some("cyberforge_model_status")');
    expect(registry).toContain('"scan.url" => Some("cyberforge_analyze_url")');
    const server = beforeTests(read('crates/cyberforge-mcp/src/lib.rs'));
    expect(server).toContain('operations::for_surface(operations::Surface::Mcp)');
    expect(server).toContain('annotations.read_only_hint = Some(true);');
    expect(server).toContain('"additionalProperties": false');
    expect(read('crates/cyberforge-mcp/Cargo.toml')).toMatch(/^rmcp = \{ version = "=\d+\.\d+\.\d+", default-features = false, features = \["server", "transport-io"\] \}$/m);
    // the same shared operations the CLI runs
    expect(server).toContain('ops::model_status(&profile, self.store(), &self.client)');
    expect(server).toContain('ops::analyze_url(&profile, self.store(), &self.client, url)');
    expect(read('crates/cyberforge-cli/src/models.rs')).toContain('ops::model_status(');
    expect(read('crates/cyberforge-cli/src/scan.rs')).toContain('ops::analyze_url(');
  });

  test('the grant is checked on every list and call; the default grant sends nothing the user gives', () => {
    const server = beforeTests(read('crates/cyberforge-mcp/src/lib.rs'));
    const run = server.slice(server.indexOf('async fn run('), server.indexOf('\nfn field('));
    expect(run).toContain('self.grants().active(&self.config.grant_id, now)');
    expect(run).toContain('self.grants().check(&grant.id, op.id, profile.origin.as_str(), account.as_deref(), now)');
    expect(run.indexOf('self.grants().check(')).toBeLessThan(run.indexOf('let outcome = match op.id'));
    const list = server.slice(server.indexOf('async fn list_tools('), server.indexOf('async fn call_tool('));
    expect(list).toContain('self.grants().active(&self.config.grant_id, grants::now_secs())');
    const grants = beforeTests(read('crates/cyberforge-core/src/grants.rs'));
    expect(grants).toContain('filter(|op| op.data_sharing != DataSharing::TargetAddress)');
    expect(grants).toContain('GrantError::AccountChanged');
    expect(grants).toContain('GrantError::OriginChanged');
    // a grant is made only for an account the server confirmed
    const ops = beforeTests(read('crates/cyberforge-core/src/ops.rs'));
    expect(ops).toMatch(/pub async fn approve_mcp_client[\s\S]*?Session::Valid \{ user_id: Some\(id\), \.\. \} => id/);
  });

  test('standard output carries protocol only, the call log holds no arguments, the client configuration no secret', () => {
    for (const file of ['crates/cyberforge-mcp/src/lib.rs', 'crates/cyberforge-cli/src/mcp.rs']) {
      expect({ file, prints: /\bprintln!|\bprint!/.test(beforeTests(read(file))) }).toEqual({ file, prints: false });
    }
    const main = read('crates/cyberforge-cli/src/main.rs');
    expect(main.indexOf('mcp::serve(&ctx, grant, cli.timeout)')).toBeLessThan(main.indexOf('let outcome = match &cli.command'));
    const server = beforeTests(read('crates/cyberforge-mcp/src/lib.rs'));
    expect(server).toContain('json!({ "at": grants::now_secs(), "grant": grant, "tool": tool, "outcome": outcome })');
    const config = beforeTests(read('crates/cyberforge-core/src/grants.rs'));
    expect(config).toContain('"args": ["mcp", "serve", "--stdio", "--grant", grant_id]');
    expect(read('crates/cyberforge-mcp/tests/protocol.rs')).toContain('the session token never reaches the client');
  });

  test('the desktop approves, lists and revokes through the installed CLI with checked values', () => {
    const native = beforeTests(read('desktop/src-tauri/src/integrations.rs'));
    expect(native).toContain('let name_arg = format!("--name={}", name.trim());');
    expect(native).toContain('if !valid_grant_id(&id)');
    expect(native).toContain('envelope_of(&cli, &["mcp", "grant", "list"], 10)');
    expect(native).not.toMatch(/KeyringStore|session::token/);
    for (const command of ['mcp_grants', 'mcp_grant_create', 'mcp_grant_revoke']) {
      expect(read('desktop/src-tauri/src/lib.rs')).toContain(`integrations::${command},`);
      expect(read('desktop/src-tauri/build.rs')).toContain(`"${command}",`);
      expect(read('desktop/src-tauri/capabilities/main.json')).toContain(`"allow-${command.replace(/_/g, '-')}"`);
    }
  });
});

test('the broker trusts the operating-system user at both ends, never a process name', () => {
  const broker = read('crates/cyberforge-core/src/broker.rs');
  expect(broker).toContain('format!("D:P(A;;GA;;;{})", sid)');
  expect(broker).toContain('.first_pipe_instance(first).reject_remote_clients(true)');
  expect(broker).toMatch(/GetNamedPipeClientProcessId[\s\S]*?sid_of_pid\(pid\)\.map\(\|client\| client == sid\)/);
  expect(broker).toMatch(/GetNamedPipeServerProcessId[\s\S]*?Ok\(server\) if server == sid/);
  // The pipe's name carries the user's SID.
  expect(broker).toContain('cyberforge-broker-{}", current_user_sid()?)');
  expect(broker).not.toMatch(/process_name|exe_name|GetModuleFileName/);
});

test('one owner per user runs the device loop and changes device state and the hosts file', () => {
  const lib = read('desktop/src-tauri/src/lib.rs');
  expect(lib.indexOf('crate::ownership::claim()')).toBeGreaterThan(-1);
  expect(lib.indexOf('crate::ownership::claim()')).toBeLessThan(lib.indexOf('crate::device::start_heartbeats('));
  expect(lib).toMatch(/if crate::ownership::is_owner_or_unenforced\(\) \{\s*crate::device::start_heartbeats\(device_state\);\s*\} else \{\s*crate::ownership::take_over_when_free/);
  const guarded = (file, fn) => {
    const source = read(`desktop/src-tauri/src/${file}`);
    const start = source.search(new RegExp(`fn ${fn}[<(]`));
    expect({ fn, start: start >= 0 }).toEqual({ fn, start: true });
    return { fn, guarded: source.slice(start, source.indexOf('\n}', start)).includes('crate::ownership::ensure_owner()?;') };
  };
  for (const fn of ['save', 'device_enroll_this', 'device_claim_code', 'device_heartbeat', 'device_rotate_key']) {
    expect(guarded('device.rs', fn)).toEqual({ fn, guarded: true });
  }
  expect(guarded('outbox.rs', 'update')).toEqual({ fn: 'update', guarded: true });
  for (const fn of ['block_site', 'unblock_site', 'protect_site', 'unprotect_site', 'allow_site', 'unallow_site']) {
    expect(guarded('blocking.rs', fn)).toEqual({ fn, guarded: true });
  }
  expect(read('desktop/src-tauri/src/device.rs')).toContain('"localOwner": crate::ownership::describe(),');
  expect(read('desktop/ui/scripts/pages/devices.js')).toContain("ownerText(s.localOwner)");
});

test('the privacy model and the device protocol live in the core; the desktop keeps only its paths and commands', () => {
  const corePrivacy = read('crates/cyberforge-core/src/privacy.rs');
  expect(corePrivacy).toContain('pub const CONSENT_VERSION: u32 = 1;');
  expect(corePrivacy).toContain('pub fn refusal(feature: Feature) -> String');
  const privacy = beforeTests(read('desktop/src-tauri/src/privacy.rs'));
  expect(privacy).toContain('pub use cyberforge_core::privacy::{describe, load_at, save_at, Feature, Settings};');
  expect(privacy).not.toMatch(/pub struct Settings|pub enum Feature|fn apply\(/);
  const coreDevice = read('crates/cyberforge-core/src/device.rs');
  for (const fn of ['claim_message', 'request_message', 'body_digest', 'key_fingerprint', 'next_seq', 'command_message', 'server_signed', 'rotate_message', 'sign', 'load_at', 'save_at']) {
    expect({ fn, inCore: new RegExp(`pub fn ${fn}\\(`).test(coreDevice) }).toEqual({ fn, inCore: true });
  }
  const device = beforeTests(read('desktop/src-tauri/src/device.rs'));
  expect(device).toContain('pub use cyberforge_core::device::{');
  expect(device).not.toMatch(/fn (claim_message|request_message|server_signed|key_fingerprint)\(/);
});

test('only the owner writes local memory, the saved history copy and the privacy settings', () => {
  const ownership = read('desktop/src-tauri/src/ownership.rs');
  for (const kind of ['local_memory', 'history_copy', 'privacy_settings']) expect(ownership).toContain(`"${kind}"`);
  const memory = read('desktop/src-tauri/src/memory.rs');
  expect(memory).toMatch(/fn persist\(mems: &\[Memory\]\) \{[\s\S]{0,200}if !crate::ownership::is_owner_or_unenforced\(\) \{\s*return;/);
  expect(memory).toMatch(/pub async fn memory_save\([\s\S]{0,300}crate::ownership::ensure_owner\(\)\?;/);
  expect(memory).toMatch(/pub async fn memory_sync\([\s\S]{0,300}crate::ownership::ensure_owner\(\)\?;/);
  expect(memory).toContain('pub fn reload_from_disk()');
  expect(read('desktop/src-tauri/src/lib.rs')).toMatch(/take_over_when_free\(move \|\| \{\s*\/\/[^\n]*\n\s*crate::memory::reload_from_disk\(\);\s*crate::device::start_heartbeats/);
  expect(read('desktop/src-tauri/src/system.rs')).toMatch(/pub fn persist_history_snapshot[\s\S]{0,400}if !crate::ownership::is_owner_or_unenforced\(\) \{\s*return;/);
  const privacy = read('desktop/src-tauri/src/privacy.rs');
  for (const fn of ['privacy_set', 'privacy_clear_history', 'privacy_clear_memory']) {
    expect({ fn, guarded: new RegExp(`pub async fn ${fn}\\([^\\n]*\\{\\n\\s*crate::ownership::ensure_owner\\(\\)\\?;`).test(privacy.replace(/\r\n/g, '\n')) }).toEqual({ fn, guarded: true });
  }
});

test('on macOS and Linux the broker is a flock in a private folder and a socket checked by user ID', () => {
  const broker = read('crates/cyberforge-core/src/broker.rs');
  expect(broker).toContain('libc::flock(lock.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB)');
  expect(broker).toContain('std::fs::DirBuilder::new().mode(0o700).create(dir)');
  expect(broker).toContain('!meta.is_dir() || meta.uid() != uid() || meta.mode() & 0o077 != 0');
  expect(broker).toMatch(/stream\.peer_cred\(\)\.map\(\|c\| c\.uid\(\) == uid\(\)\)/);
  expect(broker).toMatch(/Ok\(cred\) if cred\.uid\(\) == uid\(\) => \{\}/);
  expect(read('crates/cyberforge-core/Cargo.toml')).toMatch(/\[target\.'cfg\(unix\)'\.dependencies\]\s*\nlibc = "0\.2"/);
});

test('the CLI holds the lock only explicitly and never takes it from an owner', () => {
  const broker = read('crates/cyberforge-cli/src/broker.rs');
  expect(broker).toMatch(/Claim::HeldByAnother => \{[\s\S]*?exit::CONFLICT, "HELD_BY_ANOTHER"/);
  expect(broker).toContain('owns: vec![]');
  expect(read('crates/cyberforge-cli/src/out.rs')).toMatch(/pub const CONFLICT: u8 = 7;\s*pub const INTERRUPTED: u8 = 130;/);
});

test('the installers carry the CLI and put it on PATH reversibly, without breaking development builds', () => {
  const overlay = JSON.parse(read('desktop/src-tauri/tauri.cli.conf.json'));
  const base = JSON.parse(read('desktop/src-tauri/tauri.conf.json'));
  expect(overlay.bundle.externalBin).toEqual(['binaries/cyberforge']);
  // Tauri checks a sidecar exists when the app compiles, so only the installer build names it.
  expect(base.bundle.externalBin).toBeUndefined();
  // the overlay's resources replace the base list, so they must keep it
  for (const resource of base.bundle.resources) expect(overlay.bundle.resources).toContain(resource);
  expect(overlay.bundle.resources).toEqual(expect.arrayContaining(['installer/path-add.ps1', 'installer/path-remove.ps1']));
  expect(overlay.bundle.windows.nsis.installerHooks).toBe('installer/hooks.nsh');
  const hooks = read('desktop/src-tauri/installer/hooks.nsh');
  expect(hooks).toMatch(/!macro NSIS_HOOK_POSTINSTALL[\s\S]*?SetEnvironmentVariable\(t "CF_INSTDIR", t "\$INSTDIR"\)[\s\S]*?-File "\$INSTDIR\\installer\\path-add\.ps1"[\s\S]*?!macroend/);
  expect(hooks).toMatch(/!macro NSIS_HOOK_PREUNINSTALL[\s\S]*?-File "\$INSTDIR\\installer\\path-remove\.ps1"[\s\S]*?!macroend/);
  for (const script of ['path-add.ps1', 'path-remove.ps1']) {
    const text = read(`desktop/src-tauri/installer/${script}`);
    expect(text).toContain('$dir = $env:CF_INSTDIR');
    expect(text).toContain("GetValue('Path', '', 'DoNotExpandEnvironmentNames')");
  }
  const wix = read('desktop/src-tauri/installer/cli-path.wxs');
  expect(wix).toMatch(/<Environment [^>]*Name="PATH" Value="\[INSTALLDIR\]"[^>]*Permanent="no"/);
  expect(overlay.bundle.windows.wix.componentRefs).toEqual([wix.match(/<Component Id="(\w+)"/)[1]]);
  expect(overlay.bundle.windows.wix.fragmentPaths).toEqual(['installer/cli-path.wxs']);
  const pkg = JSON.parse(read('desktop/package.json'));
  expect(pkg.scripts.build).toBe('node scripts/build-cli.mjs && tauri build --config src-tauri/tauri.cli.conf.json');
  expect(read('.gitignore')).toContain('/desktop/src-tauri/binaries/');
});

test('scan url removes credentials before the address leaves, using the shared redaction', () => {
  // the CLI and the MCP server both go through the shared operation
  expect(read('crates/cyberforge-cli/src/scan.rs')).toContain('ops::analysis_target(');
  const ops = beforeTests(read('crates/cyberforge-core/src/ops.rs'));
  expect(ops).toContain('use crate::redact::redact_url;');
  expect(ops).toMatch(/let redacted = redact_url\(raw\);/);
  // the address sent is the redacted one
  expect(ops).toMatch(/let \(address, redacted\) = analysis_target\(input\)[\s\S]*?\.json\(&json!\(\{ "url": address \}\)\)/);
  // the desktop uses the same function, re-exported where its callers expect it
  expect(read('desktop/src-tauri/src/system.rs')).toContain('pub(crate) use cyberforge_core::redact::redact_url;');
  expect(read('desktop/src-tauri/src/system.rs')).not.toMatch(/fn looks_like_secret\(/);
  expect(read('crates/cyberforge-core/src/redact.rs')).toContain('include_str!("../../../backend/tests/security/fixtures/redact-url-vectors.json")');
});

