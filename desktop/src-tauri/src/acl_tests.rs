//! The threat-alert popup can call only its own four commands (SEC-05).
//!
//! Runs the app's real permission set (built from build.rs and capabilities/)
//! on Tauri's mock runtime, and sends the same commands from the main window
//! and from the popup. Only two harmless commands that read in-memory state
//! are registered. The sensitive names are sent without being registered, so
//! nothing sensitive can run here even if the check failed: a refusal by the
//! permission check says "not allowed", and a call the check let through would
//! instead fail as an unknown command.

use crate::state::AppState;
use std::sync::Arc;
use tauri::test::{get_ipc_response, mock_builder, INVOKE_KEY};
use tauri::webview::InvokeRequest;
use tauri::{Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tokio::sync::Mutex;

fn app() -> tauri::App<tauri::test::MockRuntime> {
    mock_builder()
        .manage(Arc::new(Mutex::new(AppState::new())))
        .invoke_handler(tauri::generate_handler![
            crate::agent::get_pending_threat,
            crate::commands::get_backend_url
        ])
        .build(tauri::generate_context!())
        .expect("mock app")
}

fn window(app: &tauri::App<tauri::test::MockRuntime>, label: &str, page: &str) -> WebviewWindow<tauri::test::MockRuntime> {
    if let Some(existing) = app.get_webview_window(label) {
        return existing;
    }
    WebviewWindowBuilder::new(app, label, WebviewUrl::App(page.into()))
        .build()
        .expect("mock window")
}

fn call(window: &WebviewWindow<tauri::test::MockRuntime>, cmd: &str) -> Result<serde_json::Value, String> {
    let request = InvokeRequest {
        cmd: cmd.into(),
        callback: tauri::ipc::CallbackFn(0),
        error: tauri::ipc::CallbackFn(1),
        url: if cfg!(any(windows, target_os = "android")) { "http://tauri.localhost" } else { "tauri://localhost" }
            .parse()
            .unwrap(),
        body: tauri::ipc::InvokeBody::Json(serde_json::json!({})),
        headers: Default::default(),
        invoke_key: INVOKE_KEY.to_string(),
    };
    get_ipc_response(window, request)
        .map(|body| body.deserialize::<serde_json::Value>().unwrap_or(serde_json::Value::Null))
        .map_err(|error| error.to_string())
}

fn refused(result: &Result<serde_json::Value, String>) -> bool {
    matches!(result, Err(message) if message.contains("not allowed"))
}

#[test]
fn the_popup_reaches_only_its_own_commands() {
    let app = app();
    let main = window(&app, "main", "index.html");
    let popup = window(&app, "cf-threat-alert", "pages/threat-alert.html");

    // what the popup needs works
    assert_eq!(call(&popup, "get_pending_threat"), Ok(serde_json::Value::Null));

    // the main window may call the same commands
    assert_eq!(call(&main, "get_pending_threat"), Ok(serde_json::Value::Null));
    assert!(call(&main, "get_backend_url").is_ok());

    // everything else is refused for the popup before it runs
    for cmd in [
        "get_backend_url",
        "hf_token_get",
        "set_hf_token",
        "auth_get_user",
        "auth_logout",
        "credential_storage_status",
        "unblock_site",
        "unallow_site",
        "list_blocked",
        "add_to_path",
        "get_browser_history",
        "get_collected_history",
        "memory_list",
        "memory_save",
        "policy_create",
        "policy_delete",
        "scan_url",
        "ml_security_chat",
    ] {
        let result = call(&popup, cmd);
        assert!(refused(&result), "popup call to {cmd} was not refused: {result:?}");
    }

    // for the main window the permission check lets those names through (they
    // fail here only because this test does not register them)
    for cmd in ["hf_token_get", "unblock_site", "add_to_path"] {
        let result = call(&main, cmd);
        assert!(!refused(&result), "main window call to {cmd} was refused: {result:?}");
    }
}
