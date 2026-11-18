//! The app in the system tray: an icon with a menu, closing the window to the
//! tray, starting with Windows, and a native watcher that keeps scanning the
//! active browser tab while the window is hidden.
//!
//! Real-time scanning is normally driven by the agent panel inside the window.
//! A hidden or minimised webview throttles its timers, so while the window is
//! not shown the watcher here does the same job from Rust: the active tab, at
//! most once a minute per address, with the on-device URL models only (the same
//! path as the panel's normal scan). It respects the same privacy choices
//! (`get_active_urls` refuses without the active-tab permission).
//!
//! Preferences are kept in `desktop.json` next to the other app files. The
//! start-with-Windows entry lives where Windows reads it (the current user's
//! Run key), so that is its only record.

use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Mutex;

use crate::state::AppState;

type SharedState = Arc<Mutex<AppState>>;

/// The flag the start-with-Windows entry passes: start in the tray, no window.
pub const BACKGROUND_FLAG: &str = "--background";
#[cfg(windows)]
const RUN_KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
#[cfg(windows)]
const RUN_VALUE: &str = "CyberForge";

/// The tray icon exists. Closing the window hides it only then: without an
/// icon there would be no way back to a hidden window.
static TRAY_READY: AtomicBool = AtomicBool::new(false);

pub fn ready() -> bool {
    TRAY_READY.load(Ordering::SeqCst)
}

pub fn started_in_background() -> bool {
    std::env::args().any(|arg| arg == BACKGROUND_FLAG)
}

// ── preferences ──────────────────────────────────────────────────────────────

fn prefs_path() -> Option<PathBuf> {
    crate::auth::config_dir().map(|d| d.join("desktop.json"))
}

fn read_prefs() -> Value {
    prefs_path()
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|t| serde_json::from_str::<Value>(&t).ok())
        .filter(Value::is_object)
        .unwrap_or_else(|| json!({}))
}

fn write_pref(key: &str, value: Value) {
    let Some(path) = prefs_path() else { return };
    let mut prefs = read_prefs();
    prefs[key] = value;
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    let _ = std::fs::write(path, serde_json::to_vec_pretty(&prefs).unwrap_or_default());
}

/// Closing the window keeps the app running in the tray (on by default, as in
/// other security tools; the tray menu turns it off).
pub fn close_to_tray() -> bool {
    read_prefs().get("closeToTray").and_then(Value::as_bool).unwrap_or(true)
}

// ── start with Windows ───────────────────────────────────────────────────────

#[cfg(windows)]
fn reg(args: &[&str]) -> bool {
    use std::os::windows::process::CommandExt;
    std::process::Command::new("reg")
        .args(args)
        .creation_flags(0x0800_0000) // no console window
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

#[cfg(windows)]
pub fn autostart_enabled() -> bool {
    reg(&["query", RUN_KEY, "/v", RUN_VALUE])
}

#[cfg(not(windows))]
pub fn autostart_enabled() -> bool {
    false
}

#[cfg(windows)]
pub fn set_autostart(on: bool) -> Result<(), String> {
    if on {
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let command = format!("\"{}\" {}", exe.display(), BACKGROUND_FLAG);
        if reg(&["add", RUN_KEY, "/v", RUN_VALUE, "/t", "REG_SZ", "/d", &command, "/f"]) {
            Ok(())
        } else {
            Err("Windows did not accept the start-up entry".into())
        }
    } else if !autostart_enabled() || reg(&["delete", RUN_KEY, "/v", RUN_VALUE, "/f"]) {
        Ok(())
    } else {
        Err("the start-up entry could not be removed".into())
    }
}

#[cfg(not(windows))]
pub fn set_autostart(_on: bool) -> Result<(), String> {
    Err("starting with the system is set up on Windows only".into())
}

// ── window ───────────────────────────────────────────────────────────────────

pub fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// The main window is not on screen (hidden in the tray, or minimised).
pub fn main_hidden(app: &AppHandle) -> bool {
    app.get_webview_window("main")
        .map(|w| !w.is_visible().unwrap_or(true) || w.is_minimized().unwrap_or(false))
        .unwrap_or(false)
}

/// Ask the open page to do something (the pages listen for `cf-tray`).
fn tell_page(app: &AppHandle, action: &str) {
    let _ = app.emit_to("main", "cf-tray", json!({ "action": action }));
}

// ── tray icon ────────────────────────────────────────────────────────────────

pub fn install(app: &tauri::App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open CyberForge", true, None::<&str>)?;
    let scan = MenuItem::with_id(app, "scan-file", "Scan a file…", true, None::<&str>)?;
    let keep = CheckMenuItem::with_id(app, "close-to-tray", "Keep protecting when the window is closed", true, close_to_tray(), None::<&str>)?;
    let auto = CheckMenuItem::with_id(app, "autostart", "Start with Windows", cfg!(windows), autostart_enabled(), None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit CyberForge", true, None::<&str>)?;
    let first = PredefinedMenuItem::separator(app)?;
    let second = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&open, &scan, &first, &keep, &auto, &second, &quit])?;

    let (keep_item, auto_item) = (keep.clone(), auto.clone());
    let mut builder = TrayIconBuilder::with_id("main")
        .tooltip("CyberForge: protection on")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "open" => show_main(app),
            "scan-file" => {
                show_main(app);
                tell_page(app, "scan-file");
            }
            "close-to-tray" => {
                let on = keep_item.is_checked().unwrap_or(true);
                write_pref("closeToTray", json!(on));
            }
            "autostart" => {
                let wanted = auto_item.is_checked().unwrap_or(false);
                if let Err(e) = set_autostart(wanted) {
                    eprintln!("CyberForge: start with Windows: {e}");
                    let _ = auto_item.set_checked(autostart_enabled());
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    TRAY_READY.store(true, Ordering::SeqCst);
    Ok(())
}

// ── background protection ────────────────────────────────────────────────────

/// Scan the active browser tab while the window is not on screen.
pub fn start_watcher(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut last = String::new();
        let mut last_at = Instant::now();
        loop {
            tokio::time::sleep(Duration::from_secs(3)).await;
            if !main_hidden(&app) {
                continue;
            }
            let state = app.state::<SharedState>();
            let Ok(found) = crate::agent::get_active_urls(state.clone()).await else { continue };
            let url = found.pointer("/data/urls/0/url").and_then(Value::as_str).unwrap_or("").to_string();
            if url.is_empty() || (url == last && last_at.elapsed() < Duration::from_secs(60)) {
                continue;
            }
            last = url.clone();
            last_at = Instant::now();
            if let Ok(result) = crate::agent::scan_url(app.clone(), state.clone(), url.clone(), None, None).await {
                crate::agent::alert_from_background(&app, state.inner(), &url, &result).await;
            }
        }
    });
}
