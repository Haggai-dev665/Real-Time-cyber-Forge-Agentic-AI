//! `auth`, `profile` and `config` as a script sees them, against a local
//! stand-in backend. Each test has its own config directory. These tests only
//! read the credential store, for entries no test creates, except the one
//! marked `#[ignore]`, which signs in for real on this machine's credential
//! store and signs out again:
//!   cargo test -p cyberforge-cli --test auth -- --ignored

use serde_json::Value;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::PathBuf;
use std::process::{Command, Output, Stdio};

const TOKEN: &str = "cli.test.token";

/// A stand-in backend: `/health`, `/api/auth/login` (password `right` signs
/// in), `/api/auth/profile` (accepts the token) and `/api/auth/logout`.
fn backend() -> String {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    std::thread::spawn(move || {
        for stream in listener.incoming() {
            let Ok(mut stream) = stream else { continue };
            let mut buffer = [0u8; 8192];
            let n = stream.read(&mut buffer).unwrap_or(0);
            let request = String::from_utf8_lossy(&buffer[..n]).to_string();
            let authorised = request.to_ascii_lowercase().contains(&format!("bearer {}", TOKEN));
            let (status, body) = if request.starts_with("GET /health ") {
                ("200 OK", r#"{"status":"healthy"}"#.to_string())
            } else if request.starts_with("POST /api/auth/login ") && request.contains(r#""password":"right""#) {
                ("200 OK", format!(r#"{{"success":true,"data":{{"user":{{"id":"u1","email":"a@example.com"}},"token":"{}"}}}}"#, TOKEN))
            } else if request.starts_with("POST /api/auth/login ") {
                ("401 Unauthorized", r#"{"success":false,"message":"Invalid credentials"}"#.to_string())
            } else if (request.starts_with("GET /api/auth/profile ") || request.starts_with("POST /api/auth/logout ")) && authorised {
                ("200 OK", r#"{"success":true,"data":{"user":{"id":"u1","email":"a@example.com"}}}"#.to_string())
            } else {
                ("401 Unauthorized", r#"{"success":false}"#.to_string())
            };
            let _ = write!(stream, "HTTP/1.1 {}\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{}", status, body.len(), body);
        }
    });
    format!("http://127.0.0.1:{}", port)
}

fn config_dir(tag: &str, origin: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("cf-cli-auth-{}-{}", tag, std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    let file = format!(r#"{{"version":1,"current":"default","profiles":{{"default":{{"origin":"{}"}}}}}}"#, origin);
    std::fs::write(dir.join("profiles.json"), file).unwrap();
    dir
}

fn run(dir: &PathBuf, args: &[&str], stdin: &str) -> Output {
    let mut child = Command::new(env!("CARGO_BIN_EXE_cyberforge"))
        .args(args)
        .env("CYBERFORGE_CONFIG_DIR", dir)
        .env_remove("CYBERFORGE_PROFILE")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("the binary runs");
    child.stdin.take().unwrap().write_all(stdin.as_bytes()).unwrap();
    child.wait_with_output().unwrap()
}

fn json(output: &Output) -> Value {
    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(stdout.trim()).unwrap_or_else(|_| panic!("not JSON: {stdout}"))
}

fn all_output(output: &Output) -> String {
    format!("{}{}", String::from_utf8_lossy(&output.stdout), String::from_utf8_lossy(&output.stderr))
}

#[test]
fn a_wrong_password_exits_3_and_keeps_nothing() {
    let dir = config_dir("wrong", &backend());
    let output = run(&dir, &["--json", "auth", "login", "--email", "a@example.com", "--password-stdin"], "not-the-password\n");
    assert_eq!(output.status.code(), Some(3));
    let value = json(&output);
    assert_eq!(value["error"]["code"], "AUTH_REJECTED");
    assert!(!all_output(&output).contains("not-the-password"));
    let status = run(&dir, &["--json", "auth", "status"], "");
    assert_eq!(status.status.code(), Some(3));
    assert_eq!(json(&status)["data"]["session"]["state"], "signed_out");
}

#[test]
fn without_a_terminal_sign_in_never_prompts() {
    let dir = config_dir("noprompt", &backend());
    let no_email = run(&dir, &["--json", "auth", "login", "--password-stdin"], "right\n");
    assert_eq!(no_email.status.code(), Some(2));
    assert_eq!(json(&no_email)["error"]["code"], "EMAIL_REQUIRED");
    let no_password = run(&dir, &["--json", "--non-interactive", "auth", "login", "--email", "a@example.com"], "");
    assert_eq!(no_password.status.code(), Some(2));
    assert_eq!(json(&no_password)["error"]["code"], "PASSWORD_REQUIRED");
    let empty = run(&dir, &["--json", "auth", "login", "--email", "a@example.com", "--password-stdin"], "\n");
    assert_eq!(empty.status.code(), Some(2));
    let bad_email = run(&dir, &["--json", "auth", "login", "--email", "not-an-email", "--password-stdin"], "right\n");
    assert_eq!(json(&bad_email)["error"]["code"], "EMAIL_INVALID");
    // a password is not accepted as an argument at all
    assert_eq!(run(&dir, &["auth", "login", "--email", "a@example.com", "--password", "right"], "").status.code(), Some(2));
}

#[test]
fn signing_out_when_not_signed_in_removes_nothing_and_succeeds() {
    let dir = config_dir("logout", &backend());
    let output = run(&dir, &["--json", "auth", "logout"], "");
    assert_eq!(output.status.code(), Some(0));
    assert_eq!(json(&output)["data"]["result"]["was_signed_in"], false);
}

#[test]
fn profiles_are_created_listed_switched_and_validated() {
    let dir = config_dir("profiles", &backend());
    let set = run(&dir, &["--json", "--profile", "staging", "config", "set", "origin", "https://staging.example.com/"], "");
    assert_eq!(set.status.code(), Some(0));
    assert_eq!(json(&set)["data"]["value"], "https://staging.example.com");
    assert_eq!(json(&set)["data"]["previous"], Value::Null);

    let list = json(&run(&dir, &["--json", "profile", "list"], ""));
    assert_eq!(list["data"]["current"], "default");
    let names: Vec<&str> = list["data"]["profiles"].as_array().unwrap().iter().map(|p| p["name"].as_str().unwrap()).collect();
    assert_eq!(names, ["default", "staging"]);
    assert_eq!(list["data"]["profiles"][1]["session"], "none");

    assert_eq!(run(&dir, &["profile", "use", "staging"], "").status.code(), Some(0));
    let get = run(&dir, &["config", "get", "origin"], "");
    assert_eq!(String::from_utf8_lossy(&get.stdout).trim(), "https://staging.example.com");

    let refused = run(&dir, &["--json", "config", "set", "origin", "http://evil.example.com"], "");
    assert_eq!(refused.status.code(), Some(2));
    assert_eq!(json(&refused)["error"]["code"], "ORIGIN_INVALID");
    assert_eq!(run(&dir, &["--json", "profile", "use", "missing"], "").status.code(), Some(2));
    assert_eq!(run(&dir, &["--json", "--profile", "Bad Name", "config", "set", "origin", "https://x.example.com"], "").status.code(), Some(2));
}

#[test]
#[ignore]
fn the_real_credential_store_signs_in_moves_and_signs_out() {
    let origin = backend();
    let dir = config_dir("real", &origin);
    let login = run(&dir, &["--json", "auth", "login", "--email", "a@example.com", "--password-stdin"], "right\n");
    assert_eq!(login.status.code(), Some(0), "{}", all_output(&login));
    assert_eq!(json(&login)["data"]["session_kept"], true);
    assert!(!all_output(&login).contains(TOKEN), "the token is never printed");

    let status = run(&dir, &["--json", "auth", "status"], "");
    assert_eq!(status.status.code(), Some(0));
    assert_eq!(json(&status)["data"]["session"]["email"], "a@example.com");
    assert_eq!(json(&run(&dir, &["--json", "profile", "list"], ""))["data"]["profiles"][0]["session"], "kept");

    // Moving the profile to another origin removes the session kept for the old one.
    let other = backend();
    let moved = run(&dir, &["--json", "config", "set", "origin", &other], "");
    assert_eq!(json(&moved)["data"]["previous_session_removed"], true);
    assert_eq!(run(&dir, &["--json", "auth", "status"], "").status.code(), Some(3));

    // Back to the first origin: still signed out, nothing came back.
    run(&dir, &["config", "set", "origin", &origin], "");
    assert_eq!(run(&dir, &["--json", "auth", "status"], "").status.code(), Some(3));

    // Sign in and out again: the backend acknowledges, the entry is gone.
    assert_eq!(run(&dir, &["auth", "login", "--email", "a@example.com", "--password-stdin"], "right\n").status.code(), Some(0));
    let logout = run(&dir, &["--json", "auth", "logout"], "");
    assert_eq!(logout.status.code(), Some(0));
    let result = &json(&logout)["data"]["result"];
    assert_eq!((result["was_signed_in"].as_bool(), result["backend_acknowledged"].as_bool(), result["removed"].as_bool()), (Some(true), Some(true), Some(true)));
    assert_eq!(run(&dir, &["--json", "auth", "status"], "").status.code(), Some(3));
}

#[test]
fn models_status_needs_a_signed_in_profile() {
    let dir = config_dir("models", &backend());
    let output = run(&dir, &["--json", "models", "status"], "");
    assert_eq!(output.status.code(), Some(3));
    assert_eq!(json(&output)["error"]["code"], "SIGNED_OUT");
}

#[test]
fn scan_url_checks_the_address_first_and_needs_a_signed_in_profile() {
    let dir = config_dir("scan", &backend());
    let bad = run(&dir, &["--json", "scan", "url", "example.com"], "");
    assert_eq!(bad.status.code(), Some(2));
    assert_eq!(json(&bad)["error"]["code"], "URL_INVALID");
    let signed_out = run(&dir, &["--json", "scan", "url", "https://example.com/"], "");
    assert_eq!(signed_out.status.code(), Some(3));
    assert_eq!(json(&signed_out)["error"]["code"], "SIGNED_OUT");
    assert_eq!(run(&dir, &["scan", "url", "https://example.com/", "--fail-on", "sometimes"], "").status.code(), Some(2));
}
