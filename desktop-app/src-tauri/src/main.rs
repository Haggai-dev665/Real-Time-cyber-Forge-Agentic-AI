// CyberForge AI Desktop — Tauri Application Entry Point
// Replaces the Electron main.js with a Rust native backend.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod auth;
mod websocket;
mod system;
mod state;

use state::AppState;
use std::sync::Arc;
use tokio::sync::Mutex;

fn main() {
    env_logger::init();

    let app_state = Arc::new(Mutex::new(AppState::new()));

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_os::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            // Auth
            commands::auth_login,
            commands::auth_register,
            commands::auth_logout,
            commands::auth_get_user,
            commands::auth_is_authenticated,
            commands::auth_update_profile,
            commands::auth_change_password,
            commands::auth_google_url,
            commands::auth_get_token,
            commands::auth_check_session,
            // System
            commands::get_system_stats,
            commands::health_check,
            commands::get_threats,
            // Backend
            commands::send_to_backend,
            // Window
            commands::toggle_fullscreen,
            commands::minimize_window,
            commands::maximize_window,
            commands::close_window,
            // Navigation
            commands::navigate_to,
            // Analysis
            commands::get_analysis_data,
            // Browser Monitor
            commands::get_available_browsers,
            commands::system_monitor_stats,
        ])
        .setup(|app| {
            log::info!("🚀 CyberForge AI Tauri app starting...");

            // Spawn background WebSocket connection to backend
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                websocket::connect_to_backend(app_handle).await;
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running CyberForge AI");
}
