//! CyberForge — AI Security Console
//!
//! Tauri desktop shell that serves the static CyberForge UI (HTML/CSS/JS in `../ui`).
//! The only piece wired to the backend is authentication: `auth_login` /
//! `auth_register` (and friends) call `https://…herokuapp.com/api/auth/*` from
//! Rust and persist the session token in the OS keychain. The frontend invokes
//! them via `window.__TAURI__.core.invoke(...)`.

mod auth;
mod commands;
mod state;

use state::AppState;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Build and run the Tauri application.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = Arc::new(Mutex::new(AppState::new()));

    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::auth_login,
            commands::auth_register,
            commands::auth_logout,
            commands::auth_get_user,
            commands::auth_is_authenticated,
            commands::auth_get_token,
        ])
        .setup(|_app| {
            #[cfg(debug_assertions)]
            {
                // Open devtools automatically during development.
                use tauri::Manager;
                if let Some(window) = _app.get_webview_window("main") {
                    window.open_devtools();
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the CyberForge desktop application");
}
