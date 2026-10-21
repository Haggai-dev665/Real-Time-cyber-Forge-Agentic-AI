//! The device's telemetry outbox (DEV-04).
//!
//! Events wait here, in `device_outbox.json` in the app's data folder, until the
//! backend has acknowledged the batch that carries them. A batch keeps its ID
//! until it is acknowledged, so sending it again after a lost answer stores
//! nothing twice on the backend. The queue is bounded: past MAX_QUEUED the
//! oldest events are dropped and counted, and the count is shown on the
//! Devices page. Events are recorded only while this computer is enrolled.
//!
//! A batch is never stuck: events older than the backend accepts (MAX_AGE_MS)
//! are dropped before a batch is made, and a batch the backend refuses as
//! invalid is dropped with the reason, instead of being sent again forever and
//! holding up everything queued behind it. A batch that was not answered (no
//! connection, a server error) is kept and sent again.
//!
//! What goes in: enforcement receipts (a block, unblock or allow and whether
//! the hosts file now enforces it) and changes in what this computer's own
//! checks confirm. No browsing history, page content or scan results.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

pub const MAX_QUEUED: usize = 500;
pub const BATCH_SIZE: usize = 100;
/// The backend takes events from the last 7 days; one hour less leaves room for clock differences.
pub const MAX_AGE_MS: u64 = 7 * 24 * 60 * 60 * 1000 - 60 * 60 * 1000;
const MAX_DATA_BYTES: usize = 2048;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct OutboxEvent {
    #[serde(rename = "type")]
    pub kind: String,
    /// Milliseconds since 1970.
    pub at: u64,
    pub data: Value,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Batch {
    pub batch_id: String,
    pub events: Vec<OutboxEvent>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct Outbox {
    #[serde(default)]
    pub queued: Vec<OutboxEvent>,
    /// The batch sent and not yet acknowledged; it is sent again, with the same ID.
    #[serde(default)]
    pub in_flight: Option<Batch>,
    #[serde(default)]
    pub dropped: u64,
    #[serde(default)]
    pub sent: u64,
    /// Why the backend last refused a batch, if it did.
    #[serde(default)]
    pub last_refusal: Option<String>,
}

impl Outbox {
    /// Queue an event, dropping (and counting) the oldest when the queue is full.
    pub fn push(&mut self, event: OutboxEvent) {
        self.queued.push(event);
        while self.queued.len() > MAX_QUEUED {
            self.queued.remove(0);
            self.dropped += 1;
        }
    }

    /// Drop (and count) queued events too old for the backend to take.
    pub fn drop_expired(&mut self, now_ms: u64) -> usize {
        let before = self.queued.len();
        self.queued.retain(|e| e.at.saturating_add(MAX_AGE_MS) > now_ms);
        let removed = before - self.queued.len();
        self.dropped += removed as u64;
        removed
    }

    /// The backend refused `batch_id` as invalid: sending it again would be refused
    /// the same way, so drop it, count its events, and keep the reason.
    pub fn refuse(&mut self, batch_id: &str, reason: &str) -> bool {
        match &self.in_flight {
            Some(batch) if batch.batch_id == batch_id => {
                self.dropped += batch.events.len() as u64;
                self.in_flight = None;
                self.last_refusal = Some(reason.chars().take(300).collect());
                true
            }
            _ => false,
        }
    }

    /// The batch to send: the one already in flight, or a new one from the queue.
    pub fn next_batch(&mut self, new_id: impl FnOnce() -> String) -> Option<Batch> {
        if let Some(batch) = &self.in_flight {
            return Some(batch.clone());
        }
        if self.queued.is_empty() {
            return None;
        }
        let take = self.queued.len().min(BATCH_SIZE);
        let batch = Batch { batch_id: new_id(), events: self.queued.drain(..take).collect() };
        self.in_flight = Some(batch.clone());
        Some(batch)
    }

    /// The backend acknowledged `batch_id`: forget the batch. False for any other ID.
    pub fn acknowledge(&mut self, batch_id: &str) -> bool {
        match &self.in_flight {
            Some(batch) if batch.batch_id == batch_id => {
                self.sent += batch.events.len() as u64;
                self.in_flight = None;
                true
            }
            _ => false,
        }
    }
}

// ── on disk ──────────────────────────────────────────────────────────────────

static LOCK: Mutex<()> = Mutex::new(());

fn outbox_path() -> Option<PathBuf> {
    crate::auth::config_dir().map(|d| d.join("device_outbox.json"))
}

pub fn load_at(path: &Path) -> Outbox {
    std::fs::read_to_string(path).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default()
}

pub fn save_at(path: &Path, outbox: &Outbox) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let staged = path.with_extension("json.new");
    std::fs::write(&staged, serde_json::to_string(outbox).unwrap_or_default()).map_err(|e| e.to_string())?;
    std::fs::rename(&staged, path).map_err(|e| e.to_string())
}

/// Change the outbox on disk, one change at a time.
pub fn update<T>(change: impl FnOnce(&mut Outbox) -> T) -> Result<T, String> {
    crate::ownership::ensure_owner()?;
    let _guard = LOCK.lock().unwrap_or_else(|p| p.into_inner());
    let path = outbox_path().ok_or("no data folder")?;
    let mut outbox = load_at(&path);
    let result = change(&mut outbox);
    save_at(&path, &outbox)?;
    Ok(result)
}

pub fn snapshot() -> Outbox {
    outbox_path().map(|p| load_at(&p)).unwrap_or_default()
}

/// Record an event while this computer is enrolled. Data over MAX_DATA_BYTES is not kept.
pub fn record(kind: &str, data: Value) {
    if !crate::device::is_enrolled() {
        return;
    }
    if serde_json::to_string(&data).map(|t| t.len()).unwrap_or(usize::MAX) > MAX_DATA_BYTES {
        return;
    }
    let at = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0);
    let _ = update(|outbox| outbox.push(OutboxEvent { kind: kind.into(), at, data }));
}

#[cfg(test)]
mod outbox_tests {
    use super::*;
    use serde_json::json;

    fn event(n: u64) -> OutboxEvent {
        OutboxEvent { kind: "enforcement".into(), at: n, data: json!({ "n": n }) }
    }

    #[test]
    fn a_full_queue_drops_the_oldest_and_counts_them() {
        let mut outbox = Outbox::default();
        for n in 0..(MAX_QUEUED as u64 + 7) {
            outbox.push(event(n));
        }
        assert_eq!(outbox.queued.len(), MAX_QUEUED);
        assert_eq!(outbox.dropped, 7);
        assert_eq!(outbox.queued[0].at, 7);
    }

    #[test]
    fn an_unacknowledged_batch_is_sent_again_with_the_same_id() {
        let mut outbox = Outbox::default();
        for n in 0..150 {
            outbox.push(event(n));
        }
        let first = outbox.next_batch(|| "batch-a".into()).unwrap();
        assert_eq!(first.events.len(), BATCH_SIZE);
        let again = outbox.next_batch(|| "batch-b".into()).unwrap();
        assert_eq!(again, first, "a resend keeps the ID and the events");
        assert!(!outbox.acknowledge("batch-b"));
        assert!(outbox.acknowledge("batch-a"));
        assert_eq!(outbox.sent, 100);
        let next = outbox.next_batch(|| "batch-c".into()).unwrap();
        assert_eq!((next.batch_id.as_str(), next.events.len(), next.events[0].at), ("batch-c", 50, 100));
        assert!(outbox.acknowledge("batch-c"));
        assert_eq!(outbox.next_batch(|| "unused".into()), None);
    }

    #[test]
    fn the_outbox_survives_a_restart() {
        let dir = std::env::temp_dir().join(format!("cf-outbox-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let path = dir.join("device_outbox.json");
        let mut outbox = Outbox::default();
        outbox.push(event(1));
        outbox.next_batch(|| "batch-a".into());
        outbox.push(event(2));
        save_at(&path, &outbox).unwrap();
        assert_eq!(load_at(&path), outbox);
        assert!(!dir.join("device_outbox.json.new").exists());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn events_too_old_for_the_backend_are_dropped_before_a_batch_is_made() {
        let now = 30 * 24 * 60 * 60 * 1000;
        let mut outbox = Outbox::default();
        outbox.push(event(now - MAX_AGE_MS - 1));
        outbox.push(event(now - MAX_AGE_MS + 1));
        outbox.push(event(now));
        assert_eq!(outbox.drop_expired(now), 1);
        assert_eq!(outbox.dropped, 1);
        assert_eq!(outbox.queued.len(), 2);
    }

    #[test]
    fn a_refused_batch_is_dropped_with_the_reason_and_the_queue_moves_on() {
        let mut outbox = Outbox::default();
        for n in 0..120 {
            outbox.push(event(n));
        }
        let first = outbox.next_batch(|| "batch-a".into()).unwrap();
        assert!(!outbox.refuse("batch-x", "wrong batch"));
        assert!(outbox.refuse(&first.batch_id, "Event 3 has a time outside the last 7 days. (TELEMETRY_EVENT_INVALID)"));
        assert_eq!(outbox.dropped, 100);
        assert!(outbox.last_refusal.as_deref().unwrap().contains("TELEMETRY_EVENT_INVALID"));
        let next = outbox.next_batch(|| "batch-b".into()).unwrap();
        assert_eq!((next.batch_id.as_str(), next.events.len()), ("batch-b", 20));
    }

    #[test]
    fn events_are_sent_in_the_shape_the_backend_takes() {
        let batch = Batch { batch_id: "batch-a".into(), events: vec![event(5)] };
        assert_eq!(
            serde_json::to_value(&batch).unwrap(),
            json!({ "batchId": "batch-a", "events": [{ "type": "enforcement", "at": 5, "data": { "n": 5 } }] })
        );
    }
}
