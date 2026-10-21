//! The MCP server as an AI client sees it: JSON-RPC over a pipe, against a
//! local stand-in server, with sessions in a store in memory. Covers the
//! initialize handshake (2025-06-18) and the current protocol without it
//! (2026-07-28), and every way a grant stops the next call.

use cyberforge_core::credentials::{MemoryStore, SecretStore};
use cyberforge_core::grants::{self, GrantStore};
use cyberforge_core::origin::Origin;
use cyberforge_core::profile::Profile;
use cyberforge_mcp::{serve_on, Config};
use serde_json::{json, Value};
use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader, DuplexStream, ReadHalf, WriteHalf};

/// A stand-in server: `/health`; `/api/auth/profile` answers account u1 for
/// `tok-a` and u2 for `tok-b`; the two Analysis Agents routes answer for either.
fn backend() -> String {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    std::thread::spawn(move || {
        for stream in listener.incoming() {
            let Ok(mut stream) = stream else { continue };
            let mut buffer = [0u8; 16384];
            let n = stream.read(&mut buffer).unwrap_or(0);
            let request = String::from_utf8_lossy(&buffer[..n]).to_string();
            let lower = request.to_ascii_lowercase();
            let account = if lower.contains("bearer tok-a") { Some("u1") } else if lower.contains("bearer tok-b") { Some("u2") } else { None };
            let (status, body) = if request.starts_with("GET /health ") {
                ("200 OK", r#"{"status":"healthy"}"#.to_string())
            } else if account.is_none() {
                ("401 Unauthorized", r#"{"success":false}"#.to_string())
            } else if request.starts_with("GET /api/auth/profile ") {
                ("200 OK", format!(r#"{{"success":true,"data":{{"user":{{"id":"{}","email":"a@example.com"}}}}}}"#, account.unwrap()))
            } else if request.starts_with("GET /api/v1/ml/capabilities ") {
                ("200 OK", r#"{"success":true,"data":{"serviceVersion":"test","capabilities":[{"id":"url_rules","kind":"rules","readiness":"ready"}]}}"#.to_string())
            } else if request.starts_with("POST /api/v1/ml/analyze-url ") {
                let sent: Value = request.split("\r\n\r\n").nth(1).and_then(|b| serde_json::from_str(b).ok()).unwrap_or(Value::Null);
                let body = json!({ "success": true, "data": { "target": sent["url"], "verdict": "unknown", "verdictReason": "no trained model", "policy": "v1" } });
                ("200 OK", body.to_string())
            } else {
                ("404 Not Found", r#"{"success":false}"#.to_string())
            };
            let _ = write!(stream, "HTTP/1.1 {}\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{}", status, body.len(), body);
        }
    });
    format!("http://127.0.0.1:{}", port)
}

struct Setup {
    dir: PathBuf,
    profile: Profile,
    store: Arc<MemoryStore>,
}

/// A config directory with profile `default` at a fresh stand-in server, signed in as u1.
fn setup(tag: &str) -> Setup {
    let origin = backend();
    let dir = std::env::temp_dir().join(format!("cf-mcp-{}-{}", tag, std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(dir.join("profiles.json"), format!(r#"{{"version":1,"current":"default","profiles":{{"default":{{"origin":"{}"}}}}}}"#, origin)).unwrap();
    let profile = Profile { name: "default".into(), origin: Origin::parse(&origin).unwrap() };
    let store = Arc::new(MemoryStore::default());
    store.set(&profile.session_entry(), "tok-a").unwrap();
    Setup { dir, profile, store }
}

fn grant(s: &Setup, extra: &[&str]) -> String {
    let mut ops = grants::default_operations();
    ops.extend(extra.iter().map(|o| o.to_string()));
    GrantStore::in_dir(&s.dir).create("Test client", "default", s.profile.origin.as_str(), "u1", &ops, 30, grants::now_secs()).unwrap().id
}

fn config(s: &Setup, grant_id: &str) -> Config {
    Config { dir: s.dir.clone(), grant_id: grant_id.into(), store: s.store.clone(), user_agent: "cyberforge-mcp-test".into(), timeout: Duration::from_secs(5) }
}

/// The client's end of the pipe.
struct Client {
    lines: tokio::io::Lines<BufReader<ReadHalf<DuplexStream>>>,
    writer: WriteHalf<DuplexStream>,
    next: u64,
    /// Request `_meta` for the current protocol (empty after an initialize).
    meta: Option<Value>,
}

impl Client {
    fn start(config: Config) -> Client {
        let (ours, theirs) = tokio::io::duplex(1 << 16);
        let (r, w) = tokio::io::split(theirs);
        tokio::spawn(async move {
            let _ = serve_on(config, (r, w)).await;
        });
        let (r, writer) = tokio::io::split(ours);
        Client { lines: BufReader::new(r).lines(), writer, next: 1, meta: None }
    }

    async fn send(&mut self, message: Value) {
        self.writer.write_all(format!("{}\n", message).as_bytes()).await.unwrap();
    }

    async fn request(&mut self, method: &str, mut params: Value) -> Value {
        let id = self.next;
        self.next += 1;
        if let Some(meta) = &self.meta {
            params["_meta"] = meta.clone();
        }
        self.send(json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": params })).await;
        loop {
            let line = tokio::time::timeout(Duration::from_secs(15), self.lines.next_line()).await.expect("an answer in time").unwrap().expect("the server is still there");
            let message: Value = serde_json::from_str(&line).unwrap_or_else(|_| panic!("standard output carried something other than JSON-RPC: {line}"));
            if message["id"] == json!(id) {
                return message;
            }
        }
    }

    async fn initialize(&mut self, version: &str) -> Value {
        let answer = self.request("initialize", json!({ "protocolVersion": version, "capabilities": {}, "clientInfo": { "name": "test", "version": "1" } })).await;
        self.send(json!({ "jsonrpc": "2.0", "method": "notifications/initialized" })).await;
        answer
    }

    async fn tools(&mut self) -> Vec<String> {
        let answer = self.request("tools/list", json!({})).await;
        answer["result"]["tools"].as_array().unwrap_or_else(|| panic!("no tools: {answer}")).iter().map(|t| t["name"].as_str().unwrap().to_string()).collect()
    }

    async fn call(&mut self, name: &str, arguments: Value) -> Value {
        self.request("tools/call", json!({ "name": name, "arguments": arguments })).await
    }
}

/// The error code of a refused tool call, or "ok".
fn outcome(answer: &Value) -> String {
    let result = &answer["result"];
    if result["isError"] == json!(true) {
        result["structuredContent"]["error"]["code"].as_str().unwrap_or("?").to_string()
    } else if result.is_object() {
        "ok".into()
    } else {
        format!("rpc error: {}", answer["error"])
    }
}

#[tokio::test]
async fn an_initialized_client_gets_the_read_only_tools_and_nothing_more() {
    let s = setup("legacy");
    let id = grant(&s, &[]);
    let mut client = Client::start(config(&s, &id));
    let init = client.initialize("2025-06-18").await;
    assert_eq!(init["result"]["protocolVersion"], "2025-06-18", "{init}");
    assert_eq!(init["result"]["serverInfo"]["name"], "cyberforge");

    assert_eq!(client.tools().await, ["cyberforge_status", "cyberforge_model_status"]);

    let status = client.call("cyberforge_status", json!({})).await;
    assert_eq!(outcome(&status), "ok", "{status}");
    assert_eq!(status["result"]["structuredContent"]["session"]["state"], "valid");
    assert!(!status.to_string().contains("tok-a"), "the session token never reaches the client");

    let models = client.call("cyberforge_model_status", json!({})).await;
    assert_eq!(outcome(&models), "ok", "{models}");
    assert!(models["result"]["content"][0]["text"].as_str().unwrap().contains("1 of 1 capabilities ready"));

    // Not in the grant, though the server knows the tool.
    assert_eq!(outcome(&client.call("cyberforge_analyze_url", json!({ "url": "https://example.com/" })).await), "NOT_GRANTED");
    // Unknown tools and undeclared arguments are protocol errors.
    assert!(client.call("cyberforge_auth_login", json!({})).await["error"].is_object());
    assert!(client.call("cyberforge_status", json!({ "verbose": true })).await["error"].is_object());

    let log = std::fs::read_to_string(s.dir.join("mcp-calls.jsonl")).unwrap();
    assert!(log.lines().count() >= 4 && log.contains("\"NOT_GRANTED\"") && !log.contains("example.com"), "the log names calls, never arguments: {log}");
}

#[tokio::test]
async fn the_current_protocol_works_without_initialize() {
    let s = setup("current");
    let id = grant(&s, &[]);
    let mut client = Client::start(config(&s, &id));
    client.meta = Some(json!({ "io.modelcontextprotocol/protocolVersion": "2026-07-28", "io.modelcontextprotocol/clientCapabilities": {} }));
    assert_eq!(client.tools().await, ["cyberforge_status", "cyberforge_model_status"]);
    assert_eq!(outcome(&client.call("cyberforge_model_status", json!({})).await), "ok");
}

#[tokio::test]
async fn an_allowed_address_is_redacted_before_it_leaves() {
    let s = setup("scan");
    let id = grant(&s, &["scan.url"]);
    let mut client = Client::start(config(&s, &id));
    client.initialize("2025-06-18").await;
    assert_eq!(client.tools().await, ["cyberforge_status", "cyberforge_model_status", "cyberforge_analyze_url"]);
    let answer = client.call("cyberforge_analyze_url", json!({ "url": "https://example.com/login?token=abc123" })).await;
    assert_eq!(outcome(&answer), "ok", "{answer}");
    let data = &answer["result"]["structuredContent"];
    assert_eq!(data["target"], "https://example.com/login?token=[redacted]");
    assert_eq!(data["addressRedactedHere"], true);
    assert_eq!(outcome(&client.call("cyberforge_analyze_url", json!({ "url": "javascript:alert(1)" })).await), "URL_INVALID");
}

#[tokio::test]
async fn revoking_stops_the_next_call_and_the_tool_list() {
    let s = setup("revoke");
    let id = grant(&s, &[]);
    let mut client = Client::start(config(&s, &id));
    client.initialize("2025-06-18").await;
    assert_eq!(outcome(&client.call("cyberforge_status", json!({})).await), "ok");
    GrantStore::in_dir(&s.dir).revoke(&id, grants::now_secs()).unwrap();
    assert_eq!(outcome(&client.call("cyberforge_status", json!({})).await), "GRANT_REVOKED");
    assert!(client.request("tools/list", json!({})).await["error"].is_object());
}

#[tokio::test]
async fn another_account_or_server_stops_the_next_call() {
    let s = setup("account");
    let id = grant(&s, &[]);
    let mut client = Client::start(config(&s, &id));
    client.initialize("2025-06-18").await;
    assert_eq!(outcome(&client.call("cyberforge_model_status", json!({})).await), "ok");

    // The profile is signed in again, to another account.
    s.store.set(&s.profile.session_entry(), "tok-b").unwrap();
    assert_eq!(outcome(&client.call("cyberforge_model_status", json!({})).await), "GRANT_ACCOUNT_CHANGED");
    s.store.set(&s.profile.session_entry(), "tok-a").unwrap();
    assert_eq!(outcome(&client.call("cyberforge_model_status", json!({})).await), "ok");

    // The profile is pointed at another server.
    let other = backend();
    std::fs::write(s.dir.join("profiles.json"), format!(r#"{{"version":1,"current":"default","profiles":{{"default":{{"origin":"{}"}}}}}}"#, other)).unwrap();
    assert_eq!(outcome(&client.call("cyberforge_status", json!({})).await), "GRANT_ORIGIN_CHANGED");
}

#[tokio::test]
async fn an_expired_or_unknown_grant_is_refused_before_serving() {
    let s = setup("expired");
    let ops = grants::default_operations();
    let old = GrantStore::in_dir(&s.dir).create("Old client", "default", s.profile.origin.as_str(), "u1", &ops, 1, grants::now_secs() - 3 * 86_400).unwrap();
    let (_, theirs) = tokio::io::duplex(1024);
    let (r, w) = tokio::io::split(theirs);
    assert!(serve_on(config(&s, &old.id), (r, w)).await.unwrap_err().contains("expired"));
    let (_, theirs) = tokio::io::duplex(1024);
    let (r, w) = tokio::io::split(theirs);
    assert!(serve_on(config(&s, "g_000000000000000000000000"), (r, w)).await.unwrap_err().contains("No such grant"));
}

#[tokio::test]
async fn signed_out_the_status_tool_still_answers_and_server_tools_refuse() {
    let s = setup("signedout");
    let id = grant(&s, &[]);
    s.store.delete(&s.profile.session_entry()).unwrap();
    let mut client = Client::start(config(&s, &id));
    client.initialize("2025-06-18").await;
    let status = client.call("cyberforge_status", json!({})).await;
    assert_eq!(outcome(&status), "ok");
    assert_eq!(status["result"]["structuredContent"]["session"]["state"], "signed_out");
    assert_eq!(outcome(&client.call("cyberforge_model_status", json!({})).await), "SIGNED_OUT");
}
