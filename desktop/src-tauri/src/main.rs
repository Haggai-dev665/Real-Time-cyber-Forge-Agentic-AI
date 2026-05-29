// Prevents an extra console window from opening on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    cyberforge_console_lib::run();
}
