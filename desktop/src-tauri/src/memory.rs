//! Local-first vector memory (RAG for scans).
//!
//! Every scan/analysis writes an "episodic" memory — a feature-hashed embedding
//! + metadata — to a local JSON store (`~/.cyberforge-console/memories.json`).
//! Before a scan runs it recalls the most-similar past memories. The same
//! deterministic embedding (FNV-1a feature hashing, L2-normalized) is used on
//! the backend, so the local store can sync to `/api/memory/*` and stay
//! comparable. No external vector DB or embedding model required.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex as StdMutex};
use std::time::Duration;
use tauri::State;
use tokio::sync::Mutex;

type SharedState = Arc<Mutex<crate::state::AppState>>;

const DIM: usize = 128;
const MAX_MEMORIES: usize = 3000;

#[derive(Serialize, Deserialize, Clone)]
struct Memory {
    id: String,
    text: String,
    kind: String,
    #[serde(default)]
    url: Option<String>,
    #[serde(default)]
    category: Option<String>,
    #[serde(default)]
    risk: Option<i64>,
    ts: i64,
    emb: Vec<f32>,
    #[serde(default)]
    synced: bool,
    /// The account signed in when it was recorded. Only memories of the account
    /// that is signed in are ever uploaded, so a switch of account does not send
    /// one person's history to another's account (SEC-07). None: recorded by an
    /// older version, kept on this computer.
    #[serde(default)]
    owner: Option<String>,
    /// Kept on this computer: sync was withdrawn while it waited to upload.
    #[serde(default)]
    local_only: bool,
}

/// The account signed in now, from the cached profile.
fn signed_in_user() -> Option<String> {
    crate::auth::get_stored_user()
        .and_then(|text| serde_json::from_str::<Value>(&text).ok())
        .and_then(|user| user.get("id").and_then(|v| v.as_str()).map(String::from))
}

/// What may be uploaded for `uid`: not yet synced, not held back, and recorded
/// while that account was signed in.
fn upload_candidates(store: &[Memory], uid: &str) -> Vec<Memory> {
    store.iter().filter(|m| !m.synced && !m.local_only && m.owner.as_deref() == Some(uid)).cloned().collect()
}

/// Sync was withdrawn: everything waiting to upload stays on this computer. Returns how many.
pub fn hold_back_unsynced() -> usize {
    ensure_loaded();
    let (count, snapshot) = {
        let mut store = lock();
        let mut count = 0;
        for m in store.iter_mut().filter(|m| !m.synced && !m.local_only) {
            m.local_only = true;
            count += 1;
        }
        (count, store.clone())
    };
    persist(&snapshot);
    count
}

/// Delete every local memory. Returns how many were removed.
pub fn clear_all() -> usize {
    ensure_loaded();
    let removed = {
        let mut store = lock();
        let n = store.len();
        store.clear();
        n
    };
    persist(&[]);
    removed
}

static STORE: StdMutex<Vec<Memory>> = StdMutex::new(Vec::new());
static LOADED: AtomicBool = AtomicBool::new(false);

fn lock() -> std::sync::MutexGuard<'static, Vec<Memory>> {
    STORE.lock().unwrap_or_else(|e| e.into_inner())
}

/// Stable per-user directory for the local memory file. On Windows `HOME` is
/// usually unset, so older builds fell back to a cwd-relative path (which moved
/// with the working directory). We now pin it to the same per-user location the
/// rest of the app uses (`%APPDATA%\com.cyberforge.console` on Windows).
fn memory_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Ok(a) = std::env::var("APPDATA") {
            return PathBuf::from(a).join("com.cyberforge.console");
        }
        if let Ok(u) = std::env::var("USERPROFILE") {
            return PathBuf::from(u).join(".cyberforge-console");
        }
    }
    if let Ok(h) = std::env::var("HOME") {
        return PathBuf::from(h).join(".cyberforge-console");
    }
    PathBuf::from(".").join(".cyberforge-console")
}

fn memory_path() -> PathBuf {
    memory_dir().join("memories.json")
}

/// Locations older builds may have written to (cwd-relative / HOME), so a switch
/// to the stable path doesn't lose existing memories.
fn legacy_memory_paths() -> Vec<PathBuf> {
    let mut v = vec![PathBuf::from(".").join(".cyberforge-console").join("memories.json")];
    if let Ok(h) = std::env::var("HOME") {
        v.push(PathBuf::from(h).join(".cyberforge-console").join("memories.json"));
    }
    v
}

fn read_memories(p: &PathBuf) -> Option<Vec<Memory>> {
    std::fs::read_to_string(p)
        .ok()
        .and_then(|s| serde_json::from_str::<Vec<Memory>>(&s).ok())
}

/// Forget what is held in this process and read the file again: for a copy
/// that has just become the owner, so it does not write back an old copy over
/// what the previous owner saved.
pub fn reload_from_disk() {
    lock().clear();
    LOADED.store(false, Ordering::SeqCst);
    ensure_loaded();
}

fn ensure_loaded() {
    if LOADED.swap(true, Ordering::SeqCst) {
        return;
    }
    // Primary (stable) location.
    if let Some(mems) = read_memories(&memory_path()).filter(|m| !m.is_empty()) {
        *lock() = mems;
        return;
    }
    // Migrate from a legacy location once, then persist to the stable path.
    let target = memory_path();
    for p in legacy_memory_paths() {
        if p == target {
            continue;
        }
        if let Some(mems) = read_memories(&p).filter(|m| !m.is_empty()) {
            *lock() = mems.clone();
            persist(&mems);
            return;
        }
    }
}

fn persist(mems: &[Memory]) {
    // Only the owner of this computer's state writes the file (ownership.rs);
    // another copy keeps what it records for this session only.
    if !crate::ownership::is_owner_or_unenforced() {
        return;
    }
    let p = memory_path();
    if let Some(parent) = p.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(s) = serde_json::to_string(mems) {
        let _ = std::fs::write(&p, s);
    }
}

fn now_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn fnv1a(s: &str) -> u32 {
    let mut h: u32 = 0x811c9dc5;
    for b in s.bytes() {
        h ^= b as u32;
        h = h.wrapping_mul(0x0100_0193);
    }
    h
}

fn tokenize(text: &str) -> Vec<String> {
    text.to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|t| t.len() >= 2)
        .map(|t| t.to_string())
        .collect()
}

fn embed(text: &str) -> Vec<f32> {
    let mut v = vec![0f32; DIM];
    for tok in tokenize(text) {
        let idx = (fnv1a(&tok) as usize) % DIM;
        v[idx] += 1.0;
    }
    let norm: f32 = v.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm > 0.0 {
        for x in v.iter_mut() {
            *x /= norm;
        }
    }
    v
}

fn cosine(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() {
        return 0.0;
    }
    a.iter().zip(b).map(|(x, y)| x * y).sum()
}

/// Store a memory locally (also used directly by `scan_url`). Returns the id.
pub fn remember(
    text: &str,
    kind: &str,
    url: Option<String>,
    category: Option<String>,
    risk: Option<i64>,
) -> String {
    ensure_loaded();
    let id = format!("m{}-{:x}", now_secs(), fnv1a(text));
    let mem = Memory {
        id: id.clone(),
        text: text.to_string(),
        kind: kind.to_string(),
        url,
        category,
        risk,
        ts: now_secs(),
        emb: embed(text),
        synced: false,
        owner: signed_in_user(),
        local_only: false,
    };
    let snapshot = {
        let mut store = lock();
        store.push(mem);
        let len = store.len();
        if len > MAX_MEMORIES {
            store.drain(0..len - MAX_MEMORIES);
        }
        store.clone()
    };
    persist(&snapshot);
    id
}

/// Recall the top-k most similar memories to `query` (local cosine search).
pub fn recall(query: &str, k: usize) -> Vec<Value> {
    ensure_loaded();
    let q = embed(query);
    let store = lock();
    let mut scored: Vec<(f32, &Memory)> = store.iter().map(|m| (cosine(&q, &m.emb), m)).collect();
    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    scored
        .iter()
        .take(k)
        .filter(|(s, _)| *s > 0.02)
        .map(|(s, m)| {
            json!({
                "id": m.id, "text": m.text, "kind": m.kind, "url": m.url,
                "category": m.category, "risk": m.risk, "ts": m.ts,
                "score": (s * 1000.0).round() / 1000.0
            })
        })
        .collect()
}

#[tauri::command]
pub async fn memory_save(
    text: String,
    kind: Option<String>,
    url: Option<String>,
    category: Option<String>,
    risk: Option<i64>,
) -> Result<Value, String> {
    crate::ownership::ensure_owner()?;
    // what a page saves is kept and shown again: bounded, and one of the three kinds
    let text = crate::input::text(&text, "text", 4000)?;
    let kind = match kind.as_deref().map(str::trim) {
        None | Some("") => "episodic",
        Some(k @ ("episodic" | "semantic" | "procedural")) => k,
        Some(_) => return Err("kind must be episodic, semantic or procedural".into()),
    };
    let url = crate::input::optional_text(url.as_deref(), "url", 2048)?;
    let category = crate::input::optional_text(category.as_deref(), "category", 64)?;
    let risk = risk.map(|r| r.clamp(0, 100));
    let id = remember(&text, kind, url, category, risk);
    Ok(json!({ "success": true, "id": id }))
}

#[tauri::command]
pub async fn memory_search(query: String, top_k: Option<usize>) -> Result<Value, String> {
    let query: String = query.chars().take(1000).collect();
    let k = crate::input::count(top_k, 5, 1, 100);
    Ok(json!({ "success": true, "data": { "results": recall(&query, k) } }))
}

#[tauri::command]
pub async fn memory_list(limit: Option<usize>) -> Result<Value, String> {
    ensure_loaded();
    let store = lock();
    let total = store.len();
    let (mut ep, mut se, mut pr) = (0i64, 0i64, 0i64);
    for m in store.iter() {
        match m.kind.as_str() {
            "semantic" => se += 1,
            "procedural" => pr += 1,
            _ => ep += 1,
        }
    }
    let lim = crate::input::count(limit, 40, 1, 500);
    let memories: Vec<Value> = store
        .iter()
        .rev()
        .take(lim)
        .map(|m| {
            json!({ "id": m.id, "text": m.text, "kind": m.kind, "url": m.url,
                    "category": m.category, "risk": m.risk, "ts": m.ts })
        })
        .collect();
    Ok(json!({
        "success": true,
        "data": { "total": total, "episodic": ep, "semantic": se, "procedural": pr, "dim": DIM, "memories": memories }
    }))
}

/// Push unsynced local memories to the backend vector store (best-effort).
#[tauri::command]
pub async fn memory_sync(state: State<'_, SharedState>) -> Result<Value, String> {
    crate::ownership::ensure_owner()?;
    crate::privacy::require(crate::privacy::Feature::Sync)?;
    ensure_loaded();
    let (base, headers, uid) = {
        let s = state.lock().await;
        (
            s.backend_url.clone(),
            s.auth_headers(),
            s.current_user.as_ref().map(|u| u.id.clone()),
        )
    };
    let Some(uid) = uid else {
        return Ok(json!({ "success": false, "message": "not signed in" }));
    };
    let unsynced: Vec<Memory> = {
        let store = lock();
        upload_candidates(&store, &uid)
    };
    if unsynced.is_empty() {
        return Ok(json!({ "success": true, "pushed": 0 }));
    }
    let client = reqwest::Client::new();
    let mut pushed = 0;
    let mut pushed_ids: Vec<String> = Vec::new();
    for m in &unsynced {
        let mut req = client
            .post(format!("{}/api/memory/save", base))
            .timeout(Duration::from_secs(12))
            .json(&json!({
                "userId": uid, "id": m.id, "text": m.text, "kind": m.kind,
                "url": m.url, "category": m.category, "risk": m.risk, "ts": m.ts
            }));
        for (k, v) in &headers {
            req = req.header(k, v);
        }
        if req.send().await.map(|r| r.status().is_success()).unwrap_or(false) {
            pushed += 1;
            pushed_ids.push(m.id.clone());
        }
    }
    if pushed > 0 {
        let snapshot = {
            let mut store = lock();
            // only the ones that went up: a failed upload is tried again next time
            for m in store.iter_mut().filter(|m| pushed_ids.contains(&m.id)) {
                m.synced = true;
            }
            store.clone()
        };
        persist(&snapshot);
    }
    Ok(json!({ "success": true, "pushed": pushed }))
}

#[cfg(test)]
mod sync_tests {
    use super::*;

    fn memory(id: &str, owner: Option<&str>, synced: bool, local_only: bool) -> Memory {
        Memory {
            id: id.into(), text: "t".into(), kind: "episodic".into(), url: None, category: None, risk: None, ts: 0,
            emb: vec![], synced, owner: owner.map(String::from), local_only,
        }
    }

    #[test]
    fn only_the_signed_in_accounts_own_unsynced_memories_are_uploaded() {
        let store = vec![
            memory("alice-new", Some("alice"), false, false),
            memory("alice-done", Some("alice"), true, false),
            memory("alice-held", Some("alice"), false, true),
            memory("bob-new", Some("bob"), false, false),
            memory("older-version", None, false, false),
        ];
        let ids = |uid: &str| upload_candidates(&store, uid).into_iter().map(|m| m.id).collect::<Vec<_>>();
        assert_eq!(ids("alice"), vec!["alice-new"]);
        // after switching to bob, alice's backlog is not sent to bob's account
        assert_eq!(ids("bob"), vec!["bob-new"]);
        assert!(ids("carol").is_empty());
    }
}
