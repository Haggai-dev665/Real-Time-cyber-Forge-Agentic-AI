// The app's own commands, listed so that Tauri checks them per window (SEC-05).
//
// Without this list every window may call every command. With it, a command
// runs only in a window whose capability grants `allow-<command>`
// (capabilities/main.json, capabilities/threat-alert.json); any other call is
// rejected before the command runs. It must name exactly the commands in
// `generate_handler!` in src/lib.rs; a contract test compares the two.
const COMMANDS: &[&str] = &[
    "auth_login",
    "auth_register",
    "auth_logout",
    "auth_get_user",
    "auth_is_authenticated",
    "credential_storage_status",
    "stream_status",
    "get_backend_url",
    "cli_status",
    "mcp_grants",
    "mcp_grant_create",
    "mcp_grant_revoke",
    "get_system_stats",
    "detect_browsers",
    "resolve_ip",
    "get_system_profile",
    "get_path_status",
    "add_to_path",
    "get_browser_history",
    "get_collected_history",
    "is_installed",
    "mark_installed",
    "agent_status",
    "scan_url",
    "get_pending_threat",
    "get_active_urls",
    "get_last_scan",
    "agent_alerts",
    "get_threats",
    "auth_google",
    "browser_intel",
    "browser_intel_report",
    "otx_fetch",
    "memory_save",
    "memory_search",
    "memory_list",
    "memory_sync",
    "ml_security_chat",
    "ml_classify_url",
    "ml_detect_dga",
    "ml_ioc_scan",
    "ml_url_enrich",
    "ml_status",
    "console_snapshot",
    "set_hf_token",
    "hf_token_status",
    "hf_token_get",
    "policy_meta",
    "policy_list",
    "policy_stats",
    "policy_response_log",
    "policy_create",
    "policy_update",
    "policy_delete",
    "policy_evaluate",
    "block_site",
    "unblock_site",
    "list_blocked",
    "protect_site",
    "unprotect_site",
    "list_protected",
    "allow_site",
    "unallow_site",
    "list_allowed",
    "public_ip",
    "device_status",
    "device_enroll_this",
    "device_claim_code",
    "device_enrollment_create",
    "devices_list",
    "device_approve",
    "device_rename",
    "device_revoke",
    "device_heartbeat",
    "device_rotate_key",
    "device_command_send",
    "device_commands_list",
    "agents_call",
    "account_call",
    "finding_state",
    "finding_exception",
    "incidents_list",
    "incident_resolve",
    "alert_state",
    "incident_evidence",
    "evidence_report",
    "privacy_get",
    "privacy_set",
    "privacy_clear_history",
    "privacy_clear_memory",
];

fn main() {
    let mut attributes = tauri_build::Attributes::new()
        .app_manifest(tauri_build::AppManifest::new().commands(COMMANDS));

    // The Windows application manifest (Common Controls v6, the same content as
    // tauri-build's default) is embedded by the linker into every target,
    // including the test binary: without it the mock-runtime test in
    // src/acl_tests.rs cannot start. tauri-build's own copy, which reaches only
    // the app executable, is switched off so the executable gets it once.
    let windows_msvc = std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows")
        && std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc");
    if windows_msvc {
        attributes = attributes.windows_attributes(tauri_build::WindowsAttributes::new_without_app_manifest());
        let manifest = std::env::current_dir()
            .expect("build directory")
            .join("windows-app-manifest.xml");
        println!("cargo:rerun-if-changed={}", manifest.display());
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!("cargo:rustc-link-arg=/MANIFESTINPUT:{}", manifest.display());
    }

    tauri_build::try_build(attributes).expect("failed to run tauri-build");
}
