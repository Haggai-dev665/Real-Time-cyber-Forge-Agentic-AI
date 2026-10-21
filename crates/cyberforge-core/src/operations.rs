//! The operation registry (plan-update-v2.md §4.1).
//!
//! One table of what CyberForge can be asked to do from outside the desktop
//! window: by the CLI now, through the desktop broker, and by the MCP server
//! later. Each entry states where it runs, what data it shares, what it needs,
//! what it changes, how long it may take, whether repeating it is safe, and
//! what the backend audits. Only operations that work are listed; a surface
//! offers exactly the operations listed for it, which the CLI's tests check
//! against its command tree.
//!
//! Authorisation is enforced by the services and the backend, not by this
//! table; the table is what clients are told and what tests hold them to.

use serde::Serialize;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Location {
    /// Runs on this computer only.
    Local,
    /// Calls the profile's backend.
    Backend,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DataSharing {
    /// Sends nothing about the user anywhere.
    None,
    /// Sends the account's credentials or session to the profile's backend.
    AccountCredentials,
    /// Sends the address the user gives, with credentials removed, to the
    /// profile's backend and from there to its ML service, with the session.
    TargetAddress,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Requires {
    /// Anyone who can run the program.
    Nothing,
    /// The same operating-system user as the desktop that answers.
    SameOsUser,
    /// A signed-in profile.
    Session,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SideEffects {
    None,
    /// Writes or removes this profile's entry in the credential store.
    CredentialStore,
    /// Writes the CLI's profiles file.
    LocalConfig,
    /// Starts or ends a session at the backend.
    BackendSession,
    /// Holds this computer's state, so no other program changes it meanwhile.
    LocalOwnership,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Surface {
    Cli,
    Broker,
    /// Offered to AI clients by the MCP server, under a grant.
    Mcp,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
pub struct Operation {
    pub id: &'static str,
    pub summary: &'static str,
    /// Version of this operation's input and output.
    pub schema_version: u32,
    pub location: Location,
    pub data_sharing: DataSharing,
    pub requires: Requires,
    pub side_effects: &'static [SideEffects],
    pub timeout_secs: u64,
    /// Repeating it with the same input leaves the same result.
    pub idempotent: bool,
    /// The backend audit action it records, if any.
    pub audit: Option<&'static str>,
    pub surfaces: &'static [Surface],
}

const CLI: &[Surface] = &[Surface::Cli];
const CLI_AND_MCP: &[Surface] = &[Surface::Cli, Surface::Mcp];

pub const OPERATIONS: &[Operation] = &[
    Operation {
        id: "version",
        summary: "The program's version, output schema and platform.",
        schema_version: 1,
        location: Location::Local,
        data_sharing: DataSharing::None,
        requires: Requires::Nothing,
        side_effects: &[],
        timeout_secs: 1,
        idempotent: true,
        audit: None,
        surfaces: CLI,
    },
    Operation {
        id: "status",
        summary: "Backend health, credential store, session and desktop broker. Writes nothing.",
        schema_version: 1,
        location: Location::Backend,
        data_sharing: DataSharing::AccountCredentials,
        requires: Requires::Nothing,
        side_effects: &[],
        timeout_secs: 30,
        idempotent: true,
        audit: None,
        surfaces: CLI_AND_MCP,
    },
    Operation {
        id: "auth.login",
        summary: "Sign the profile in with email and password and keep the session in the credential store.",
        schema_version: 1,
        location: Location::Backend,
        data_sharing: DataSharing::AccountCredentials,
        requires: Requires::Nothing,
        side_effects: &[SideEffects::BackendSession, SideEffects::CredentialStore],
        timeout_secs: 30,
        idempotent: false,
        audit: Some("auth.login"),
        surfaces: CLI,
    },
    Operation {
        id: "auth.status",
        summary: "Whether the profile is signed in and the backend accepts the session.",
        schema_version: 1,
        location: Location::Backend,
        data_sharing: DataSharing::AccountCredentials,
        requires: Requires::Nothing,
        side_effects: &[],
        timeout_secs: 30,
        idempotent: true,
        audit: None,
        surfaces: CLI,
    },
    Operation {
        id: "auth.logout",
        summary: "Remove the profile's session from this computer and tell the backend. The token is not revoked.",
        schema_version: 1,
        location: Location::Backend,
        data_sharing: DataSharing::AccountCredentials,
        requires: Requires::Nothing,
        side_effects: &[SideEffects::BackendSession, SideEffects::CredentialStore],
        timeout_secs: 30,
        idempotent: true,
        audit: Some("auth.logout"),
        surfaces: CLI,
    },
    Operation {
        id: "profile.list",
        summary: "Profiles, their backends, the current one, and whether each keeps a session.",
        schema_version: 1,
        location: Location::Local,
        data_sharing: DataSharing::None,
        requires: Requires::Nothing,
        side_effects: &[],
        timeout_secs: 5,
        idempotent: true,
        audit: None,
        surfaces: CLI,
    },
    Operation {
        id: "profile.use",
        summary: "Make an existing profile the current one.",
        schema_version: 1,
        location: Location::Local,
        data_sharing: DataSharing::None,
        requires: Requires::Nothing,
        side_effects: &[SideEffects::LocalConfig],
        timeout_secs: 5,
        idempotent: true,
        audit: None,
        surfaces: CLI,
    },
    Operation {
        id: "config.list",
        summary: "The selected profile's settings.",
        schema_version: 1,
        location: Location::Local,
        data_sharing: DataSharing::None,
        requires: Requires::Nothing,
        side_effects: &[],
        timeout_secs: 5,
        idempotent: true,
        audit: None,
        surfaces: CLI,
    },
    Operation {
        id: "config.get",
        summary: "One setting of the selected profile.",
        schema_version: 1,
        location: Location::Local,
        data_sharing: DataSharing::None,
        requires: Requires::Nothing,
        side_effects: &[],
        timeout_secs: 5,
        idempotent: true,
        audit: None,
        surfaces: CLI,
    },
    Operation {
        id: "config.set",
        summary: "Change a setting of the selected profile; a new origin removes the old origin's session.",
        schema_version: 1,
        location: Location::Local,
        data_sharing: DataSharing::None,
        requires: Requires::Nothing,
        side_effects: &[SideEffects::LocalConfig, SideEffects::CredentialStore],
        timeout_secs: 5,
        idempotent: true,
        audit: None,
        surfaces: CLI,
    },
    Operation {
        id: "broker.status",
        summary: "Which program owns this computer's CyberForge state, and what it owns.",
        schema_version: 1,
        location: Location::Local,
        data_sharing: DataSharing::None,
        requires: Requires::SameOsUser,
        side_effects: &[],
        timeout_secs: 5,
        idempotent: true,
        audit: None,
        surfaces: &[Surface::Cli, Surface::Broker],
    },
    Operation {
        id: "models.status",
        summary: "What the ML service can do now: each capability's kind, readiness and limits, from the backend.",
        schema_version: 1,
        location: Location::Backend,
        data_sharing: DataSharing::AccountCredentials,
        requires: Requires::Session,
        side_effects: &[],
        timeout_secs: 30,
        idempotent: true,
        audit: None,
        surfaces: CLI_AND_MCP,
    },
    Operation {
        id: "scan.url",
        summary: "Analyse one URL with the ML service through the backend; credentials are removed first. A versioned verdict: threat, benign or unknown.",
        schema_version: 1,
        location: Location::Backend,
        data_sharing: DataSharing::TargetAddress,
        requires: Requires::Session,
        side_effects: &[],
        timeout_secs: 90,
        idempotent: true,
        audit: None,
        surfaces: CLI_AND_MCP,
    },
    Operation {
        id: "broker.hold",
        summary: "Take this computer's state and hold it, running nothing on it, until released. Never taken from a running owner.",
        schema_version: 1,
        location: Location::Local,
        data_sharing: DataSharing::None,
        requires: Requires::Nothing,
        side_effects: &[SideEffects::LocalOwnership],
        timeout_secs: 86_400,
        idempotent: false,
        audit: None,
        surfaces: CLI,
    },
    Operation {
        id: "mcp.serve",
        summary: "Serve the MCP tools of one approved client grant over standard input and output.",
        schema_version: 1,
        location: Location::Local,
        data_sharing: DataSharing::None,
        requires: Requires::Nothing,
        side_effects: &[],
        timeout_secs: 86_400,
        idempotent: true,
        audit: None,
        surfaces: CLI,
    },
    Operation {
        id: "mcp.grant.create",
        summary: "Approve an AI client: a grant naming the operations it may use, for the signed-in profile.",
        schema_version: 1,
        location: Location::Local,
        data_sharing: DataSharing::None,
        requires: Requires::Nothing,
        side_effects: &[SideEffects::LocalConfig],
        timeout_secs: 30,
        idempotent: false,
        audit: None,
        surfaces: CLI,
    },
    Operation {
        id: "mcp.grant.list",
        summary: "The AI clients approved on this computer, active and revoked.",
        schema_version: 1,
        location: Location::Local,
        data_sharing: DataSharing::None,
        requires: Requires::Nothing,
        side_effects: &[],
        timeout_secs: 5,
        idempotent: true,
        audit: None,
        surfaces: CLI,
    },
    Operation {
        id: "mcp.grant.revoke",
        summary: "Revoke an AI client's grant; its next call is refused.",
        schema_version: 1,
        location: Location::Local,
        data_sharing: DataSharing::None,
        requires: Requires::Nothing,
        side_effects: &[SideEffects::LocalConfig],
        timeout_secs: 5,
        idempotent: true,
        audit: None,
        surfaces: CLI,
    },
    Operation {
        id: "mcp.config",
        summary: "The configuration an AI client needs for a grant, with no secret in it.",
        schema_version: 1,
        location: Location::Local,
        data_sharing: DataSharing::None,
        requires: Requires::Nothing,
        side_effects: &[],
        timeout_secs: 5,
        idempotent: true,
        audit: None,
        surfaces: CLI,
    },
];

/// The MCP tool name of an operation offered to AI clients (plan §5.2).
pub fn mcp_tool_name(id: &str) -> Option<&'static str> {
    match id {
        "status" => Some("cyberforge_status"),
        "models.status" => Some("cyberforge_model_status"),
        "scan.url" => Some("cyberforge_analyze_url"),
        _ => None,
    }
}

pub fn find(id: &str) -> Option<&'static Operation> {
    OPERATIONS.iter().find(|op| op.id == id)
}

/// The operations a surface offers.
pub fn for_surface(surface: Surface) -> impl Iterator<Item = &'static Operation> {
    OPERATIONS.iter().filter(move |op| op.surfaces.contains(&surface))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ids_are_unique_and_well_formed() {
        let mut ids: Vec<_> = OPERATIONS.iter().map(|op| op.id).collect();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), OPERATIONS.len());
        for op in OPERATIONS {
            assert!(op.id.chars().all(|c| c.is_ascii_lowercase() || c == '.' || c == '_'), "{}", op.id);
            assert!(op.timeout_secs > 0 && (op.timeout_secs <= 300 || op.side_effects == [SideEffects::LocalOwnership] || op.id == "mcp.serve"), "{}", op.id);
            assert!(!op.surfaces.is_empty(), "{}", op.id);
        }
    }

    #[test]
    fn declarations_are_consistent() {
        for op in OPERATIONS {
            // Whatever reaches the backend says what it shares; local work shares nothing.
            if op.location == Location::Local {
                assert_eq!(op.data_sharing, DataSharing::None, "{}", op.id);
            }
            if op.side_effects.contains(&SideEffects::BackendSession) {
                assert_eq!(op.location, Location::Backend, "{}", op.id);
                assert!(op.audit.is_some(), "{} changes a backend session, so the backend audits it", op.id);
            }
        }
        // Through the broker only what is read-only for now: everything else needs
        // a client grant, which arrives with the MCP server.
        for op in for_surface(Surface::Broker) {
            assert!(op.side_effects.is_empty(), "{}", op.id);
            assert_eq!(op.requires, Requires::SameOsUser, "{}", op.id);
        }
        // AI clients get read-only operations, each with a tool name.
        for op in for_surface(Surface::Mcp) {
            assert!(op.side_effects.is_empty(), "{} changes something; AI clients may not", op.id);
            assert!(mcp_tool_name(op.id).is_some(), "{} has no MCP tool name", op.id);
        }
        // What the user hands over leaves only with a signed-in session, to that profile's backend.
        for op in OPERATIONS.iter().filter(|op| op.data_sharing == DataSharing::TargetAddress) {
            assert_eq!((op.location, op.requires), (Location::Backend, Requires::Session), "{}", op.id);
        }
        assert!(find("broker.status").is_some());
        assert!(find("ai.ask").is_none(), "nothing is listed before it works");
    }
}
