//! The live feed, read in the native layer.
//!
//! The backend's `/api/stream` is a Server-Sent Events stream of this account's
//! scans, alerts and threat intelligence. It used to be opened by a script in
//! each page. That cannot work in a built app: the content security policy
//! allows a page to talk only to the app itself, so the connection is refused.
//! It also needed the session token inside the page.
//!
//! Here one task holds the connection for the whole app. It signs in with the
//! `Authorization` header, so no token is in an address, forwards every event
//! to every window as the Tauri event `cf-stream`, and reports whether it is
//! connected as `cf-stream-status`. Pages only listen.
//!
//! On reconnect it sends the ID of the last event it received, and the server
//! replays what was missed, once.

use serde_json::{json, Value};
use std::sync::{Arc, Mutex as StdMutex, OnceLock};
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

use crate::state::AppState;

type SharedState = Arc<Mutex<AppState>>;

/// The server sends a comment line every 25 seconds. Longer than this with
/// nothing at all means the connection is dead even if it has not said so.
const IDLE_LIMIT: Duration = Duration::from_secs(70);
/// How often a quiet connection checks that the session it belongs to is still
/// the one signed in.
const SESSION_CHECK: Duration = Duration::from_secs(5);
const MAX_BACKOFF: Duration = Duration::from_secs(30);

// ── Server-Sent Events ──

/// One event from the stream.
#[derive(Debug, Default, PartialEq, Eq)]
pub struct Frame {
    pub event: Option<String>,
    pub data: String,
    pub id: Option<String>,
}

/// Turns the bytes of an event stream into frames. Bytes can arrive split
/// anywhere, including inside a character, so nothing is decoded until a whole
/// line is in hand.
#[derive(Default)]
pub struct SseParser {
    pending: Vec<u8>,
    event: Option<String>,
    data: Vec<String>,
    id: Option<String>,
}

impl SseParser {
    pub fn push(&mut self, bytes: &[u8]) -> Vec<Frame> {
        self.pending.extend_from_slice(bytes);
        let mut frames = Vec::new();
        while let Some(end) = self.pending.iter().position(|b| *b == b'\n') {
            let mut line: Vec<u8> = self.pending.drain(..=end).collect();
            line.pop(); // the newline
            if line.last() == Some(&b'\r') {
                line.pop();
            }
            let line = String::from_utf8_lossy(&line).into_owned();
            if line.is_empty() {
                // a blank line ends an event; one with no data is not an event
                if !self.data.is_empty() {
                    frames.push(Frame { event: self.event.take(), data: self.data.join("\n"), id: self.id.clone() });
                }
                self.event = None;
                self.data.clear();
                continue;
            }
            if line.starts_with(':') {
                continue; // a comment: the server's keep-alive
            }
            let (field, value) = match line.split_once(':') {
                Some((f, v)) => (f, v.strip_prefix(' ').unwrap_or(v)),
                None => (line.as_str(), ""),
            };
            match field {
                "event" => self.event = Some(value.to_string()),
                "data" => self.data.push(value.to_string()),
                // the last ID stays in force for later events, as the format defines
                "id" if !value.contains('\0') => self.id = Some(value.to_string()),
                _ => {} // "retry" and anything unknown
            }
        }
        frames
    }
}

// ── status ──

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Status {
    pub connected: bool,
    pub reason: String,
}

fn status_cell() -> &'static StdMutex<Status> {
    static CELL: OnceLock<StdMutex<Status>> = OnceLock::new();
    CELL.get_or_init(|| StdMutex::new(Status { connected: false, reason: "not started".into() }))
}

pub fn current_status() -> Status {
    status_cell().lock().map(|s| s.clone()).unwrap_or(Status { connected: false, reason: "unknown".into() })
}

/// Whether the live feed is connected, and if not, why. Pages ask this when
/// they load, because the feed may have connected before they did.
#[tauri::command]
pub async fn stream_status() -> Result<Value, String> {
    let s = current_status();
    Ok(json!({ "connected": s.connected, "reason": s.reason }))
}

// ── reading one connection ──

/// What a connection produced.
pub enum Signal {
    /// The server accepted the session and the stream is open.
    Connected,
    /// One event: the object the backend published (`{ id, type, data, ts, … }`).
    Event(Value),
}

/// Why a connection ended.
#[derive(Debug, PartialEq, Eq)]
pub enum Ended {
    /// The server refused the session (401 or 403).
    Rejected(u16),
    /// A different account signed in, or this one signed out, while it was open.
    SessionChanged,
    /// Anything else: the network, the server, or silence. Worth retrying.
    Dropped(String),
}

async fn session_is_still(state: &SharedState, token: &str) -> bool {
    let s = state.lock().await;
    s.is_authenticated && s.auth_token.as_deref() == Some(token)
}

/// Open the stream and pass on what arrives until it ends. `last_event_id` is
/// sent so the server can replay what was missed, and is kept up to date.
pub async fn read_stream(
    client: &reqwest::Client,
    base: &str,
    token: &str,
    last_event_id: &mut Option<String>,
    state: &SharedState,
    on: &mut (dyn FnMut(Signal) + Send),
) -> Ended {
    let mut request = client
        .get(format!("{}/api/stream", base))
        .header("Accept", "text/event-stream")
        .header("Cache-Control", "no-cache")
        .header("Authorization", format!("Bearer {}", token));
    if let Some(id) = last_event_id.as_deref() {
        request = request.header("Last-Event-ID", id);
    }
    let mut response = match request.send().await {
        Ok(r) => r,
        Err(e) => return Ended::Dropped(crate::http::error_chain(e)),
    };
    let status = response.status();
    if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
        return Ended::Rejected(status.as_u16());
    }
    if !status.is_success() {
        return Ended::Dropped(format!("the server answered HTTP {}", status.as_u16()));
    }

    let mut parser = SseParser::default();
    let mut last_heard = Instant::now();
    loop {
        match tokio::time::timeout(SESSION_CHECK, response.chunk()).await {
            // quiet for a few seconds: is this still the signed-in session?
            Err(_) => {
                if !session_is_still(state, token).await {
                    return Ended::SessionChanged;
                }
                if last_heard.elapsed() > IDLE_LIMIT {
                    return Ended::Dropped(format!("nothing received for {} seconds", IDLE_LIMIT.as_secs()));
                }
            }
            Ok(Err(e)) => return Ended::Dropped(crate::http::error_chain(e)),
            Ok(Ok(None)) => return Ended::Dropped("the server closed the stream".into()),
            Ok(Ok(Some(bytes))) => {
                last_heard = Instant::now();
                for frame in parser.push(&bytes) {
                    match frame.event.as_deref() {
                        Some("connected") => on(Signal::Connected),
                        // the server says why it is closing; the next attempt finds out what follows
                        Some("closed") => {
                            let reason = serde_json::from_str::<Value>(&frame.data)
                                .ok()
                                .and_then(|v| v.get("reason").and_then(|r| r.as_str()).map(String::from))
                                .unwrap_or_else(|| "closed by the server".into());
                            return Ended::Dropped(format!("closed by the server: {}", reason));
                        }
                        _ => {
                            if let Ok(event) = serde_json::from_str::<Value>(&frame.data) {
                                if let Some(id) = frame.id.filter(|id| !id.is_empty()) {
                                    *last_event_id = Some(id);
                                }
                                on(Signal::Event(event));
                            }
                        }
                    }
                }
            }
        }
    }
}

fn backoff(attempt: u32) -> Duration {
    Duration::from_secs(1u64 << attempt.min(5)).min(MAX_BACKOFF)
}

// ── the task ──

fn set_status(app: &tauri::AppHandle, connected: bool, reason: &str) {
    use tauri::Emitter;
    let next = Status { connected, reason: reason.to_string() };
    let changed = match status_cell().lock() {
        Ok(mut current) => {
            let changed = *current != next;
            *current = next;
            changed
        }
        Err(_) => true,
    };
    if changed {
        let _ = app.emit("cf-stream-status", json!({ "connected": connected, "reason": reason }));
    }
}

/// Keep the live feed open for as long as the app runs: wait for a session,
/// connect, forward events, and reconnect when the connection is lost.
pub fn start(app: tauri::AppHandle, state: SharedState) {
    tauri::async_runtime::spawn(async move {
        use tauri::Emitter;
        // No overall timeout: the request is meant to stay open.
        let client = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(15))
            .user_agent("cyber-forge-desktop/1.0")
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());
        let mut last_event_id: Option<String> = None;
        let mut account: Option<String> = None;
        let mut attempt: u32 = 0;
        loop {
            let (base, token, user) = {
                let s = state.lock().await;
                (
                    s.backend_url.clone(),
                    if s.is_authenticated { s.auth_token.clone() } else { None },
                    s.current_user.as_ref().map(|u| u.id.clone()),
                )
            };
            let Some(token) = token else {
                set_status(&app, false, "signed out");
                last_event_id = None;
                account = None;
                attempt = 0;
                tokio::time::sleep(Duration::from_secs(2)).await;
                continue;
            };
            // A position in one account's feed means nothing in another's.
            if account != user {
                last_event_id = None;
                account = user;
            }

            let mut was_connected = false;
            let ended = {
                let handle = app.clone();
                let mut forward = |signal: Signal| match signal {
                    Signal::Connected => {
                        was_connected = true;
                        set_status(&handle, true, "connected");
                    }
                    Signal::Event(event) => {
                        let _ = handle.emit("cf-stream", event);
                    }
                };
                read_stream(&client, &base, &token, &mut last_event_id, &state, &mut forward).await
            };
            if was_connected {
                attempt = 0;
            }
            match ended {
                Ended::SessionChanged => {
                    // A renewed token for the same sign-in is not a sign-out.
                    let still_signed_in = state.lock().await.is_authenticated;
                    set_status(&app, false, if still_signed_in { "reconnecting: session renewed" } else { "signed out" });
                }
                Ended::Rejected(code) => {
                    // The session check elsewhere decides whether to sign the user
                    // out. Until the token changes there is no point asking often.
                    set_status(&app, false, &format!("the server did not accept the session (HTTP {})", code));
                    for _ in 0..12 {
                        tokio::time::sleep(Duration::from_secs(5)).await;
                        if !session_is_still(&state, &token).await {
                            break;
                        }
                    }
                }
                Ended::Dropped(reason) => {
                    set_status(&app, false, &reason);
                    tokio::time::sleep(backoff(attempt)).await;
                    attempt = attempt.saturating_add(1);
                }
            }
        }
    });
}

#[cfg(test)]
mod stream_tests {
    use super::*;
    use crate::state::UserInfo;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    fn frames(chunks: &[&[u8]]) -> Vec<Frame> {
        let mut parser = SseParser::default();
        chunks.iter().flat_map(|c| parser.push(c)).collect()
    }

    #[test]
    fn frames_are_read_as_the_server_writes_them() {
        let got = frames(&[b"retry: 3000\n\nevent: connected\ndata: {\"ts\":1}\n\nid: run-7\nevent: scan:update\ndata: {\"id\":\"run-7\",\"type\":\"scan:update\"}\n\n"]);
        assert_eq!(got, vec![
            Frame { event: Some("connected".into()), data: "{\"ts\":1}".into(), id: None },
            Frame { event: Some("scan:update".into()), data: "{\"id\":\"run-7\",\"type\":\"scan:update\"}".into(), id: Some("run-7".into()) },
        ]);
    }

    #[test]
    fn keep_alive_comments_and_a_retry_alone_are_not_events() {
        assert_eq!(frames(&[b": ping 1791000000\n\nretry: 3000\n\n: ping 2\n\n"]), vec![]);
    }

    #[test]
    fn bytes_split_anywhere_give_the_same_frames() {
        let whole = "id: a-1\r\nevent: alert:new\r\ndata: {\"title\":\"caf\u{e9} \u{26a0}\"}\r\n\r\n".as_bytes();
        let expected = frames(&[whole]);
        assert_eq!(expected.len(), 1);
        assert_eq!(expected[0].data, "{\"title\":\"caf\u{e9} \u{26a0}\"}");
        for cut in 1..whole.len() {
            assert_eq!(frames(&[&whole[..cut], &whole[cut..]]), expected, "split at byte {}", cut);
        }
        // one byte at a time
        let single: Vec<&[u8]> = whole.chunks(1).collect();
        assert_eq!(frames(&single), expected);
    }

    #[test]
    fn several_data_lines_are_one_event_and_an_id_stays_in_force() {
        let got = frames(&[b"id: 5\ndata: first\ndata: second\n\ndata: next\n\n"]);
        assert_eq!(got, vec![
            Frame { event: None, data: "first\nsecond".into(), id: Some("5".into()) },
            Frame { event: None, data: "next".into(), id: Some("5".into()) },
        ]);
    }

    #[test]
    fn the_wait_between_attempts_grows_and_is_capped() {
        let waits: Vec<u64> = (0..8).map(|a| backoff(a).as_secs()).collect();
        assert_eq!(waits, vec![1, 2, 4, 8, 16, 30, 30, 30]);
    }

    fn signed_in(token: &str) -> SharedState {
        let mut app = AppState::new();
        app.set_authenticated(
            UserInfo { id: "user-1".into(), email: "a@example.org".into(), name: "A".into(), avatar: None, role: None },
            token.into(),
        );
        Arc::new(Mutex::new(app))
    }

    /// A one-connection HTTP server that answers with `response` and reports
    /// the request it was sent.
    async fn serve_once(response: String, hold_open: Duration) -> (String, tokio::task::JoinHandle<String>) {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        let task = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut request = Vec::new();
            let mut buffer = [0u8; 2048];
            while !request.windows(4).any(|w| w == b"\r\n\r\n") {
                let n = socket.read(&mut buffer).await.unwrap();
                if n == 0 {
                    break;
                }
                request.extend_from_slice(&buffer[..n]);
            }
            socket.write_all(response.as_bytes()).await.unwrap();
            socket.flush().await.unwrap();
            tokio::time::sleep(hold_open).await;
            String::from_utf8_lossy(&request).into_owned()
        });
        (base, task)
    }

    const OPEN: &str = "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nConnection: close\r\n\r\n";

    #[tokio::test]
    async fn the_session_goes_in_a_header_and_events_arrive_in_order() {
        let body = "retry: 3000\n\nevent: connected\ndata: {\"ts\":1,\"authenticated\":true}\n\n: ping 1\n\n\
                    id: e-1\nevent: scan:update\ndata: {\"id\":\"e-1\",\"type\":\"scan:update\",\"data\":{\"url\":\"https://example.org/\"}}\n\n\
                    id: e-2\nevent: alert:new\ndata: {\"id\":\"e-2\",\"type\":\"alert:new\",\"data\":{\"title\":\"x\"}}\n\n";
        let (base, server) = serve_once(format!("{}{}", OPEN, body), Duration::from_millis(0)).await;
        let state = signed_in("the-session-token");
        let mut last_id = Some("e-0".to_string());
        let mut seen: Vec<String> = Vec::new();
        let mut on = |signal: Signal| match signal {
            Signal::Connected => seen.push("connected".into()),
            Signal::Event(e) => seen.push(e["type"].as_str().unwrap_or("?").to_string()),
        };
        let ended = read_stream(&reqwest::Client::new(), &base, "the-session-token", &mut last_id, &state, &mut on).await;

        assert_eq!(seen, vec!["connected", "scan:update", "alert:new"]);
        assert_eq!(last_id.as_deref(), Some("e-2"), "the position moves to the last event received");
        assert_eq!(ended, Ended::Dropped("the server closed the stream".into()));

        let request = server.await.unwrap().to_lowercase();
        let first_line = request.lines().next().unwrap().to_string();
        assert_eq!(first_line, "get /api/stream http/1.1", "nothing about the session is in the address");
        assert!(request.contains("authorization: bearer the-session-token"));
        assert!(request.contains("last-event-id: e-0"), "the last position is sent so the server can replay");
        assert!(request.contains("accept: text/event-stream"));
    }

    #[tokio::test]
    async fn a_refused_session_is_reported_as_refused_and_nothing_is_forwarded() {
        let (base, server) = serve_once(
            "HTTP/1.1 401 Unauthorized\r\nContent-Type: application/json\r\nContent-Length: 17\r\nConnection: close\r\n\r\n{\"success\":false}".into(),
            Duration::from_millis(0),
        ).await;
        let state = signed_in("expired-token");
        let mut count = 0;
        let mut on = |_signal: Signal| count += 1;
        let ended = read_stream(&reqwest::Client::new(), &base, "expired-token", &mut None, &state, &mut on).await;
        assert_eq!(ended, Ended::Rejected(401));
        assert_eq!(count, 0);
        let _ = server.await;
    }

    #[tokio::test]
    async fn the_server_closing_the_stream_gives_its_reason() {
        let body = "event: connected\ndata: {}\n\nevent: closed\ndata: {\"reason\":\"signed out\"}\n\n";
        let (base, server) = serve_once(format!("{}{}", OPEN, body), Duration::from_millis(0)).await;
        let state = signed_in("t");
        let mut on = |_signal: Signal| {};
        let ended = read_stream(&reqwest::Client::new(), &base, "t", &mut None, &state, &mut on).await;
        assert_eq!(ended, Ended::Dropped("closed by the server: signed out".into()));
        let _ = server.await;
    }

    #[tokio::test]
    async fn an_open_connection_is_dropped_when_the_account_signs_out() {
        // the server opens the stream and then says nothing
        let (base, server) = serve_once(format!("{}event: connected\ndata: {{}}\n\n", OPEN), Duration::from_secs(20)).await;
        let state = signed_in("t");
        let signing_out = state.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(300)).await;
            signing_out.lock().await.clear_auth();
        });
        let started = Instant::now();
        let mut on = |_signal: Signal| {};
        let ended = read_stream(&reqwest::Client::new(), &base, "t", &mut None, &state, &mut on).await;
        assert_eq!(ended, Ended::SessionChanged);
        assert!(started.elapsed() < Duration::from_secs(12), "noticed at the next session check, not at the idle limit");
        server.abort();
    }

    #[tokio::test]
    async fn a_server_that_cannot_be_reached_is_worth_retrying() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        drop(listener);
        let state = signed_in("t");
        let mut on = |_signal: Signal| {};
        let ended = read_stream(&reqwest::Client::new(), &base, "t", &mut None, &state, &mut on).await;
        assert!(matches!(ended, Ended::Dropped(_)));
    }

    /// Reads the real backend's feed through this reader, with a session given
    /// from outside (the driver registers a throwaway account, triggers one
    /// alert, and removes the account). Prints event types only.
    ///   CF_LIVE_BASE=… CF_LIVE_TOKEN=… cargo test --lib stream_tests::the_live_backend -- --ignored --nocapture
    #[tokio::test]
    #[ignore]
    async fn the_live_backend_feed_arrives_through_this_reader() {
        let (Ok(base), Ok(token)) = (std::env::var("CF_LIVE_BASE"), std::env::var("CF_LIVE_TOKEN")) else {
            println!("SKIPPED: CF_LIVE_BASE and CF_LIVE_TOKEN are not set");
            return;
        };
        let state = signed_in(&token);
        let sign_out = state.clone();
        let seen = Arc::new(StdMutex::new(Vec::<String>::new()));
        let record = seen.clone();
        let mut on = move |signal: Signal| {
            let label = match signal {
                Signal::Connected => "connected".to_string(),
                Signal::Event(e) => e["type"].as_str().unwrap_or("?").to_string(),
            };
            println!("LIVE {}", label);
            let alert = label == "alert:new";
            record.lock().unwrap().push(label);
            if alert {
                // what was waited for has arrived: sign out, which must end the connection
                let sign_out = sign_out.clone();
                tokio::spawn(async move { sign_out.lock().await.clear_auth() });
            }
        };
        let client = reqwest::Client::builder().connect_timeout(Duration::from_secs(15)).build().unwrap();
        let mut last_id = None;
        let ended = tokio::time::timeout(Duration::from_secs(100), read_stream(&client, &base, &token, &mut last_id, &state, &mut on)).await;
        let seen = seen.lock().unwrap().clone();
        println!("LIVE ended: {:?} | position kept: {}", ended, last_id.is_some());
        assert_eq!(seen.first().map(String::as_str), Some("connected"));
        assert!(seen.iter().any(|t| t == "alert:new"), "the alert triggered for this account arrived: {:?}", seen);
        assert_eq!(ended.ok(), Some(Ended::SessionChanged));
        assert!(last_id.is_some());
    }
}

