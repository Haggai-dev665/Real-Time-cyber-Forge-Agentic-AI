// Prevents an extra console window from opening on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if std::env::args().any(|arg| arg == "--prepare-local-ml") {
        std::process::exit(if cyberforge_console_lib::prepare_local_models_headless() { 0 } else { 1 });
    }
    cyberforge_console_lib::run();
}
