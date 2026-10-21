//! `cyberforge broker status | hold`.
//!
//! `hold` is the CLI-owned local runtime the plan allows (§4.1): it takes the
//! same per-user lock the desktop app takes, explicitly, and answers the
//! broker as owner `cli` until it is stopped. It runs no device loop, so while
//! it holds the lock no CyberForge program changes this computer's device
//! state, outbox, hosts file, local memory or privacy settings. It never takes
//! the lock from a running owner.

use crate::out::{exit, Outcome};
use cyberforge_core::broker::{self, Claim, OwnerInfo, QueryError};
use cyberforge_core::text::printable;
use serde_json::json;
use std::time::Duration;

pub async fn status() -> Outcome {
    const CMD: &str = "broker status";
    match broker::query(Duration::from_secs(3)).await {
        Ok(info) => {
            let owner = printable(&info.owner, 20);
            let owns = info.owns.iter().take(16).map(|s| printable(s, 40)).collect::<Vec<_>>();
            let text = if owns.is_empty() {
                format!("{} {} (process {}) holds this computer's CyberForge state and runs nothing on it.", owner, printable(&info.version, 40), info.pid)
            } else {
                format!("{} {} (process {}) owns this computer's CyberForge state: {}.", owner, printable(&info.version, 40), info.pid, owns.join(", "))
            };
            Outcome::done(CMD, json!({ "state": "attached", "owner": owner, "version": info.version, "pid": info.pid, "started_at": info.started_at, "owns": owns }), text)
        }
        Err(QueryError::NotRunning) => Outcome {
            command: CMD,
            code: exit::UNAVAILABLE,
            data: json!({ "state": "not_running" }),
            error: None,
            warnings: vec![],
            text: "No CyberForge program owns this computer's state now.".into(),
        },
        Err(QueryError::Untrusted(reason)) => Outcome::failed(CMD, exit::FAILURE, "BROKER_UNTRUSTED", format!("Something answers on CyberForge's broker name but not as you; it was not trusted ({}).", reason)),
        Err(QueryError::Unsupported(reason)) | Err(QueryError::Failed(reason)) => Outcome::failed(CMD, exit::UNAVAILABLE, "BROKER_UNAVAILABLE", reason),
    }
}

pub async fn hold(seconds: Option<u64>, as_json: bool) -> Outcome {
    const CMD: &str = "broker hold";
    let started_at = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let info = OwnerInfo { owner: "cli".into(), version: env!("CARGO_PKG_VERSION").into(), pid: std::process::id(), started_at, owns: vec![] };
    let owner = match broker::claim(info) {
        Claim::Owner(owner) => owner,
        Claim::HeldByAnother => {
            let who = match broker::query(Duration::from_secs(3)).await {
                Ok(info) => format!("{} (process {})", printable(&info.owner, 20), info.pid),
                Err(_) => "another program".into(),
            };
            return Outcome::failed(CMD, exit::CONFLICT, "HELD_BY_ANOTHER", format!("{} owns this computer's CyberForge state; it was not taken from it.", who));
        }
        Claim::Unsupported(reason) | Claim::Failed(reason) => return Outcome::failed(CMD, exit::UNAVAILABLE, "BROKER_UNAVAILABLE", reason),
    };
    if !as_json {
        eprintln!(
            "Holding this computer's CyberForge state (process {}). No CyberForge window changes device state meanwhile. {}",
            std::process::id(),
            match seconds {
                Some(s) => format!("Releasing in {} s, or press Ctrl+C.", s),
                None => "Press Ctrl+C to release.".into(),
            }
        );
    }
    let serving = tokio::spawn(owner.serve());
    let interrupted = match seconds {
        Some(s) => tokio::select! {
            _ = tokio::time::sleep(Duration::from_secs(s)) => false,
            _ = tokio::signal::ctrl_c() => true,
        },
        None => {
            let _ = tokio::signal::ctrl_c().await;
            true
        }
    };
    serving.abort();
    let _ = serving.await;
    let mut outcome = Outcome::done(
        CMD,
        json!({ "held_for_seconds": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0).saturating_sub(started_at), "interrupted": interrupted }),
        "Released this computer's CyberForge state.".into(),
    );
    if interrupted {
        outcome.code = exit::INTERRUPTED;
    }
    outcome
}
