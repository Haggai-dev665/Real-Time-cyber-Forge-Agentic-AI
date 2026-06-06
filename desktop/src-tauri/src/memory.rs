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
    if text.trim().is_empty() {
        return Err("text is required".into());
    }
    let id = remember(&text, kind.as_deref().unwrap_or("episodic"), url, category, risk);
    Ok(json!({ "success": true, "id": id }))
}

#[tauri::command]
pub async fn memory_search(query: String, top_k: Option<usize>) -> Result<Value, String> {
    Ok(json!({ "success": true, "data": { "results": recall(&query, top_k.unwrap_or(5)) } }))
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
    let lim = limit.unwrap_or(40);
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
        store.iter().filter(|m| !m.synced).cloned().collect()
    };
    if unsynced.is_empty() {
        return Ok(json!({ "success": true, "pushed": 0 }));
    }
    let client = reqwest::Client::new();
    let mut pushed = 0;
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
        }
    }
    if pushed > 0 {
        let snapshot = {
            let mut store = lock();
            for m in store.iter_mut() {
                m.synced = true;
            }
            store.clone()
        };
        persist(&snapshot);
    }
    Ok(json!({ "success": true, "pushed": pushed }))
}
