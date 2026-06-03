//! Agent actions for the Agent Core screen + floating agent panel:
//!   • `scan_url`        — real URL scan via the backend (scraper → ML → Gemini)
//!   • `get_active_urls` — the active browser tab URL(s) so scans target what the
//!                         user is actually browsing (macOS AppleScript)
//!   • `get_last_scan`   — the most recent scan result (shared state → keeps the
//!                         Agent Core screen and the floating panel in sync)
//!   • `agent_alerts`    — real alerts feed from the backend
//!
//! Mirrors the desktop-app's browser-monitoring + scan logic, but the scan call
//! runs from Rust (reqwest + keychain token) so there are no CORS/CSP concerns.

use crate::state::AppState;
use serde_json::{json, Value};
use std::process::Command;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::State;
use tokio::sync::Mutex;

type SharedState = Arc<Mutex<AppState>>;

fn authed(
    mut req: reqwest::RequestBuilder,
    headers: &[(String, String)],
) -> reqwest::RequestBuilder {
    for (k, v) in headers {
        req = req.header(k, v);
    }
    req
}

/// Run an AppleScript snippet and return trimmed stdout (None if empty/failed).
#[cfg(target_os = "macos")]
fn run_osascript(script: &str) -> Option<String> {
    let out = Command::new("osascript").arg("-e").arg(script).output().ok()?;
    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if s.is_empty() || s == "missing value" {
        None
    } else {
        Some(s)
    }
}

#[cfg(not(target_os = "macos"))]
fn run_osascript(_script: &str) -> Option<String> {
    None
}

/// The URL of the tab the user is **actively looking at** — the priority target
/// for real-time scanning. On macOS we ask the front browser directly. On
/// Windows there is no scripting bridge, so we read the foreground window title
/// (which is the active tab's page title) and resolve it to a URL via the user's
/// browser history. Either way the result is the single active tab, so the
/// scanner never has to guess between many history entries.
#[tauri::command]
pub async fn get_active_urls(state: State<'_, SharedState>) -> Result<Value, String> {
    #[cfg(target_os = "macos")]
    {
        let _ = &state;
        return Ok(json!({ "success": true, "data": { "urls": collect_active_urls() } }));
    }

    #[cfg(windows)]
    {
        if let Some((key, name, page)) = foreground_browser_tab() {
            let snap = crate::system::history_data(state.inner()).await;
            if let Some(item) = match_title_in_history(&snap, &page) {
                return Ok(json!({ "success": true, "data": { "urls": [item] } }));
            }
            // Foreground IS a browser but the page isn't in history yet (e.g. a
            // brand-new tab). Expose the title so the UI can show context, but
            // give no URL to scan — better idle than scanning the wrong page.
            return Ok(json!({
                "success": true,
                "data": { "urls": [], "active": { "browser": name, "key": key, "title": page } }
            }));
        }
        let _ = &state;
        return Ok(json!({ "success": true, "data": { "urls": [] } }));
    }

    #[cfg(not(any(target_os = "macos", windows)))]
    {
        let _ = &state;
        Ok(json!({ "success": true, "data": { "urls": [] } }))
    }
}

/// Read the foreground window's title and, if it belongs to a known browser,
/// return (browser-key, browser-name, page-title). The page title is the window
/// title with the trailing " - <Browser>" suffix removed.
#[cfg(windows)]
fn foreground_browser_tab() -> Option<(String, String, String)> {
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW,
    };
    // (title suffix, display name, key) — order matters (em-dash Firefox first).
    const SUF: &[(&str, &str, &str)] = &[
        (" - Google Chrome", "Google Chrome", "chrome"),
        (" - Microsoft\u{200b} Edge", "Microsoft Edge", "edge"),
        (" - Microsoft Edge", "Microsoft Edge", "edge"),
        (" \u{2014} Mozilla Firefox", "Firefox", "firefox"),
        (" - Mozilla Firefox", "Firefox", "firefox"),
        (" - Brave", "Brave", "brave"),
        (" - Opera", "Opera", "opera"),
        (" - Chromium", "Chromium", "chromium"),
    ];
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return None;
        }
        let len = GetWindowTextLengthW(hwnd);
        if len <= 0 {
            return None;
        }
        let mut buf = vec![0u16; (len as usize) + 1];
        let n = GetWindowTextW(hwnd, &mut buf);
        if n <= 0 {
            return None;
        }
        let title = String::from_utf16_lossy(&buf[..n as usize]);
        for (suf, name, key) in SUF {
            if let Some(p) = title.strip_suffix(suf) {
                let page = p.trim().to_string();
                if page.is_empty() || page.eq_ignore_ascii_case("New Tab") {
                    return None;
                }
                return Some((key.to_string(), name.to_string(), page));
            }
        }
        None
    }
}

/// Find the most recent history entry whose title matches the foreground page
/// title, and return it shaped like an active-tab record. History is newest
/// first, so the first qualifying entry is the freshest. Substring matching is
/// length-guarded to avoid spurious matches on very short titles.
#[cfg(windows)]
fn match_title_in_history(snap: &Value, page: &str) -> Option<Value> {
    let arr = snap.pointer("/data/history")?.as_array()?;
    let pl = page.to_lowercase();
    for it in arr {
        let url = it.get("url").and_then(|v| v.as_str()).unwrap_or("");
        if !url.starts_with("http") {
            continue;
        }
        let t = it.get("title").and_then(|v| v.as_str()).unwrap_or("");
        if t.is_empty() {
            continue;
        }
        let tl = t.to_lowercase();
        let long = pl.len() >= 5 && tl.len() >= 5;
        if tl == pl || (long && (tl.contains(&pl) || pl.contains(&tl))) {
            let host = url
                .split("://")
                .nth(1)
                .and_then(|r| r.split('/').next())
                .unwrap_or("")
                .to_string();
            let browser = it.get("browser").and_then(|v| v.as_str()).unwrap_or("").to_string();
            return Some(json!({
                "browser": browser, "key": "active", "url": url, "title": t,
                "host": host, "https": url.starts_with("https"), "source": "foreground"
            }));
        }
    }
    None
}

/// Active tab URL/title/host for each running browser (macOS AppleScript).
fn collect_active_urls() -> Vec<Value> {
    // (display name, key, url-script, title-script)
    let defs: [(&str, &str, &str, &str); 4] = [
        (
            "Google Chrome", "chrome",
            r#"tell application "System Events" to if exists (processes where name is "Google Chrome") then tell application "Google Chrome" to get URL of active tab of front window"#,
            r#"tell application "System Events" to if exists (processes where name is "Google Chrome") then tell application "Google Chrome" to get title of active tab of front window"#,
        ),
        (
            "Safari", "safari",
            r#"tell application "System Events" to if exists (processes where name is "Safari") then tell application "Safari" to get URL of front document"#,
            r#"tell application "System Events" to if exists (processes where name is "Safari") then tell application "Safari" to get name of front document"#,
        ),
        (
            "Brave Browser", "brave",
            r#"tell application "System Events" to if exists (processes where name is "Brave Browser") then tell application "Brave Browser" to get URL of active tab of front window"#,
            r#"tell application "System Events" to if exists (processes where name is "Brave Browser") then tell application "Brave Browser" to get title of active tab of front window"#,
        ),
        (
            "Microsoft Edge", "edge",
            r#"tell application "System Events" to if exists (processes where name is "Microsoft Edge") then tell application "Microsoft Edge" to get URL of active tab of front window"#,
            r#"tell application "System Events" to if exists (processes where name is "Microsoft Edge") then tell application "Microsoft Edge" to get title of active tab of front window"#,
        ),
    ];

    let mut urls = Vec::new();
    for &(name, key, url_script, title_script) in defs.iter() {
        if let Some(url) = run_osascript(url_script) {
            if url.starts_with("http") {
                let title = run_osascript(title_script).unwrap_or_default();
                let host = url
                    .split("://")
                    .nth(1)
                    .and_then(|r| r.split('/').next())
                    .unwrap_or("")
                    .to_string();
                let https = url.starts_with("https");
                urls.push(json!({ "browser": name, "key": key, "url": url, "title": title, "host": host, "https": https }));
            }
        }
    }
    urls
}

/// Browser intelligence for the screen: running browsers + active tab sessions +
/// the domains being visited (active-tab hosts + last-scan external domains).
#[tauri::command]
pub async fn browser_intel(state: State<'_, SharedState>) -> Result<Value, String> {
    let browsers_payload = crate::system::browsers_data(state.inner()).await;
    let browsers = browsers_payload
        .pointer("/data/browsers")
        .cloned()
        .unwrap_or(json!([]));
    let sessions = collect_active_urls();

    // domains = unique active-tab hosts + external domains from the last scan
    let mut domains: Vec<String> = Vec::new();
    let push_domain = |d: &str, list: &mut Vec<String>| {
        if !d.is_empty() && !list.iter().any(|x| x == d) {
            list.push(d.to_string());
        }
    };
    for s in &sessions {
        if let Some(h) = s.get("host").and_then(|v| v.as_str()) {
            push_domain(h, &mut domains);
        }
    }
    {
        let st = state.lock().await;
        if let Some(scan) = &st.last_scan {
            if let Some(ext) = scan.pointer("/data/externalDomains").and_then(|v| v.as_array()) {
                for d in ext {
                    if let Some(ds) = d.as_str() {
                        push_domain(ds, &mut domains);
                    }
                }
            }
        }
    }

    Ok(json!({
        "success": true,
        "data": { "browsers": browsers, "sessions": sessions, "domains": domains }
    }))
}

/// Report the detected browsers to the backend (best-effort, runs occasionally).
#[tauri::command]
pub async fn browser_intel_report(state: State<'_, SharedState>) -> Result<Value, String> {
    let browsers = crate::system::browsers_data(state.inner())
        .await
        .pointer("/data/browsers")
        .cloned()
        .unwrap_or(json!([]));
    let (base, headers, user_id) = {
        let s = state.lock().await;
        (
            s.backend_url.clone(),
            s.auth_headers(),
            s.current_user.as_ref().map(|u| u.id.clone()),
        )
    };
    let Some(uid) = user_id else {
        return Ok(json!({ "success": false, "message": "not signed in" }));
    };
    let client = reqwest::Client::new();
    let req = client
        .post(format!("{}/api/agent/browser-intelligence", base))
        .timeout(Duration::from_secs(12))
        .json(&json!({ "userId": uid, "deviceId": "desktop", "browsers": browsers }));
    match authed(req, &headers).send().await {
        Ok(r) => {
            let b: Value = r.json().await.unwrap_or(json!({ "success": true }));
            Ok(b)
        }
        Err(e) => Ok(json!({ "success": false, "error": crate::http::error_chain(e) })),
    }
}

/// Scan a URL through the backend agent pipeline and cache the result in state.
#[tauri::command]
pub async fn scan_url(
    state: State<'_, SharedState>,
    url: String,
    browser: Option<String>,
) -> Result<Value, String> {
    if url.trim().is_empty() {
        return Err("url is required".into());
    }

    let (base, headers, user_id) = {
        let s = state.lock().await;
        (
            s.backend_url.clone(),
            s.auth_headers(),
            s.current_user.as_ref().map(|u| u.id.clone()),
        )
    };

    let client = reqwest::Client::new();
    let req = client
        .post(format!("{}/api/agent/scan-url", base))
        .timeout(Duration::from_secs(60))
        .json(&json!({
            "url": url,
            "browser": browser.unwrap_or_else(|| "desktop".into()),
            "userId": user_id,
        }));

    let resp = authed(req, &headers)
        .send()
        .await
        .map_err(crate::http::error_chain)?;
    let mut body: Value = resp.json().await.map_err(crate::http::error_chain)?;

    // Vector memory (RAG): recall similar past scans, remember this one.
    let related = crate::memory::recall(&url, 4);
    if let Some(d) = body.get("data").cloned() {
        let risk = d
            .get("riskScore")
            .and_then(|v| v.as_i64().or_else(|| v.as_f64().map(|f| f as i64)));
        let cat = d
            .get("category")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();
        let summary = d.get("summary").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let host = url
            .split("://")
            .nth(1)
            .and_then(|r| r.split('/').next())
            .unwrap_or(url.as_str())
            .to_string();
        let text = format!("Scanned {} — {} (risk {}). {}", host, cat, risk.unwrap_or(0), summary);
        crate::memory::remember(&text, "episodic", Some(url.clone()), Some(cat), risk);
    }
    if let Some(obj) = body.get_mut("data").and_then(|d| d.as_object_mut()) {
        obj.insert("related".to_string(), json!(related));
    }

    {
        let mut s = state.lock().await;
        s.last_scan = Some(body.clone());
    }

    Ok(body)
}

/// The most recent scan result (shared between Agent Core + floating panel).
#[tauri::command]
pub async fn get_last_scan(state: State<'_, SharedState>) -> Result<Value, String> {
    let s = state.lock().await;
    Ok(s.last_scan.clone().unwrap_or(Value::Null))
}

/// Real alerts from the backend for the agent console / activity feed.
#[tauri::command]
pub async fn agent_alerts(state: State<'_, SharedState>) -> Result<Value, String> {
    let (base, headers, user_id) = {
        let s = state.lock().await;
        (
            s.backend_url.clone(),
            s.auth_headers(),
            s.current_user.as_ref().map(|u| u.id.clone()),
        )
    };

    let Some(uid) = user_id else {
        return Ok(json!({ "success": true, "data": { "count": 0, "alerts": [] } }));
    };

    let client = reqwest::Client::new();
    let req = client
        .get(format!("{}/api/agent/alerts?userId={}&limit=20", base, uid))
        .timeout(Duration::from_secs(12));

    match authed(req, &headers).send().await {
        Ok(r) => {
            let body: Value = r.json().await.map_err(crate::http::error_chain)?;
            Ok(body)
        }
        Err(e) => Ok(json!({ "success": false, "error": crate::http::error_chain(e), "data": { "count": 0, "alerts": [] } })),
    }
}

// ── Threat Overview data ────────────────────────────────────────────────────

/// Threats + severity breakdown + stats for the Threat Overview screen (cached).
pub async fn threats_data(state: &SharedState) -> Value {
    {
        let s = state.lock().await;
        if let Some((t, v)) = &s.threats_cache {
            if t.elapsed() < Duration::from_secs(60) {
                return v.clone();
            }
        }
    }

    let (base, headers, is_auth, user_id) = {
        let s = state.lock().await;
        (
            s.backend_url.clone(),
            s.auth_headers(),
            s.is_authenticated,
            s.current_user.as_ref().map(|u| u.id.clone()),
        )
    };
    // Skip the backend entirely until signed in (same rate-limit reasoning as
    // metrics::status_data) — the broadcaster runs on the login screen too.
    if !is_auth {
        return json!({ "success": true, "data": {
            "total": 0, "critical": 0, "high": 0, "medium": 0, "low": 0,
            "threats": [], "stats": Value::Null
        }});
    }
    let client = reqwest::Client::new();

    let mut threats: Vec<Value> = Vec::new();
    let (mut crit, mut high, mut med, mut low) = (0u64, 0u64, 0u64, 0u64);
    if let Ok(r) = authed(
        client
            .get(format!("{}/api/threats?status=active&limit=100", base))
            .timeout(Duration::from_secs(12)),
        &headers,
    )
    .send()
    .await
    {
        if let Ok(b) = r.json::<Value>().await {
            if let Some(arr) = b.pointer("/data/threats").and_then(|v| v.as_array()) {
                for t in arr {
                    match t.get("severity").and_then(|v| v.as_str()).unwrap_or("") {
                        "critical" => crit += 1,
                        "high" => high += 1,
                        "medium" => med += 1,
                        "low" => low += 1,
                        _ => {}
                    }
                }
                threats = arr.clone();
            }
        }
    }

    // Real detections also live in the agent "alerts" collection (scraper/scan
    // analyses), which is separate from /api/threats. Merge them so the Threat
    // Overview reflects actual activity instead of an empty threats table.
    if let Some(uid) = &user_id {
        if let Ok(r) = authed(
            client
                .get(format!("{}/api/agent/alerts?userId={}&limit=50", base, uid))
                .timeout(Duration::from_secs(12)),
            &headers,
        )
        .send()
        .await
        {
            if let Ok(b) = r.json::<Value>().await {
                if let Some(arr) = b.pointer("/data/alerts").and_then(|v| v.as_array()) {
                    for a in arr {
                        let sev = a.get("severity").and_then(|v| v.as_str()).unwrap_or("low");
                        match sev {
                            "critical" => crit += 1,
                            "high" => high += 1,
                            "medium" => med += 1,
                            _ => low += 1,
                        }
                        let desc = a.get("description").and_then(|v| v.as_str()).unwrap_or("");
                        let title: String = desc
                            .lines()
                            .next()
                            .unwrap_or("")
                            .trim_start_matches('#')
                            .trim()
                            .chars()
                            .take(90)
                            .collect();
                        let source = a.get("source").and_then(|v| v.as_str()).unwrap_or("alert");
                        threats.push(json!({
                            "severity": sev,
                            "type": source,
                            "title": if title.is_empty() { source.to_string() } else { title },
                            "source": source,
                            "alertId": a.get("alert_id").cloned().unwrap_or(Value::Null),
                            "createdAt": a.get("created_at").cloned()
                                .or_else(|| a.get("timestamp").cloned()).unwrap_or(Value::Null),
                            "riskScore": a.get("riskScore").cloned()
                                .or_else(|| a.get("risk_score").cloned()).unwrap_or(Value::Null)
                        }));
                    }
                }
            }
        }
    }

    let mut total = crit + high + med + low;
    let mut stats = Value::Null;
    if let Ok(r) = authed(
        client
            .get(format!("{}/api/threats/stats", base))
            .timeout(Duration::from_secs(12)),
        &headers,
    )
    .send()
    .await
    {
        if let Ok(b) = r.json::<Value>().await {
            if let Some(d) = b.get("data") {
                if let Some(tt) = d.get("total_threats").and_then(|v| v.as_u64()) {
                    if tt > total {
                        total = tt;
                    }
                }
                stats = d.clone();
            }
        }
    }

    let result = json!({
        "success": true,
        "data": {
            "total": total, "critical": crit, "high": high, "medium": med, "low": low,
            "threats": threats, "stats": stats
        }
    });
    {
        let mut s = state.lock().await;
        s.threats_cache = Some((Instant::now(), result.clone()));
    }
    result
}

#[tauri::command]
pub async fn get_threats(state: State<'_, SharedState>) -> Result<Value, String> {
    Ok(threats_data(state.inner()).await)
}

// ── Google sign-in (loopback OAuth) ─────────────────────────────────────────

fn urlencode(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => out.push(b as char),
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}

fn urldecode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out: Vec<u8> = Vec::new();
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'%' if i + 2 < bytes.len() => match u8::from_str_radix(&s[i + 1..i + 3], 16) {
                Ok(b) => {
                    out.push(b);
                    i += 3;
                }
                Err(_) => {
                    out.push(bytes[i]);
                    i += 1;
                }
            },
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            c => {
                out.push(c);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).to_string()
}

#[cfg(target_os = "macos")]
fn open_url(url: &str) {
    let _ = Command::new("open").arg(url).spawn();
}
#[cfg(not(target_os = "macos"))]
fn open_url(_url: &str) {}

/// Google sign-in for desktop: opens the consent screen in the system browser,
/// captures the OAuth `code` on a loopback port, and exchanges it via the
/// backend (`/api/auth/google/token`). Requires `GOOGLE_CLIENT_ID`/`SECRET` on
/// the server (and the loopback redirect registered in the Google console).
#[tauri::command]
pub async fn auth_google(state: State<'_, SharedState>) -> Result<Value, String> {
    let base = {
        let s = state.lock().await;
        s.backend_url.clone()
    };
    let client = reqwest::Client::new();

    // 1) client id from the backend
    let cfg: Value = client
        .get(format!("{}/api/auth/google/config", base))
        .header("User-Agent", "cyber-forge-desktop/1.0")
        .timeout(Duration::from_secs(12))
        .send()
        .await
        .map_err(crate::http::error_chain)?
        .json()
        .await
        .map_err(crate::http::error_chain)?;
    let client_id = cfg
        .get("clientId")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if client_id.is_empty() {
        return Ok(json!({
            "success": false,
            "message": "Google sign-in is not configured on the server (set GOOGLE_CLIENT_ID)."
        }));
    }

    // 2) loopback listener on a random port
    let listener = std::net::TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let redirect_uri = format!("http://127.0.0.1:{}", port);

    // 3) build the consent URL + open the system browser
    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope={}&access_type=offline&prompt=select_account",
        urlencode(&client_id),
        urlencode(&redirect_uri),
        urlencode("openid email profile"),
    );
    open_url(&auth_url);

    // 4) wait for the loopback callback (non-blocking poll, 180s timeout)
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let deadline = Instant::now() + Duration::from_secs(180);
    let code: String = loop {
        match listener.accept() {
            Ok((mut stream, _)) => {
                use std::io::{Read, Write};
                let _ = stream.set_nonblocking(false);
                let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
                let mut buf = [0u8; 4096];
                let n = stream.read(&mut buf).unwrap_or(0);
                let req = String::from_utf8_lossy(&buf[..n]);
                let first = req.lines().next().unwrap_or("");
                let path = first.split_whitespace().nth(1).unwrap_or("");
                let found = path.split('?').nth(1).and_then(|qs| {
                    qs.split('&').find_map(|kv| {
                        let mut it = kv.splitn(2, '=');
                        if it.next() == Some("code") {
                            it.next().map(urldecode)
                        } else {
                            None
                        }
                    })
                });
                let html = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n<!doctype html><meta charset=utf-8><body style=\"font-family:system-ui,sans-serif;background:#0b1220;color:#efe9dd;text-align:center;padding-top:90px\"><h2>CyberForge</h2><p>Signed in &mdash; close this tab and return to the app.</p></body>";
                let _ = stream.write_all(html.as_bytes());
                match found {
                    Some(c) if !c.is_empty() => break c,
                    _ => {
                        return Ok(json!({ "success": false, "message": "Google sign-in was cancelled." }))
                    }
                }
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                if Instant::now() > deadline {
                    return Err("Google sign-in timed out".into());
                }
                tokio::time::sleep(Duration::from_millis(250)).await;
            }
            Err(e) => return Err(e.to_string()),
        }
    };

    // 5) exchange the code for a session via the backend
    let resp = client
        .post(format!("{}/api/auth/google/token", base))
        .header("User-Agent", "cyber-forge-desktop/1.0")
        .timeout(Duration::from_secs(30))
        .json(&json!({ "code": code, "redirect_uri": redirect_uri }))
        .send()
        .await
        .map_err(crate::http::error_chain)?;
    let body = crate::http::read_json(resp).await?;

    // 6) flatten + persist (same shape as auth_login)
    let token = body
        .pointer("/data/token")
        .and_then(|t| t.as_str())
        .or_else(|| body.get("token").and_then(|t| t.as_str()));
    let user_val = body.pointer("/data/user").or_else(|| body.get("user"));
    if let (Some(tok), Some(uv)) = (token, user_val) {
        let user = crate::commands::build_user_info(uv);
        let user_json = serde_json::to_string(&user).unwrap_or_default();
        let user_clone = uv.clone();
        {
            let mut s = state.lock().await;
            s.set_authenticated(user, tok.to_string());
        }
        let _ = crate::auth::store_token(tok);
        crate::auth::store_user(&user_json); // cache profile for offline restore
        return Ok(json!({ "success": true, "token": tok, "user": user_clone, "message": "Signed in with Google" }));
    }

    Ok(body)
}
