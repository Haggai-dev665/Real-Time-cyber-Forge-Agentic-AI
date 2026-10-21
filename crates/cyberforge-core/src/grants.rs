//! MCP client grants (plan-update-v2.md §4.2, §5).
//!
//! An AI client reaches CyberForge only through a grant the user approved. A
//! grant names the client, the CLI profile (and so the server origin) it acts
//! for, the account that profile was signed in to when the grant was made, the
//! operations it may use, and when it expires. It is checked on every call, so
//! revoking it blocks the next call. It holds no secret: the client's
//! configuration names its ID, and the trust boundary is this operating-system
//! user, as for the CLI itself.
//!
//! Read-only operations are the default. An operation that sends something the
//! user gives (an address to analyse) must be named when the grant is made.
//!
//! The grants live in `mcp-grants.json` beside the CLI's profiles.

use crate::operations::{self, DataSharing, Surface};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

const FILE_VERSION: u32 = 1;
pub const MAX_DAYS: u64 = 365;
pub const DEFAULT_DAYS: u64 = 90;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Grant {
    pub id: String,
    /// What the user called the client, e.g. "Claude Desktop".
    pub client_name: String,
    pub profile: String,
    pub origin: String,
    /// The account the profile was signed in to when the grant was made.
    pub account_id: String,
    pub operations: Vec<String>,
    pub created_at: u64,
    pub expires_at: u64,
    #[serde(default)]
    pub revoked_at: Option<u64>,
    #[serde(default = "first_revision")]
    pub revision: u32,
}

fn first_revision() -> u32 {
    1
}

impl Grant {
    /// `active`, `expired` or `revoked`, at `now`.
    pub fn state(&self, now: u64) -> &'static str {
        if self.revoked_at.is_some() {
            "revoked"
        } else if self.expires_at <= now {
            "expired"
        } else {
            "active"
        }
    }

    /// The grant as the CLI and the desktop show it.
    pub fn to_json(&self, now: u64) -> serde_json::Value {
        serde_json::json!({
            "id": self.id, "clientName": self.client_name, "profile": self.profile, "origin": self.origin,
            "operations": self.operations, "createdAt": self.created_at, "expiresAt": self.expires_at,
            "revokedAt": self.revoked_at, "revision": self.revision, "state": self.state(now)
        })
    }
}

/// What an AI client's configuration needs to start the server for a grant:
/// the CLI program and its arguments. It holds no secret.
pub fn client_config(cli: &str, grant_id: &str) -> serde_json::Value {
    serde_json::json!({ "mcpServers": { "cyberforge": { "command": cli, "args": ["mcp", "serve", "--stdio", "--grant", grant_id] } } })
}

#[derive(Debug, PartialEq)]
pub enum GrantError {
    Invalid(String),
    Unknown,
    Revoked,
    Expired,
    /// The grant does not include this operation.
    NotGranted(String),
    /// The profile is now signed in to another account than the grant was made for.
    AccountChanged,
    /// The profile now points at another server than the grant was made for.
    OriginChanged,
    File(String),
}

impl GrantError {
    pub fn code(&self) -> &'static str {
        match self {
            GrantError::Invalid(_) => "GRANT_INVALID",
            GrantError::Unknown => "GRANT_UNKNOWN",
            GrantError::Revoked => "GRANT_REVOKED",
            GrantError::Expired => "GRANT_EXPIRED",
            GrantError::NotGranted(_) => "NOT_GRANTED",
            GrantError::AccountChanged => "GRANT_ACCOUNT_CHANGED",
            GrantError::OriginChanged => "GRANT_ORIGIN_CHANGED",
            GrantError::File(_) => "GRANT_FILE",
        }
    }

    pub fn message(&self) -> String {
        match self {
            GrantError::Invalid(m) | GrantError::File(m) => m.clone(),
            GrantError::Unknown => "No such grant; approve the client in CyberForge (Settings > Integrations, or cyberforge mcp grant create).".into(),
            GrantError::Revoked => "This client's grant was revoked.".into(),
            GrantError::Expired => "This client's grant has expired; approve it again.".into(),
            GrantError::NotGranted(op) => format!("This client's grant does not include {}.", op),
            GrantError::AccountChanged => "The profile is signed in to another account than this grant was approved for; approve the client again.".into(),
            GrantError::OriginChanged => "The profile now points at another server than this grant was approved for; approve the client again.".into(),
        }
    }
}

/// The operations an MCP client can be granted: those the registry offers on the MCP surface.
pub fn grantable() -> Vec<&'static operations::Operation> {
    operations::for_surface(Surface::Mcp).collect()
}

/// The read-only default: every grantable operation that sends nothing the user gives.
pub fn default_operations() -> Vec<String> {
    grantable().into_iter().filter(|op| op.data_sharing != DataSharing::TargetAddress).map(|op| op.id.to_string()).collect()
}

pub struct GrantStore {
    path: PathBuf,
}

#[derive(Serialize, Deserialize, Default)]
struct GrantFile {
    #[serde(default)]
    version: u32,
    #[serde(default)]
    grants: Vec<Grant>,
}

fn new_id() -> Result<String, GrantError> {
    let mut bytes = [0u8; 12];
    getrandom::fill(&mut bytes).map_err(|e| GrantError::File(format!("could not make a grant ID: {e}")))?;
    Ok(format!("g_{}", bytes.iter().map(|b| format!("{b:02x}")).collect::<String>()))
}

fn valid_id(id: &str) -> bool {
    id.len() == 26 && id.starts_with("g_") && id[2..].chars().all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase())
}

impl GrantStore {
    pub fn in_dir(dir: &Path) -> Self {
        GrantStore { path: dir.join("mcp-grants.json") }
    }

    fn read(&self) -> Result<GrantFile, GrantError> {
        match std::fs::read_to_string(&self.path) {
            Ok(text) => {
                let file: GrantFile = serde_json::from_str(text.trim_start_matches('\u{feff}'))
                    .map_err(|_| GrantError::File(format!("{} is not a valid grants file; fix or remove it", self.path.display())))?;
                if file.version > FILE_VERSION {
                    return Err(GrantError::File(format!("{} was written by a newer CyberForge; update it", self.path.display())));
                }
                Ok(file)
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(GrantFile::default()),
            Err(e) => Err(GrantError::File(format!("{} could not be read: {}", self.path.display(), e))),
        }
    }

    fn write(&self, mut file: GrantFile) -> Result<(), GrantError> {
        file.version = FILE_VERSION;
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| GrantError::File(e.to_string()))?;
        }
        let staged = self.path.with_extension("json.new");
        let text = serde_json::to_string_pretty(&file).map_err(|e| GrantError::File(e.to_string()))?;
        std::fs::write(&staged, text).map_err(|e| GrantError::File(e.to_string()))?;
        std::fs::rename(&staged, &self.path).map_err(|e| GrantError::File(e.to_string()))
    }

    pub fn list(&self) -> Result<Vec<Grant>, GrantError> {
        Ok(self.read()?.grants)
    }

    /// Record a grant. The caller has checked that the profile is signed in
    /// to `account_id` at `origin`.
    pub fn create(&self, client_name: &str, profile: &str, origin: &str, account_id: &str, operations: &[String], days: u64, now: u64) -> Result<Grant, GrantError> {
        let name = client_name.trim();
        if name.is_empty() || name.chars().count() > 60 || name.chars().any(|c| c.is_control()) {
            return Err(GrantError::Invalid("A client name is 1-60 characters, with no control characters.".into()));
        }
        if days == 0 || days > MAX_DAYS {
            return Err(GrantError::Invalid(format!("A grant lasts 1 to {} days.", MAX_DAYS)));
        }
        if account_id.trim().is_empty() {
            return Err(GrantError::Invalid("The profile must be signed in to make a grant.".into()));
        }
        let allowed: Vec<&str> = grantable().iter().map(|op| op.id).collect();
        let mut ops: Vec<String> = Vec::new();
        for op in operations {
            if !allowed.contains(&op.as_str()) {
                return Err(GrantError::Invalid(format!("{} cannot be granted to an AI client.", op)));
            }
            if !ops.contains(op) {
                ops.push(op.clone());
            }
        }
        if ops.is_empty() {
            return Err(GrantError::Invalid("A grant names at least one operation.".into()));
        }
        let grant = Grant {
            id: new_id()?,
            client_name: name.to_string(),
            profile: profile.to_string(),
            origin: origin.to_string(),
            account_id: account_id.to_string(),
            operations: ops,
            created_at: now,
            expires_at: now + days * 86_400,
            revoked_at: None,
            revision: 1,
        };
        let mut file = self.read()?;
        file.grants.push(grant.clone());
        self.write(file)?;
        Ok(grant)
    }

    pub fn revoke(&self, id: &str, now: u64) -> Result<Grant, GrantError> {
        let mut file = self.read()?;
        let grant = file.grants.iter_mut().find(|g| g.id == id).ok_or(GrantError::Unknown)?;
        if grant.revoked_at.is_none() {
            grant.revoked_at = Some(now);
            grant.revision += 1;
        }
        let out = grant.clone();
        self.write(file)?;
        Ok(out)
    }

    /// The grant, if it may be used now (not revoked, not expired).
    pub fn active(&self, id: &str, now: u64) -> Result<Grant, GrantError> {
        if !valid_id(id) {
            return Err(GrantError::Unknown);
        }
        let grant = self.read()?.grants.into_iter().find(|g| g.id == id).ok_or(GrantError::Unknown)?;
        if grant.revoked_at.is_some() {
            return Err(GrantError::Revoked);
        }
        if grant.expires_at <= now {
            return Err(GrantError::Expired);
        }
        Ok(grant)
    }

    /// Whether `operation` may be done now for this grant, by a profile now at
    /// `origin` signed in to `account_id` (None: not known yet).
    pub fn check(&self, id: &str, operation: &str, origin: &str, account_id: Option<&str>, now: u64) -> Result<Grant, GrantError> {
        let grant = self.active(id, now)?;
        if !grant.operations.iter().any(|op| op == operation) {
            return Err(GrantError::NotGranted(operation.to_string()));
        }
        if grant.origin != origin {
            return Err(GrantError::OriginChanged);
        }
        if let Some(account) = account_id {
            if account != grant.account_id {
                return Err(GrantError::AccountChanged);
            }
        }
        Ok(grant)
    }
}

pub fn now_secs() -> u64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn store(tag: &str) -> (GrantStore, PathBuf) {
        let dir = std::env::temp_dir().join(format!("cf-grants-{}-{}", tag, std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        (GrantStore::in_dir(&dir), dir)
    }

    #[test]
    fn the_default_is_read_only() {
        let defaults = default_operations();
        assert!(defaults.contains(&"status".to_string()));
        assert!(!defaults.contains(&"scan.url".to_string()), "sending an address must be granted by name");
    }

    #[test]
    fn a_grant_allows_only_its_operations_for_its_account_and_server() {
        let (grants, dir) = store("check");
        let g = grants.create("Claude Desktop", "default", "https://cf.example", "u1", &default_operations(), 30, 1_000).unwrap();
        assert!(valid_id(&g.id));
        assert_eq!(g.expires_at, 1_000 + 30 * 86_400);
        assert!(grants.check(&g.id, "status", "https://cf.example", Some("u1"), 2_000).is_ok());
        assert!(grants.check(&g.id, "status", "https://cf.example", None, 2_000).is_ok(), "the account may not be known yet");
        assert_eq!(grants.check(&g.id, "scan.url", "https://cf.example", Some("u1"), 2_000), Err(GrantError::NotGranted("scan.url".into())));
        assert_eq!(grants.check(&g.id, "status", "https://cf.example", Some("u2"), 2_000), Err(GrantError::AccountChanged));
        assert_eq!(grants.check(&g.id, "status", "https://other.example", Some("u1"), 2_000), Err(GrantError::OriginChanged));
        assert_eq!(grants.check(&g.id, "status", "https://cf.example", Some("u1"), g.expires_at), Err(GrantError::Expired));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn revoking_blocks_the_next_call() {
        let (grants, dir) = store("revoke");
        let g = grants.create("Cursor", "default", "https://cf.example", "u1", &["status".to_string()], 7, 10).unwrap();
        let revoked = grants.revoke(&g.id, 20).unwrap();
        assert_eq!((revoked.revoked_at, revoked.revision), (Some(20), 2));
        assert_eq!(grants.check(&g.id, "status", "https://cf.example", Some("u1"), 30), Err(GrantError::Revoked));
        assert_eq!(grants.list().unwrap().len(), 1, "a revoked grant stays listed");
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn grants_cannot_name_operations_the_mcp_surface_does_not_offer() {
        let (grants, dir) = store("bad");
        for (name, ops, days) in [
            ("x", vec!["auth.login".to_string()], 7),
            ("x", vec!["broker.hold".to_string()], 7),
            ("x", vec![], 7),
            ("", vec!["status".to_string()], 7),
            ("x", vec!["status".to_string()], 0),
            ("x", vec!["status".to_string()], MAX_DAYS + 1),
        ] {
            assert!(matches!(grants.create(name, "default", "https://cf.example", "u1", &ops, days, 1), Err(GrantError::Invalid(_))), "{name:?} {ops:?} {days}");
        }
        assert!(matches!(grants.create("x", "default", "https://cf.example", "", &["status".to_string()], 7, 1), Err(GrantError::Invalid(_))));
        assert_eq!(grants.check("g_not-a-real-id", "status", "https://cf.example", None, 1), Err(GrantError::Unknown));
        let _ = std::fs::remove_dir_all(dir);
    }
}
