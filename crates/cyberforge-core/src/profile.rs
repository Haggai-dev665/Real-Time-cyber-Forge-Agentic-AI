//! Named CLI profiles.
//!
//! A profile binds a name to one backend origin and to one credential-store
//! entry whose name includes both, so a session token kept for one origin is
//! never found, let alone sent, when the profile points somewhere else. The
//! profiles file holds no secrets.
//!
//! `profiles.json`:
//! `{"version":1,"current":"default","profiles":{"default":{"origin":"https://…"}}}`
//!
//! With no file, or no entry for it, the `default` profile uses the deployed
//! backend.

use crate::origin::Origin;
use serde_json::{json, Map, Value};
use std::path::{Path, PathBuf};

pub const DEFAULT_PROFILE: &str = "default";
const FILE_VERSION: u64 = 1;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Profile {
    pub name: String,
    pub origin: Origin,
}

impl Profile {
    /// The credential-store entry for this profile's session.
    pub fn session_entry(&self) -> String {
        format!("session:{}:{}", self.name, self.origin)
    }
}

/// Profile names are 1–32 lower-case letters, digits, `-` or `_`, starting with
/// a letter or digit.
pub fn valid_name(name: &str) -> bool {
    let bytes = name.as_bytes();
    !bytes.is_empty()
        && bytes.len() <= 32
        && bytes[0].is_ascii_alphanumeric()
        && bytes.iter().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || *b == b'-' || *b == b'_')
}

/// Why a profile could not be resolved.
#[derive(Debug, PartialEq, Eq)]
pub enum ProfileError {
    /// The name given is not a valid profile name, or no such profile exists.
    Usage(String),
    /// The profiles file exists and could not be used.
    File(String),
}

pub struct ProfileStore {
    path: PathBuf,
}

impl ProfileStore {
    pub fn in_dir(dir: &Path) -> Self {
        ProfileStore { path: dir.join("profiles.json") }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    fn read(&self) -> Result<Map<String, Value>, ProfileError> {
        let text = match std::fs::read_to_string(&self.path) {
            Ok(text) => text,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Map::new()),
            Err(e) => return Err(ProfileError::File(format!("{} could not be read: {}", self.path.display(), e))),
        };
        let invalid = || ProfileError::File(format!("{} is not a valid profiles file; fix or remove it", self.path.display()));
        let value: Value = serde_json::from_str(text.trim_start_matches('\u{feff}')).map_err(|_| invalid())?;
        let file = value.as_object().cloned().ok_or_else(invalid)?;
        match file.get("version").and_then(Value::as_u64) {
            Some(FILE_VERSION) | None => Ok(file),
            Some(other) => Err(ProfileError::File(format!(
                "{} was written by a newer CyberForge (version {}); update the CLI",
                self.path.display(),
                other
            ))),
        }
    }

    /// The profile to use: the one named, else the file's current one, else
    /// `default`.
    pub fn resolve(&self, requested: Option<&str>) -> Result<Profile, ProfileError> {
        if let Some(name) = requested {
            if !valid_name(name) {
                return Err(ProfileError::Usage(
                    "A profile name is 1-32 lower-case letters, digits, '-' or '_'.".into(),
                ));
            }
        }
        let file = self.read()?;
        let name = match requested {
            Some(name) => name.to_string(),
            None => file
                .get("current")
                .and_then(Value::as_str)
                .filter(|n| valid_name(n))
                .unwrap_or(DEFAULT_PROFILE)
                .to_string(),
        };
        let entry = file.get("profiles").and_then(|p| p.get(&name));
        let origin = match entry.and_then(|e| e.get("origin")).and_then(Value::as_str) {
            Some(text) => Origin::parse(text).map_err(|rule| {
                ProfileError::File(format!("Profile '{}' in {} has an invalid origin. {}", name, self.path.display(), rule))
            })?,
            None if name == DEFAULT_PROFILE => Origin::default_backend(),
            None => return Err(ProfileError::Usage(format!("There is no profile named '{}'.", name))),
        };
        Ok(Profile { name, origin })
    }

    /// Add or replace a profile and, if asked, make it current.
    pub fn save(&self, profile: &Profile, make_current: bool) -> Result<(), ProfileError> {
        let mut file = self.read()?;
        file.insert("version".into(), json!(FILE_VERSION));
        let profiles = file.entry("profiles").or_insert_with(|| json!({}));
        if !profiles.is_object() {
            *profiles = json!({});
        }
        profiles[profile.name.as_str()] = json!({ "origin": profile.origin.as_str() });
        if make_current {
            file.insert("current".into(), json!(profile.name));
        }
        self.write(file)
    }

    /// Make an existing profile (or `default`) the current one.
    pub fn use_profile(&self, name: &str) -> Result<Profile, ProfileError> {
        let profile = self.resolve(Some(name))?;
        let mut file = self.read()?;
        file.insert("version".into(), json!(FILE_VERSION));
        file.insert("current".into(), json!(profile.name));
        self.write(file)?;
        Ok(profile)
    }

    /// The current profile's name and every profile, `default` included even
    /// when the file does not name it. A profile with an invalid origin is an
    /// error, as when resolving it.
    pub fn list(&self) -> Result<(String, Vec<Profile>), ProfileError> {
        let file = self.read()?;
        let mut names: Vec<String> = file
            .get("profiles")
            .and_then(Value::as_object)
            .map(|p| p.keys().filter(|n| valid_name(n)).cloned().collect())
            .unwrap_or_default();
        if !names.iter().any(|n| n == DEFAULT_PROFILE) {
            names.push(DEFAULT_PROFILE.to_string());
        }
        names.sort();
        let current = self.resolve(None)?.name;
        let profiles = names.iter().map(|n| self.resolve(Some(n))).collect::<Result<Vec<_>, _>>()?;
        Ok((current, profiles))
    }

    fn write(&self, file: Map<String, Value>) -> Result<(), ProfileError> {
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| ProfileError::File(e.to_string()))?;
        }
        let text = serde_json::to_string_pretty(&Value::Object(file)).map_err(|e| ProfileError::File(e.to_string()))?;
        std::fs::write(&self.path, text).map_err(|e| ProfileError::File(format!("{} could not be written: {}", self.path.display(), e)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("cf-core-profile-{}-{}", tag, std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn with_no_file_the_default_profile_is_the_deployed_backend() {
        let store = ProfileStore::in_dir(&temp_dir("none"));
        let profile = store.resolve(None).unwrap();
        assert_eq!(profile, Profile { name: "default".into(), origin: Origin::default_backend() });
        assert!(matches!(store.resolve(Some("staging")), Err(ProfileError::Usage(_))));
    }

    #[test]
    fn saved_profiles_resolve_by_name_and_as_current() {
        let dir = temp_dir("saved");
        let store = ProfileStore::in_dir(&dir);
        let staging = Profile { name: "staging".into(), origin: Origin::parse("https://staging.example.com").unwrap() };
        store.save(&staging, true).unwrap();
        assert_eq!(store.resolve(None).unwrap(), staging);
        assert_eq!(store.resolve(Some("default")).unwrap().origin, Origin::default_backend());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn profiles_are_listed_and_switched() {
        let dir = temp_dir("list");
        let store = ProfileStore::in_dir(&dir);
        assert_eq!(store.list().unwrap(), ("default".to_string(), vec![store.resolve(None).unwrap()]));
        let staging = Profile { name: "staging".into(), origin: Origin::parse("https://staging.example.com").unwrap() };
        store.save(&staging, false).unwrap();
        let (current, profiles) = store.list().unwrap();
        assert_eq!(current, "default");
        assert_eq!(profiles.iter().map(|p| p.name.as_str()).collect::<Vec<_>>(), ["default", "staging"]);
        assert_eq!(store.use_profile("staging").unwrap(), staging);
        assert_eq!(store.resolve(None).unwrap(), staging);
        assert!(matches!(store.use_profile("missing"), Err(ProfileError::Usage(_))));
        assert_eq!(store.resolve(None).unwrap(), staging, "a failed switch changes nothing");
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn a_session_entry_is_bound_to_the_profile_and_its_origin() {
        let a = Profile { name: "work".into(), origin: Origin::parse("https://a.example.com").unwrap() };
        let b = Profile { name: "work".into(), origin: Origin::parse("https://b.example.com").unwrap() };
        assert_ne!(a.session_entry(), b.session_entry());
        assert_eq!(a.session_entry(), "session:work:https://a.example.com");
    }

    #[test]
    fn bad_names_files_and_origins_are_reported() {
        let dir = temp_dir("bad");
        let store = ProfileStore::in_dir(&dir);
        for name in ["", "Work", "a b", "../x", &"x".repeat(33)] {
            assert!(matches!(store.resolve(Some(name)), Err(ProfileError::Usage(_))), "{name}");
        }
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(store.path(), "not json").unwrap();
        assert!(matches!(store.resolve(None), Err(ProfileError::File(_))));
        std::fs::write(store.path(), r#"{"profiles":{"default":{"origin":"http://evil.example.com"}}}"#).unwrap();
        assert!(matches!(store.resolve(None), Err(ProfileError::File(_))));
        std::fs::write(store.path(), r#"{"version":9}"#).unwrap();
        assert!(matches!(store.resolve(None), Err(ProfileError::File(_))));
        let _ = std::fs::remove_dir_all(dir);
    }
}
