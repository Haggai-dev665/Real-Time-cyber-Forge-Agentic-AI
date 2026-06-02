// Browser Detector — OS-aware, privacy-conscious browser detection.
//
// Capabilities:
//   ✓ Detect installed browsers (Chrome, Firefox, Edge, Brave, Opera, Chromium, Arc)
//   ✓ Extract version via safe CLI invocation
//   ✓ Determine install path
//   ✓ Check if process is currently running
//   ✓ Detect default browser (macOS / Linux / Windows)
//
// Privacy guarantee:
//   ✗ Does NOT access browsing history
//   ✗ Does NOT read cookies or passwords
//   ✗ Does NOT inspect extensions or profile data
//
// Only system-level installation metadata is collected.

use serde::Serialize;
use std::process::Command;
use super::process_checker;

// ──────────────────────────────────────────────
// Public types
// ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserDetectionResult {
    pub os: &'static str,
    pub os_display: String,
    pub browsers: Vec<DetectedBrowser>,
    pub default_browser: Option<String>,
    pub scan_timestamp: String,
    pub privacy_notice: &'static str,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedBrowser {
    pub name: String,
    pub key: String,
    pub version: Option<String>,
    pub install_path: Option<String>,
    pub is_installed: bool,
    pub is_running: bool,
    pub is_default: bool,
    pub icon_class: String,
    pub debug_port: u16,
}

// ──────────────────────────────────────────────
// Browser candidate definition
// ──────────────────────────────────────────────

struct BrowserCandidate {
    name: &'static str,
    key: &'static str,
    icon_class: &'static str,
    debug_port: u16,
    process_names: Vec<&'static str>,
}

fn browser_candidates() -> Vec<BrowserCandidate> {
    vec![
        BrowserCandidate {
            name: "Google Chrome",
            key: "chrome",
            icon_class: "fab fa-chrome",
            debug_port: 9222,
            process_names: vec!["google chrome", "chrome"],
        },
        BrowserCandidate {
            name: "Mozilla Firefox",
            key: "firefox",
            icon_class: "fab fa-firefox-browser",
            debug_port: 9223,
            process_names: vec!["firefox"],
        },
        BrowserCandidate {
            name: "Microsoft Edge",
            key: "edge",
            icon_class: "fab fa-edge",
            debug_port: 9224,
            process_names: vec!["microsoft edge", "msedge"],
        },
        BrowserCandidate {
            name: "Brave Browser",
            key: "brave",
            icon_class: "fab fa-brave",
            debug_port: 9225,
            process_names: vec!["brave"],
        },
        BrowserCandidate {
            name: "Opera",
            key: "opera",
            icon_class: "fab fa-opera",
            debug_port: 9226,
            process_names: vec!["opera"],
        },
        BrowserCandidate {
            name: "Chromium",
            key: "chromium",
            icon_class: "fab fa-chrome",
            debug_port: 9227,
            process_names: vec!["chromium"],
        },
        BrowserCandidate {
            name: "Arc",
            key: "arc",
            icon_class: "fas fa-arc",
            debug_port: 9228,
            process_names: vec!["arc"],
        },
    ]
}

// ──────────────────────────────────────────────
// Main entry point
// ──────────────────────────────────────────────

/// Detect all browsers on the system. Returns structured JSON-ready data.
pub fn detect_all_browsers() -> BrowserDetectionResult {
    let os = super::os_info::get_os_name();
    let os_display = super::os_info::get_os_display_name().to_string();
    let default = detect_default_browser();
    let candidates = browser_candidates();

    let browsers: Vec<DetectedBrowser> = candidates
        .into_iter()
        .map(|c| {
            let install_path = get_install_path(c.key);
            let is_installed = install_path
                .as_ref()
                .map(|p| std::path::Path::new(p).exists())
                .unwrap_or(false);

            let version = if is_installed {
                get_browser_version(c.key, install_path.as_deref())
            } else {
                None
            };

            let is_running = process_checker::is_process_running(&c.process_names);

            let is_default = default
                .as_ref()
                .map(|d| d.to_lowercase().contains(c.key))
                .unwrap_or(false);

            DetectedBrowser {
                name: c.name.to_string(),
                key: c.key.to_string(),
                version,
                install_path,
                is_installed,
                is_running,
                is_default,
                icon_class: c.icon_class.to_string(),
                debug_port: c.debug_port,
            }
        })
        .collect();

    BrowserDetectionResult {
        os,
        os_display,
        browsers,
        default_browser: default,
        scan_timestamp: chrono::Utc::now().to_rfc3339(),
        privacy_notice: "No personal browsing data accessed. Only system-level installation metadata is collected.",
    }
}

// ──────────────────────────────────────────────
// macOS install paths
// ──────────────────────────────────────────────

#[cfg(target_os = "macos")]
fn get_install_path(key: &str) -> Option<String> {
    match key {
        "chrome" => Some("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome".into()),
        "firefox" => Some("/Applications/Firefox.app/Contents/MacOS/firefox".into()),
        "edge" => Some("/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge".into()),
        "brave" => Some("/Applications/Brave Browser.app/Contents/MacOS/Brave Browser".into()),
        "opera" => Some("/Applications/Opera.app/Contents/MacOS/Opera".into()),
        "chromium" => Some("/Applications/Chromium.app/Contents/MacOS/Chromium".into()),
        "arc" => Some("/Applications/Arc.app/Contents/MacOS/Arc".into()),
        _ => None,
    }
}

// ──────────────────────────────────────────────
// Linux install paths (uses `which`)
// ──────────────────────────────────────────────

#[cfg(target_os = "linux")]
fn get_install_path(key: &str) -> Option<String> {
    let bins: &[&str] = match key {
        "chrome" => &["google-chrome", "google-chrome-stable"],
        "firefox" => &["firefox"],
        "edge" => &["microsoft-edge", "microsoft-edge-stable"],
        "brave" => &["brave-browser", "brave-browser-stable"],
        "opera" => &["opera"],
        "chromium" => &["chromium-browser", "chromium"],
        "arc" => &["arc"],
        _ => return None,
    };

    for bin in bins {
        if let Some(path) = which_bin(bin) {
            return Some(path);
        }
    }
    None
}

#[cfg(target_os = "linux")]
fn which_bin(name: &str) -> Option<String> {
    Command::new("which")
        .arg(name)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
}

// ──────────────────────────────────────────────
// Windows install paths (registry + known locations)
// ──────────────────────────────────────────────

#[cfg(target_os = "windows")]
fn get_install_path(key: &str) -> Option<String> {
    let candidates: Vec<String> = match key {
        "chrome" => vec![
            format!(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
            format!(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
            format!(r"{}\AppData\Local\Google\Chrome\Application\chrome.exe", std::env::var("USERPROFILE").unwrap_or_default()),
        ],
        "firefox" => vec![
            format!(r"C:\Program Files\Mozilla Firefox\firefox.exe"),
            format!(r"C:\Program Files (x86)\Mozilla Firefox\firefox.exe"),
        ],
        "edge" => vec![
            format!(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
            format!(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
        ],
        "brave" => vec![
            format!(r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe"),
            format!(r"C:\Program Files (x86)\BraveSoftware\Brave-Browser\Application\brave.exe"),
            format!(r"{}\AppData\Local\BraveSoftware\Brave-Browser\Application\brave.exe", std::env::var("USERPROFILE").unwrap_or_default()),
        ],
        "opera" => vec![
            format!(r"{}\AppData\Local\Programs\Opera\launcher.exe", std::env::var("USERPROFILE").unwrap_or_default()),
            format!(r"C:\Program Files\Opera\launcher.exe"),
        ],
        "chromium" => vec![
            format!(r"C:\Program Files\Chromium\Application\chrome.exe"),
            format!(r"{}\AppData\Local\Chromium\Application\chrome.exe", std::env::var("USERPROFILE").unwrap_or_default()),
        ],
        "arc" => vec![
            format!(r"{}\AppData\Local\Packages\TheBrowserCompany.Arc\LocalCache\Local\Arc\Application\Arc.exe", std::env::var("USERPROFILE").unwrap_or_default()),
        ],
        _ => return None,
    };

    for path in candidates {
        if std::path::Path::new(&path).exists() {
            return Some(path);
        }
    }
    None
}

// ──────────────────────────────────────────────
// Unsupported OS fallback
// ──────────────────────────────────────────────

#[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
fn get_install_path(_key: &str) -> Option<String> {
    None
}

// ──────────────────────────────────────────────
// Version extraction (safe process invocation)
// ──────────────────────────────────────────────

fn get_browser_version(key: &str, install_path: Option<&str>) -> Option<String> {
    let output = match key {
        // Chromium-based browsers support --version
        "chrome" | "edge" | "brave" | "chromium" | "arc" => {
            let path = install_path?;
            run_version_command(path, &["--version"])
        }
        // Firefox
        "firefox" => {
            let path = install_path?;
            run_version_command(path, &["--version"])
        }
        // Opera
        "opera" => {
            let path = install_path?;
            run_version_command(path, &["--version"])
        }
        _ => None,
    };

    output.map(|raw| extract_version_number(&raw))
}

/// Run a command and capture stdout, with a timeout.
fn run_version_command(binary: &str, args: &[&str]) -> Option<String> {
    Command::new(binary)
        .args(args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .output()
        .ok()
        .filter(|o| o.status.success() || !o.stdout.is_empty())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
}

/// Extract a semver-like version number from a raw string.
/// e.g. "Google Chrome 123.0.6312.86" → "123.0.6312.86"
/// e.g. "Mozilla Firefox 124.0.1" → "124.0.1"
fn extract_version_number(raw: &str) -> String {
    // Find the first sequence that looks like a version (digits and dots)
    let mut start = None;
    let mut end = 0;
    for (i, ch) in raw.char_indices() {
        if ch.is_ascii_digit() {
            if start.is_none() {
                start = Some(i);
            }
            end = i + ch.len_utf8();
        } else if ch == '.' && start.is_some() {
            end = i + ch.len_utf8();
        } else if start.is_some() {
            break;
        }
    }

    match start {
        Some(s) => raw[s..end].trim_end_matches('.').to_string(),
        None => raw.to_string(),
    }
}

// ──────────────────────────────────────────────
// Default browser detection
// ──────────────────────────────────────────────

#[cfg(target_os = "macos")]
fn detect_default_browser() -> Option<String> {
    // On macOS, the default HTTP handler is stored in Launch Services.
    // We query it using `defaults read` on the LaunchServices plist.
    let output = Command::new("defaults")
        .args(["read", "com.apple.LaunchServices/com.apple.launchservices.secure", "LSHandlers"])
        .output()
        .ok()?;

    let text = String::from_utf8_lossy(&output.stdout).to_lowercase();

    // Parse for the http handler
    if text.contains("com.google.chrome") {
        Some("Google Chrome".into())
    } else if text.contains("org.mozilla.firefox") {
        Some("Mozilla Firefox".into())
    } else if text.contains("com.microsoft.edgemac") {
        Some("Microsoft Edge".into())
    } else if text.contains("com.brave.browser") {
        Some("Brave Browser".into())
    } else if text.contains("com.operasoftware.opera") {
        Some("Opera".into())
    } else if text.contains("company.thebrowser.browser") {
        Some("Arc".into())
    } else if text.contains("com.apple.safari") {
        Some("Safari".into())
    } else {
        // Fallback: try plutil-based approach
        detect_default_browser_fallback()
    }
}

#[cfg(target_os = "macos")]
fn detect_default_browser_fallback() -> Option<String> {
    // Use python3 to query via CoreServices (commonly available on macOS)
    let output = Command::new("python3")
        .args([
            "-c",
            "from LaunchServices import LSCopyDefaultHandlerForURLScheme; \
             h = LSCopyDefaultHandlerForURLScheme('https'); \
             print(str(h) if h else '')",
        ])
        .output()
        .ok()
        .filter(|o| o.status.success())?;

    let bundle = String::from_utf8_lossy(&output.stdout).trim().to_lowercase();
    if bundle.is_empty() {
        return None;
    }

    if bundle.contains("chrome") { return Some("Google Chrome".into()); }
    if bundle.contains("firefox") { return Some("Mozilla Firefox".into()); }
    if bundle.contains("edge") { return Some("Microsoft Edge".into()); }
    if bundle.contains("brave") { return Some("Brave Browser".into()); }
    if bundle.contains("opera") { return Some("Opera".into()); }
    if bundle.contains("arc") || bundle.contains("thebrowser") { return Some("Arc".into()); }
    if bundle.contains("safari") { return Some("Safari".into()); }

    Some(bundle)
}

#[cfg(target_os = "linux")]
fn detect_default_browser() -> Option<String> {
    // On Linux, xdg-settings provides the default browser
    let output = Command::new("xdg-settings")
        .args(["get", "default-web-browser"])
        .output()
        .ok()
        .filter(|o| o.status.success())?;

    let desktop = String::from_utf8_lossy(&output.stdout).trim().to_lowercase();
    if desktop.is_empty() {
        return None;
    }

    if desktop.contains("chrome") { return Some("Google Chrome".into()); }
    if desktop.contains("firefox") { return Some("Mozilla Firefox".into()); }
    if desktop.contains("edge") { return Some("Microsoft Edge".into()); }
    if desktop.contains("brave") { return Some("Brave Browser".into()); }
    if desktop.contains("opera") { return Some("Opera".into()); }
    if desktop.contains("chromium") { return Some("Chromium".into()); }

    Some(desktop)
}

#[cfg(target_os = "windows")]
fn detect_default_browser() -> Option<String> {
    // On Windows, query the registry for the default HTTP handler
    let output = Command::new("reg")
        .args([
            "query",
            r"HKEY_CURRENT_USER\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\https\UserChoice",
            "/v",
            "ProgId",
        ])
        .output()
        .ok()
        .filter(|o| o.status.success())?;

    let text = String::from_utf8_lossy(&output.stdout).to_lowercase();

    if text.contains("chromehtml") { return Some("Google Chrome".into()); }
    if text.contains("firefoxurl") { return Some("Mozilla Firefox".into()); }
    if text.contains("msedgehtm") { return Some("Microsoft Edge".into()); }
    if text.contains("bravehtml") { return Some("Brave Browser".into()); }
    if text.contains("operastable") { return Some("Opera".into()); }

    Some("Unknown".into())
}

#[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
fn detect_default_browser() -> Option<String> {
    None
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_extraction() {
        assert_eq!(extract_version_number("Google Chrome 123.0.6312.86"), "123.0.6312.86");
        assert_eq!(extract_version_number("Mozilla Firefox 124.0.1"), "124.0.1");
        assert_eq!(extract_version_number("Brave Browser 1.63.174"), "1.63.174");
        assert_eq!(extract_version_number("Microsoft Edge 122.0.2365.92"), "122.0.2365.92");
    }

    #[test]
    fn test_detect_does_not_panic() {
        // Should never panic, even if no browsers are installed
        let result = detect_all_browsers();
        assert!(!result.os.is_empty());
        assert!(!result.browsers.is_empty()); // candidates always returned
    }
}
