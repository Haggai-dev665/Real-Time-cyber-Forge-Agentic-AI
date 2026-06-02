// Active Browser URL Monitor
// Detects the currently active tab URL from running browsers using OS-level APIs.
//
// macOS: Uses `osascript` (AppleScript) to query Chrome, Safari, Firefox, Edge, Brave, Arc
// Linux: Falls back to xdotool + xprop for basic window title detection
// Windows: Falls back to window title parsing
//
// Privacy note:
//   - Only reads the URL and title of the ACTIVE/FRONT tab
//   - Does NOT access history, cookies, or stored passwords
//   - Each call is a snapshot; no persistent monitoring thread on the Rust side

use serde::Serialize;
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveTabInfo {
    pub browser: String,
    pub browser_key: String,
    pub url: String,
    pub title: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveUrlsResult {
    pub tabs: Vec<ActiveTabInfo>,
    pub scan_timestamp: String,
}

/// Get the active tab URL from all running browsers.
pub fn get_active_browser_urls() -> ActiveUrlsResult {
    let mut tabs = Vec::new();

    // Query each supported browser
    for (name, key, query_fn) in browser_queries() {
        if let Some(tab) = query_fn() {
            tabs.push(ActiveTabInfo {
                browser: name.to_string(),
                browser_key: key.to_string(),
                url: tab.0,
                title: tab.1,
                timestamp: chrono::Utc::now().to_rfc3339(),
            });
        }
    }

    ActiveUrlsResult {
        tabs,
        scan_timestamp: chrono::Utc::now().to_rfc3339(),
    }
}

// ──────────────────────────────────────────────
// macOS implementation using AppleScript
// ──────────────────────────────────────────────

#[cfg(target_os = "macos")]
fn browser_queries() -> Vec<(&'static str, &'static str, fn() -> Option<(String, String)>)> {
    vec![
        ("Google Chrome", "chrome", query_chrome as fn() -> Option<(String, String)>),
        ("Safari", "safari", query_safari as fn() -> Option<(String, String)>),
        ("Mozilla Firefox", "firefox", query_firefox as fn() -> Option<(String, String)>),
        ("Microsoft Edge", "edge", query_edge as fn() -> Option<(String, String)>),
        ("Brave Browser", "brave", query_brave as fn() -> Option<(String, String)>),
        ("Arc", "arc", query_arc as fn() -> Option<(String, String)>),
    ]
}

#[cfg(target_os = "macos")]
fn run_osascript(script: &str) -> Option<String> {
    Command::new("osascript")
        .args(["-e", script])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .filter(|s| !s.is_empty() && s != "missing value")
}

#[cfg(target_os = "macos")]
fn query_chrome() -> Option<(String, String)> {
    let url = run_osascript(
        r#"tell application "System Events" to if exists (processes where name is "Google Chrome") then tell application "Google Chrome" to get URL of active tab of front window"#,
    )?;
    let title = run_osascript(
        r#"tell application "System Events" to if exists (processes where name is "Google Chrome") then tell application "Google Chrome" to get title of active tab of front window"#,
    )
    .unwrap_or_default();
    // Filter out internal pages
    if url.starts_with("chrome://") || url.starts_with("chrome-extension://") {
        return None;
    }
    Some((url, title))
}

#[cfg(target_os = "macos")]
fn query_safari() -> Option<(String, String)> {
    let url = run_osascript(
        r#"tell application "System Events" to if exists (processes where name is "Safari") then tell application "Safari" to get URL of front document"#,
    )?;
    let title = run_osascript(
        r#"tell application "System Events" to if exists (processes where name is "Safari") then tell application "Safari" to get name of front document"#,
    )
    .unwrap_or_default();
    if url.starts_with("favorites://") || url.is_empty() {
        return None;
    }
    Some((url, title))
}

#[cfg(target_os = "macos")]
fn query_firefox() -> Option<(String, String)> {
    // Firefox doesn't expose tab URLs via AppleScript natively.
    // We can get the window title which usually contains the page title and URL info.
    let title = run_osascript(
        r#"tell application "System Events" to if exists (processes where name is "firefox") then tell application "System Events" to get name of front window of (first process whose name is "firefox")"#,
    )?;
    // Firefox window title format: "Page Title — Mozilla Firefox" or "Page Title - Mozilla Firefox"
    let page_title = title
        .replace(" — Mozilla Firefox", "")
        .replace(" - Mozilla Firefox", "")
        .trim()
        .to_string();
    if page_title.is_empty() || page_title == "Mozilla Firefox" {
        return None;
    }
    // We can't get the exact URL from Firefox via AppleScript, so we use the title
    Some(("firefox-active-tab".to_string(), page_title))
}

#[cfg(target_os = "macos")]
fn query_edge() -> Option<(String, String)> {
    let url = run_osascript(
        r#"tell application "System Events" to if exists (processes where name is "Microsoft Edge") then tell application "Microsoft Edge" to get URL of active tab of front window"#,
    )?;
    let title = run_osascript(
        r#"tell application "System Events" to if exists (processes where name is "Microsoft Edge") then tell application "Microsoft Edge" to get title of active tab of front window"#,
    )
    .unwrap_or_default();
    if url.starts_with("edge://") {
        return None;
    }
    Some((url, title))
}

#[cfg(target_os = "macos")]
fn query_brave() -> Option<(String, String)> {
    let url = run_osascript(
        r#"tell application "System Events" to if exists (processes where name is "Brave Browser") then tell application "Brave Browser" to get URL of active tab of front window"#,
    )?;
    let title = run_osascript(
        r#"tell application "System Events" to if exists (processes where name is "Brave Browser") then tell application "Brave Browser" to get title of active tab of front window"#,
    )
    .unwrap_or_default();
    if url.starts_with("brave://") {
        return None;
    }
    Some((url, title))
}

#[cfg(target_os = "macos")]
fn query_arc() -> Option<(String, String)> {
    let url = run_osascript(
        r#"tell application "System Events" to if exists (processes where name is "Arc") then tell application "Arc" to get URL of active tab of front window"#,
    )?;
    let title = run_osascript(
        r#"tell application "System Events" to if exists (processes where name is "Arc") then tell application "Arc" to get title of active tab of front window"#,
    )
    .unwrap_or_default();
    if url.starts_with("arc://") {
        return None;
    }
    Some((url, title))
}

// ──────────────────────────────────────────────
// Linux fallback — window title parsing
// ──────────────────────────────────────────────

#[cfg(target_os = "linux")]
fn browser_queries() -> Vec<(&'static str, &'static str, fn() -> Option<(String, String)>)> {
    vec![
        ("Active Browser", "browser", query_linux_active_window as fn() -> Option<(String, String)>),
    ]
}

#[cfg(target_os = "linux")]
fn query_linux_active_window() -> Option<(String, String)> {
    let output = Command::new("xdotool")
        .args(["getactivewindow", "getwindowname"])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())?;

    if output.is_empty() {
        return None;
    }
    // Window titles for browsers usually end with " - Browser Name"
    Some(("linux-active-window".to_string(), output))
}

// ──────────────────────────────────────────────
// Windows fallback — window title parsing
// ──────────────────────────────────────────────

#[cfg(target_os = "windows")]
fn browser_queries() -> Vec<(&'static str, &'static str, fn() -> Option<(String, String)>)> {
    vec![]
}

// ──────────────────────────────────────────────
// Unsupported platforms
// ──────────────────────────────────────────────

#[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
fn browser_queries() -> Vec<(&'static str, &'static str, fn() -> Option<(String, String)>)> {
    vec![]
}
