// System utilities — browser detection, etc.

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct BrowserInfo {
    pub name: String,
    pub key: String,
    pub debug_port: u16,
    pub available: bool,
}

/// Detect installed browsers on the system.
pub fn detect_browsers() -> Vec<BrowserInfo> {
    let mut browsers = Vec::new();

    let candidates = vec![
        ("Google Chrome", "chrome", 9222u16, chrome_path()),
        ("Brave Browser", "brave", 9223, brave_path()),
        ("Microsoft Edge", "edge", 9224, edge_path()),
        ("Chromium", "chromium", 9225, chromium_path()),
        ("Arc", "arc", 9226, arc_path()),
        ("Opera", "opera", 9227, opera_path()),
    ];

    for (name, key, port, path) in candidates {
        let available = path.map(|p| std::path::Path::new(&p).exists()).unwrap_or(false);
        browsers.push(BrowserInfo {
            name: name.to_string(),
            key: key.to_string(),
            debug_port: port,
            available,
        });
    }

    browsers
}

// Platform-specific browser paths

#[cfg(target_os = "macos")]
fn chrome_path() -> Option<String> {
    Some("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome".into())
}

#[cfg(target_os = "macos")]
fn brave_path() -> Option<String> {
    Some("/Applications/Brave Browser.app/Contents/MacOS/Brave Browser".into())
}

#[cfg(target_os = "macos")]
fn edge_path() -> Option<String> {
    Some("/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge".into())
}

#[cfg(target_os = "macos")]
fn chromium_path() -> Option<String> {
    Some("/Applications/Chromium.app/Contents/MacOS/Chromium".into())
}

#[cfg(target_os = "macos")]
fn arc_path() -> Option<String> {
    Some("/Applications/Arc.app/Contents/MacOS/Arc".into())
}

#[cfg(target_os = "macos")]
fn opera_path() -> Option<String> {
    Some("/Applications/Opera.app/Contents/MacOS/Opera".into())
}

// Linux
#[cfg(target_os = "linux")]
fn chrome_path() -> Option<String> { which("google-chrome").or_else(|| which("google-chrome-stable")) }
#[cfg(target_os = "linux")]
fn brave_path() -> Option<String> { which("brave-browser") }
#[cfg(target_os = "linux")]
fn edge_path() -> Option<String> { which("microsoft-edge") }
#[cfg(target_os = "linux")]
fn chromium_path() -> Option<String> { which("chromium-browser").or_else(|| which("chromium")) }
#[cfg(target_os = "linux")]
fn arc_path() -> Option<String> { None }
#[cfg(target_os = "linux")]
fn opera_path() -> Option<String> { which("opera") }

#[cfg(target_os = "linux")]
fn which(name: &str) -> Option<String> {
    std::process::Command::new("which")
        .arg(name)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
}

// Windows
#[cfg(target_os = "windows")]
fn chrome_path() -> Option<String> {
    Some(r"C:\Program Files\Google\Chrome\Application\chrome.exe".into())
}
#[cfg(target_os = "windows")]
fn brave_path() -> Option<String> {
    Some(r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe".into())
}
#[cfg(target_os = "windows")]
fn edge_path() -> Option<String> {
    Some(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe".into())
}
#[cfg(target_os = "windows")]
fn chromium_path() -> Option<String> { None }
#[cfg(target_os = "windows")]
fn arc_path() -> Option<String> { None }
#[cfg(target_os = "windows")]
fn opera_path() -> Option<String> { None }
