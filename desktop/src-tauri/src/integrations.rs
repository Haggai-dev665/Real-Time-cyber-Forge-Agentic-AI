//! What the desktop knows about its integrations: the `cyberforge` command
//! line, installed beside the app (V2-01), and its MCP server (V2-03).
//!
//! `cli_status` looks for the CLI next to this program only, asks it for its
//! version with fixed arguments, and checks whether its folder is on PATH.
//! The `mcp_*` commands approve, list and revoke AI clients by running that
//! CLI with fixed arguments and checked values, so the CLI's own profile and
//! session are used only by the CLI (plan §4.2). It never runs anything a page
//! names.

use cyberforge_core::credentials::app_config_dir;
use cyberforge_core::grants;
use cyberforge_core::operations;
use cyberforge_core::text::printable;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::time::Duration;

/// The CLI's configuration directory: its profiles, grants and MCP call log.
const CLI_APP_ID: &str = "com.cyberforge.cli";

fn cli_name() -> &'static str {
    if cfg!(windows) { "cyberforge.exe" } else { "cyberforge" }
}

/// The CLI beside this program, if it is there.
fn beside_app() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let candidate = exe.parent()?.join(cli_name());
    candidate.is_file().then_some(candidate)
}

/// Whether `folder` is one of the PATH entries this process sees. A PATH change
/// made by the installer reaches programs started after it.
fn on_path(folder: &Path, path_var: &str) -> bool {
    let sep = if cfg!(windows) { ';' } else { ':' };
    let want = folder.to_string_lossy().trim_end_matches(['\\', '/']).to_lowercase();
    path_var.split(sep).any(|entry| entry.trim().trim_end_matches(['\\', '/']).to_lowercase() == want)
}

/// The CLI's JSON envelope for fixed arguments, or why there is none.
async fn envelope_of(cli: &Path, args: &[&str], seconds: u64) -> Result<Value, String> {
    let mut command = tokio::process::Command::new(cli);
    command.arg("--json").arg("--non-interactive").args(args).stdin(std::process::Stdio::null()).kill_on_drop(true);
    #[cfg(target_os = "windows")]
    command.creation_flags(0x0800_0000); // no console window
    let output = tokio::time::timeout(Duration::from_secs(seconds), command.output())
        .await
        .map_err(|_| format!("the CLI did not answer within {seconds} seconds"))?
        .map_err(|e| format!("the CLI could not be started: {e}"))?;
    let envelope: Value = serde_json::from_slice(&output.stdout).map_err(|_| "the CLI's answer was not its JSON envelope".to_string())?;
    if envelope.get("schema").and_then(Value::as_str) != Some("cyberforge.cli.v1") {
        return Err("the program beside the app does not answer as the CyberForge CLI".into());
    }
    Ok(envelope)
}

/// The CLI's own report of its version, or why there is none.
async fn version_of(cli: &Path) -> Result<Value, String> {
    let envelope = envelope_of(cli, &["version"], 5).await?;
    Ok(envelope.get("data").cloned().unwrap_or(Value::Null))
}

/// The envelope's data, or its error message.
fn data_or_error(envelope: Value) -> Result<Value, String> {
    if envelope.get("ok").and_then(Value::as_bool) == Some(true) {
        return Ok(envelope.get("data").cloned().unwrap_or(Value::Null));
    }
    let message = envelope.pointer("/error/message").and_then(Value::as_str).unwrap_or("The CLI refused.");
    Err(printable(message, 300))
}

fn installed_cli() -> Result<PathBuf, String> {
    beside_app().ok_or_else(|| "The cyberforge command is not installed beside this app, and AI clients start their MCP server through it.".to_string())
}

/// The last `limit` MCP calls from the CLI's log, newest first: when, which
/// grant, which tool and how it ended. The log never holds a call's arguments.
fn recent_calls(dir: &Path, limit: usize) -> Vec<Value> {
    let text = std::fs::read_to_string(dir.join("mcp-calls.jsonl")).unwrap_or_default();
    let lines: Vec<&str> = text.lines().collect();
    lines[lines.len().saturating_sub(limit)..]
        .iter()
        .rev()
        .filter_map(|line| serde_json::from_str::<Value>(line).ok())
        .map(|v| json!({
            "at": v.get("at").and_then(Value::as_u64),
            "grant": printable(v.get("grant").and_then(Value::as_str).unwrap_or(""), 40),
            "tool": printable(v.get("tool").and_then(Value::as_str).unwrap_or(""), 60),
            "outcome": printable(v.get("outcome").and_then(Value::as_str).unwrap_or(""), 40),
        }))
        .collect()
}

/// A client name as `cyberforge mcp grant create` accepts it.
fn valid_client_name(name: &str) -> bool {
    let name = name.trim();
    !name.is_empty() && name.chars().count() <= 60 && !name.chars().any(char::is_control)
}

fn valid_grant_id(id: &str) -> bool {
    id.len() == 26 && id.starts_with("g_") && id[2..].chars().all(|c| c.is_ascii_digit() || ('a'..='f').contains(&c))
}

/// The approved AI clients, the CLI profiles they act as, what can be
/// granted, the recent calls, and the configuration each active client needs.
#[tauri::command]
pub async fn mcp_grants() -> Result<Value, String> {
    let cli = installed_cli()?;
    let list = data_or_error(envelope_of(&cli, &["mcp", "grant", "list"], 10).await?)?;
    let profiles = envelope_of(&cli, &["profile", "list"], 10).await.ok().and_then(|e| data_or_error(e).ok()).unwrap_or(Value::Null);
    let command = cli.to_string_lossy().to_string();
    let rows: Vec<Value> = list.get("grants").and_then(Value::as_array).cloned().unwrap_or_default().into_iter().map(|mut g| {
        if g.get("state").and_then(Value::as_str) == Some("active") {
            let id = g.get("id").and_then(Value::as_str).unwrap_or("").to_string();
            g["clientConfig"] = grants::client_config(&command, &id);
        }
        g
    }).collect();
    let defaults = grants::default_operations();
    let grantable: Vec<Value> = grants::grantable().into_iter().map(|op| json!({
        "id": op.id, "tool": operations::mcp_tool_name(op.id), "summary": op.summary,
        "default": defaults.iter().any(|d| d == op.id),
    })).collect();
    let calls = app_config_dir(CLI_APP_ID).map(|dir| recent_calls(&dir, 20)).unwrap_or_default();
    Ok(json!({ "grants": rows, "profiles": profiles, "grantable": grantable, "recentCalls": calls, "cli": command }))
}

/// Approve an AI client for the CLI's current profile and its signed-in account.
#[tauri::command]
pub async fn mcp_grant_create(name: String, allow_scan: bool, days: u64) -> Result<Value, String> {
    if !valid_client_name(&name) {
        return Err("Give the client a name of 1 to 60 characters.".into());
    }
    if !(1..=grants::MAX_DAYS).contains(&days) {
        return Err(format!("An approval lasts 1 to {} days.", grants::MAX_DAYS));
    }
    let cli = installed_cli()?;
    // `--name=…` keeps a name that starts with '-' from being read as a flag.
    let name_arg = format!("--name={}", name.trim());
    let days_arg = format!("--days={days}");
    let mut args = vec!["mcp", "grant", "create", name_arg.as_str(), days_arg.as_str()];
    if allow_scan {
        args.push("--allow=scan.url");
    }
    data_or_error(envelope_of(&cli, &args, 30).await?)
}

/// Withdraw an AI client's approval; its next call is refused.
#[tauri::command]
pub async fn mcp_grant_revoke(id: String) -> Result<Value, String> {
    if !valid_grant_id(&id) {
        return Err("That is not a grant id.".into());
    }
    let cli = installed_cli()?;
    data_or_error(envelope_of(&cli, &["mcp", "grant", "revoke", &id], 10).await?)
}

#[tauri::command]
pub async fn cli_status() -> Result<Value, String> {
    let Some(cli) = beside_app() else {
        return Ok(json!({
            "installed": false,
            "reason": "The cyberforge command is not installed beside this app. Installers made with `npm run build` include it; development builds have it after `cargo build -p cyberforge-cli`.",
            "mcp": { "available": false, "reason": "AI clients start the MCP server through the cyberforge command, which is not installed." }
        }));
    };
    let folder = cli.parent().map(Path::to_path_buf).unwrap_or_default();
    let path_var = std::env::var("PATH").unwrap_or_default();
    let version = version_of(&cli).await;
    Ok(json!({
        "installed": true,
        "path": cli.to_string_lossy(),
        "folder": folder.to_string_lossy(),
        "onPath": on_path(&folder, &path_var),
        "version": version.as_ref().ok().and_then(|d| d.get("version")).cloned(),
        "schema": version.as_ref().ok().and_then(|d| d.get("schema")).cloned(),
        "mcp": { "available": version.is_ok() },
        "versionError": version.err(),
    }))
}

#[cfg(test)]
mod integration_tests {
    use super::{on_path, recent_calls, valid_client_name, valid_grant_id};
    use std::path::Path;

    #[test]
    fn page_values_are_checked_before_the_cli_runs() {
        assert!(valid_client_name("Claude Desktop"));
        assert!(valid_client_name("--json"), "passed as --name=..., so it cannot become a flag");
        assert!(!valid_client_name("   "));
        assert!(!valid_client_name(&"x".repeat(61)));
        assert!(!valid_client_name("a\nb"));
        assert!(valid_grant_id("g_0123456789abcdef01234567"));
        for bad in ["g_0123456789ABCDEF01234567", "g_0123", "--json", "g_0123456789abcdef0123456z"] {
            assert!(!valid_grant_id(bad), "{bad}");
        }
    }

    #[test]
    fn recent_calls_are_newest_first_and_carry_only_known_fields() {
        let dir = std::env::temp_dir().join(format!("cf-desktop-calls-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let log = [
            r#"{"at":1,"grant":"g_a","tool":"cyberforge_status","outcome":"ok","extra":"x"}"#,
            "not json",
            r#"{"at":2,"grant":"g_a","tool":"cyberforge_model_status","outcome":"SIGNED_OUT"}"#,
        ];
        std::fs::write(dir.join("mcp-calls.jsonl"), log.join("\n")).unwrap();
        let calls = recent_calls(&dir, 20);
        assert_eq!(calls.len(), 2);
        assert_eq!(calls[0]["outcome"], "SIGNED_OUT");
        assert!(calls[1].get("extra").is_none());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_folder_is_on_path_whatever_its_case_or_trailing_separator() {
        let sep = if cfg!(windows) { ";" } else { ":" };
        let path = ["C:\\Windows", "C:\\Users\\Me\\AppData\\Local\\CyberForge\\", "D:\\tools"].join(sep);
        assert!(on_path(Path::new("C:\\Users\\Me\\AppData\\Local\\CyberForge"), &path));
        assert!(on_path(Path::new("c:\\users\\me\\appdata\\local\\cyberforge"), &path));
        assert!(!on_path(Path::new("C:\\Users\\Me\\AppData\\Local\\Other"), &path));
        assert!(!on_path(Path::new("C:\\Users\\Me\\AppData\\Local\\CyberForge"), ""));
    }
}
