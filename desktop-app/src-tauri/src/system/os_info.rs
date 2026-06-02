// OS detection module

/// Returns the OS name as a lowercase string: "windows", "macos", or "linux".
/// Falls back to "unknown" on unsupported platforms.
pub fn get_os_name() -> &'static str {
    #[cfg(target_os = "windows")]
    { "windows" }
    #[cfg(target_os = "macos")]
    { "macos" }
    #[cfg(target_os = "linux")]
    { "linux" }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    { "unknown" }
}

/// Returns a human-readable OS label.
pub fn get_os_display_name() -> &'static str {
    #[cfg(target_os = "windows")]
    { "Microsoft Windows" }
    #[cfg(target_os = "macos")]
    { "macOS" }
    #[cfg(target_os = "linux")]
    { "Linux" }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    { "Unknown OS" }
}
