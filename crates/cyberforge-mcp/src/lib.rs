//! CyberForge's MCP server (plan-update-v2.md §5, V2-03).
//!
//! An AI client launches `cyberforge mcp serve --stdio --grant <id>`. The
//! server offers the registry's MCP operations that the grant includes, as
//! tools (`cyberforge_status`, `cyberforge_model_status`,
//! `cyberforge_analyze_url`), and checks the grant on every list and call:
//! revoking it, letting it expire, signing the profile in to another account,
//! or pointing the profile at another server stops the next call.
//!
//! Each tool runs the same shared operation the CLI runs (`cyberforge_core`),
//! as the grant's CLI profile, with that profile's session. Standard output
//! carries protocol messages only; diagnostics go to standard error. Each call
//! is noted in `mcp-calls.jsonl` (operation, outcome and time, never its
//! arguments) for the desktop's Integrations page.

use cyberforge_core::credentials::SecretStore;
use cyberforge_core::grants::{self, GrantError, GrantStore};
use cyberforge_core::operations;
use cyberforge_core::ops::{self, OpError};
use cyberforge_core::profile::{Profile, ProfileStore};
use cyberforge_core::session;
use cyberforge_core::status;
use cyberforge_core::text::printable;
use rmcp::model::{
    CallToolRequestParams, CallToolResponse, CallToolResult, ContentBlock, Implementation, ListToolsResult,
    PaginatedRequestParams, ServerCapabilities, ServerConfig, Tool, ToolAnnotations,
};
use rmcp::service::RequestContext;
use rmcp::{ErrorData as McpError, RoleServer, ServerHandler, ServiceExt};
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;

/// Where the CLI's files are, and how to reach the network and the credential store.
#[derive(Clone)]
pub struct Config {
    pub dir: PathBuf,
    pub grant_id: String,
    /// Where the CLI keeps profile sessions: the system credential store
    /// under the CLI's service name (tests pass a store in memory).
    pub store: Arc<dyn SecretStore + Send + Sync>,
    pub user_agent: String,
    pub timeout: Duration,
}

#[derive(Clone)]
pub struct Server {
    config: Config,
    client: reqwest::Client,
    /// (fingerprint of the session token, the account it is signed in to)
    account: Arc<Mutex<Option<(String, String)>>>,
}

fn object(value: Value) -> Arc<Map<String, Value>> {
    match value {
        Value::Object(map) => Arc::new(map),
        _ => Arc::new(Map::new()),
    }
}

/// The tool for an operation, with its input schema and what it does to the world.
fn tool_for(op: &operations::Operation) -> Option<Tool> {
    let name = operations::mcp_tool_name(op.id)?;
    let schema = if op.id == "scan.url" {
        json!({
            "type": "object",
            "properties": { "url": { "type": "string", "maxLength": 2048, "description": "The http:// or https:// address to analyse. Credentials in it are removed before it is sent." } },
            "required": ["url"],
            "additionalProperties": false
        })
    } else {
        json!({ "type": "object", "properties": {}, "additionalProperties": false })
    };
    let mut annotations = ToolAnnotations::new();
    annotations.read_only_hint = Some(true);
    annotations.destructive_hint = Some(false);
    annotations.idempotent_hint = Some(op.idempotent);
    annotations.open_world_hint = Some(op.id == "scan.url");
    Some(Tool::new(name, op.summary, object(schema)).with_annotations(annotations))
}

fn operation_of_tool(name: &str) -> Option<&'static operations::Operation> {
    operations::for_surface(operations::Surface::Mcp).find(|op| operations::mcp_tool_name(op.id) == Some(name))
}

fn refused(code: &str, message: String) -> CallToolResult {
    let mut result = CallToolResult::error(vec![ContentBlock::text(message.clone())]);
    result.structured_content = Some(json!({ "error": { "code": code, "message": message } }));
    result
}

fn fingerprint(token: &str) -> String {
    Sha256::digest(token.as_bytes()).iter().take(8).map(|b| format!("{b:02x}")).collect()
}

/// Append one line to the call log, keeping the last 500. Best effort.
fn note_call(dir: &Path, grant: &str, tool: &str, outcome: &str) {
    let path = dir.join("mcp-calls.jsonl");
    let line = json!({ "at": grants::now_secs(), "grant": grant, "tool": tool, "outcome": outcome }).to_string();
    let mut lines: Vec<String> = std::fs::read_to_string(&path).map(|t| t.lines().map(str::to_string).collect()).unwrap_or_default();
    lines.push(line);
    let keep = lines.len().saturating_sub(500);
    let text = lines[keep..].join("\n") + "\n";
    if let Ok(mut file) = std::fs::File::create(&path) {
        let _ = file.write_all(text.as_bytes());
    }
}

impl Server {
    pub fn new(config: Config) -> Server {
        let client = cyberforge_core::http::client(&config.user_agent, config.timeout);
        Server { config, client, account: Arc::new(Mutex::new(None)) }
    }

    fn store(&self) -> &(dyn SecretStore + Sync) {
        &*self.config.store
    }

    fn grants(&self) -> GrantStore {
        GrantStore::in_dir(&self.config.dir)
    }

    fn profile_of(&self, name: &str) -> Result<Profile, String> {
        ProfileStore::in_dir(&self.config.dir).resolve(Some(name)).map_err(|e| format!("{:?}", e))
    }

    /// The account the profile's session is signed in to, asked once per session.
    async fn account(&self, profile: &Profile) -> Result<Option<String>, OpError> {
        let Some(token) = session::token(self.store(), profile).map_err(|e| OpError { kind: ops::OpErrorKind::Failure, code: "STORE_UNAVAILABLE".into(), message: e })? else {
            return Ok(None);
        };
        let print = fingerprint(&token);
        if let Some((known, account)) = self.account.lock().await.as_ref() {
            if *known == print {
                return Ok(Some(account.clone()));
            }
        }
        let report = status::check(profile, self.store(), &self.client).await;
        match report.session {
            status::Session::Valid { user_id: Some(id), .. } => {
                *self.account.lock().await = Some((print, id.clone()));
                Ok(Some(id))
            }
            status::Session::Rejected { .. } => Err(OpError { kind: ops::OpErrorKind::Auth, code: "AUTH_REJECTED".into(), message: "The server refused the profile's session; sign in again with cyberforge auth login.".into() }),
            _ => Ok(None),
        }
    }

    async fn run(&self, op: &operations::Operation, arguments: &Map<String, Value>) -> CallToolResult {
        let now = grants::now_secs();
        let grant = match self.grants().active(&self.config.grant_id, now) {
            Ok(grant) => grant,
            Err(error) => return refused(error.code(), error.message()),
        };
        let profile = match self.profile_of(&grant.profile) {
            Ok(profile) => profile,
            Err(_) => return refused("PROFILE", format!("The grant's profile {} no longer exists.", grant.profile)),
        };
        // Operations on the server are checked against the account too.
        let account = if op.location == operations::Location::Backend {
            match self.account(&profile).await {
                Ok(account) => account,
                Err(error) => return refused(&error.code, error.message),
            }
        } else {
            None
        };
        if let Err(error) = self.grants().check(&grant.id, op.id, profile.origin.as_str(), account.as_deref(), now) {
            return refused(error.code(), error.message());
        }
        let outcome = match op.id {
            "status" => {
                let report = status::check(&profile, self.store(), &self.client).await;
                let data = serde_json::to_value(&report).unwrap_or(Value::Null);
                Ok((summary_of_status(&data), data))
            }
            "models.status" => ops::model_status(&profile, self.store(), &self.client).await.map(|data| (summary_of_models(&data), data)),
            "scan.url" => {
                let url = arguments.get("url").and_then(Value::as_str).unwrap_or("");
                ops::analyze_url(&profile, self.store(), &self.client, url).await.map(|(mut data, redacted)| {
                    if let Value::Object(map) = &mut data {
                        map.insert("addressRedactedHere".into(), Value::Bool(redacted));
                    }
                    (summary_of_analysis(&data), data)
                })
            }
            _ => Err(OpError { kind: ops::OpErrorKind::Failure, code: "NOT_IMPLEMENTED".into(), message: "This operation is listed but not implemented.".into() }),
        };
        match outcome {
            Ok((text, data)) => {
                let mut result = CallToolResult::success(vec![ContentBlock::text(text)]);
                result.structured_content = Some(data);
                result
            }
            Err(error) => refused(&error.code, error.message),
        }
    }
}

fn field(v: &Value, key: &str) -> String {
    printable(v.get(key).and_then(Value::as_str).unwrap_or(""), 300)
}

fn summary_of_status(report: &Value) -> String {
    let state = |part: &str| report.pointer(&format!("/{part}/state")).and_then(Value::as_str).unwrap_or("unknown").to_string();
    format!(
        "CyberForge server {}: {}. Session: {}. Credential store: {}. Local owner: {}.",
        field(report, "origin"), state("backend"), state("session"), state("credential_store"), state("desktop_broker")
    )
}

fn summary_of_models(data: &Value) -> String {
    let list = data.get("capabilities").and_then(Value::as_array).cloned().unwrap_or_default();
    let ready = list.iter().filter(|c| c.get("readiness").and_then(Value::as_str) == Some("ready")).count();
    let lines: Vec<String> = list.iter().take(20).map(|c| format!("- {} ({}): {}", field(c, "id"), field(c, "kind"), field(c, "readiness"))).collect();
    format!("Analysis Agents {}: {} of {} capabilities ready.\n{}", field(data, "serviceVersion"), ready, list.len(), lines.join("\n"))
}

fn summary_of_analysis(data: &Value) -> String {
    format!(
        "Verdict: {} ({}). Address analysed: {}. Policy {}; scores are raw model scores, not probabilities.",
        field(data, "verdict"), field(data, "verdictReason"), field(data, "target"), field(data, "policy")
    )
}

impl ServerHandler for Server {
    fn get_info(&self) -> ServerConfig {
        ServerConfig::new(ServerCapabilities::builder().enable_tools().build())
            .with_server_info(Implementation::new("cyberforge", env!("CARGO_PKG_VERSION")))
            .with_instructions("CyberForge security tools for the user who approved this client. Every tool is read-only. Results come from the user's CyberForge server and its Analysis Agents; a verdict of unknown means no trained model answered.")
    }

    async fn list_tools(&self, _request: Option<PaginatedRequestParams>, _context: RequestContext<RoleServer>) -> Result<ListToolsResult, McpError> {
        let grant = self.grants().active(&self.config.grant_id, grants::now_secs()).map_err(|e| McpError::invalid_request(e.message(), None))?;
        let tools = operations::for_surface(operations::Surface::Mcp)
            .filter(|op| grant.operations.iter().any(|g| g == op.id))
            .filter_map(tool_for)
            .collect();
        Ok(ListToolsResult::with_all_items(tools))
    }

    async fn call_tool(&self, request: CallToolRequestParams, _context: RequestContext<RoleServer>) -> Result<CallToolResponse, McpError> {
        let name = request.name.to_string();
        let Some(op) = operation_of_tool(&name) else {
            note_call(&self.config.dir, &self.config.grant_id, &name, "UNKNOWN_TOOL");
            return Err(McpError::invalid_params(format!("No tool named {}", printable(&name, 60)), None));
        };
        let arguments = request.arguments.unwrap_or_default();
        // Only the arguments a tool declares are accepted.
        let declared: &[&str] = if op.id == "scan.url" { &["url"] } else { &[] };
        if let Some(extra) = arguments.keys().find(|k| !declared.contains(&k.as_str())) {
            return Err(McpError::invalid_params(format!("{} takes no argument named {}", name, printable(extra, 40)), None));
        }
        let result = self.run(op, &arguments).await;
        let outcome = if result.is_error == Some(true) {
            result.structured_content.as_ref().and_then(|v| v.pointer("/error/code")).and_then(Value::as_str).unwrap_or("ERROR").to_string()
        } else {
            "ok".to_string()
        };
        note_call(&self.config.dir, &self.config.grant_id, &name, &outcome);
        Ok(result.into())
    }
}

/// Serve over standard input and output until the client closes it.
pub async fn serve_stdio(config: Config) -> Result<(), String> {
    serve_on(config, rmcp::transport::stdio()).await
}

/// Serve over any byte stream pair (standard input and output, or a test's pipes).
pub async fn serve_on<R, W>(config: Config, transport: (R, W)) -> Result<(), String>
where
    R: tokio::io::AsyncRead + Send + Unpin + 'static,
    W: tokio::io::AsyncWrite + Send + Unpin + 'static,
{
    // Refuse at once, on standard error, when the grant cannot be used.
    GrantStore::in_dir(&config.dir).active(&config.grant_id, grants::now_secs()).map_err(|e: GrantError| e.message())?;
    let running = Server::new(config).serve(transport).await.map_err(|e| e.to_string())?;
    running.waiting().await.map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tools_come_from_the_registry_and_are_read_only() {
        let tools: Vec<Tool> = operations::for_surface(operations::Surface::Mcp).filter_map(tool_for).collect();
        let names: Vec<String> = tools.iter().map(|t| t.name.to_string()).collect();
        assert_eq!(names, ["cyberforge_status", "cyberforge_model_status", "cyberforge_analyze_url"]);
        for tool in &tools {
            let a = tool.annotations.as_ref().unwrap();
            assert_eq!((a.read_only_hint, a.destructive_hint), (Some(true), Some(false)), "{}", tool.name);
            assert_eq!(tool.input_schema.get("additionalProperties"), Some(&Value::Bool(false)));
        }
        assert_eq!(tools[2].input_schema["required"], json!(["url"]));
        assert_eq!(operation_of_tool("cyberforge_analyze_url").map(|o| o.id), Some("scan.url"));
        assert!(operation_of_tool("cyberforge_auth_login").is_none());
    }
}
