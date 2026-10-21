// The desktop app keeps its tokens in the operating system's credential store
// and in no file (SEC-03, finding F09, B06). The behaviour is tested in Rust
// (`cargo test --lib credential_tests`); these checks guard the two things that
// let it go wrong unnoticed before: the dependency's build features, and a
// token being handed to a page.
const fs = require('fs');
const path = require('path');

const desktop = path.join(__dirname, '..', '..', '..', 'desktop');
const { readPage } = require('../helpers/desktopPage');
const read = relative => readPage(path.join(desktop, relative)).replace(/\r\n/g, '\n');
const describeDesktop = fs.existsSync(desktop) ? describe : describe.skip;

describeDesktop('desktop credential storage', () => {
  test('the keyring crate is built with a real credential store on every platform', () => {
    // With no platform feature the crate is an in-memory stand-in that keeps
    // nothing after exit. That is how tokens came to live only in plaintext.
    const line = read('src-tauri/Cargo.toml').split('\n').find(l => /^keyring\s*=/.test(l));
    expect(line).toBeDefined();
    for (const feature of ['windows-native', 'apple-native', 'sync-secret-service']) {
      expect(line).toContain(`"${feature}"`);
    }
    const locked = read('src-tauri/Cargo.lock').match(/name = "keyring"[\s\S]*?\n\n/);
    expect(locked[0]).toMatch(/windows-sys/);
    expect(locked[0]).toMatch(/security-framework/);
  });

  test('the storage module writes no token to a file', () => {
    const source = read('src-tauri/src/auth.rs').split('#[cfg(test)]')[0];
    // the only things written to disk: the session file without its token, and the emptied import file
    expect(source).not.toMatch(/insert\("token"/);
    expect(source).not.toMatch(/"active": token/);
    expect(source).not.toMatch(/file_set\(/);
    expect(source).toMatch(/fn save_secret[\s\S]*?self\.secrets\.get\(name\)/);
  });

  test('every sign-in path reports whether the session was saved', () => {
    const commands = read('src-tauri/src/commands.rs');
    const agent = read('src-tauri/src/agent.rs');
    expect((commands.match(/note_session_storage\(&mut result, &kept\)/g) || []).length).toBe(2);
    expect(agent).toMatch(/note_session_storage\(&mut result, &kept\)/);
    for (const page of ['ui/pages/login.html', 'ui/pages/register.html']) {
      expect(read(page)).toMatch(/sessionSaved===false/);
    }
  });

  test('the saved AI token is never sent to a page', () => {
    const command = read('src-tauri/src/ml.rs').match(/pub async fn hf_token_get\(\)[\s\S]*?\n}\n/);
    expect(command).not.toBeNull();
    expect(command[0]).not.toMatch(/"token":/);
    expect(command[0]).toMatch(/"masked": masked/);
    const settings = read('ui/scripts/cf-header.js');
    expect(settings).not.toMatch(/inp\.value=r\.token/);
    expect(settings).not.toMatch(/r\.masked\|\|r\.token/);
  });

  test('Settings shows whether the credential store works', () => {
    expect(read('src-tauri/src/lib.rs')).toMatch(/commands::credential_storage_status/);
    expect(read('ui/scripts/cf-header.js')).toMatch(/inv\('credential_storage_status'\)/);
  });
});

describeDesktop('browser-history addresses', () => {
  test('credentials are removed when history is collected, before anything else uses it', () => {
    const source = read('src-tauri/src/system.rs');
    const assemble = source.match(/fn assemble_history\([\s\S]*?\n}\n/);
    expect(assemble).not.toBeNull();
    const redaction = assemble[0].indexOf('.map(redact_url)');
    expect(redaction).toBeGreaterThan(-1);
    // before the de-duplication and before the snapshot is built
    expect(redaction).toBeLessThan(assemble[0].indexOf('items.retain('));
    expect(redaction).toBeLessThan(assemble[0].indexOf('json!({'));
  });
});
