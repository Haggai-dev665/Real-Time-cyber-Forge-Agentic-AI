//! Scan a file the user chose (Analyze page: drop or pick a file).
//!
//! The page sends the file's bytes as the raw request body, with its name in the
//! `x-cf-file-name` header (percent-encoded), so a large file is not converted to
//! JSON. The app hashes the file on this computer, then, only if the user allowed
//! cloud scanning, uploads it to the backend's file analysis, where Windows
//! programs are scored by the trained file malware model. The file is parsed
//! there, never run, and not kept. Without the permission the answer carries the
//! local facts (size, SHA-256, kind) and says why nothing was sent.

use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::State;
use tokio::sync::Mutex;

use crate::state::AppState;

type SharedState = Arc<Mutex<AppState>>;

/// The backend refuses larger uploads (routes/sandbox.js, MAX_UPLOAD_MB).
pub const MAX_FILE_BYTES: usize = 25 * 1024 * 1024;

/// `%XX` sequences to bytes, then UTF-8 (invalid bytes replaced).
fn percent_decode(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hex = |b: u8| (b as char).to_digit(16);
            if let (Some(high), Some(low)) = (hex(bytes[i + 1]), hex(bytes[i + 2])) {
                out.push((high * 16 + low) as u8);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// A file name safe to put in a form header: no path, no quotes or control
/// characters, at most 200 characters.
pub fn clean_name(raw: &str) -> String {
    let base = raw.rsplit(['/', '\\']).next().unwrap_or("");
    let cleaned: String = base
        .chars()
        .filter(|c| !c.is_control() && *c != '"' && *c != ';')
        .take(200)
        .collect();
    let cleaned = cleaned.trim().to_string();
    if cleaned.is_empty() { "file".into() } else { cleaned }
}

/// What can be said about the file without sending it anywhere.
pub fn local_facts(bytes: &[u8]) -> Value {
    let kind = if bytes.starts_with(b"MZ") {
        "Windows program (PE)"
    } else if bytes.starts_with(b"%PDF") {
        "PDF document"
    } else if bytes.starts_with(b"PK\x03\x04") {
        "ZIP archive or Office document"
    } else if bytes.starts_with(b"\x7fELF") {
        "Linux program (ELF)"
    } else {
        "other"
    };
    json!({
        "size": bytes.len(),
        "sha256": format!("{:x}", Sha256::digest(bytes)),
        "kind": kind,
        "windowsProgram": bytes.starts_with(b"MZ"),
    })
}

fn multipart(boundary: &str, name: &str, bytes: &[u8]) -> Vec<u8> {
    let mut body = Vec::with_capacity(bytes.len() + 256);
    body.extend_from_slice(
        format!(
            "--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{name}\"\r\nContent-Type: application/octet-stream\r\n\r\n"
        )
        .as_bytes(),
    );
    body.extend_from_slice(bytes);
    body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
    body
}

#[tauri::command]
pub async fn scan_file(app: tauri::AppHandle, state: State<'_, SharedState>, request: tauri::ipc::Request<'_>) -> Result<Value, String> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err("Send the file's bytes as the request body.".into());
    };
    if bytes.is_empty() {
        return Err("The file is empty.".into());
    }
    if bytes.len() > MAX_FILE_BYTES {
        return Err(format!("The file is larger than {} MB, the most the scanner takes.", MAX_FILE_BYTES / (1024 * 1024)));
    }
    let name = clean_name(&percent_decode(
        request.headers().get("x-cf-file-name").and_then(|v| v.to_str().ok()).unwrap_or("file"),
    ));
    let bytes = bytes.clone();
    let local = local_facts(&bytes);

    if let Err(refusal) = crate::privacy::require(crate::privacy::Feature::CloudScanning) {
        return Ok(json!({ "success": true, "name": name, "local": local, "scan": null, "notSent": refusal }));
    }
    let (base, headers, signed_in) = {
        let s = state.lock().await;
        (s.backend_url.clone(), s.auth_headers(), s.is_authenticated)
    };
    if !signed_in {
        return Ok(json!({ "success": true, "name": name, "local": local, "scan": null, "notSent": "Sign in to send the file for analysis." }));
    }

    crate::event_journal::publish(&app, state.inner(), "agent:activity", json!({ "type": "File scan started", "file": name, "source": "desktop" })).await;
    let mut random = [0u8; 12];
    let _ = getrandom::fill(&mut random);
    let boundary = format!("cf{}", random.iter().map(|b| format!("{b:02x}")).collect::<String>());
    let started = Instant::now();
    let mut req = crate::http::client_with_timeout(Duration::from_secs(180))
        .post(format!("{base}/api/sandbox/analyze/file"))
        .header("Content-Type", format!("multipart/form-data; boundary={boundary}"))
        .body(multipart(&boundary, &name, &bytes));
    for (k, v) in &headers {
        req = req.header(k, v);
    }
    let resp = req.send().await.map_err(|e| format!("Could not reach CyberForge: {}", crate::http::error_chain(e)))?;
    let status = resp.status().as_u16();
    let body: Value = resp.json().await.unwrap_or(Value::Null);
    if !(200..300).contains(&status) {
        let said = body.get("error").or_else(|| body.get("message")).and_then(Value::as_str).unwrap_or("");
        let message = match status {
            401 => "Your session has ended; sign in again.".to_string(),
            413 => "The file is too large for the scanner.".to_string(),
            429 => "The analysis limit for now has been reached; try again later.".to_string(),
            _ if !said.is_empty() => format!("The scan failed: {said}"),
            _ => format!("The scan failed (HTTP {status})."),
        };
        crate::event_journal::publish(&app, state.inner(), "scan:error", json!({ "file": name, "message": message })).await;
        return Err(message);
    }
    let scan = body.get("scan").cloned().unwrap_or(Value::Null);
    let model = scan.pointer("/mlReport/model_predictions/file_malware").cloned().unwrap_or(Value::Null);
    crate::event_journal::publish(
        &app,
        state.inner(),
        "scan:update",
        json!({
            "file": name,
            "verdict": scan.get("verdict").cloned().unwrap_or(Value::Null),
            "modelVerdict": model.get("verdict").cloned().unwrap_or(Value::Null),
            "durationMs": started.elapsed().as_millis() as u64,
            "source": "file-scan",
        }),
    )
    .await;
    Ok(json!({ "success": true, "name": name, "local": local, "scan": scan, "roundTripMs": started.elapsed().as_millis() as u64 }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_lose_paths_quotes_and_control_characters() {
        assert_eq!(clean_name("C:\\Users\\me\\setup.exe"), "setup.exe");
        assert_eq!(clean_name("../../a\"b;\r\n.exe"), "ab.exe");
        assert_eq!(clean_name("   "), "file");
        assert_eq!(clean_name(&"x".repeat(500)).len(), 200);
    }

    #[test]
    fn percent_encoded_names_decode_as_utf8() {
        assert_eq!(percent_decode("r%C3%A9sum%C3%A9.pdf"), "résumé.pdf");
        assert_eq!(percent_decode("100%"), "100%");
        assert_eq!(percent_decode("a%zzb"), "a%zzb");
    }

    #[test]
    fn local_facts_name_the_kind_and_hash() {
        let facts = local_facts(b"MZ\x90\x00");
        assert_eq!(facts["kind"], "Windows program (PE)");
        assert_eq!(facts["windowsProgram"], true);
        assert_eq!(local_facts(b"abc")["sha256"], "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    }

    #[test]
    fn the_form_carries_the_file_between_boundaries() {
        let body = multipart("B", "a.exe", b"MZ");
        let text = String::from_utf8_lossy(&body);
        assert!(text.starts_with("--B\r\nContent-Disposition: form-data; name=\"file\"; filename=\"a.exe\""));
        assert!(text.ends_with("\r\nMZ\r\n--B--\r\n"));
    }
}
