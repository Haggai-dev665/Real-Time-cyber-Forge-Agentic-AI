//! Installation, immutable verified caching, and warm native detector inference.
use cyberforge_core::local_ml::Pack;
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    io::Write,
    path::PathBuf,
    sync::{Arc, Mutex, OnceLock, RwLock},
    time::Instant,
};
const MANIFEST: &str = include_str!("../local-ml/manifest.json");
const BUNDLED: &[u8] = include_bytes!("../local-ml/core-v1.json.gz");
static PACK: RwLock<Option<Arc<Pack>>> = RwLock::new(None);
static SETUP: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());
#[derive(Deserialize)]
struct Manifest {
    repo: String,
    revision: Option<String>,
    path: String,
    sha256: String,
    bytes: u64,
    #[serde(rename = "sourceRevision")]
    source_revision: String,
}
fn manifest() -> Manifest {
    serde_json::from_str(MANIFEST).expect("validated local ML release manifest")
}
fn state() -> &'static Mutex<Value> {
    static S: OnceLock<Mutex<Value>> = OnceLock::new();
    S.get_or_init(||Mutex::new(json!({"ready":false,"state":"not_loaded","downloadedBytes":0,"totalBytes":manifest().bytes,"modelCount":0})))
}
pub fn status() -> Value {
    state().lock().unwrap_or_else(|p| p.into_inner()).clone()
}
fn update(app: Option<&tauri::AppHandle>, next: Value) {
    let mut s = state().lock().unwrap_or_else(|p| p.into_inner());
    if let Some(fields) = next.as_object() {
        for (k, v) in fields {
            s[k] = v.clone();
        }
    }
    let ready = s["ready"].clone();
    let phase = s["state"].clone();
    drop(s);
    if let Some(a) = app {
        crate::event_journal::device(
            a,
            "model:status",
            json!({"status":phase,"modelCount":if ready==true{4}else{0},"source":"local-ml"}),
        );
    }
}
fn directory() -> Result<PathBuf, String> {
    std::env::var_os("CYBERFORGE_LOCAL_MODEL_DIR")
        .map(PathBuf::from)
        .or_else(|| crate::auth::config_dir().map(|p| p.join("models")))
        .ok_or("No local model directory".into())
}
fn verified(bytes: &[u8], m: &Manifest) -> bool {
    bytes.len() as u64 == m.bytes && format!("{:x}", Sha256::digest(bytes)) == m.sha256
}
fn activate(bytes: &[u8], m: &Manifest) -> Result<(), String> {
    if !verified(bytes, m) {
        return Err("Detector pack checksum mismatch".into());
    }
    let p = Pack::from_gzip(bytes)?;
    *PACK.write().unwrap_or_else(|p| p.into_inner()) = Some(Arc::new(p));
    Ok(())
}
pub async fn load(app: Option<&tauri::AppHandle>) -> Result<(), String> {
    if PACK.read().unwrap_or_else(|p| p.into_inner()).is_some() {
        return Ok(());
    }
    let _guard = SETUP.lock().await;
    if PACK.read().unwrap_or_else(|p| p.into_inner()).is_some() {
        return Ok(());
    }
    let m = manifest();
    let cached = directory()?.join(&m.sha256).join("core-v1.json.gz");
    let bytes = std::fs::read(cached).ok().filter(|b| verified(b, &m));
    let source = if bytes.is_some() {
        "huggingface-cache"
    } else {
        "bundled-verified"
    };
    let data = bytes.unwrap_or_else(|| BUNDLED.to_vec());
    tokio::task::spawn_blocking(move || activate(&data, &manifest()))
        .await
        .map_err(|e| e.to_string())??;
    update(
        app,
        json!({"ready":true,"state":"ready","source":source,"modelCount":4,"revision":m.revision,"sourceRevision":m.source_revision,"sha256":m.sha256,"scope":"URL features and anomaly; not page content or an LLM","error":null}),
    );
    Ok(())
}
struct FileLock(PathBuf);
impl Drop for FileLock {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.0);
    }
}
async fn download(app: Option<&tauri::AppHandle>) -> Result<(), String> {
    let m = manifest();
    let revision = m
        .revision
        .as_ref()
        .ok_or("This release has no published model revision")?;
    // Only compiled-in, immutable repository coordinates are used; a webview
    // cannot supply a URL, file path, model, checksum or executable to download.
    if revision.len() != 40
        || !revision.bytes().all(|b| b.is_ascii_hexdigit())
        || m.repo != "Che237/cyberforge-models"
        || m.path != "desktop/core-v1.json.gz"
    {
        return Err("Invalid pinned model manifest".into());
    }
    let dir = directory()?.join(&m.sha256);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let final_path = dir.join("core-v1.json.gz");
    if std::fs::read(&final_path)
        .ok()
        .map(|b| verified(&b, &m))
        .unwrap_or(false)
    {
        update(
            app,
            json!({"state":"ready","source":"huggingface-cache","downloadedBytes":m.bytes}),
        );
        return Ok(());
    }
    let lock = dir.join("download.lock");
    if lock
        .metadata()
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.elapsed().ok())
        .map(|t| t.as_secs() > 600)
        .unwrap_or(false)
    {
        let _ = std::fs::remove_file(&lock);
    }
    let file_lock = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&lock)
        .map_err(|_| "Another CyberForge process is preparing this model pack".to_string())?;
    let _lock = FileLock(lock);
    drop(file_lock);
    // Windows rename cannot replace a damaged cache. Keep the bundled pack
    // active while repairing the exact immutable cache file under this lock.
    if final_path.exists() {
        if std::fs::read(&final_path)
            .ok()
            .map(|b| verified(&b, &m))
            .unwrap_or(false)
        {
            update(
                app,
                json!({"state":"ready","source":"huggingface-cache","downloadedBytes":m.bytes}),
            );
            return Ok(());
        }
        std::fs::remove_file(&final_path).map_err(|e| e.to_string())?;
    }
    let partial = dir.join("core-v1.json.gz.partial");
    let offset = partial.metadata().map(|m| m.len()).unwrap_or(0);
    let offset = if offset >= m.bytes {
        let _ = std::fs::remove_file(&partial);
        0
    } else {
        offset
    };
    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(8))
        .timeout(std::time::Duration::from_secs(120))
        .user_agent(crate::http::USER_AGENT)
        .build().map_err(|e|e.to_string())?;
    let url = format!(
        "https://huggingface.co/{}/resolve/{}/{}",
        m.repo, revision, m.path
    );
    let mut request = client.get(&url);
    if offset > 0 {
        request = request.header("Range", format!("bytes={offset}-"));
    }
    update(
        app,
        json!({"state":"downloading","downloadedBytes":offset,"resumedFromBytes":offset,"error":null}),
    );
    let mut response = request.send().await.map_err(|_| {
        "Cannot reach Hugging Face; verified bundled models remain available".to_string()
    })?;
    if !response.status().is_success() {
        return Err(format!(
            "Model download returned HTTP {}",
            response.status().as_u16()
        ));
    }
    let resume = response.status() == reqwest::StatusCode::PARTIAL_CONTENT;
    if resume
        && !response
            .headers()
            .get("content-range")
            .and_then(|h| h.to_str().ok())
            .map(|h| h.starts_with(&format!("bytes {offset}-")))
            .unwrap_or(false)
    {
        return Err("Unexpected model download range".into());
    }
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(!resume)
        .append(resume)
        .open(&partial)
        .map_err(|e| e.to_string())?;
    let mut received = if resume { offset } else { 0 };
    let mut progress = received;
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "Download interrupted; retry will resume the partial file".to_string())?
    {
        received += chunk.len() as u64;
        if received > m.bytes {
            return Err("Model download exceeded its declared size".into());
        }
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        if received - progress >= 1024 * 1024 {
            update(app, json!({"downloadedBytes":received}));
            progress = received;
        }
    }
    file.sync_all().map_err(|e| e.to_string())?;
    drop(file);
    let bytes = std::fs::read(&partial).map_err(|e| e.to_string())?;
    if !verified(&bytes, &m) {
        let _ = std::fs::remove_file(&partial);
        return Err("Model checksum did not match; corrupt download discarded".into());
    }
    // Validate semantics before atomically exposing a new version directory.
    tokio::task::spawn_blocking(move||Pack::from_gzip(&bytes).map(|_|()))
        .await.map_err(|e|e.to_string())??;
    std::fs::rename(&partial, &final_path).map_err(|e| e.to_string())?;
    update(
        app,
        json!({"state":"ready","source":"huggingface-cache","downloadedBytes":received,"error":null}),
    );
    Ok(())
}
pub async fn prepare(app: Option<&tauri::AppHandle>) -> Value {
    if let Err(e) = load(app).await {
        return json!({"success":false,"ready":false,"error":e});
    }
    let _guard = SETUP.lock().await;
    match download(app).await {
        Ok(()) => {
            let mut out = status();
            out["success"] = json!(true);
            out
        }
        Err(e) => {
            update(
                app,
                json!({"state":"ready_offline","error":e,"source":"bundled-verified"}),
            );
            let mut out = status();
            out["success"] = json!(false);
            out
        }
    }
}
#[tauri::command]
pub async fn local_model_status() -> Result<Value, String> {
    Ok(status())
}
#[tauri::command]
pub async fn prepare_local_models(app: tauri::AppHandle) -> Result<Value, String> {
    crate::ownership::ensure_owner()?;
    Ok(prepare(Some(&app)).await)
}
pub async fn scan(url: &str) -> Result<Value, String> {
    load(None).await?;
    let pack = PACK
        .read()
        .unwrap_or_else(|p| p.into_inner())
        .clone()
        .ok_or("Local models not loaded")?;
    let url = url.to_string();
    tokio::task::spawn_blocking(move||{
        let started=Instant::now();let (_,predictions)=pack.scores(&url)?;
        let max=predictions.iter().filter(|p|p["model"]!="anomaly_detection").filter_map(|p|p["threat_score"].as_f64()).fold(0f64,f64::max);
        let risk=(max*100.).round() as i64;let elapsed=started.elapsed().as_secs_f64()*1000.;
        Ok(json!({"success":true,"data":{"url":url,"riskScore":risk,"verdict":if max>=0.5{"suspicious"}else{"benign"},"category":"url-feature-assessment","source":"local-ml","modelRevision":pack.source_revision,"localInferenceMs":elapsed,"backendAvailable":false,"backendRiskScore":null,"summary":"On-device URL-feature assessment. Page content, BERT and live threat intelligence were not checked. Use cloud deep scan for additional evidence.","predictions":predictions,"signals":["Three trained URL classifiers and a separate anomaly model ran on this computer."],"coverage":{"localModels":true,"backendModels":false,"page":"not observed","liveThreatIntel":false,"bert":false,"explanation":"deterministic summary; no LLM call"}}}))
    }).await.map_err(|e|e.to_string())?
}
pub fn start(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let _ = prepare(Some(&app)).await;
    });
}
pub fn bootstrap() -> bool {
    match tokio::runtime::Runtime::new() {
        Ok(rt) => {
            let result = rt.block_on(prepare(None));
            println!("{}", result);
            result["success"] == true
        }
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn embedded_pack_is_pinned_and_complete() {
        let m = manifest();
        assert!(verified(BUNDLED, &m));
        let p = Pack::from_gzip(BUNDLED).unwrap();
        assert_eq!(p.models.len(), 4);
        assert_eq!(m.source_revision, p.source_revision);
        assert_eq!(p.source_revision.len(), 40);
    }
    #[tokio::test]
    async fn scan_is_available_without_network_and_marks_coverage() {
        let result = scan("https://example.com/").await.unwrap();
        assert_eq!(result["data"]["source"], "local-ml");
        assert_eq!(result["data"]["predictions"].as_array().unwrap().len(), 4);
        assert_eq!(result["data"]["coverage"]["page"], "not observed");
        assert_eq!(result["data"]["coverage"]["backendModels"], false);
        assert!(result["data"]["localInferenceMs"].is_number());
    }
}
