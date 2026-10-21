//! `cyberforge mcp serve | grant create | grant list | grant revoke | config`.
//!
//! An AI client is approved with a grant (see `cyberforge_core::grants`), then
//! launches `cyberforge mcp serve --stdio --grant <id>`, which serves only what
//! that grant includes (`cyberforge_mcp`).

use crate::out::{exit, Outcome};
use crate::{Ctx, USER_AGENT};
use cyberforge_core::grants::{self, Grant, GrantStore};
use serde_json::{json, Value};
use std::sync::Arc;
use std::time::Duration;

fn grant_json(g: &Grant) -> Value {
    g.to_json(grants::now_secs())
}

/// What an AI client's configuration needs: this program and the grant. No secret.
pub fn client_config(grant_id: &str) -> Value {
    let command = std::env::current_exe().map(|p| p.to_string_lossy().to_string()).unwrap_or_else(|_| "cyberforge".into());
    grants::client_config(&command, grant_id)
}

pub async fn grant_create(ctx: &Ctx, name: &str, allow: &[String], days: u64) -> Outcome {
    const CMD: &str = "mcp grant create";
    let profile = match ctx.profile(CMD) {
        Ok(profile) => profile,
        Err(outcome) => return outcome,
    };
    let dir = match ctx.dir(CMD) {
        Ok(dir) => dir,
        Err(outcome) => return outcome,
    };
    match cyberforge_core::ops::approve_mcp_client(&dir, &profile, &ctx.store(), &ctx.client(), name, allow, days).await {
        Ok(grant) => {
            let config = client_config(&grant.id);
            let text = format!(
                "Approved {} (grant {}) for profile {} at {}: {}. Expires in {} days.\nAdd this to the client's MCP configuration:\n{}",
                grant.client_name, grant.id, grant.profile, grant.origin, grant.operations.join(", "), days,
                serde_json::to_string_pretty(&config).unwrap_or_default()
            );
            Outcome::done(CMD, json!({ "grant": grant_json(&grant), "clientConfig": config }), text)
        }
        Err(error) => crate::out::from_op(CMD, error),
    }
}

pub fn grant_list(ctx: &Ctx) -> Outcome {
    const CMD: &str = "mcp grant list";
    let dir = match ctx.dir(CMD) {
        Ok(dir) => dir,
        Err(outcome) => return outcome,
    };
    match GrantStore::in_dir(&dir).list() {
        Ok(list) => {
            let rows: Vec<Value> = list.iter().map(grant_json).collect();
            let text = if rows.is_empty() {
                "No AI client is approved. Approve one with: cyberforge mcp grant create --name \"Claude Desktop\"".to_string()
            } else {
                rows.iter().map(|g| format!("{}  {:<8} {:<20} {}", g["id"].as_str().unwrap_or(""), g["state"].as_str().unwrap_or(""), g["clientName"].as_str().unwrap_or(""), g["operations"].as_array().map(|o| o.iter().filter_map(Value::as_str).collect::<Vec<_>>().join(", ")).unwrap_or_default())).collect::<Vec<_>>().join("\n")
            };
            Outcome::done(CMD, json!({ "grants": rows }), text)
        }
        Err(error) => Outcome::failed(CMD, exit::FAILURE, error.code(), error.message()),
    }
}

pub fn grant_revoke(ctx: &Ctx, id: &str) -> Outcome {
    const CMD: &str = "mcp grant revoke";
    let dir = match ctx.dir(CMD) {
        Ok(dir) => dir,
        Err(outcome) => return outcome,
    };
    match GrantStore::in_dir(&dir).revoke(id, grants::now_secs()) {
        Ok(grant) => Outcome::done(CMD, json!({ "grant": grant_json(&grant) }), format!("Revoked {} ({}). Its next call is refused.", grant.client_name, grant.id)),
        Err(error) => Outcome::failed(CMD, if matches!(error, grants::GrantError::Unknown) { exit::USAGE } else { exit::FAILURE }, error.code(), error.message()),
    }
}

pub fn config(ctx: &Ctx, id: &str) -> Outcome {
    const CMD: &str = "mcp config";
    let dir = match ctx.dir(CMD) {
        Ok(dir) => dir,
        Err(outcome) => return outcome,
    };
    match GrantStore::in_dir(&dir).active(id, grants::now_secs()) {
        Ok(grant) => {
            let config = client_config(&grant.id);
            Outcome::done(CMD, json!({ "grant": grant_json(&grant), "clientConfig": config }), serde_json::to_string_pretty(&config).unwrap_or_default())
        }
        Err(error) => Outcome::failed(CMD, exit::USAGE, error.code(), error.message()),
    }
}

/// The server. Nothing but protocol goes to standard output.
pub async fn serve(ctx: &Ctx, grant: &str, timeout: u64) -> u8 {
    let dir = match ctx.dir("mcp serve") {
        Ok(dir) => dir,
        Err(_) => {
            eprintln!("cyberforge mcp: no configuration directory could be found for this user");
            return exit::FAILURE;
        }
    };
    let config = cyberforge_mcp::Config { dir, grant_id: grant.to_string(), store: Arc::new(ctx.store()), user_agent: USER_AGENT.to_string(), timeout: Duration::from_secs(timeout) };
    match cyberforge_mcp::serve_stdio(config).await {
        Ok(()) => exit::OK,
        Err(message) => {
            eprintln!("cyberforge mcp: {}", cyberforge_core::text::printable(&message, 300));
            exit::AUTH
        }
    }
}
