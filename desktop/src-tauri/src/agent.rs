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

/// Fetch threat-intelligence pulses from AlienVault OTX. The API key is supplied
/// by the caller (the Threat Globe holds it in the frontend). The request runs
/// from Rust via reqwest so it bypasses the webview's CSP/CORS (`connect-src`
/// blocks otx.alienvault.com from JS). Tries the richest source first and falls
/// back, so a fresh key still returns data.
#[tauri::command]
pub async fn otx_fetch(api_key: String, limit: Option<u32>) -> Result<Value, String> {
    let key = api_key.trim().to_string();
    if key.is_empty() {
        return Err("OTX API key is required".into());
    }
    let limit = limit.unwrap_or(40).clamp(1, 100);
    let base = "https://otx.alienvault.com/api/v1";
    let endpoints = [
        format!("{}/pulses/subscribed?limit={}&page=1", base, limit),
        format!("{}/pulses/activity?limit={}&page=1", base, limit),
        format!("{}/search/pulses?q=malware&limit={}&sort=-modified", base, limit),
    ];
    let client = reqwest::Client::new();
    let mut last_err = String::new();
    for url in endpoints.iter() {
        let res = client
            .get(url)
            .header("X-OTX-API-KEY", &key)
            .header("User-Agent", "cyberforge-desktop/1.0")
            .timeout(Duration::from_secs(20))
            .send()
            .await;
        match res {
            Ok(r) => {
                let status = r.status();
                let body: Value = match r.json().await {
                    Ok(v) => v,
                    Err(e) => {
                        last_err = format!("decode error: {}", e);
                        continue;
                    }
                };
                let results = body.get("results").cloned().unwrap_or(Value::Null);
                let count = results.as_array().map(|a| a.len()).unwrap_or(0);
                if status.is_success() && count > 0 {
                    // Geolocate the malicious IP indicators so the globe can draw
                    // real origin → destination movement (OTX has no source geo).
                    let ips = extract_indicator_ips(&results);
                    let ip_geo = geolocate_ips(&client, &ips).await;
                    return Ok(json!({
                        "success": true, "source": url, "count": count,
                        "results": results, "ip_geo": ip_geo
                    }));
                }
                if !status.is_success() {
                    last_err = format!("HTTP {} from OTX", status.as_u16());
                }
            }
            Err(e) => {
                last_err = crate::http::error_chain(e);
            }
        }
    }
    Ok(json!({
        "success": false,
        "error": if last_err.is_empty() { "OTX returned no pulses".into() } else { last_err },
        "results": [], "ip_geo": {}
    }))
}

/// Collect unique IPv4/IPv6 indicators from the pulse list (capped) so they can
/// be geolocated into attack-origin coordinates.
fn extract_indicator_ips(results: &Value) -> Vec<String> {
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::new();
    if let Some(arr) = results.as_array() {
        for p in arr {
            if let Some(inds) = p.get("indicators").and_then(|v| v.as_array()) {
                for ind in inds {
                    let t = ind.get("type").and_then(|v| v.as_str()).unwrap_or("");
                    if t.starts_with("IPv4") || t.starts_with("IPv6") {
                        if let Some(ip) = ind.get("indicator").and_then(|v| v.as_str()) {
                            if seen.insert(ip.to_string()) {
                                out.push(ip.to_string());
                                if out.len() >= 100 {
                                    return out;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    out
}

/// Batch-geolocate IPs via ip-api.com (free, no key). Returns a map
/// ip → { lat, lon, country, cc }. Failures are skipped silently.
async fn geolocate_ips(
    client: &reqwest::Client,
    ips: &[String],
) -> serde_json::Map<String, Value> {
    let mut out = serde_json::Map::new();
    if ips.is_empty() {
        return out;
    }
    let url = "http://ip-api.com/batch?fields=status,country,countryCode,lat,lon,query";
    if let Ok(r) = client.post(url).json(&ips).timeout(Duration::from_secs(15)).send().await {
        if let Ok(arr) = r.json::<Value>().await {
            if let Some(list) = arr.as_array() {
                for g in list {
                    if g.get("status").and_then(|v| v.as_str()) == Some("success") {
                        if let Some(ip) = g.get("query").and_then(|v| v.as_str()) {
                            out.insert(
                                ip.to_string(),
                                json!({
                                    "lat": g.get("lat").cloned().unwrap_or(Value::Null),
                                    "lon": g.get("lon").cloned().unwrap_or(Value::Null),
                                    "country": g.get("country").cloned().unwrap_or(Value::Null),
                                    "cc": g.get("countryCode").cloned().unwrap_or(Value::Null),
                                }),
                            );
                        }
                    }
                }
            }
        }
    }
    out
}

// ──────────────────────────────────────────────────────────────────────────
// Local phishing REINFORCEMENT
//
// Newly-stood-up phishing pages (e.g. on free hosts like *.great-site.net,
// *.page.gd, *.42web.io) have clean reputation and a valid cert, so the cloud
// orchestrator can return a benign verdict — a false negative. We add an
// independent local layer (URL + page-content heuristics, then DeepSeek via the
// HF token to confirm) and blend its score with the backend's, so these pages
// are flagged and alerted on even when the backend misses them.
// ──────────────────────────────────────────────────────────────────────────

fn scan_host(url: &str) -> String {
    url.split("://")
        .nth(1)
        .unwrap_or(url)
        .split('/')
        .next()
        .unwrap_or("")
        .trim_start_matches("www.")
        .to_lowercase()
}

/// Risk (0..=100) inferred from the URL/host alone + human-readable signals.
fn url_phish_signals(url: &str) -> (i64, Vec<String>) {
    let u = url.to_lowercase();
    let host = scan_host(url);
    let mut risk = 0i64;
    let mut sig: Vec<String> = Vec::new();

    // Throwaway free hosting heavily abused for phishing — a real brand login is
    // never served from one of these.
    const ABUSE_HOSTS: &[&str] = &[
        "great-site.net", "page.gd", "42web.io", "epizy.com", "infinityfreeapp.com", "rf.gd",
        "wuaze.com", "kesug.com", "free.nf", "000webhostapp.com", "byethost", "rf.gd",
        "weebly.com", "blogspot.com", "godaddysites.com", "square.site", "mystrikingly.com",
        "rf.gd", "freehostia.com", "byet.host", "infinityfree.net", "ezyro.com",
    ];
    // Legit dev/preview hosts (lower weight — sometimes abused, often genuine).
    const DEV_HOSTS: &[&str] = &["netlify.app", "vercel.app", "pages.dev", "web.app", "glitch.me", "repl.co", "onrender.com"];
    const RISKY_TLDS: &[&str] = &[
        ".gd", ".tk", ".ml", ".ga", ".cf", ".gq", ".xyz", ".top", ".click", ".live", ".rest",
        ".zip", ".mov", ".work", ".fit", ".sbs", ".cyou", ".icu", ".buzz",
    ];
    if ABUSE_HOSTS.iter().any(|h| host.ends_with(h) || host.contains(h)) {
        risk += 40;
        sig.push("hosted on a free/abused domain".into());
    } else if DEV_HOSTS.iter().any(|h| host.ends_with(h)) {
        risk += 18;
        sig.push("hosted on a free preview/dev domain".into());
    }
    if RISKY_TLDS.iter().any(|t| host.ends_with(t)) {
        risk += 16;
        sig.push("high-risk TLD".into());
    }
    // Brand tokens embedded in host/subdomain/path → impersonation.
    const BRANDS: &[&str] = &[
        "google", "gmail", "microsoft", "office365", "outlook", "apple", "icloud", "paypal",
        "amazon", "facebook", "instagram", "netflix", "whatsapp", "dropbox", "docusign",
        "coinbase", "binance", "metamask", "wellsfargo", "chase",
    ];
    if let Some(b) = BRANDS.iter().find(|b| host.contains(*b) || u.contains(&format!("/{}", b))) {
        risk += 22;
        sig.push(format!("brand token '{}' in URL", b));
    }
    // Credential-style keywords in the URL.
    const KW: &[&str] = &[
        "login", "signin", "sign-in", "verify", "secure", "account", "update", "webscr",
        "auth", "confirm", "unlock", "recover", "wallet", "billing", "credential",
    ];
    let kw = KW.iter().filter(|k| u.contains(**k)).count();
    if kw >= 2 {
        risk += 14;
        sig.push("credential keywords in URL".into());
    } else if kw == 1 {
        risk += 7;
    }
    if host.split('.').count() >= 5 {
        risk += 8;
        sig.push("excessive subdomain depth".into());
    }
    if u.contains('@') {
        risk += 15;
        sig.push("'@' in URL".into());
    }
    if host.starts_with("xn--") || host.contains(".xn--") {
        risk += 18;
        sig.push("punycode (look-alike) host".into());
    }
    (risk.min(100), sig)
}

// ── Minimal AES-128 (for solving the InfinityFree / aes.js bot challenge) ──
const AES_SBOX: [u8; 256] = [
    0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
    0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
    0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
    0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
    0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
    0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
    0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
    0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
    0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
    0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
    0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
    0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
    0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
    0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
    0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
    0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16,
];
const AES_INV_SBOX: [u8; 256] = [
    0x52,0x09,0x6a,0xd5,0x30,0x36,0xa5,0x38,0xbf,0x40,0xa3,0x9e,0x81,0xf3,0xd7,0xfb,
    0x7c,0xe3,0x39,0x82,0x9b,0x2f,0xff,0x87,0x34,0x8e,0x43,0x44,0xc4,0xde,0xe9,0xcb,
    0x54,0x7b,0x94,0x32,0xa6,0xc2,0x23,0x3d,0xee,0x4c,0x95,0x0b,0x42,0xfa,0xc3,0x4e,
    0x08,0x2e,0xa1,0x66,0x28,0xd9,0x24,0xb2,0x76,0x5b,0xa2,0x49,0x6d,0x8b,0xd1,0x25,
    0x72,0xf8,0xf6,0x64,0x86,0x68,0x98,0x16,0xd4,0xa4,0x5c,0xcc,0x5d,0x65,0xb6,0x92,
    0x6c,0x70,0x48,0x50,0xfd,0xed,0xb9,0xda,0x5e,0x15,0x46,0x57,0xa7,0x8d,0x9d,0x84,
    0x90,0xd8,0xab,0x00,0x8c,0xbc,0xd3,0x0a,0xf7,0xe4,0x58,0x05,0xb8,0xb3,0x45,0x06,
    0xd0,0x2c,0x1e,0x8f,0xca,0x3f,0x0f,0x02,0xc1,0xaf,0xbd,0x03,0x01,0x13,0x8a,0x6b,
    0x3a,0x91,0x11,0x41,0x4f,0x67,0xdc,0xea,0x97,0xf2,0xcf,0xce,0xf0,0xb4,0xe6,0x73,
    0x96,0xac,0x74,0x22,0xe7,0xad,0x35,0x85,0xe2,0xf9,0x37,0xe8,0x1c,0x75,0xdf,0x6e,
    0x47,0xf1,0x1a,0x71,0x1d,0x29,0xc5,0x89,0x6f,0xb7,0x62,0x0e,0xaa,0x18,0xbe,0x1b,
    0xfc,0x56,0x3e,0x4b,0xc6,0xd2,0x79,0x20,0x9a,0xdb,0xc0,0xfe,0x78,0xcd,0x5a,0xf4,
    0x1f,0xdd,0xa8,0x33,0x88,0x07,0xc7,0x31,0xb1,0x12,0x10,0x59,0x27,0x80,0xec,0x5f,
    0x60,0x51,0x7f,0xa9,0x19,0xb5,0x4a,0x0d,0x2d,0xe5,0x7a,0x9f,0x93,0xc9,0x9c,0xef,
    0xa0,0xe0,0x3b,0x4d,0xae,0x2a,0xf5,0xb0,0xc8,0xeb,0xbb,0x3c,0x83,0x53,0x99,0x61,
    0x17,0x2b,0x04,0x7e,0xba,0x77,0xd6,0x26,0xe1,0x69,0x14,0x63,0x55,0x21,0x0c,0x7d,
];
const AES_RCON: [u8; 11] = [0x00,0x01,0x02,0x04,0x08,0x10,0x20,0x40,0x80,0x1b,0x36];

fn gf_mul(mut a: u8, mut b: u8) -> u8 {
    let mut p = 0u8;
    for _ in 0..8 {
        if b & 1 != 0 { p ^= a; }
        let hi = a & 0x80;
        a <<= 1;
        if hi != 0 { a ^= 0x1b; }
        b >>= 1;
    }
    p
}
fn aes128_key_expansion(key: &[u8; 16]) -> [u8; 176] {
    let mut w = [0u8; 176];
    w[..16].copy_from_slice(key);
    let mut i = 16;
    let mut rc = 1;
    while i < 176 {
        let mut t = [w[i - 4], w[i - 3], w[i - 2], w[i - 1]];
        if i % 16 == 0 {
            t.rotate_left(1);
            for x in t.iter_mut() { *x = AES_SBOX[*x as usize]; }
            t[0] ^= AES_RCON[rc];
            rc += 1;
        }
        for j in 0..4 { w[i + j] = w[i - 16 + j] ^ t[j]; }
        i += 4;
    }
    w
}
/// Decrypt one 16-byte block with AES-128 (state index = row + 4*col).
fn aes128_decrypt_block(ct: &[u8; 16], key: &[u8; 16]) -> [u8; 16] {
    let w = aes128_key_expansion(key);
    let mut s = *ct;
    let ark = |s: &mut [u8; 16], r: usize| { for i in 0..16 { s[i] ^= w[16 * r + i]; } };
    let inv_sub = |s: &mut [u8; 16]| { for b in s.iter_mut() { *b = AES_INV_SBOX[*b as usize]; } };
    let inv_shift = |s: &mut [u8; 16]| {
        let t = *s;
        for r in 1..4 { for c in 0..4 { s[r + 4 * c] = t[r + 4 * ((c + 4 - r) % 4)]; } }
    };
    let inv_mix = |s: &mut [u8; 16]| {
        for c in 0..4 {
            let i = 4 * c;
            let (a0, a1, a2, a3) = (s[i], s[i + 1], s[i + 2], s[i + 3]);
            s[i]     = gf_mul(a0,14) ^ gf_mul(a1,11) ^ gf_mul(a2,13) ^ gf_mul(a3,9);
            s[i + 1] = gf_mul(a0,9)  ^ gf_mul(a1,14) ^ gf_mul(a2,11) ^ gf_mul(a3,13);
            s[i + 2] = gf_mul(a0,13) ^ gf_mul(a1,9)  ^ gf_mul(a2,14) ^ gf_mul(a3,11);
            s[i + 3] = gf_mul(a0,11) ^ gf_mul(a1,13) ^ gf_mul(a2,9)  ^ gf_mul(a3,14);
        }
    };
    ark(&mut s, 10);
    for r in (1..=9).rev() { inv_shift(&mut s); inv_sub(&mut s); ark(&mut s, r); inv_mix(&mut s); }
    inv_shift(&mut s); inv_sub(&mut s); ark(&mut s, 0);
    s
}
fn hex16(h: &str) -> Option<[u8; 16]> {
    if h.len() != 32 { return None; }
    let mut out = [0u8; 16];
    for i in 0..16 {
        out[i] = u8::from_str_radix(&h[i * 2..i * 2 + 2], 16).ok()?;
    }
    Some(out)
}
fn to_hex(b: &[u8]) -> String { b.iter().map(|x| format!("{:02x}", x)).collect() }

/// Parse an InfinityFree `aes.js` interstitial: the `toNumbers("..")` constants
/// (key, iv, cipher) and the redirect target. Returns `(__test cookie, target)`.
fn solve_if_challenge(html: &str, base: &str) -> Option<(String, String)> {
    if !(html.contains("toNumbers(") && html.contains("__test")) { return None; }
    let mut nums = Vec::new();
    for part in html.split("toNumbers(\"").skip(1) {
        if let Some(end) = part.find('"') {
            if let Some(b) = hex16(&part[..end]) { nums.push(b); }
        }
    }
    if nums.len() < 3 { return None; }
    let (a, b, c) = (nums[0], nums[1], nums[2]); // key, iv, cipher (slowAES.decrypt(c,2,a,b))
    let dec = aes128_decrypt_block(&c, &a);
    let mut plain = [0u8; 16];
    for i in 0..16 { plain[i] = dec[i] ^ b[i]; } // CBC: XOR with IV
    let cookie = to_hex(&plain);
    // Redirect target from location.href="…"; fall back to the base + ?i=1.
    let target = html
        .split("location.href=\"").nth(1)
        .and_then(|p| p.find('"').map(|e| p[..e].to_string()))
        .unwrap_or_else(|| if base.contains('?') { base.to_string() } else { format!("{}/?i=1", base.trim_end_matches('/')) });
    Some((cookie, target))
}

const SCAN_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async fn fetch_text(client: &reqwest::Client, url: &str, cookie: Option<&str>) -> Option<String> {
    let mut req = client
        .get(url)
        .header("User-Agent", SCAN_UA)
        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
        .header("Accept-Language", "en-US,en;q=0.9")
        .timeout(Duration::from_secs(10));
    if let Some(ck) = cookie { req = req.header("Cookie", format!("__test={}", ck)); }
    let resp = req.send().await.ok()?;
    let bytes = resp.bytes().await.ok()?;
    Some(String::from_utf8_lossy(&bytes).chars().take(160_000).collect())
}

/// Fetch the page (best-effort, bounded). If a free host returns an `aes.js`
/// bot interstitial, solve it and re-fetch so we inspect the REAL page — the
/// exact step the cloud scraper skips, which is why these were scored "safe".
async fn scan_fetch_page(url: &str) -> Option<String> {
    let client = crate::http::client();
    let first = fetch_text(&client, url, None).await?;
    if first.contains("toNumbers(") && first.contains("__test") {
        if let Some((cookie, target)) = solve_if_challenge(&first, url) {
            if let Some(real) = fetch_text(&client, &target, Some(&cookie)).await {
                if !real.contains("toNumbers(") {
                    return Some(real);
                }
            }
        }
    }
    Some(first)
}

/// Crudely strip HTML to visible text for the model / lure matching. Char-based
/// so it never slices a multi-byte sequence.
fn html_to_text(html: &str) -> String {
    let mut out = String::with_capacity(html.len() / 2);
    let mut in_tag = false;
    let mut tag_buf = String::new();
    let mut skip = false; // inside <script>/<style>
    for c in html.chars() {
        if in_tag {
            if c == '>' {
                in_tag = false;
                let t = tag_buf.trim_start_matches('/').to_lowercase();
                if t.starts_with("script") || t.starts_with("style") {
                    skip = !tag_buf.starts_with('/');
                }
                out.push(' ');
            } else if tag_buf.len() < 12 {
                tag_buf.push(c);
            }
        } else if c == '<' {
            in_tag = true;
            tag_buf.clear();
        } else if !skip {
            out.push(c);
        }
    }
    out.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Risk (0..=100) inferred from page content + signals.
fn content_phish_signals(html: &str) -> (i64, Vec<String>) {
    let h = html.to_lowercase();
    let mut risk = 0i64;
    let mut sig: Vec<String> = Vec::new();

    let has_password = h.contains("type=\"password\"") || h.contains("type='password'") || h.contains("type=password");
    if has_password {
        risk += 28;
        sig.push("password input field".into());
        if h.contains("<form") {
            risk += 8;
            sig.push("credential form".into());
        }
    }
    const LOGIN_KW: &[&str] = &[
        "sign in", "signin", "log in", "login", "verify your", "confirm your identity",
        "two-step", "authenticate", "enter your password",
    ];
    let lk = LOGIN_KW.iter().filter(|k| h.contains(**k)).count();
    if lk >= 2 {
        risk += 12;
        sig.push("sign-in / verification language".into());
    }
    const BRANDS: &[&str] = &[
        "google", "microsoft", "office 365", "office365", "outlook", "apple id", "paypal",
        "amazon", "facebook", "netflix", "dropbox",
    ];
    if has_password {
        if let Some(b) = BRANDS.iter().find(|b| h.contains(**b)) {
            risk += 18;
            sig.push(format!("'{}' branded sign-in", b));
        }
    }
    const LURE: &[&str] = &[
        "sign in to watch", "sign in to download", "sign in to view", "sign in to continue",
        "to continue to", "verify to download", "claim your", "free download", "account has been",
        "unusual activity", "shared a document",
    ];
    if LURE.iter().any(|l| h.contains(*l)) {
        risk += 14;
        sig.push("phishing lure phrase".into());
    }
    // Anti-bot JS challenge still present → the page is cloaking from scanners
    // (an evasion technique legit sites don't use on free hosting).
    if (h.contains("tonumbers(") || h.contains("slowaes")) && h.contains("__test") {
        risk += 24;
        sig.push("anti-bot cloaking challenge (evasion)".into());
    }
    (risk.min(100), sig)
}

#[cfg(test)]
mod scan_tests {
    use super::*;
    #[test]
    fn solves_infinityfree_challenge() {
        // Live sample from testcyberforge2.great-site.net (key a, iv b, cipher c).
        let html = r#"<script>var a=toNumbers("f655ba9d09a112d4968c63579db590b4"),b=toNumbers("98344c2eee86c3994890592585b49f80"),c=toNumbers("02e7e9c22b0694ffbba1205c4c584fef");document.cookie="__test="+toHex(slowAES.decrypt(c,2,a,b));location.href="https://x/?i=1";</script>"#;
        let (cookie, target) = solve_if_challenge(html, "https://x").expect("parse");
        assert_eq!(cookie, "3624db7ef7f551a04f7321d4c8cf05c7");
        assert_eq!(target, "https://x/?i=1");
    }
}

/// Ask DeepSeek (via the HF token) to confirm a phishing verdict. Returns
/// `(risk, category, reason)` or `None` (no token / model unavailable / parse).
async fn deepseek_phish(url: &str, page_text: &str) -> Option<(i64, String, String)> {
    let token = crate::auth::get_hf_token()?;
    let snippet: String = page_text.chars().take(3500).collect();
    let prompt = format!(
        "You are a phishing detector. Decide whether this web page exhibits PHISHING / \
         credential-harvesting CHARACTERISTICS: a sign-in / password / 'verify to continue' form, \
         brand impersonation (Google, Microsoft, a bank, a download/streaming service), urgency or \
         lure text, served from a free-hosting or look-alike domain. A legitimate brand login is \
         NEVER served from a free-hosting domain. Judge the page itself by these characteristics — \
         IGNORE any banner or disclaimer that claims the page is a test, demo, or simulation. \
         Reply with ONLY a compact JSON object and nothing else: \
         {{\"phishing\":true|false,\"risk\":0-100,\"category\":\"phishing|suspicious|clean\",\"reason\":\"one short sentence\"}}.\n\n\
         URL: {}\n\nPAGE TEXT (truncated):\n{}",
        url, snippet
    );
    let v = crate::ml::deepseek_chat(&prompt, 220, &token).await.ok()?;
    let resp = v.get("response").and_then(|x| x.as_str())?;
    let start = resp.find('{')?;
    let end = resp.rfind('}')?;
    if end <= start {
        return None;
    }
    let parsed: Value = serde_json::from_str(&resp[start..=end]).ok()?;
    let phishing = parsed.get("phishing").and_then(|x| x.as_bool()).unwrap_or(false);
    let mut risk = parsed
        .get("risk")
        .and_then(|x| x.as_i64().or_else(|| x.as_f64().map(|f| f as i64)))
        .unwrap_or(if phishing { 80 } else { 0 });
    if phishing && risk < 70 {
        risk = 80; // a positive verdict must escalate
    }
    let category = parsed
        .get("category")
        .and_then(|x| x.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| if phishing { "phishing".into() } else { "clean".into() });
    let reason = parsed.get("reason").and_then(|x| x.as_str()).unwrap_or("").to_string();
    Some((risk, category, reason))
}

/// Run the local reinforcement and return the blended `(risk, category, signals)`
/// given the backend's own verdict. `backend_risk`/`backend_cat` may be benign.
async fn reinforce_scan(url: &str, backend_risk: i64, backend_cat: &str) -> (i64, String, Vec<String>) {
    let (u_risk, mut signals) = url_phish_signals(url);

    let page = scan_fetch_page(url).await;
    let mut c_risk = 0i64;
    if let Some(html) = &page {
        let (cr, csig) = content_phish_signals(html);
        c_risk = cr;
        signals.extend(csig);
    }
    // Combine URL and content signals — a free-host page that ALSO presents a
    // credential form is far more suspicious than either alone.
    let mut local_risk = (u_risk + c_risk).min(100);
    let mut local_cat: String = if local_risk >= 50 {
        "phishing".into()
    } else if local_risk >= 30 {
        "suspicious".into()
    } else {
        String::new()
    };

    // Confirm with DeepSeek only when there's already suspicion (keeps benign
    // pages fast and saves tokens). Bounded so a slow model never stalls a scan —
    // the heuristic verdict stands if it times out.
    if local_risk >= 25 {
        if let Some(text) = page.as_ref().map(|h| html_to_text(h)) {
            let ds = tokio::time::timeout(Duration::from_secs(22), deepseek_phish(url, &text))
                .await
                .ok()
                .flatten();
            if let Some((dr, dcat, dreason)) = ds {
                if dr > local_risk {
                    local_risk = dr;
                }
                if !dcat.is_empty() && dcat != "clean" {
                    local_cat = dcat;
                }
                if !dreason.is_empty() {
                    signals.push(format!("AI: {}", dreason));
                }
            }
        }
    }

    let final_risk = backend_risk.max(local_risk);
    let final_cat = if local_risk >= backend_risk && !local_cat.is_empty() {
        local_cat
    } else if !backend_cat.is_empty() && backend_cat != "unknown" {
        backend_cat.to_string()
    } else if final_risk >= 50 {
        "phishing".into()
    } else if final_risk >= 30 {
        "suspicious".into()
    } else {
        "clean".into()
    };
    (final_risk.min(100), final_cat, signals)
}

/// Build (or replace) the always-on-top threat-alert popup so the user sees it
/// over their browser even when CyberForge is minimized. Window creation is
/// dispatched to the main thread (a requirement on some platforms).
fn show_threat_alert(app: &tauri::AppHandle) {
    let app = app.clone();
    let _ = app.clone().run_on_main_thread(move || {
        use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
        const LABEL: &str = "cf-threat-alert";
        if let Some(w) = app.get_webview_window(LABEL) {
            let _ = w.close();
        }
        let (w, h) = (392.0_f64, 318.0_f64);
        let built = WebviewWindowBuilder::new(&app, LABEL, WebviewUrl::App("pages/threat-alert.html".into()))
            .title("CyberForge Security Alert")
            .inner_size(w, h)
            .resizable(false)
            .decorations(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .focused(true)
            .build();
        if let Ok(win) = built {
            if let Ok(Some(mon)) = win.primary_monitor() {
                let s = mon.size().to_logical::<f64>(mon.scale_factor());
                let x = (s.width - w - 22.0).max(8.0);
                let y = (s.height - h - 60.0).max(8.0);
                let _ = win.set_position(tauri::LogicalPosition::new(x, y));
            }
        }
    });
}

/// The latest flagged threat — read by the threat-alert popup window on load.
#[tauri::command]
pub async fn get_pending_threat(state: State<'_, SharedState>) -> Result<Value, String> {
    let s = state.lock().await;
    Ok(s.pending_threat.clone().unwrap_or(Value::Null))
}

/// Scan a URL through the backend agent pipeline and cache the result in state.
#[tauri::command]
pub async fn scan_url(
    app: tauri::AppHandle,
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

    // Backend scan (best-effort). If it fails we still run local reinforcement,
    // so scanning never hard-fails and phishing is still caught offline-ish.
    let mut body: Value = match authed(req, &headers).send().await {
        Ok(resp) => resp.json().await.unwrap_or_else(|_| json!({ "success": true, "data": {} })),
        Err(_) => json!({ "success": true, "data": { "scraperSuccess": false } }),
    };
    if !body.get("data").map(|d| d.is_object()).unwrap_or(false) {
        body["data"] = json!({});
    }
    if let Some(obj) = body.get_mut("data").and_then(|d| d.as_object_mut()) {
        obj.entry("url".to_string()).or_insert_with(|| json!(url));
    }

    // The backend's own verdict (may be benign / missing on fresh phishing).
    let backend_risk = body
        .pointer("/data/riskScore")
        .and_then(|v| v.as_i64().or_else(|| v.as_f64().map(|f| f as i64)))
        .unwrap_or(0);
    let backend_cat = body
        .pointer("/data/category")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    // Local reinforcement (URL + page content + DeepSeek) blended in.
    let (final_risk, final_cat, signals) = reinforce_scan(&url, backend_risk, &backend_cat).await;
    let reinforced = final_risk > backend_risk || (final_cat != backend_cat && final_risk >= 50);
    if let Some(obj) = body.get_mut("data").and_then(|d| d.as_object_mut()) {
        obj.insert("riskScore".to_string(), json!(final_risk));
        obj.insert("category".to_string(), json!(final_cat));
        obj.insert("signals".to_string(), json!(signals));
        obj.insert("backendRiskScore".to_string(), json!(backend_risk));
        obj.insert("reinforced".to_string(), json!(reinforced));
        if reinforced && !signals.is_empty() {
            let extra = format!(
                "CyberForge local analysis flagged this page (risk {}, {}): {}.",
                final_risk, final_cat, signals.join(", ")
            );
            let prev = obj.get("summary").and_then(|v| v.as_str()).unwrap_or("").to_string();
            obj.insert(
                "summary".to_string(),
                json!(if prev.is_empty() { extra } else { format!("{} {}", prev, extra) }),
            );
        }
    }

    // Vector memory (RAG): recall similar past scans, remember THIS one with the
    // blended verdict so the AI assistant + threat views see the real risk.
    let related = crate::memory::recall(&url, 4);
    {
        let host = scan_host(&url);
        let summary = body.pointer("/data/summary").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let text = format!("Scanned {} — {} (risk {}). {}", host, final_cat, final_risk, summary);
        crate::memory::remember(&text, "episodic", Some(url.clone()), Some(final_cat.clone()), Some(final_risk));
    }
    if let Some(obj) = body.get_mut("data").and_then(|d| d.as_object_mut()) {
        obj.insert("related".to_string(), json!(related));
    }

    // Pop an always-on-top alert over the browser when a real threat is flagged,
    // deduped per host (10-minute window) so it never spams.
    if final_risk >= 50 {
        let host = scan_host(&url);
        let fire = {
            let mut s = state.lock().await;
            let now = Instant::now();
            let recent = s
                .alerted_hosts
                .get(&host)
                .map(|t| now.duration_since(*t) < Duration::from_secs(600))
                .unwrap_or(false);
            if recent {
                false
            } else {
                s.alerted_hosts.insert(host.clone(), now);
                let kind = if final_cat.contains("phish") { "phishing" } else { "malicious" };
                let msg = format!(
                    "We scanned {} earlier and found it is a {} page that is trying to steal your credentials. CyberForge rated it {} / 100 risk. What would you like to do?",
                    host, kind, final_risk
                );
                s.pending_threat = Some(json!({
                    "host": host.clone(),
                    "url": url.clone(),
                    "risk": final_risk,
                    "category": final_cat.clone(),
                    "message": msg,
                    "signals": signals.clone(),
                }));
                true
            }
        };
        if fire {
            show_threat_alert(&app);
        }
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
