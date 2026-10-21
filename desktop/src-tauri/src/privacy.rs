//! What this app may collect and send, as the user chose it (SEC-07).
//!
//! Five separate controls, each off until the user decides:
//!   history_access   read the browsers' history files on this computer
//!   active_tab       watch the address in the active browser tab
//!   cloud_scanning   send addresses to the CyberForge backend for analysis
//!   llm_processing   send assistant questions to a language model
//!   sync             copy local memory and browser information to the account
//!
//! The choices are kept in `privacy.json` with the consent version they were
//! made under and when; a later consent version counts as undecided again. The
//! commands that collect or send check here first (`require`), so a page cannot
//! get past a choice, and the background history collector does too.
//! Withdrawing `sync` takes everything not yet uploaded out of the upload queue.

use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::Mutex;

// The model, its consent rules and its file format are shared (cyberforge_core::privacy).
pub use cyberforge_core::privacy::{describe, load_at, save_at, Feature, Settings};

static LOCK: Mutex<()> = Mutex::new(());

fn settings_path() -> Option<PathBuf> {
    crate::auth::config_dir().map(|d| d.join("privacy.json"))
}

pub fn current() -> Settings {
    settings_path().map(|p| load_at(&p)).unwrap_or_default()
}

pub fn allowed(feature: Feature) -> bool {
    current().allows(feature)
}

/// For a command that collects or sends: an error the page shows as it is.
pub fn require(feature: Feature) -> Result<(), String> {
    if allowed(feature) {
        Ok(())
    } else {
        Err(cyberforge_core::privacy::refusal(feature))
    }
}

fn now_ms() -> u64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

// ── commands ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn privacy_get() -> Result<Value, String> {
    Ok(describe(&current()))
}

/// Save choices, e.g. `{ "cloud_scanning": true, "sync": false }`.
#[tauri::command]
pub async fn privacy_set(choices: serde_json::Map<String, Value>) -> Result<Value, String> {
    crate::ownership::ensure_owner()?;
    let (settings, turned_off) = {
        let _guard = LOCK.lock().unwrap_or_else(|p| p.into_inner());
        let path = settings_path().ok_or("no data folder")?;
        let mut settings = load_at(&path);
        let turned_off = settings.apply(&choices, now_ms())?;
        save_at(&path, &settings)?;
        (settings, turned_off)
    };
    let mut effects = Vec::new();
    if turned_off.iter().any(|f| f == "sync") {
        let held = crate::memory::hold_back_unsynced();
        effects.push(format!("{held} memories waiting to upload were kept on this computer only"));
    }
    if turned_off.iter().any(|f| f == "history_access") {
        effects.push("browser history is no longer read; the copy already on this computer stays until you clear it".into());
    }
    let mut out = describe(&settings);
    out["effects"] = json!(effects);
    Ok(out)
}

/// Delete the copy of browser history this app keeps.
#[tauri::command]
pub async fn privacy_clear_history(state: tauri::State<'_, std::sync::Arc<tokio::sync::Mutex<crate::state::AppState>>>) -> Result<Value, String> {
    crate::ownership::ensure_owner()?;
    let removed = crate::system::clear_collected_history(state.inner()).await;
    Ok(json!({ "cleared": true, "filesRemoved": removed }))
}

/// Delete this computer's local memory (what the assistant recalls). Synced copies are not affected.
#[tauri::command]
pub async fn privacy_clear_memory() -> Result<Value, String> {
    crate::ownership::ensure_owner()?;
    Ok(json!({ "cleared": true, "memoriesRemoved": crate::memory::clear_all() }))
}
