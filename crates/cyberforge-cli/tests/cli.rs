//! The `cyberforge` binary as a script sees it: exit codes, the JSON envelope,
//! and where text goes. Each test uses its own config directory
//! (CYBERFORGE_CONFIG_DIR) and a local address, never the deployed backend.
//! The credential store is only read, for an entry no test creates.

use serde_json::Value;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::PathBuf;
use std::process::{Command, Output};

fn config_dir(tag: &str, origin: Option<&str>) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("cf-cli-test-{}-{}", tag, std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    if let Some(origin) = origin {
        let file = format!(r#"{{"version":1,"current":"default","profiles":{{"default":{{"origin":"{}"}}}}}}"#, origin);
        std::fs::write(dir.join("profiles.json"), file).unwrap();
    }
    dir
}

fn run(dir: &PathBuf, args: &[&str]) -> Output {
    Command::new(env!("CARGO_BIN_EXE_cyberforge"))
        .args(args)
        .env("CYBERFORGE_CONFIG_DIR", dir)
        .env_remove("CYBERFORGE_PROFILE")
        .output()
        .expect("the binary runs")
}

fn envelope(output: &Output) -> Value {
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert_eq!(stdout.trim().lines().count(), 1, "one line of JSON on stdout: {stdout}");
    let value: Value = serde_json::from_str(stdout.trim()).expect("stdout is JSON");
    assert_eq!(value["schema"], "cyberforge.cli.v1");
    assert!(value["correlation_id"].as_str().is_some_and(|id| id.len() == 16));
    value
}

/// An origin that never answers: it hangs up on every connection. It stays
/// bound, so no other test's server can take the port in its place.
fn closed_origin() -> String {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    std::thread::spawn(move || {
        for stream in listener.incoming() {
            drop(stream);
        }
    });
    format!("http://127.0.0.1:{}", port)
}

/// An origin whose `/health` answers healthy for one request.
fn healthy_origin() -> String {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    std::thread::spawn(move || {
        for stream in listener.incoming().take(4) {
            let Ok(mut stream) = stream else { continue };
            let mut buffer = [0u8; 4096];
            let _ = stream.read(&mut buffer);
            let body = r#"{"status":"healthy"}"#;
            let _ = write!(stream, "HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{}", body.len(), body);
        }
    });
    format!("http://127.0.0.1:{}", port)
}

#[test]
fn status_against_a_healthy_backend_exits_0_and_reports_every_part() {
    let dir = config_dir("healthy", Some(&healthy_origin()));
    let output = run(&dir, &["--json", "status"]);
    assert_eq!(output.status.code(), Some(0));
    let value = envelope(&output);
    assert_eq!(value["ok"], true);
    assert_eq!(value["data"]["backend"]["state"], "reachable");
    assert_eq!(value["data"]["session"]["state"], "signed_out");
    // Whatever this machine is running: the desktop app may or may not own the state.
    let broker = value["data"]["desktop_broker"]["state"].as_str().unwrap();
    assert!(["attached", "not_running", "not_available"].contains(&broker), "{broker}");
    assert!(value["data"]["credential_store"]["state"].is_string());
}

#[test]
fn status_offline_exits_4_and_still_reports() {
    let dir = config_dir("offline", Some(&closed_origin()));
    let output = run(&dir, &["--json", "--timeout", "5", "status"]);
    assert_eq!(output.status.code(), Some(4));
    let value = envelope(&output);
    assert_eq!(value["ok"], false);
    assert_eq!(value["data"]["backend"]["state"], "unreachable");
    assert!(value["warnings"][0].as_str().unwrap().contains("did not answer"));

    let text = run(&dir, &["--timeout", "5", "status"]);
    assert_eq!(text.status.code(), Some(4));
    assert!(String::from_utf8_lossy(&text.stdout).contains("unreachable"));
    assert!(String::from_utf8_lossy(&text.stderr).contains("warning: The backend"));
}

#[test]
fn usage_errors_exit_2_with_a_json_envelope_when_asked() {
    let dir = config_dir("usage", None);
    let output = run(&dir, &["--json", "scan", "url"]);
    assert_eq!(output.status.code(), Some(2));
    let value = envelope(&output);
    assert_eq!(value["error"]["code"], "USAGE");

    assert_eq!(run(&dir, &["--timeout", "0", "status"]).status.code(), Some(2));
    let bad_profile = run(&dir, &["--json", "--profile", "Not Valid", "status"]);
    assert_eq!(bad_profile.status.code(), Some(2));
    assert_eq!(envelope(&bad_profile)["error"]["code"], "PROFILE");
    let missing = run(&dir, &["--json", "--profile", "staging", "status"]);
    assert_eq!(missing.status.code(), Some(2));
    assert!(envelope(&missing)["error"]["message"].as_str().unwrap().contains("no profile named 'staging'"));
}

#[test]
fn a_profiles_file_pointing_off_this_computer_over_http_is_refused() {
    let dir = config_dir("badorigin", Some("http://evil.example.com"));
    let output = run(&dir, &["--json", "status"]);
    assert_eq!(output.status.code(), Some(1));
    assert_eq!(envelope(&output)["error"]["code"], "PROFILE_FILE");
}

#[test]
fn version_and_help_need_no_network() {
    let dir = config_dir("version", None);
    let output = run(&dir, &["--json", "version"]);
    assert_eq!(output.status.code(), Some(0));
    let value = envelope(&output);
    assert_eq!(value["data"]["schema"], "cyberforge.cli.v1");
    assert_eq!(value["data"]["version"], env!("CARGO_PKG_VERSION"));

    let help = run(&dir, &["--help"]);
    assert_eq!(help.status.code(), Some(0));
    let text = String::from_utf8_lossy(&help.stdout);
    assert!(text.contains("status") && text.contains("version"));
    assert_eq!(run(&dir, &[]).status.code(), Some(2), "no command is a usage error");
}
