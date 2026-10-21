//! `cyberforge mcp` as an AI client and a script see it. The server is spawned
//! as the client would spawn it; standard output must carry protocol messages
//! only. Sessions are read from the real credential store, for profiles no test
//! signs in, so the server-side tools answer SIGNED_OUT here (the signed-in
//! paths are covered in crates/cyberforge-mcp/tests/protocol.rs).

use cyberforge_core::grants::{self, GrantStore};
use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::path::PathBuf;
use std::process::{Command, Output, Stdio};

/// A stand-in server that is healthy and refuses every session.
fn backend() -> String {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    std::thread::spawn(move || {
        use std::io::Read;
        for stream in listener.incoming() {
            let Ok(mut stream) = stream else { continue };
            let mut buffer = [0u8; 8192];
            let n = stream.read(&mut buffer).unwrap_or(0);
            let request = String::from_utf8_lossy(&buffer[..n]).to_string();
            let (status, body) = if request.starts_with("GET /health ") { ("200 OK", r#"{"status":"healthy"}"#) } else { ("401 Unauthorized", r#"{"success":false}"#) };
            let _ = write!(stream, "HTTP/1.1 {}\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{}", status, body.len(), body);
        }
    });
    format!("http://127.0.0.1:{}", port)
}

fn config_dir(tag: &str, origin: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("cf-cli-mcp-{}-{}", tag, std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    // A profile name no one signs in with, so no real session is found.
    let file = format!(r#"{{"version":1,"current":"mcp-test","profiles":{{"mcp-test":{{"origin":"{}"}}}}}}"#, origin);
    std::fs::write(dir.join("profiles.json"), file).unwrap();
    dir
}

fn grant(dir: &PathBuf, origin: &str) -> String {
    GrantStore::in_dir(dir).create("Test client", "mcp-test", origin, "u1", &grants::default_operations(), 30, grants::now_secs()).unwrap().id
}

fn run(dir: &PathBuf, args: &[&str]) -> Output {
    Command::new(env!("CARGO_BIN_EXE_cyberforge")).args(args).env("CYBERFORGE_CONFIG_DIR", dir).env_remove("CYBERFORGE_PROFILE").output().unwrap()
}

fn json(output: &Output) -> Value {
    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(stdout.trim()).unwrap_or_else(|_| panic!("not JSON: {stdout}"))
}

#[test]
fn the_spawned_server_speaks_only_json_rpc_on_standard_output() {
    let origin = backend();
    let dir = config_dir("serve", &origin);
    let id = grant(&dir, &origin);
    let mut child = Command::new(env!("CARGO_BIN_EXE_cyberforge"))
        .args(["mcp", "serve", "--stdio", "--grant", &id])
        .env("CYBERFORGE_CONFIG_DIR", &dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    let mut stdin = child.stdin.take().unwrap();
    let mut lines = BufReader::new(child.stdout.take().unwrap()).lines();
    let mut ask = |id: u64, method: &str, params: Value| -> Value {
        writeln!(stdin, "{}", json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": params })).unwrap();
        if method == "initialize" {
            writeln!(stdin, "{}", json!({ "jsonrpc": "2.0", "method": "notifications/initialized" })).unwrap();
        }
        let line = lines.next().expect("an answer").unwrap();
        let message: Value = serde_json::from_str(&line).unwrap_or_else(|_| panic!("not JSON-RPC on standard output: {line}"));
        assert_eq!(message["id"], json!(id), "{message}");
        message
    };
    let init = ask(1, "initialize", json!({ "protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": { "name": "test", "version": "1" } }));
    assert_eq!(init["result"]["serverInfo"]["name"], "cyberforge");
    let tools: Vec<String> = ask(2, "tools/list", json!({}))["result"]["tools"].as_array().unwrap().iter().map(|t| t["name"].as_str().unwrap().to_string()).collect();
    assert_eq!(tools, ["cyberforge_status", "cyberforge_model_status"]);
    let status = ask(3, "tools/call", json!({ "name": "cyberforge_status", "arguments": {} }));
    assert_eq!(status["result"]["structuredContent"]["session"]["state"], "signed_out", "{status}");
    let models = ask(4, "tools/call", json!({ "name": "cyberforge_model_status", "arguments": {} }));
    assert_eq!(models["result"]["structuredContent"]["error"]["code"], "SIGNED_OUT", "{models}");
    drop(stdin);
    // The client closing standard input ends the server cleanly, with nothing more on standard output.
    assert!(lines.next().is_none());
    assert_eq!(child.wait().unwrap().code(), Some(0));
}

#[test]
fn an_unknown_grant_is_refused_on_standard_error_with_exit_3() {
    let dir = config_dir("unknown", "http://127.0.0.1:9");
    let out = run(&dir, &["mcp", "serve", "--stdio", "--grant", "g_000000000000000000000000"]);
    assert_eq!(out.status.code(), Some(3));
    assert!(out.stdout.is_empty());
    assert!(String::from_utf8_lossy(&out.stderr).contains("No such grant"));
    // --stdio is the only transport, and it must be said.
    assert_eq!(run(&dir, &["mcp", "serve", "--grant", "g_000000000000000000000000"]).status.code(), Some(2));
}

#[test]
fn grants_are_listed_configured_and_revoked() {
    let origin = "http://127.0.0.1:9";
    let dir = config_dir("grants", origin);
    assert_eq!(json(&run(&dir, &["--json", "mcp", "grant", "list"]))["data"]["grants"], json!([]));
    let id = grant(&dir, origin);

    let list = json(&run(&dir, &["--json", "mcp", "grant", "list"]));
    assert_eq!(list["data"]["grants"][0]["state"], "active");
    assert_eq!(list["data"]["grants"][0]["operations"], json!(["status", "models.status"]));

    let config = json(&run(&dir, &["--json", "mcp", "config", "--grant", &id]));
    let server = &config["data"]["clientConfig"]["mcpServers"]["cyberforge"];
    assert_eq!(server["args"], json!(["mcp", "serve", "--stdio", "--grant", id]));
    assert!(server["command"].as_str().unwrap().contains("cyberforge"));
    assert!(!config.to_string().to_lowercase().contains("token"), "the client configuration holds no secret");

    let revoke = run(&dir, &["--json", "mcp", "grant", "revoke", &id]);
    assert_eq!(revoke.status.code(), Some(0));
    assert_eq!(json(&run(&dir, &["--json", "mcp", "grant", "list"]))["data"]["grants"][0]["state"], "revoked");
    assert_eq!(run(&dir, &["--json", "mcp", "config", "--grant", &id]).status.code(), Some(2));
    assert_eq!(run(&dir, &["--json", "mcp", "grant", "revoke", "g_ffffffffffffffffffffffff"]).status.code(), Some(2));
}

#[test]
fn approving_a_client_needs_a_signed_in_profile() {
    let origin = backend();
    let dir = config_dir("create", &origin);
    let out = run(&dir, &["--json", "mcp", "grant", "create", "--name", "Claude Desktop"]);
    assert_eq!(out.status.code(), Some(3));
    assert_eq!(json(&out)["error"]["code"], "SIGNED_OUT");
    assert!(!dir.join("mcp-grants.json").exists() || json(&run(&dir, &["--json", "mcp", "grant", "list"]))["data"]["grants"] == json!([]));
}
