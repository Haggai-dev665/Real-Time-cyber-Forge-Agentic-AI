// CyberForge Desktop — Tauri Application Entry Point
// Replaces the Electron main.js with a Rust native backend.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod auth;
mod websocket;
mod system;
mod state;
mod distributed;
mod telemetry_loop;

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
            commands::detect_system_browsers,
            commands::system_monitor_stats,
            commands::get_active_browser_urls,
            // Browser Intelligence Engine
            commands::process_browser_intelligence,
            commands::feed_intelligence_ml_risk,
            commands::get_intelligence_snapshot,
            commands::get_intelligence_config,
            // TODO 4: Distributed Intelligence
            commands::get_node_identity,
            commands::register_node,
            commands::sync_telemetry,
            commands::get_sync_state,
            commands::get_distributed_status,
            commands::get_risk_weight_table,
            commands::get_global_metrics,
            commands::get_node_statuses,
            commands::get_correlations,
            commands::apply_risk_adjustment,
            // Telemetry loop control
            commands::start_telemetry_loop,
            commands::stop_telemetry_loop,
            commands::get_telemetry_loop_status,
            commands::get_system_telemetry,
        ])
        .setup(|app| {
            log::info!("🚀 CyberForge Tauri app starting...");

            // TODO 4: Initialize node identity on startup (non-blocking)
            std::thread::spawn(|| {
                let identity = distributed::initialize_node_identity();
                log::info!("🆔 Node identity initialized: {}", identity.node_id);
            });

            // Spawn background WebSocket connection to backend
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                websocket::connect_to_backend(app_handle).await;
            });

            // Start real-time telemetry background loops (URL-poll + system telemetry)
            let tele_app = app.handle().clone();
            let started = telemetry_loop::start_background_loops(
                tele_app,
                telemetry_loop::TelemetryLoopConfig::default(),
            );
            log::info!("🔄 Telemetry background loops started: {}", started);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running CyberForge");
}
