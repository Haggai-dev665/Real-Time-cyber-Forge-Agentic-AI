// WebSocket client — persistent connection to the CyberForge backend.
// Replaces the Electron WebSocket logic from main.js.

use futures_util::{SinkExt, StreamExt};
use tauri::{AppHandle, Emitter, Manager};
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};

use crate::state::AppState;
use std::sync::Arc;
use tokio::sync::Mutex;

const RECONNECT_DELAY_SECS: u64 = 5;

pub async fn connect_to_backend(app: AppHandle) {
    loop {
        let state = app.state::<Arc<Mutex<AppState>>>();
        let ws_url = {
            let s = state.lock().await;
            s.ws_url.clone()
        };

        log::info!("🔌 Connecting to backend WebSocket: {}", ws_url);

        match connect_async(&ws_url).await {
            Ok((ws_stream, _)) => {
                log::info!("✅ WebSocket connected to backend");
                let _ = app.emit("backend-status", "connected");

                {
                    let mut s = state.lock().await;
                    s.ws_connected = true;
                }

                let (mut write, mut read) = ws_stream.split();

                // Send identification
                let identify_msg = serde_json::json!({
                    "type": "identify",
                    "client_type": "desktop",
                    "version": "2.0.0",
                    "platform": std::env::consts::OS,
                    "runtime": "tauri",
                    "timestamp": chrono::Utc::now().to_rfc3339()
                });
                let _ = write.send(Message::Text(identify_msg.to_string().into())).await;

                // Send auth token if available
                {
                    let s = state.lock().await;
                    if let Some(ref token) = s.auth_token {
                        let auth_msg = serde_json::json!({
                            "type": "authenticate",
                            "token": token
                        });
                        let _ = write.send(Message::Text(auth_msg.to_string().into())).await;
                    }
                }

                // Read messages
                while let Some(msg) = read.next().await {
                    match msg {
                        Ok(Message::Text(text)) => {
                            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&text) {
                                handle_backend_message(&app, &parsed);
                            }
                        }
                        Ok(Message::Ping(data)) => {
                            let _ = write.send(Message::Pong(data)).await;
                        }
                        Ok(Message::Close(_)) => {
                            log::info!("WebSocket closed by server");
                            break;
                        }
                        Err(e) => {
                            log::error!("WebSocket error: {}", e);
                            break;
                        }
                        _ => {}
                    }
                }

                {
                    let mut s = state.lock().await;
                    s.ws_connected = false;
                }

                let _ = app.emit("backend-status", "disconnected");
                log::info!("🔌 WebSocket disconnected, reconnecting in {}s...", RECONNECT_DELAY_SECS);
            }
            Err(e) => {
                log::error!("❌ WebSocket connection failed: {}", e);
                let _ = app.emit("backend-status", "error");
            }
        }

        tokio::time::sleep(std::time::Duration::from_secs(RECONNECT_DELAY_SECS)).await;
    }
}

fn handle_backend_message(app: &AppHandle, message: &serde_json::Value) {
    let msg_type = message.get("type").and_then(|t| t.as_str()).unwrap_or("");

    match msg_type {
        "connection_established" => {
            log::info!("Backend connection established");
        }
        "identification_confirmed" => {
            log::info!("Client identification confirmed");
        }
        "authentication_confirmed" => {
            log::info!("Client authentication confirmed");
        }
        "analysis_result" => {
            if let Some(data) = message.get("data") {
                let _ = app.emit("analysis-result", data.clone());
            }
        }
        "threat_alert" => {
            if let Some(data) = message.get("data") {
                let _ = app.emit("threat-alert", data.clone());
            }
        }
        "ai_insight" => {
            if let Some(data) = message.get("data") {
                let _ = app.emit("ai-insight", data.clone());
            }
        }
        "session_update" => {
            if let Some(data) = message.get("data") {
                let _ = app.emit("session-update", data.clone());
            }
        }
        "behavioral_alert" => {
            if let Some(data) = message.get("data") {
                let _ = app.emit("behavioral-alert", data.clone());
            }
        }
        "risk_score_update" => {
            if let Some(data) = message.get("data") {
                let _ = app.emit("risk-score-update", data.clone());
            }
        }
        "heartbeat" | "heartbeat_response" | "connection_acknowledged" => {
            // Silent
        }
        _ => {
            log::debug!("Unknown WS message type: {}", msg_type);
        }
    }
}
