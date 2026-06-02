//! Secure auth-token storage backed by the OS keychain (same approach as the
//! existing desktop-app), so a session survives across app restarts.

use keyring::Entry;

const SERVICE_NAME: &str = "com.cyberforge.console";

pub fn store_token(token: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, "auth_token").map_err(|e| e.to_string())?;
    entry.set_password(token).map_err(|e| e.to_string())
}

pub fn get_stored_token() -> Option<String> {
    let entry = Entry::new(SERVICE_NAME, "auth_token").ok()?;
    entry.get_password().ok()
}

pub fn delete_token() -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, "auth_token").map_err(|e| e.to_string())?;
    // Ignore the error if no credential exists yet.
    let _ = entry.delete_credential();
    Ok(())
}
