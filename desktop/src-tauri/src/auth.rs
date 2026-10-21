//! Where the desktop app keeps its credentials.
//!
//! **Secrets** (the backend session token and the Hugging Face token) are kept
//! in the operating system's credential store and nowhere else: Windows
//! Credential Manager, the macOS Keychain, or the Secret Service on Linux.
//! Every write is read back before it is called saved.
//!
//! **Not secrets** (the cached user profile) stay in `session.json` under the
//! app-config directory, so a session can be restored without a network call.
//!
//! Older builds wrote both tokens into plaintext files, and wrote nothing to the
//! credential store at all: the `keyring` crate was built without a platform
//! feature, which makes it an in-memory stand-in that forgets everything on
//! exit. Those plaintext copies are moved into the credential store the first
//! time they are read, and removed from the files once the move is verified.
//!
//! When the credential store does not work, nothing is written in its place.
//! The session lasts until the app closes, and the caller is told why.

use serde_json::{json, Value};
use std::path::PathBuf;

const SERVICE_NAME: &str = "com.cyberforge.console";
const AUTH_TOKEN: &str = "auth_token";
const HF_TOKEN: &str = "hf_token";
const DEVICE_KEY: &str = "device_key";
const DEVICE_KEY_NEXT: &str = "device_key_next";

pub use cyberforge_core::credentials::SecretStore;
use cyberforge_core::credentials::KeyringStore;

/// The operating system's credential store, under the desktop app's service
/// name. The implementation is shared with the CLI (`cyberforge_core`), which
/// uses its own service name, so neither reads the other's session.
pub type OsCredentialStore = KeyringStore;
const OS_CREDENTIAL_STORE: OsCredentialStore = KeyringStore::new(SERVICE_NAME);

/// `%APPDATA%\com.cyberforge.console` (Win) / `~/Library/Application Support/…`
/// (mac) / `~/.config/…` (Linux) — matches Tauri's app-config dir.
pub(crate) fn config_dir() -> Option<PathBuf> {
    cyberforge_core::credentials::app_config_dir(SERVICE_NAME)
}

/// Where the Hugging Face token in use came from.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum HfSource {
    Environment,
    CredentialStore,
    /// A file a developer placed beside the app or named in `HF_CONFIG`. It is
    /// read and left alone, like the environment variable.
    OverrideFile,
    /// A plaintext copy in the app's own directory that could not be moved,
    /// because the credential store is not working.
    PlaintextFile,
    None,
}

impl HfSource {
    pub fn label(self) -> &'static str {
        match self {
            HfSource::Environment => "environment variable",
            HfSource::CredentialStore => "system credential store",
            HfSource::OverrideFile => "override file",
            HfSource::PlaintextFile => "plaintext file (the credential store is not working)",
            HfSource::None => "none",
        }
    }
}

/// The app's credentials: a directory for what is not secret, and a store for
/// what is. Generic over the store so the rules can be tested without touching
/// the real credential store.
pub struct Vault<S: SecretStore> {
    dir: Option<PathBuf>,
    secrets: S,
}

impl<S: SecretStore> Vault<S> {
    // ── the credential store ──

    /// Save a secret and read it back. A store that accepts the value and then
    /// does not return it has not saved it.
    fn save_secret(&self, name: &str, secret: &str) -> Result<(), String> {
        self.secrets.set(name, secret)?;
        match self.secrets.get(name)? {
            Some(kept) if kept == secret => Ok(()),
            _ => Err("the system credential store accepted the value and did not keep it".into()),
        }
    }

    /// Whether the credential store can keep a value, checked with a throwaway entry.
    pub fn check_secure_storage(&self) -> Result<(), String> {
        const PROBE: &str = "storage_check";
        let outcome = self.save_secret(PROBE, "ok");
        let _ = self.secrets.delete(PROBE);
        outcome
    }

    // ── session.json: the profile, and what older builds left there ──

    fn session_file(&self) -> Option<PathBuf> {
        self.dir.as_ref().map(|d| d.join("session.json"))
    }

    fn read_session(&self) -> serde_json::Map<String, Value> {
        self.session_file()
            .and_then(|p| std::fs::read_to_string(p).ok())
            .and_then(|s| serde_json::from_str::<Value>(&s).ok())
            .and_then(|v| v.as_object().cloned())
            .unwrap_or_default()
    }

    /// Write the session file, or remove it when nothing is left to keep.
    fn write_session(&self, session: &serde_json::Map<String, Value>) {
        let Some(path) = self.session_file() else { return };
        if session.is_empty() {
            let _ = std::fs::remove_file(path);
            return;
        }
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let _ = std::fs::write(path, Value::Object(session.clone()).to_string());
    }

    fn remove_from_session(&self, keys: &[&str]) {
        let mut session = self.read_session();
        let before = session.len();
        for key in keys {
            session.remove(*key);
        }
        if session.len() != before {
            self.write_session(&session);
        }
    }

    fn session_text(&self, key: &str) -> Option<String> {
        self.read_session()
            .get(key)
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
    }

    // ── the backend session token ──

    /// Keep the session token for the next launch. `Err` means it was not kept:
    /// the session works until the app closes and the user signs in again after.
    /// No plaintext copy is written in either case, and one left by an older
    /// build is removed.
    pub fn store_token(&self, token: &str) -> Result<(), String> {
        let saved = self.save_secret(AUTH_TOKEN, token);
        self.remove_from_session(&["token"]);
        saved
    }

    /// Cache the user profile so the session can be restored offline. The
    /// profile is not a secret and is kept in the session file.
    pub fn store_user(&self, user_json: &str) {
        let Ok(profile) = serde_json::from_str::<Value>(user_json) else { return };
        let mut session = self.read_session();
        session.insert("user".into(), profile);
        self.write_session(&session);
    }

    /// The saved session token. A plaintext copy from an older build is moved
    /// into the credential store here, and removed from the file whether or not
    /// the move worked: if it did not, the token is still returned, so this
    /// launch stays signed in, and nothing is left on disk.
    pub fn get_stored_token(&self) -> Option<String> {
        let kept = self.secrets.get(AUTH_TOKEN).ok().flatten().filter(|t| !t.trim().is_empty());
        let legacy = self.session_text("token");
        if legacy.is_some() {
            if kept.is_none() {
                if let Some(token) = &legacy {
                    let _ = self.save_secret(AUTH_TOKEN, token);
                }
            }
            self.remove_from_session(&["token"]);
        }
        kept.or(legacy)
    }

    pub fn get_stored_user(&self) -> Option<String> {
        self.read_session().get("user").filter(|v| !v.is_null()).map(|v| v.to_string())
    }

    /// Sign-out: forget the token and the cached profile.
    pub fn delete_token(&self) -> Result<(), String> {
        let removed = self.secrets.delete(AUTH_TOKEN);
        let _ = self.secrets.delete("auth_user"); // written by older builds
        self.remove_from_session(&["token", "user"]);
        removed
    }

    // ── the Hugging Face token ──

    fn app_hf_config(&self) -> Option<PathBuf> {
        self.dir.as_ref().map(|d| d.join("hf_config.json"))
    }

    /// A token written in the app's own directory: by an older build, or by the
    /// user pasting one into `hf_config.json` to have it imported.
    fn hf_plaintext_in_app_dir(&self) -> Option<String> {
        self.app_hf_config()
            .and_then(|p| token_in_hf_config(&p))
            .or_else(|| self.session_text("hf_token"))
    }

    /// Remove the Hugging Face token from the app's own files, leaving a note
    /// that says where it went and how to import another.
    fn scrub_hf_plaintext(&self) {
        self.remove_from_session(&["hf_token"]);
        let Some(path) = self.app_hf_config() else { return };
        if !path.exists() {
            return;
        }
        let body = json!({
            "_comment": "The Hugging Face token is kept in the system credential store, not in this file. To use another token, save it from Settings > AI & Models, or paste it into `active` below and restart: it is moved to the credential store and removed from this file.",
            "active": "",
            "tokens": [],
        });
        let _ = std::fs::write(&path, serde_json::to_string_pretty(&body).unwrap_or_else(|_| "{}".into()));
    }

    /// Save the Hugging Face token. `Err` means it was not saved anywhere.
    // ── the device key (device.rs) ──
    // Kept when the user signs out: the installation stays enrolled as a device.

    /// The device's private key (PKCS#8, base64), if one was made.
    pub fn device_key(&self) -> Result<Option<String>, String> {
        self.secrets.get(DEVICE_KEY)
    }

    /// Keep a new device key, read back to be sure it was kept.
    pub fn store_device_key(&self, pkcs8_base64: &str) -> Result<(), String> {
        self.save_secret(DEVICE_KEY, pkcs8_base64)
    }

    /// The key a rotation is moving to, kept until the backend has confirmed it.
    pub fn device_key_next(&self) -> Result<Option<String>, String> {
        self.secrets.get(DEVICE_KEY_NEXT)
    }

    pub fn store_device_key_next(&self, pkcs8_base64: &str) -> Result<(), String> {
        self.save_secret(DEVICE_KEY_NEXT, pkcs8_base64)
    }

    pub fn delete_device_key_next(&self) -> Result<(), String> {
        self.secrets.delete(DEVICE_KEY_NEXT)
    }

    pub fn store_hf_token(&self, token: &str) -> Result<(), String> {
        self.save_secret(HF_TOKEN, token).map_err(|reason| {
            format!(
                "The token was not saved: {}. Nothing was written to disk. \
                 You can set the HF_TOKEN environment variable before starting the app instead.",
                reason
            )
        })?;
        self.scrub_hf_plaintext();
        Ok(())
    }

    /// The Hugging Face token in use and where it came from.
    pub fn hf_token_info(&self, environment: Option<String>, override_files: &[PathBuf]) -> (Option<String>, HfSource) {
        // 1) explicit environment override
        if let Some(token) = environment.map(|t| t.trim().to_string()).filter(|t| !t.is_empty()) {
            return (Some(token), HfSource::Environment);
        }
        // 2) a plaintext copy in the app's own directory: move it, then remove it.
        //    It wins over the credential store so that pasting a token into the
        //    file still changes the token in use.
        if let Some(token) = self.hf_plaintext_in_app_dir() {
            return match self.save_secret(HF_TOKEN, &token) {
                Ok(()) => {
                    self.scrub_hf_plaintext();
                    (Some(token), HfSource::CredentialStore)
                }
                // The store is not working: use the token and leave the file,
                // because it is the only copy of a secret the user supplied.
                Err(_) => (Some(token), HfSource::PlaintextFile),
            };
        }
        // 3) a file a developer placed deliberately
        for path in override_files {
            if let Some(token) = token_in_hf_config(path) {
                return (Some(token), HfSource::OverrideFile);
            }
        }
        // 4) the credential store
        match self.secrets.get(HF_TOKEN).ok().flatten().filter(|t| !t.trim().is_empty()) {
            Some(token) => (Some(token), HfSource::CredentialStore),
            None => (None, HfSource::None),
        }
    }
}

/// Read a token from an `hf_config.json`. Accepts `{"active": "hf_…"}`,
/// `{"hf_token"/"token": "hf_…"}`, or a `{"tokens": [...]}` array (first
/// non-empty entry).
fn token_in_hf_config(path: &std::path::Path) -> Option<String> {
    let text = std::fs::read_to_string(path).ok()?;
    let config: Value = serde_json::from_str(&text).ok()?;
    for key in ["active", "hf_token", "token"] {
        if let Some(token) = config.get(key).and_then(|x| x.as_str()).map(str::trim).filter(|t| !t.is_empty()) {
            return Some(token.to_string());
        }
    }
    config
        .get("tokens")
        .and_then(|x| x.as_array())
        .and_then(|list| list.iter().filter_map(|t| t.as_str()).map(str::trim).find(|t| !t.is_empty()))
        .map(String::from)
}

/// Files a developer can place a token in. They are read and never changed:
/// the path in `HF_CONFIG`, then `hf_config.json` in the working directory, its
/// parent, and beside the executable (so it works in `tauri dev` and when built).
fn hf_override_files() -> Vec<PathBuf> {
    let mut files: Vec<PathBuf> = Vec::new();
    if let Ok(p) = std::env::var("HF_CONFIG") {
        if !p.trim().is_empty() {
            files.push(PathBuf::from(p));
        }
    }
    if let Ok(cwd) = std::env::current_dir() {
        files.push(cwd.join("hf_config.json"));
        if let Some(parent) = cwd.parent() {
            files.push(parent.join("hf_config.json"));
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            files.push(dir.join("hf_config.json"));
        }
    }
    // the app's own copy is handled by the vault, which also removes it
    let own = config_dir().map(|d| d.join("hf_config.json"));
    files.retain(|f| Some(f) != own.as_ref());
    files
}

fn vault() -> Vault<OsCredentialStore> {
    Vault { dir: config_dir(), secrets: OS_CREDENTIAL_STORE }
}

// ── what the rest of the app calls ──

pub fn store_token(token: &str) -> Result<(), String> {
    let saved = vault().store_token(token);
    #[cfg(debug_assertions)]
    eprintln!("[cyberforge] store_token: credential store {}", if saved.is_ok() { "ok" } else { "failed" });
    saved
}

pub fn store_user(user_json: &str) {
    vault().store_user(user_json)
}

pub fn get_stored_token() -> Option<String> {
    vault().get_stored_token()
}

pub fn get_stored_user() -> Option<String> {
    vault().get_stored_user()
}

pub fn delete_token() -> Result<(), String> {
    vault().delete_token()
}

pub fn store_hf_token(token: &str) -> Result<(), String> {
    vault().store_hf_token(token)
}

/// The effective HF token and where it was resolved from.
pub fn hf_token_info() -> (Option<String>, HfSource) {
    vault().hf_token_info(std::env::var("HF_TOKEN").ok(), &hf_override_files())
}

pub fn get_hf_token() -> Option<String> {
    hf_token_info().0
}

/// Whether the system credential store can keep a value on this machine.
pub fn check_secure_storage() -> Result<(), String> {
    vault().check_secure_storage()
}

pub fn device_key() -> Result<Option<String>, String> {
    vault().device_key()
}

pub fn store_device_key(pkcs8_base64: &str) -> Result<(), String> {
    vault().store_device_key(pkcs8_base64)
}

pub fn device_key_next() -> Result<Option<String>, String> {
    vault().device_key_next()
}

pub fn store_device_key_next(pkcs8_base64: &str) -> Result<(), String> {
    vault().store_device_key_next(pkcs8_base64)
}

pub fn delete_device_key_next() -> Result<(), String> {
    vault().delete_device_key_next()
}

#[cfg(test)]
mod credential_tests {
    use super::*;
    use std::cell::RefCell;
    use std::collections::HashMap;

    #[derive(Clone, Copy, PartialEq)]
    enum Behaviour {
        Works,
        /// Refuses every call, as a locked or missing store does.
        Refuses,
        /// Accepts a value and does not return it: what the `keyring` crate does
        /// when it is built without a platform feature.
        Forgets,
    }

    struct FakeStore {
        behaviour: Behaviour,
        kept: RefCell<HashMap<String, String>>,
    }

    impl FakeStore {
        fn new(behaviour: Behaviour) -> Self {
            FakeStore { behaviour, kept: RefCell::new(HashMap::new()) }
        }
        fn holds(&self, name: &str) -> Option<String> {
            self.kept.borrow().get(name).cloned()
        }
    }

    impl SecretStore for FakeStore {
        fn set(&self, name: &str, secret: &str) -> Result<(), String> {
            match self.behaviour {
                Behaviour::Refuses => Err("the credential store is locked".into()),
                Behaviour::Forgets => Ok(()),
                Behaviour::Works => {
                    self.kept.borrow_mut().insert(name.into(), secret.into());
                    Ok(())
                }
            }
        }
        fn get(&self, name: &str) -> Result<Option<String>, String> {
            match self.behaviour {
                Behaviour::Refuses => Err("the credential store is locked".into()),
                _ => Ok(self.kept.borrow().get(name).cloned()),
            }
        }
        fn delete(&self, name: &str) -> Result<(), String> {
            match self.behaviour {
                Behaviour::Refuses => Err("the credential store is locked".into()),
                _ => {
                    self.kept.borrow_mut().remove(name);
                    Ok(())
                }
            }
        }
    }

    const SESSION: &str = "eyJhbGciOiJIUzI1NiJ9.session-token-for-tests.signature";
    const HF: &str = "hf_TestTokenForUnitTestsOnly000000000";
    const HF_OLD: &str = "hf_AnOlderTestTokenKeptInHistory00000";

    /// A vault over a fresh, empty directory.
    fn vault_in(name: &str, behaviour: Behaviour) -> Vault<FakeStore> {
        let dir = std::env::temp_dir().join(format!("cf-vault-{}-{}", std::process::id(), name));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        Vault { dir: Some(dir), secrets: FakeStore::new(behaviour) }
    }

    fn dir(v: &Vault<FakeStore>) -> PathBuf {
        v.dir.clone().unwrap()
    }

    /// Everything written under the vault's directory, as one string.
    fn everything_on_disk(v: &Vault<FakeStore>) -> String {
        let mut all = String::new();
        for entry in std::fs::read_dir(dir(v)).unwrap().flatten() {
            all.push_str(&std::fs::read_to_string(entry.path()).unwrap_or_default());
            all.push('\n');
        }
        all
    }

    fn write(v: &Vault<FakeStore>, file: &str, body: Value) {
        std::fs::write(dir(v).join(file), body.to_string()).unwrap();
    }

    fn done(v: Vault<FakeStore>) {
        let _ = std::fs::remove_dir_all(dir(&v));
    }

    #[test]
    fn a_session_token_goes_to_the_credential_store_and_not_to_disk() {
        let v = vault_in("store", Behaviour::Works);
        v.store_user(r#"{"id":"u1","email":"a@example.org"}"#);
        assert_eq!(v.store_token(SESSION), Ok(()));
        assert_eq!(v.secrets.holds(AUTH_TOKEN).as_deref(), Some(SESSION));
        assert!(!everything_on_disk(&v).contains(SESSION));
        assert_eq!(v.get_stored_token().as_deref(), Some(SESSION));
        assert!(v.get_stored_user().unwrap().contains("a@example.org"));
        done(v);
    }

    #[test]
    fn a_store_that_refuses_is_reported_and_nothing_is_written_instead() {
        let v = vault_in("refuses", Behaviour::Refuses);
        let outcome = v.store_token(SESSION);
        assert_eq!(outcome, Err("the credential store is locked".into()));
        assert!(!everything_on_disk(&v).contains(SESSION));
        assert_eq!(v.get_stored_token(), None);
        done(v);
    }

    #[test]
    fn a_store_that_forgets_has_not_saved_anything() {
        let v = vault_in("forgets", Behaviour::Forgets);
        let outcome = v.store_token(SESSION);
        assert!(outcome.unwrap_err().contains("did not keep it"));
        assert!(v.check_secure_storage().is_err());
        assert!(!everything_on_disk(&v).contains(SESSION));
        done(v);
    }

    #[test]
    fn storage_check_passes_on_a_working_store_and_leaves_nothing_behind() {
        let v = vault_in("check", Behaviour::Works);
        assert_eq!(v.check_secure_storage(), Ok(()));
        assert!(v.secrets.kept.borrow().is_empty());
        done(v);
    }

    #[test]
    fn a_plaintext_session_token_is_moved_and_the_profile_is_kept() {
        let v = vault_in("migrate", Behaviour::Works);
        write(&v, "session.json", json!({ "token": SESSION, "user": { "id": "u1", "email": "a@example.org" }, "hf_token": HF }));
        assert_eq!(v.get_stored_token().as_deref(), Some(SESSION));
        assert_eq!(v.secrets.holds(AUTH_TOKEN).as_deref(), Some(SESSION));
        let left: Value = serde_json::from_str(&std::fs::read_to_string(dir(&v).join("session.json")).unwrap()).unwrap();
        assert!(left.get("token").is_none());
        assert_eq!(left["user"]["email"], "a@example.org");
        // read again: it now comes from the store
        assert_eq!(v.get_stored_token().as_deref(), Some(SESSION));
        done(v);
    }

    #[test]
    fn a_plaintext_session_token_is_removed_even_when_it_cannot_be_moved() {
        let v = vault_in("migrate-fail", Behaviour::Refuses);
        write(&v, "session.json", json!({ "token": SESSION, "user": { "id": "u1" } }));
        // this launch stays signed in
        assert_eq!(v.get_stored_token().as_deref(), Some(SESSION));
        // and nothing is left for the next one
        assert!(!everything_on_disk(&v).contains(SESSION));
        assert_eq!(v.get_stored_token(), None);
        assert!(v.get_stored_user().is_some());
        done(v);
    }

    #[test]
    fn the_stored_token_wins_over_a_stale_plaintext_copy_which_is_removed() {
        let v = vault_in("stale", Behaviour::Works);
        v.secrets.set(AUTH_TOKEN, "current-session-token").unwrap();
        write(&v, "session.json", json!({ "token": SESSION }));
        assert_eq!(v.get_stored_token().as_deref(), Some("current-session-token"));
        assert!(!dir(&v).join("session.json").exists(), "an emptied session file is removed");
        done(v);
    }

    #[test]
    fn signing_out_forgets_the_token_and_the_profile() {
        let v = vault_in("logout", Behaviour::Works);
        v.store_token(SESSION).unwrap();
        v.store_user(r#"{"id":"u1"}"#);
        assert_eq!(v.delete_token(), Ok(()));
        assert_eq!(v.secrets.holds(AUTH_TOKEN), None);
        assert_eq!(v.get_stored_token(), None);
        assert_eq!(v.get_stored_user(), None);
        assert!(!dir(&v).join("session.json").exists());
        done(v);
    }

    #[test]
    fn an_hf_token_is_saved_to_the_store_and_older_copies_are_removed() {
        let v = vault_in("hf-store", Behaviour::Works);
        write(&v, "hf_config.json", json!({ "active": HF_OLD, "tokens": [HF_OLD, "hf_EvenOlderTestToken0000000000000000"] }));
        write(&v, "session.json", json!({ "hf_token": HF_OLD, "user": { "id": "u1" } }));
        assert_eq!(v.store_hf_token(HF), Ok(()));
        assert_eq!(v.secrets.holds(HF_TOKEN).as_deref(), Some(HF));
        let disk = everything_on_disk(&v);
        assert!(!disk.contains("hf_"), "no token of any age is left on disk: {}", disk.replace(HF, "<token>"));
        assert_eq!(v.hf_token_info(None, &[]), (Some(HF.to_string()), HfSource::CredentialStore));
        assert!(v.get_stored_user().is_some(), "the profile in the same file is untouched");
        done(v);
    }

    #[test]
    fn an_hf_token_that_cannot_be_saved_is_an_error_and_is_not_written_to_disk() {
        let v = vault_in("hf-refuses", Behaviour::Refuses);
        let error = v.store_hf_token(HF).unwrap_err();
        assert!(error.contains("was not saved") && error.contains("HF_TOKEN"));
        assert!(!everything_on_disk(&v).contains(HF));
        assert_eq!(v.hf_token_info(None, &[]), (None, HfSource::None));
        done(v);
    }

    #[test]
    fn a_plaintext_hf_token_is_imported_and_removed_from_the_file() {
        let v = vault_in("hf-migrate", Behaviour::Works);
        write(&v, "hf_config.json", json!({ "active": HF, "tokens": [HF, HF_OLD] }));
        assert_eq!(v.hf_token_info(None, &[]), (Some(HF.to_string()), HfSource::CredentialStore));
        assert_eq!(v.secrets.holds(HF_TOKEN).as_deref(), Some(HF));
        assert!(!everything_on_disk(&v).contains("hf_"));
        // the file is still there, with a note on where the token went
        assert!(std::fs::read_to_string(dir(&v).join("hf_config.json")).unwrap().contains("system credential store"));
        done(v);
    }

    #[test]
    fn a_token_pasted_into_the_file_replaces_the_stored_one() {
        let v = vault_in("hf-replace", Behaviour::Works);
        v.store_hf_token(HF_OLD).unwrap();
        write(&v, "hf_config.json", json!({ "active": HF }));
        assert_eq!(v.hf_token_info(None, &[]).0.as_deref(), Some(HF));
        assert_eq!(v.secrets.holds(HF_TOKEN).as_deref(), Some(HF));
        done(v);
    }

    #[test]
    fn a_plaintext_hf_token_is_left_alone_when_it_cannot_be_moved() {
        let v = vault_in("hf-migrate-fail", Behaviour::Forgets);
        write(&v, "hf_config.json", json!({ "active": HF }));
        assert_eq!(v.hf_token_info(None, &[]), (Some(HF.to_string()), HfSource::PlaintextFile));
        assert!(everything_on_disk(&v).contains(HF), "the only copy of the user's token is not destroyed");
        assert!(HfSource::PlaintextFile.label().contains("not working"));
        done(v);
    }

    #[test]
    fn the_environment_wins_and_override_files_are_read_but_never_changed() {
        let v = vault_in("hf-order", Behaviour::Works);
        v.store_hf_token(HF_OLD).unwrap();
        let outside = std::env::temp_dir().join(format!("cf-vault-{}-override.json", std::process::id()));
        std::fs::write(&outside, json!({ "tokens": ["", HF] }).to_string()).unwrap();
        let files = vec![outside.clone()];
        assert_eq!(v.hf_token_info(Some("  hf_FromTheEnvironment  ".into()), &files), (Some("hf_FromTheEnvironment".into()), HfSource::Environment));
        assert_eq!(v.hf_token_info(Some("   ".into()), &files), (Some(HF.to_string()), HfSource::OverrideFile));
        assert!(std::fs::read_to_string(&outside).unwrap().contains(HF), "an override file is not rewritten");
        assert_eq!(v.secrets.holds(HF_TOKEN).as_deref(), Some(HF_OLD), "and its token is not copied anywhere");
        assert_eq!(v.hf_token_info(None, &[]), (Some(HF_OLD.to_string()), HfSource::CredentialStore));
        let _ = std::fs::remove_file(outside);
        done(v);
    }

    /// Writes one throwaway entry to the real credential store of this machine
    /// and removes it. Not part of the normal run:
    ///   cargo test --lib credential_tests::the_real_credential_store -- --ignored
    #[test]
    #[ignore]
    fn the_real_credential_store_keeps_a_value_and_gives_it_up() {
        let store = OS_CREDENTIAL_STORE;
        const NAME: &str = "selftest_probe";
        let _ = store.delete(NAME);
        store.set(NAME, "kept-across-handles").expect("the store accepts a value");
        // a second handle: the stand-in store the crate falls back to fails here
        assert_eq!(store.get(NAME), Ok(Some("kept-across-handles".to_string())));
        assert_eq!(store.delete(NAME), Ok(()));
        assert_eq!(store.get(NAME), Ok(None));
        assert_eq!(store.delete(NAME), Ok(()), "deleting what is not there is not an error");
    }
}
