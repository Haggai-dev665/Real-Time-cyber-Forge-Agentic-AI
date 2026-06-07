//! System-level site blocking + protection.
//!
//! **Block** writes the OS hosts file (`…\System32\drivers\etc\hosts` on Windows,
//! `/etc/hosts` elsewhere) so the domain resolves to 127.0.0.1 for every browser
//! on the machine — a real, system-wide block. Editing the hosts file needs
//! admin rights, so we try a direct write first and fall back to an elevated
//! PowerShell copy (one UAC prompt). The managed list is also persisted to the
//! app-config dir, so the Security Functions page can show + unblock entries even
//! before/without elevation.
//!
//! **Protect** records a domain the user wants accessed over the secure tunnel.
//! Full traffic encryption + egress-IP rotation is delivered by the CyberForge
//! VPN tunnel; this module records the intent and reports the real public IP.

use serde_json::{json, Value};
use std::path::PathBuf;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const SERVICE_NAME: &str = "com.cyberforge.console";
const MARK_START: &str = "# === CyberForge Blocklist START (managed - do not edit) ===";
const MARK_END: &str = "# === CyberForge Blocklist END ===";

fn config_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Ok(a) = std::env::var("APPDATA") {
            return PathBuf::from(a).join(SERVICE_NAME);
        }
    }
    if let Ok(h) = std::env::var("HOME") {
        #[cfg(target_os = "macos")]
        {
            return PathBuf::from(h).join("Library").join("Application Support").join(SERVICE_NAME);
        }
        #[cfg(not(target_os = "macos"))]
        {
            return PathBuf::from(h).join(".config").join(SERVICE_NAME);
        }
    }
    PathBuf::from(".").join(SERVICE_NAME)
}

fn now_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn blocklist_path() -> PathBuf {
    config_dir().join("blocklist.json")
}
fn protectlist_path() -> PathBuf {
    config_dir().join("protected.json")
}
fn allowlist_path() -> PathBuf {
    config_dir().join("allowed.json")
}

/// Record every block/protect/allow decision into the local vector memory so the
/// agent builds context from the user's actions (read by the AI assistant).
fn record(text: &str, category: &str, domain: &str, risk: Option<i64>) {
    crate::memory::remember(text, "procedural", Some(domain.to_string()), Some(category.to_string()), risk);
}

fn read_list(p: &PathBuf) -> Vec<Value> {
    std::fs::read_to_string(p)
        .ok()
        .and_then(|s| serde_json::from_str::<Vec<Value>>(&s).ok())
        .unwrap_or_default()
}
fn write_list(p: &PathBuf, list: &[Value]) {
    if let Some(parent) = p.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let _ = std::fs::write(p, serde_json::to_string_pretty(list).unwrap_or_else(|_| "[]".into()));
}

/// Reduce arbitrary user input to a bare, validated domain (or None).
fn normalize_domain(input: &str) -> Option<String> {
    let mut d = input.trim().to_lowercase();
    if let Some(i) = d.find("://") {
        d = d[i + 3..].to_string();
    }
    d = d.split('/').next().unwrap_or(&d).to_string();
    d = d.split('?').next().unwrap_or(&d).to_string();
    d = d.split(':').next().unwrap_or(&d).to_string();
    let d = d.trim().trim_start_matches("www.").trim_matches('.').to_string();
    if d.len() < 3 || !d.contains('.') {
        return None;
    }
    if !d.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-') {
        return None;
    }
    Some(d)
}

fn hosts_path() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        let root = std::env::var("SystemRoot").unwrap_or_else(|_| r"C:\Windows".into());
        return PathBuf::from(root).join(r"System32\drivers\etc\hosts");
    }
    #[cfg(not(target_os = "windows"))]
    {
        PathBuf::from("/etc/hosts")
    }
}

/// Remove any existing CyberForge-managed block from the hosts content.
fn strip_managed(content: &str) -> String {
    let mut out = String::new();
    let mut skip = false;
    for line in content.lines() {
        let t = line.trim();
        if t == MARK_START {
            skip = true;
            continue;
        }
        if t == MARK_END {
            skip = false;
            continue;
        }
        if !skip {
            out.push_str(line);
            out.push('\n');
        }
    }
    out
}

fn managed_block(domains: &[String]) -> String {
    let mut s = String::from(MARK_START);
    s.push('\n');
    for d in domains {
        s.push_str(&format!("127.0.0.1 {}\n", d));
        s.push_str(&format!("127.0.0.1 www.{}\n", d));
        s.push_str(&format!("::1 {}\n", d));
    }
    s.push_str(MARK_END);
    s.push('\n');
    s
}

/// Rewrite the hosts file's managed block with `domains`. Direct write first;
/// on failure, an elevated PowerShell copy (Windows). Returns Ok, or Err with a
/// human-readable reason (e.g. needs admin / cancelled).
fn apply_hosts(domains: &[String]) -> Result<(), String> {
    let path = hosts_path();
    let current = std::fs::read_to_string(&path).unwrap_or_default();
    let mut new = strip_managed(&current).trim_end().to_string();
    if !domains.is_empty() {
        new.push_str("\n\n");
        new.push_str(&managed_block(domains));
    } else {
        new.push('\n');
    }

    // 1) direct write (works if the app is elevated)
    if std::fs::write(&path, &new).is_ok() {
        return Ok(());
    }

    // 2) elevated fallback
    #[cfg(target_os = "windows")]
    {
        apply_hosts_elevated(&new, &path)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Could not write the hosts file (need sudo). Run CyberForge with elevated rights to enforce blocks.".into())
    }
}

#[cfg(target_os = "windows")]
fn apply_hosts_elevated(new_content: &str, hosts: &PathBuf) -> Result<(), String> {
    let tmp = std::env::temp_dir().join("cf_hosts_pending.txt");
    std::fs::write(&tmp, new_content).map_err(|e| format!("temp write failed: {}", e))?;
    let script = std::env::temp_dir().join("cf_apply_hosts.ps1");
    // The elevated script copies our prepared content over the hosts file.
    let body = format!(
        "Copy-Item -LiteralPath '{}' -Destination '{}' -Force\n",
        tmp.display(),
        hosts.display()
    );
    std::fs::write(&script, body).map_err(|e| format!("script write failed: {}", e))?;
    // Launch the script elevated (UAC), wait for it to finish.
    let cmd = format!(
        "Start-Process powershell -WindowStyle Hidden -Verb RunAs -ArgumentList \
         '-NoProfile','-ExecutionPolicy','Bypass','-File','{}' -Wait",
        script.display()
    );
    let out = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &cmd])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("powershell failed: {}", e))?;
    if !out.status.success() {
        return Err("Elevation was cancelled — run CyberForge as administrator to enforce blocks.".into());
    }
    // Verify the change actually landed.
    let after = std::fs::read_to_string(hosts).unwrap_or_default();
    if after.contains(MARK_START) || new_content.trim().lines().all(|l| after.contains(l.trim())) {
        Ok(())
    } else {
        Err("Hosts file did not update — administrator approval is required.".into())
    }
}

fn blocked_domains(list: &[Value]) -> Vec<String> {
    list.iter()
        .filter_map(|v| v.get("domain").and_then(|d| d.as_str()).map(String::from))
        .collect()
}

// ──────────────────────────────────────────────
// Tauri commands
// ──────────────────────────────────────────────

/// Block a domain system-wide (hosts file) and record it. `reason` is optional.
#[tauri::command]
pub async fn block_site(domain: String, reason: Option<String>) -> Result<Value, String> {
    let Some(dom) = normalize_domain(&domain) else {
        return Err(format!("\u{201c}{}\u{201d} is not a valid domain", domain));
    };
    let mut list = read_list(&blocklist_path());
    if !list.iter().any(|v| v.get("domain").and_then(|d| d.as_str()) == Some(dom.as_str())) {
        list.push(json!({
            "domain": dom, "reason": reason.unwrap_or_else(|| "Flagged by CyberForge".into()),
            "ts": now_secs(), "enforced": false
        }));
    }
    // Try to enforce in the hosts file.
    let enforce = apply_hosts(&blocked_domains(&list));
    let enforced = enforce.is_ok();
    for v in list.iter_mut() {
        if v.get("domain").and_then(|d| d.as_str()) == Some(dom.as_str()) {
            if let Some(obj) = v.as_object_mut() {
                obj.insert("enforced".into(), json!(enforced));
            }
        }
    }
    write_list(&blocklist_path(), &list);
    // Blocking overrides any previous allow for the same domain.
    {
        let mut al = read_list(&allowlist_path());
        al.retain(|v| v.get("domain").and_then(|d| d.as_str()) != Some(dom.as_str()));
        write_list(&allowlist_path(), &al);
    }
    record(
        &format!("User blocked {} ({})", dom, if enforced { "enforced system-wide via hosts file" } else { "listed — needs admin to enforce" }),
        "action-block", &dom, Some(if enforced { 80 } else { 70 }),
    );
    Ok(json!({
        "success": true, "domain": dom, "enforced": enforced,
        "needsAdmin": !enforced,
        "message": if enforced { "Blocked system-wide.".to_string() } else { enforce.err().unwrap_or_default() },
        "blocked": list
    }))
}

/// Remove a domain from the block list + hosts file.
#[tauri::command]
pub async fn unblock_site(domain: String) -> Result<Value, String> {
    let dom = normalize_domain(&domain).unwrap_or_else(|| domain.trim().to_lowercase());
    let mut list = read_list(&blocklist_path());
    list.retain(|v| v.get("domain").and_then(|d| d.as_str()) != Some(dom.as_str()));
    let res = apply_hosts(&blocked_domains(&list));
    write_list(&blocklist_path(), &list);
    Ok(json!({
        "success": true, "domain": dom, "unenforced": res.is_ok(),
        "needsAdmin": res.is_err(),
        "message": res.err().unwrap_or_default(),
        "blocked": list
    }))
}

/// The current managed block list.
#[tauri::command]
pub async fn list_blocked() -> Result<Value, String> {
    let list = read_list(&blocklist_path());
    Ok(json!({ "success": true, "count": list.len(), "blocked": list }))
}

/// Record a domain to access over the protected tunnel.
#[tauri::command]
pub async fn protect_site(domain: String) -> Result<Value, String> {
    let Some(dom) = normalize_domain(&domain) else {
        return Err(format!("\u{201c}{}\u{201d} is not a valid domain", domain));
    };
    let mut list = read_list(&protectlist_path());
    if !list.iter().any(|v| v.get("domain").and_then(|d| d.as_str()) == Some(dom.as_str())) {
        list.push(json!({ "domain": dom, "ts": now_secs() }));
        write_list(&protectlist_path(), &list);
    }
    record(&format!("User enabled protected access for {}", dom), "action-protect", &dom, None);
    let ip = public_ip_value().await;
    Ok(json!({
        "success": true, "domain": dom, "protected": list,
        "publicIp": ip,
        // Honest about scope: real encryption + egress-IP rotation is the tunnel's job.
        "note": "Protected access recorded. Traffic encryption and a rotated egress IP are applied when the CyberForge secure tunnel is active."
    }))
}

#[tauri::command]
pub async fn unprotect_site(domain: String) -> Result<Value, String> {
    let dom = normalize_domain(&domain).unwrap_or_else(|| domain.trim().to_lowercase());
    let mut list = read_list(&protectlist_path());
    list.retain(|v| v.get("domain").and_then(|d| d.as_str()) != Some(dom.as_str()));
    write_list(&protectlist_path(), &list);
    Ok(json!({ "success": true, "protected": list }))
}

#[tauri::command]
pub async fn list_protected() -> Result<Value, String> {
    let list = read_list(&protectlist_path());
    Ok(json!({ "success": true, "count": list.len(), "protected": list }))
}

/// Allow (trust) a domain: remove it from the block list + hosts file and add it
/// to the allow list, so the agent treats it as trusted and won't re-flag it.
#[tauri::command]
pub async fn allow_site(domain: String) -> Result<Value, String> {
    let Some(dom) = normalize_domain(&domain) else {
        return Err(format!("\u{201c}{}\u{201d} is not a valid domain", domain));
    };
    // Unblock if it was blocked.
    let mut blocked = read_list(&blocklist_path());
    let was_blocked = blocked.iter().any(|v| v.get("domain").and_then(|d| d.as_str()) == Some(dom.as_str()));
    if was_blocked {
        blocked.retain(|v| v.get("domain").and_then(|d| d.as_str()) != Some(dom.as_str()));
        let _ = apply_hosts(&blocked_domains(&blocked));
        write_list(&blocklist_path(), &blocked);
    }
    let mut allowed = read_list(&allowlist_path());
    if !allowed.iter().any(|v| v.get("domain").and_then(|d| d.as_str()) == Some(dom.as_str())) {
        allowed.push(json!({ "domain": dom, "ts": now_secs() }));
        write_list(&allowlist_path(), &allowed);
    }
    record(&format!("User allowed {} (marked trusted)", dom), "action-allow", &dom, Some(0));
    Ok(json!({ "success": true, "domain": dom, "allowed": allowed, "wasUnblocked": was_blocked }))
}

#[tauri::command]
pub async fn unallow_site(domain: String) -> Result<Value, String> {
    let dom = normalize_domain(&domain).unwrap_or_else(|| domain.trim().to_lowercase());
    let mut list = read_list(&allowlist_path());
    list.retain(|v| v.get("domain").and_then(|d| d.as_str()) != Some(dom.as_str()));
    write_list(&allowlist_path(), &list);
    Ok(json!({ "success": true, "allowed": list }))
}

#[tauri::command]
pub async fn list_allowed() -> Result<Value, String> {
    let list = read_list(&allowlist_path());
    Ok(json!({ "success": true, "count": list.len(), "allowed": list }))
}

async fn public_ip_value() -> Value {
    let client = reqwest::Client::new();
    match client
        .get("https://api.ipify.org?format=json")
        .timeout(std::time::Duration::from_secs(8))
        .send()
        .await
    {
        Ok(r) => r.json::<Value>().await.ok().and_then(|v| v.get("ip").cloned()).unwrap_or(Value::Null),
        Err(_) => Value::Null,
    }
}

/// The user's real current public IP (no rotation — informational).
#[tauri::command]
pub async fn public_ip() -> Result<Value, String> {
    Ok(json!({ "success": true, "ip": public_ip_value().await }))
}
