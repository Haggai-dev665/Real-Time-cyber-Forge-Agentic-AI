//! The operating system's credential store, and each app's config directory.
//!
//! Secrets live only in the credential store: Windows Credential Manager, the
//! macOS Keychain, or the Secret Service on Linux. Each app uses its own
//! service name, so the desktop app's session and a CLI profile's session are
//! separate entries and neither is used in place of the other.

use std::collections::HashMap;
use std::sync::Mutex;
use std::path::PathBuf;

/// A place secrets can be kept. `get` answers `Ok(None)` when there is no entry
/// and `Err` when the store itself could not be used.
pub trait SecretStore {
    fn set(&self, name: &str, secret: &str) -> Result<(), String>;
    fn get(&self, name: &str) -> Result<Option<String>, String>;
    fn delete(&self, name: &str) -> Result<(), String>;
}

/// The operating system's credential store, under one service name.
pub struct KeyringStore {
    service: &'static str,
}

impl KeyringStore {
    pub const fn new(service: &'static str) -> Self {
        KeyringStore { service }
    }
}

impl SecretStore for KeyringStore {
    fn set(&self, name: &str, secret: &str) -> Result<(), String> {
        keyring::Entry::new(self.service, name)
            .and_then(|e| e.set_password(secret))
            .map_err(|e| e.to_string())
    }

    fn get(&self, name: &str) -> Result<Option<String>, String> {
        match keyring::Entry::new(self.service, name).and_then(|e| e.get_password()) {
            Ok(secret) => Ok(Some(secret)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }

    fn delete(&self, name: &str) -> Result<(), String> {
        match keyring::Entry::new(self.service, name).and_then(|e| e.delete_credential()) {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(e.to_string()),
        }
    }
}

/// A store held in memory, for tests and for callers that must not persist.
#[derive(Default)]
pub struct MemoryStore {
    entries: Mutex<HashMap<String, String>>,
}

impl SecretStore for MemoryStore {
    fn set(&self, name: &str, secret: &str) -> Result<(), String> {
        self.entries.lock().unwrap_or_else(|p| p.into_inner()).insert(name.to_string(), secret.to_string());
        Ok(())
    }

    fn get(&self, name: &str) -> Result<Option<String>, String> {
        Ok(self.entries.lock().unwrap_or_else(|p| p.into_inner()).get(name).cloned())
    }

    fn delete(&self, name: &str) -> Result<(), String> {
        self.entries.lock().unwrap_or_else(|p| p.into_inner()).remove(name);
        Ok(())
    }
}

/// `%APPDATA%\<app_id>` (Windows), `~/Library/Application Support/<app_id>`
/// (macOS) or `$XDG_CONFIG_HOME/<app_id>`, `~/.config/<app_id>` (Linux). For
/// the desktop app this matches Tauri's app-config directory.
pub fn app_config_dir(app_id: &str) -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        return std::env::var("APPDATA").ok().map(|b| PathBuf::from(b).join(app_id));
    }
    #[cfg(target_os = "macos")]
    {
        return std::env::var("HOME")
            .ok()
            .map(|h| PathBuf::from(h).join("Library").join("Application Support").join(app_id));
    }
    #[cfg(target_os = "linux")]
    {
        return std::env::var("XDG_CONFIG_HOME")
            .ok()
            .map(PathBuf::from)
            .or_else(|| std::env::var("HOME").ok().map(|h| PathBuf::from(h).join(".config")))
            .map(|b| b.join(app_id));
    }
    #[allow(unreachable_code)]
    {
        let _ = app_id;
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_memory_store_keeps_and_forgets() {
        let store = MemoryStore::default();
        assert_eq!(store.get("a"), Ok(None));
        store.set("a", "1").unwrap();
        assert_eq!(store.get("a"), Ok(Some("1".into())));
        store.delete("a").unwrap();
        assert_eq!(store.get("a"), Ok(None));
    }

    #[test]
    fn config_dirs_are_per_app() {
        if let (Some(a), Some(b)) = (app_config_dir("com.cyberforge.console"), app_config_dir("com.cyberforge.cli")) {
            assert_ne!(a, b);
            assert!(a.ends_with("com.cyberforge.console"));
        }
    }
}
