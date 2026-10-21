//! System-level site blocking + protection.
//!
//! **Block** writes the OS hosts file (`…\System32\drivers\etc\hosts` on Windows,
//! `/etc/hosts` elsewhere) so the domain resolves to 127.0.0.1 for every browser
//! on the machine. This is a domain-resolution control: it does not stop a
//! program that connects by IP address or uses its own resolver.
//!
//! How the hosts file is changed (SEC-05):
//!   - only the section between CyberForge's two marker lines is rewritten; every
//!     other line is kept exactly, with the file's own line endings. A file with
//!     an incomplete section is not changed at all, and the user is told why;
//!   - only valid domain names are written, re-checked from the saved list each
//!     time, so an edited list cannot add any other kind of line;
//!   - the new content is written to a file beside the hosts file and renamed
//!     over it, so the hosts file is never half-written. The previous content is
//!     kept in the app's data folder (`hosts.previous`, and `hosts.original` from
//!     the first change), the result is read back, and the previous content is
//!     put back if it does not match;
//!   - when that needs administrator rights (Windows), one elevated PowerShell
//!     step does the same: it copies prepared content from a new, randomly named
//!     folder into the hosts folder, refuses it unless its SHA-256 matches the
//!     one computed here, keeps a backup, replaces the file, and checks it. No
//!     script file is written: the step is passed on the command line;
//!   - one change runs at a time, and whether a domain is enforced is read from
//!     the hosts file afterwards, never assumed. A cancelled elevation leaves
//!     the domain listed as not enforced, and an unblock that could not change
//!     the file leaves the domain listed as still blocked.
//!
//! **Save** (the `protect_site` command, shown as "Save" in the interface) keeps
//! a domain on a list. Nothing is enforced for a saved domain: there is no
//! secure tunnel in this application, and the interface must not suggest one.
//! The command name is kept so existing saved lists keep working.

use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const SERVICE_NAME: &str = "com.cyberforge.console";
const MARK_START: &str = "# === CyberForge Blocklist START (managed - do not edit) ===";
const MARK_END: &str = "# === CyberForge Blocklist END ===";

/// One change to the lists and the hosts file at a time.
static CHANGES: Mutex<()> = Mutex::new(());

fn change_lock() -> MutexGuard<'static, ()> {
    CHANGES.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

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

/// Written beside the list and renamed over it, so a list is never half-written.
fn write_list(p: &PathBuf, list: &[Value]) {
    if let Some(parent) = p.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let text = serde_json::to_string_pretty(list).unwrap_or_else(|_| "[]".into());
    let _ = replace_file(p, &text);
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
    if d.len() < 3 || d.len() > 253 || !d.contains('.') {
        return None;
    }
    if !d.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-') {
        return None;
    }
    Some(d)
}

fn domain_of(v: &Value) -> Option<&str> {
    v.get("domain").and_then(|d| d.as_str())
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

// ──────────────────────────────────────────────
// The hosts file's content
// ──────────────────────────────────────────────

/// A hosts file split around CyberForge's section.
#[derive(Debug, PartialEq)]
struct HostsContent {
    /// Every line outside the section, as it was, without its line ending.
    lines: Vec<String>,
    /// The domains the section blocks now.
    blocked: Vec<String>,
    /// The file's own line ending.
    newline: &'static str,
}

const INCOMPLETE: &str = "The hosts file has an incomplete CyberForge section (a start or end marker line without the other). \
     It was not changed, so that none of its other lines are lost. Remove the leftover marker line by hand and try again.";

fn parse_hosts(content: &str) -> Result<HostsContent, String> {
    let newline = if content.contains("\r\n") || (content.is_empty() && cfg!(windows)) { "\r\n" } else { "\n" };
    let mut lines = Vec::new();
    let mut blocked: Vec<String> = Vec::new();
    let mut inside = false;
    for raw in content.split('\n') {
        let line = raw.strip_suffix('\r').unwrap_or(raw);
        let t = line.trim();
        if t == MARK_START {
            if inside {
                return Err(INCOMPLETE.into());
            }
            inside = true;
        } else if t == MARK_END {
            if !inside {
                return Err(INCOMPLETE.into());
            }
            inside = false;
        } else if inside {
            if let Some(d) = t.strip_prefix("127.0.0.1 ") {
                let d = d.trim();
                if !d.starts_with("www.") && !blocked.iter().any(|b| b == d) {
                    blocked.push(d.to_string());
                }
            }
        } else {
            lines.push(line.to_string());
        }
    }
    if inside {
        return Err(INCOMPLETE.into());
    }
    // the split leaves one empty piece after a final line ending; trailing blank
    // lines are not kept either, so the file does not grow with every change
    while lines.last().is_some_and(|l| l.trim().is_empty()) {
        lines.pop();
    }
    Ok(HostsContent { lines, blocked, newline })
}

/// The file with `domains` as CyberForge's section (none: no section).
fn render_hosts(content: &HostsContent, domains: &[String]) -> String {
    let nl = content.newline;
    let mut out = content.lines.join(nl);
    if !out.is_empty() {
        out.push_str(nl);
    }
    if !domains.is_empty() {
        if !out.is_empty() {
            out.push_str(nl);
        }
        out.push_str(MARK_START);
        out.push_str(nl);
        for d in domains {
            out.push_str(&format!("127.0.0.1 {d}{nl}127.0.0.1 www.{d}{nl}::1 {d}{nl}"));
        }
        out.push_str(MARK_END);
        out.push_str(nl);
    }
    out
}

/// The domains a saved list asks to block: only entries that are already a
/// valid, bare domain name, once each. Anything else in the file is ignored.
fn hosts_domains(list: &[Value]) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for d in list.iter().filter_map(domain_of) {
        if normalize_domain(d).as_deref() == Some(d) && !out.iter().any(|o| o == d) {
            out.push(d.to_string());
        }
    }
    out
}

/// The domains the hosts file blocks now (empty when it cannot be read).
fn enforced_domains_at(path: &Path) -> Vec<String> {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|c| parse_hosts(&c).ok())
        .map(|h| h.blocked)
        .unwrap_or_default()
}

// ──────────────────────────────────────────────
// Writing it
// ──────────────────────────────────────────────

/// Write `text` beside `path` and rename it over `path`.
fn replace_file(path: &Path, text: &str) -> std::io::Result<()> {
    let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    let staged = path.with_file_name(format!("{name}.cyberforge-new"));
    std::fs::write(&staged, text)?;
    std::fs::rename(&staged, path).inspect_err(|_| {
        let _ = std::fs::remove_file(&staged);
    })
}

fn keep_backup(backup_dir: &Path, previous: &str) {
    let _ = std::fs::create_dir_all(backup_dir);
    let original = backup_dir.join("hosts.original");
    if !original.exists() {
        let _ = std::fs::write(&original, previous);
    }
    let _ = std::fs::write(backup_dir.join("hosts.previous"), previous);
}

/// Make CyberForge's section of the hosts file at `path` block exactly `domains`.
fn apply_hosts_at(path: &Path, backup_dir: &Path, domains: &[String], may_elevate: bool) -> Result<(), String> {
    let current = match std::fs::read_to_string(path) {
        Ok(c) => c,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(e) => return Err(format!("The hosts file could not be read ({e}); it was not changed.")),
    };
    let new = render_hosts(&parse_hosts(&current)?, domains);
    if new == current {
        return Ok(());
    }
    keep_backup(backup_dir, &current);

    match replace_file(path, &new) {
        Ok(()) => verify_or_restore(path, &new, &current),
        Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied && may_elevate => apply_elevated(path, &new),
        Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => {
            Err("Administrator rights are needed to change the hosts file; it was not changed.".into())
        }
        Err(e) => Err(format!("The hosts file could not be written ({e}); it was not changed.")),
    }
}

fn verify_or_restore(path: &Path, expected: &str, previous: &str) -> Result<(), String> {
    match std::fs::read_to_string(path) {
        Ok(after) if after == expected => Ok(()),
        _ => {
            let restored = replace_file(path, previous).is_ok();
            Err(if restored {
                "The hosts file did not read back as written; the previous version was put back.".into()
            } else {
                "The hosts file did not read back as written, and the previous version could not be put back. \
                 A copy of it is in the app's data folder (hosts.previous)."
                    .into()
            })
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn apply_elevated(_path: &Path, _new: &str) -> Result<(), String> {
    Err("Administrator rights are needed to change the hosts file (run CyberForge with sudo); it was not changed.".into())
}

#[cfg(target_os = "windows")]
fn apply_elevated(path: &Path, new: &str) -> Result<(), String> {
    let dir = new_private_dir().map_err(|e| format!("Could not prepare the change ({e}); the hosts file was not changed."))?;
    let src = dir.join("hosts.new");
    let result = (|| {
        std::fs::write(&src, new).map_err(|e| format!("Could not prepare the change ({e}); the hosts file was not changed."))?;
        let script = elevated_script(&src, path, &sha256_hex(new.as_bytes()));
        let outer = format!(
            "$ErrorActionPreference = 'Stop'\n\
             try {{ $p = Start-Process -FilePath powershell.exe -Verb RunAs -WindowStyle Hidden -Wait -PassThru \
             -ArgumentList '-NoProfile','-NonInteractive','-EncodedCommand','{}'; exit $p.ExitCode }} catch {{ exit 2 }}\n",
            encode_command(&script)
        );
        let out = std::process::Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-EncodedCommand", &encode_command(&outer)])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| format!("PowerShell could not be started ({e}); the hosts file was not changed."))?;
        match out.status.code() {
            Some(0) => match std::fs::read_to_string(path) {
                Ok(after) if after == new => Ok(()),
                _ => Err("The hosts file did not read back as written.".into()),
            },
            Some(2) => Err("Administrator approval was not given; the hosts file was not changed.".into()),
            Some(3) => Err("The prepared content changed before it was applied; the hosts file was not changed.".into()),
            Some(5) => Err("The hosts file did not match after writing; the previous version was put back.".into()),
            _ => Err("The administrator step failed; the hosts file was not changed.".into()),
        }
    })();
    let _ = std::fs::remove_dir_all(&dir);
    result
}

/// The elevated step. It copies the prepared content into the hosts folder
/// first and checks the copy's hash there, where an unprivileged process cannot
/// change it, so content swapped after it was prepared is refused (exit 3).
#[cfg(any(target_os = "windows", test))]
fn elevated_script(src: &Path, dst: &Path, sha256: &str) -> String {
    format!(
        "$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue'\n\
         try {{\n\
         $src = {src}; $dst = {dst}; $hash = '{sha256}'\n\
         $new = $dst + '.cyberforge-new'; $bak = $dst + '.cyberforge-backup'\n\
         Copy-Item -LiteralPath $src -Destination $new -Force\n\
         if ((Get-FileHash -Algorithm SHA256 -LiteralPath $new).Hash -ne $hash) {{ Remove-Item -LiteralPath $new -Force; exit 3 }}\n\
         if (Test-Path -LiteralPath $dst) {{ Copy-Item -LiteralPath $dst -Destination $bak -Force }}\n\
         Move-Item -LiteralPath $new -Destination $dst -Force\n\
         if ((Get-FileHash -Algorithm SHA256 -LiteralPath $dst).Hash -ne $hash) {{\n\
           if (Test-Path -LiteralPath $bak) {{ Copy-Item -LiteralPath $bak -Destination $dst -Force }}; exit 5 }}\n\
         exit 0\n\
         }} catch {{ exit 6 }}\n",
        src = ps_quote(&src.to_string_lossy()),
        dst = ps_quote(&dst.to_string_lossy()),
    )
}

/// A PowerShell single-quoted string. PowerShell also treats the typographic
/// single quotes as quotes, so those are doubled too.
#[cfg(any(target_os = "windows", test))]
fn ps_quote(s: &str) -> String {
    let mut out = String::from("'");
    for c in s.chars() {
        if matches!(c, '\'' | '\u{2018}' | '\u{2019}' | '\u{201A}' | '\u{201B}') {
            out.push(c);
        }
        out.push(c);
    }
    out.push('\'');
    out
}

/// What `powershell -EncodedCommand` takes: base64 of the UTF-16LE text.
#[cfg(any(target_os = "windows", test))]
fn encode_command(script: &str) -> String {
    use base64::Engine;
    let bytes: Vec<u8> = script.encode_utf16().flat_map(|u| u.to_le_bytes()).collect();
    base64::engine::general_purpose::STANDARD.encode(bytes)
}

#[cfg(any(target_os = "windows", test))]
fn sha256_hex(bytes: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    Sha256::digest(bytes).iter().map(|b| format!("{b:02X}")).collect()
}

/// A new folder with a random name under the temp folder; fails if it exists.
#[cfg(any(target_os = "windows", test))]
fn new_private_dir() -> std::io::Result<PathBuf> {
    let mut bytes = [0u8; 16];
    getrandom::fill(&mut bytes).map_err(|e| std::io::Error::other(e.to_string()))?;
    let name: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
    let dir = std::env::temp_dir().join(format!("cyberforge-hosts-{name}"));
    std::fs::create_dir(&dir)?;
    Ok(dir)
}

/// Whether the hosts file can be read and has no incomplete CyberForge section,
/// so a block could be applied (with administrator approval where needed).
/// What a device heartbeat reports as `hosts_blocking`.
pub fn hosts_file_usable() -> bool {
    std::fs::read_to_string(hosts_path()).ok().is_some_and(|c| parse_hosts(&c).is_ok())
}

fn apply_hosts(domains: &[String]) -> Result<(), String> {
    apply_hosts_at(&hosts_path(), &config_dir(), domains, true)
}

/// Mark each saved entry with whether the hosts file blocks it now.
fn mark_enforced(list: &mut [Value], in_hosts: &[String]) {
    for v in list.iter_mut() {
        let enforced = domain_of(v).is_some_and(|d| in_hosts.iter().any(|h| h == d));
        if let Some(obj) = v.as_object_mut() {
            obj.insert("enforced".into(), json!(enforced));
        }
    }
}

// ──────────────────────────────────────────────
// Tauri commands
// ──────────────────────────────────────────────

/// Block a domain system-wide (hosts file) and record it. `reason` is optional.
#[tauri::command]
pub async fn block_site(domain: String, reason: Option<String>) -> Result<Value, String> {
    crate::ownership::ensure_owner()?;
    let Some(dom) = normalize_domain(&domain) else {
        return Err(format!("\u{201c}{}\u{201d} is not a valid domain", domain));
    };
    let reason: String = reason.unwrap_or_else(|| "Flagged by CyberForge".into()).chars().take(200).collect();
    let _guard = change_lock();
    let mut list = read_list(&blocklist_path());
    if !list.iter().any(|v| domain_of(v) == Some(dom.as_str())) {
        list.push(json!({ "domain": dom, "reason": reason, "ts": now_secs(), "enforced": false }));
    }
    let attempt = apply_hosts(&hosts_domains(&list));
    let in_hosts = enforced_domains_at(&hosts_path());
    mark_enforced(&mut list, &in_hosts);
    let enforced = in_hosts.iter().any(|d| d == &dom);
    write_list(&blocklist_path(), &list);
    // Blocking overrides any previous allow for the same domain.
    {
        let mut al = read_list(&allowlist_path());
        al.retain(|v| domain_of(v) != Some(dom.as_str()));
        write_list(&allowlist_path(), &al);
    }
    crate::outbox::record("enforcement", json!({ "action": "block", "domain": dom, "enforced": enforced }));
    record(
        &format!("User blocked {} ({})", dom, if enforced { "enforced system-wide via hosts file" } else { "listed — needs admin to enforce" }),
        "action-block", &dom, Some(if enforced { 80 } else { 70 }),
    );
    Ok(json!({
        "success": true, "domain": dom, "enforced": enforced,
        "needsAdmin": !enforced,
        "message": if enforced { "Blocked system-wide.".to_string() } else { attempt.err().unwrap_or_else(|| "Not in the hosts file.".into()) },
        "blocked": list
    }))
}

/// Remove a domain from the block list + hosts file. If the hosts file still
/// blocks it afterwards (elevation refused), it stays listed and this fails.
#[tauri::command]
pub async fn unblock_site(domain: String) -> Result<Value, String> {
    crate::ownership::ensure_owner()?;
    let dom = normalize_domain(&domain).unwrap_or_else(|| domain.trim().to_lowercase());
    let _guard = change_lock();
    let mut list = read_list(&blocklist_path());
    let remaining: Vec<Value> = list.iter().filter(|v| domain_of(v) != Some(dom.as_str())).cloned().collect();
    let attempt = apply_hosts(&hosts_domains(&remaining));
    let in_hosts = enforced_domains_at(&hosts_path());
    if in_hosts.iter().any(|d| d == &dom) {
        mark_enforced(&mut list, &in_hosts);
        write_list(&blocklist_path(), &list);
        crate::outbox::record("enforcement", json!({ "action": "unblock", "domain": dom, "enforced": true, "applied": false }));
        return Err(format!(
            "{dom} is still blocked: {}",
            attempt.err().unwrap_or_else(|| "the hosts file still lists it.".into())
        ));
    }
    let mut list = remaining;
    mark_enforced(&mut list, &in_hosts);
    write_list(&blocklist_path(), &list);
    crate::outbox::record("enforcement", json!({ "action": "unblock", "domain": dom, "enforced": false, "applied": true }));
    Ok(json!({
        "success": true, "domain": dom, "unenforced": true,
        "needsAdmin": false,
        "message": attempt.err().unwrap_or_default(),
        "blocked": list
    }))
}

/// The current managed block list, each entry marked with whether the hosts
/// file blocks it now.
#[tauri::command]
pub async fn list_blocked() -> Result<Value, String> {
    let mut list = read_list(&blocklist_path());
    mark_enforced(&mut list, &enforced_domains_at(&hosts_path()));
    Ok(json!({ "success": true, "count": list.len(), "blocked": list }))
}

/// Save a domain to the user's list. This changes nothing about how the site is
/// reached, and the response says so (`enforced: false`).
#[tauri::command]
pub async fn protect_site(domain: String) -> Result<Value, String> {
    crate::ownership::ensure_owner()?;
    let Some(dom) = normalize_domain(&domain) else {
        return Err(format!("\u{201c}{}\u{201d} is not a valid domain", domain));
    };
    let _guard = change_lock();
    let mut list = read_list(&protectlist_path());
    if !list.iter().any(|v| domain_of(v) == Some(dom.as_str())) {
        list.push(json!({ "domain": dom, "ts": now_secs() }));
        write_list(&protectlist_path(), &list);
    }
    record(&format!("User saved {} to their list (nothing enforced)", dom), "action-protect", &dom, None);
    Ok(json!({
        "success": true, "domain": dom, "protected": list,
        "enforced": false,
        "note": format!("{} saved to your list. Nothing else changes: the site is reached exactly as before.", dom)
    }))
}

#[tauri::command]
pub async fn unprotect_site(domain: String) -> Result<Value, String> {
    crate::ownership::ensure_owner()?;
    let dom = normalize_domain(&domain).unwrap_or_else(|| domain.trim().to_lowercase());
    let _guard = change_lock();
    let mut list = read_list(&protectlist_path());
    list.retain(|v| domain_of(v) != Some(dom.as_str()));
    write_list(&protectlist_path(), &list);
    Ok(json!({ "success": true, "protected": list }))
}

#[tauri::command]
pub async fn list_protected() -> Result<Value, String> {
    let list = read_list(&protectlist_path());
    Ok(json!({ "success": true, "count": list.len(), "protected": list }))
}

/// Allow a domain: remove it from the block list + hosts file and add it to the
/// allow list. The scanner does not read that list, so an allowed site is still
/// scanned and can still be flagged. If the hosts file still blocks the domain
/// afterwards (elevation refused), it stays blocked and is not marked allowed.
#[tauri::command]
pub async fn allow_site(domain: String) -> Result<Value, String> {
    crate::ownership::ensure_owner()?;
    let Some(dom) = normalize_domain(&domain) else {
        return Err(format!("\u{201c}{}\u{201d} is not a valid domain", domain));
    };
    let _guard = change_lock();
    let mut blocked = read_list(&blocklist_path());
    let was_listed = blocked.iter().any(|v| domain_of(v) == Some(dom.as_str()));
    let mut message = String::new();
    if was_listed {
        let remaining: Vec<Value> = blocked.iter().filter(|v| domain_of(v) != Some(dom.as_str())).cloned().collect();
        if let Err(e) = apply_hosts(&hosts_domains(&remaining)) {
            message = e;
        }
    }
    let in_hosts = enforced_domains_at(&hosts_path());
    let still_blocked = in_hosts.iter().any(|d| d == &dom);
    if still_blocked {
        mark_enforced(&mut blocked, &in_hosts);
        write_list(&blocklist_path(), &blocked);
        return Ok(json!({
            "success": false, "domain": dom, "wasUnblocked": false, "stillBlocked": true,
            "message": if message.is_empty() { "The hosts file still blocks it.".to_string() } else { message },
            "allowed": read_list(&allowlist_path())
        }));
    }
    if was_listed {
        blocked.retain(|v| domain_of(v) != Some(dom.as_str()));
        mark_enforced(&mut blocked, &in_hosts);
        write_list(&blocklist_path(), &blocked);
    }
    let mut allowed = read_list(&allowlist_path());
    if !allowed.iter().any(|v| domain_of(v) == Some(dom.as_str())) {
        allowed.push(json!({ "domain": dom, "ts": now_secs() }));
        write_list(&allowlist_path(), &allowed);
    }
    crate::outbox::record("enforcement", json!({ "action": "allow", "domain": dom, "enforced": false, "wasUnblocked": was_listed }));
    record(&format!("User allowed {} (marked trusted)", dom), "action-allow", &dom, Some(0));
    Ok(json!({ "success": true, "domain": dom, "allowed": allowed, "wasUnblocked": was_listed, "stillBlocked": false }))
}

#[tauri::command]
pub async fn unallow_site(domain: String) -> Result<Value, String> {
    crate::ownership::ensure_owner()?;
    let dom = normalize_domain(&domain).unwrap_or_else(|| domain.trim().to_lowercase());
    let _guard = change_lock();
    let mut list = read_list(&allowlist_path());
    list.retain(|v| domain_of(v) != Some(dom.as_str()));
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

#[cfg(test)]
mod hosts_tests {
    use super::*;

    const USER_HOSTS: &str = "# Copyright (c) Microsoft\r\n#\r\n127.0.0.1 localhost\r\n10.0.0.5 nas.home  # my NAS\r\n";

    fn scratch() -> PathBuf {
        new_private_dir().expect("scratch dir")
    }

    #[test]
    fn other_lines_and_line_endings_survive_a_block_and_an_unblock() {
        let blocked = render_hosts(&parse_hosts(USER_HOSTS).unwrap(), &["phish.example".into()]);
        assert!(blocked.starts_with(USER_HOSTS), "user lines changed: {blocked:?}");
        assert!(blocked.contains("127.0.0.1 phish.example\r\n127.0.0.1 www.phish.example\r\n::1 phish.example\r\n"));
        assert!(!blocked.replace("\r\n", "").contains('\n'), "a bare LF was written into a CRLF file");
        assert_eq!(parse_hosts(&blocked).unwrap().blocked, vec!["phish.example".to_string()]);

        let unblocked = render_hosts(&parse_hosts(&blocked).unwrap(), &[]);
        assert_eq!(unblocked, USER_HOSTS);
        // the same content again changes nothing
        assert_eq!(render_hosts(&parse_hosts(&blocked).unwrap(), &["phish.example".into()]), blocked);
    }

    #[test]
    fn an_incomplete_section_stops_the_change_instead_of_deleting_lines() {
        for broken in [
            format!("{MARK_START}\n127.0.0.1 a.example\n10.0.0.5 nas.home\n"),
            format!("10.0.0.5 nas.home\n{MARK_END}\n"),
            format!("{MARK_START}\n{MARK_START}\n{MARK_END}\n"),
        ] {
            assert!(parse_hosts(&broken).is_err(), "accepted: {broken:?}");
        }
        let dir = scratch();
        let hosts = dir.join("hosts");
        let broken = format!("10.0.0.5 nas.home\n{MARK_START}\n127.0.0.1 a.example\n192.168.1.9 printer.lan\n");
        std::fs::write(&hosts, &broken).unwrap();
        let result = apply_hosts_at(&hosts, &dir.join("backup"), &["b.example".into()], false);
        assert!(result.unwrap_err().contains("incomplete"));
        assert_eq!(std::fs::read_to_string(&hosts).unwrap(), broken);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn only_valid_domain_names_from_the_saved_list_reach_the_hosts_file() {
        let list = vec![
            json!({ "domain": "good.example" }),
            json!({ "domain": "evil.example\n203.0.113.9 bank.example" }),
            json!({ "domain": "203.0.113.9 bank.example" }),
            json!({ "domain": "good.example" }),
            json!({ "domain": "UPPER.example" }),
            json!({ "domain": 42 }),
        ];
        assert_eq!(hosts_domains(&list), vec!["good.example".to_string()]);
        let content = render_hosts(&parse_hosts("").unwrap(), &hosts_domains(&list));
        assert!(!content.contains("bank.example"));
    }

    #[test]
    fn a_change_is_written_whole_backed_up_and_read_back() {
        let dir = scratch();
        let hosts = dir.join("hosts");
        let backup = dir.join("backup");
        std::fs::write(&hosts, USER_HOSTS).unwrap();

        apply_hosts_at(&hosts, &backup, &["a.example".into(), "b.example".into()], false).unwrap();
        assert_eq!(enforced_domains_at(&hosts), vec!["a.example".to_string(), "b.example".to_string()]);
        assert_eq!(std::fs::read_to_string(backup.join("hosts.original")).unwrap(), USER_HOSTS);
        assert_eq!(std::fs::read_to_string(backup.join("hosts.previous")).unwrap(), USER_HOSTS);
        assert!(!dir.join("hosts.cyberforge-new").exists(), "the staged file was left behind");

        let before_unblock = std::fs::read_to_string(&hosts).unwrap();
        apply_hosts_at(&hosts, &backup, &["b.example".into()], false).unwrap();
        assert_eq!(enforced_domains_at(&hosts), vec!["b.example".to_string()]);
        assert_eq!(std::fs::read_to_string(backup.join("hosts.previous")).unwrap(), before_unblock);
        assert_eq!(std::fs::read_to_string(backup.join("hosts.original")).unwrap(), USER_HOSTS, "the first original was replaced");
        assert!(std::fs::read_to_string(&hosts).unwrap().starts_with(USER_HOSTS));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn a_hosts_file_that_cannot_be_read_is_not_overwritten() {
        let dir = scratch();
        // a folder where the file should be: reading fails with something other than "not found"
        let hosts = dir.join("hosts");
        std::fs::create_dir(&hosts).unwrap();
        let result = apply_hosts_at(&hosts, &dir.join("backup"), &["a.example".into()], false);
        assert!(result.unwrap_err().contains("could not be read"));
        assert!(hosts.is_dir());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn quoted_paths_cannot_end_the_string() {
        assert_eq!(ps_quote(r"C:\Users\o'brien\x"), r"'C:\Users\o''brien\x'");
        assert_eq!(ps_quote("a\u{2019}b"), "'a\u{2019}\u{2019}b'");
    }

    /// The elevated step, run here without elevation against files in a scratch
    /// folder: it replaces the file, keeps a backup, and refuses content whose
    /// hash does not match.
    #[cfg(target_os = "windows")]
    #[test]
    fn the_elevated_step_replaces_checks_and_refuses_changed_content() {
        let run = |script: &str| {
            std::process::Command::new("powershell")
                .args(["-NoProfile", "-NonInteractive", "-EncodedCommand", &encode_command(script)])
                .creation_flags(CREATE_NO_WINDOW)
                .status()
                .expect("powershell")
                .code()
        };
        let dir = scratch();
        let src = dir.join("hosts.new");
        let dst = dir.join("o'hosts"); // a quote in the path, as in some user names
        std::fs::write(&dst, USER_HOSTS).unwrap();
        let new = render_hosts(&parse_hosts(USER_HOSTS).unwrap(), &["a.example".into()]);
        std::fs::write(&src, &new).unwrap();

        assert_eq!(run(&elevated_script(&src, &dst, &sha256_hex(new.as_bytes()))), Some(0));
        assert_eq!(std::fs::read_to_string(&dst).unwrap(), new);
        assert_eq!(std::fs::read_to_string(dir.join("o'hosts.cyberforge-backup")).unwrap(), USER_HOSTS);

        // content swapped after it was prepared: refused, file unchanged
        std::fs::write(&src, "203.0.113.9 bank.example\r\n").unwrap();
        assert_eq!(run(&elevated_script(&src, &dst, &sha256_hex(new.as_bytes()))), Some(3));
        assert_eq!(std::fs::read_to_string(&dst).unwrap(), new);
        assert!(!dir.join("o'hosts.cyberforge-new").exists());
        let _ = std::fs::remove_dir_all(dir);
    }
}
