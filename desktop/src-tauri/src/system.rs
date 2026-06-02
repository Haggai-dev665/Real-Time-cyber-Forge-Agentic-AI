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
    let bin = match install_dir {
        Some(d) if !d.trim().is_empty() => join_bin(&d),
        _ => default_install_target().bin,
    };
    Ok(json!({ "success": true, "bin": bin, "present": path_contains(&bin) }))
}

/// Add `<install_dir>/bin` (or the OS default) to the user PATH. Idempotent and
/// elevation-free; the bin directory is created so the PATH entry is valid.
#[tauri::command]
pub async fn add_to_path(install_dir: Option<String>) -> Result<Value, String> {
    let bin = match install_dir {
        Some(d) if !d.trim().is_empty() => join_bin(&d),
        _ => default_install_target().bin,
    };
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
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let tmp = std::env::temp_dir().join(format!("cf_hist_{}.sqlite", stamp));
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

fn compute_history(limit: usize) -> Value {
    let defs = browser_defs();
    let mut items: Vec<Value> = Vec::new();
    for d in &defs {
        let Some(h) = locate_history(d) else { continue };
        for (url, title, ts) in read_history_db(&h.path, d.firefox, limit) {
            items.push(json!({ "url": url, "title": title, "browser": d.name, "lastVisit": ts }));
        }
    }
    // newest first, then de-dup by URL, then cap
    items.sort_by(|a, b| {
        b["lastVisit"].as_i64().unwrap_or(0).cmp(&a["lastVisit"].as_i64().unwrap_or(0))
    });
    let mut seen = std::collections::HashSet::new();
    items.retain(|it| seen.insert(it["url"].as_str().unwrap_or("").to_string()));
    items.truncate(limit);
    json!({ "success": true, "data": { "history": items, "count": items.len() } })
}

/// Recent real URLs from the user's browser history (all detected browsers,
/// newest first, de-duplicated). The UI scans these with the ML backend so the
/// agent analyses actually-visited sites in real time — no extension needed.
#[tauri::command]
pub async fn get_browser_history(limit: Option<usize>) -> Result<Value, String> {
    let limit = limit.unwrap_or(25).clamp(1, 200);
    Ok(compute_history(limit))
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
        let v = compute_history(10);
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
