//! Who owns this computer's CyberForge state (V2-01).
//!
//! At start the app tries to become the owner through the shared broker
//! (`cyberforge_core::broker`): on Windows, a per-user named pipe whose first
//! instance is the lock. The owner alone runs the enrolled-device loop, sends
//! this device's signed messages, keeps the device outbox and changes the hosts
//! file. A second copy of the app, or one started while `cyberforge broker
//! hold` holds the lock, still opens, refuses those changes with a
//! reason instead of competing with the owner (two loops would reuse device
//! sequence numbers), and takes over once the owner has exited.
//!
//! Where there is no broker (other platforms, or the pipe could not be made),
//! ownership is not enforced and the app behaves as it did before.

use cyberforge_core::broker::{self, Claim, OwnerInfo};
use serde_json::{json, Value};
use std::sync::Mutex;

/// What the owner alone changes, as reported to clients of the broker.
pub const OWNS: &[&str] = &["device_loop", "device_messages", "device_outbox", "hosts_file", "local_memory", "history_copy", "privacy_settings"];

#[derive(Clone, Debug, PartialEq)]
pub enum Ownership {
    /// This copy of the app owns the state and answers the broker.
    Owner,
    /// Another program of this user owns it.
    Secondary,
    /// No broker: not enforced, for this reason.
    Unenforced(String),
}

static OWNERSHIP: Mutex<Option<Ownership>> = Mutex::new(None);

fn current() -> Option<Ownership> {
    OWNERSHIP.lock().unwrap_or_else(|p| p.into_inner()).clone()
}

fn set(ownership: Ownership) {
    *OWNERSHIP.lock().unwrap_or_else(|p| p.into_inner()) = Some(ownership);
}

fn started_at() -> u64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

fn info() -> OwnerInfo {
    OwnerInfo {
        owner: "desktop".into(),
        version: env!("CARGO_PKG_VERSION").into(),
        pid: std::process::id(),
        started_at: started_at(),
        owns: OWNS.iter().map(|s| s.to_string()).collect(),
    }
}

/// One attempt. Must run inside the app's async runtime; the broker then
/// answers clients there for as long as the app runs.
fn attempt() -> Ownership {
    match broker::claim(info()) {
        Claim::Owner(owner) => {
            tauri::async_runtime::spawn(owner.serve());
            Ownership::Owner
        }
        Claim::HeldByAnother => Ownership::Secondary,
        Claim::Unsupported(reason) | Claim::Failed(reason) => Ownership::Unenforced(reason),
    }
}

/// Try to become the owner, at start.
pub fn claim() -> Ownership {
    if let Some(known) = current() {
        return known;
    }
    let result = tauri::async_runtime::block_on(async { attempt() });
    set(result.clone());
    result
}

/// For a copy that started second: try again every ten seconds, and once the
/// owner has gone and this copy holds the lock, run `became_owner` (which
/// starts the device loop). Nothing changes while another program owns it.
pub fn take_over_when_free(became_owner: impl FnOnce() + Send + 'static) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(10)).await;
            if current() != Some(Ownership::Secondary) {
                return;
            }
            let result = attempt();
            if result != Ownership::Secondary {
                eprintln!("CyberForge: local state owner: {:?}", result);
                set(result);
                became_owner();
                return;
            }
        }
    });
}

/// Whether this copy may run the device loop and change device state.
pub fn is_owner_or_unenforced() -> bool {
    current() != Some(Ownership::Secondary)
}

/// `Err` with a reason when another program owns this computer's state.
pub fn ensure_owner() -> Result<(), String> {
    if is_owner_or_unenforced() {
        Ok(())
    } else {
        Err("Another CyberForge program owns this computer's device state (another window, or `cyberforge broker hold`), so this window does not change it. Make the change there, or close or release it; this window takes over within ten seconds.".into())
    }
}

/// For the device screen.
pub fn describe() -> Value {
    match current() {
        Some(Ownership::Owner) => json!({ "state": "this_app", "owns": OWNS }),
        Some(Ownership::Secondary) => json!({ "state": "another_program" }),
        Some(Ownership::Unenforced(reason)) => json!({ "state": "not_enforced", "reason": reason }),
        None => json!({ "state": "not_claimed" }),
    }
}
