//! `cyberforge models status`: what the ML service can do now, as the backend
//! reports it (`GET /api/v1/ml/capabilities`, V2-ML02). The CLI never holds
//! the ML service's key; it asks the backend with the profile's session.

use crate::out::Outcome;
use crate::Ctx;
use cyberforge_core::text::printable;
use serde_json::Value;

pub async fn status(ctx: &Ctx) -> Outcome {
    const CMD: &str = "models status";
    let profile = match ctx.profile(CMD) {
        Ok(profile) => profile,
        Err(outcome) => return outcome,
    };
    let data = match cyberforge_core::ops::model_status(&profile, &ctx.store(), &ctx.client()).await {
        Ok(data) => data,
        Err(error) => return crate::out::from_op(CMD, error),
    };
    let text = render(&data);
    let mut outcome = Outcome::done(CMD, data.clone(), text);
    let not_ready = data
        .get("capabilities")
        .and_then(Value::as_array)
        .map(|list| list.iter().filter(|c| c.get("readiness").and_then(Value::as_str) != Some("ready")).count())
        .unwrap_or(0);
    if not_ready > 0 {
        outcome.warnings.push(format!("{} capabilit{} not ready now; see each one's readiness.", not_ready, if not_ready == 1 { "y is" } else { "ies are" }));
    }
    outcome
}

/// The report as text. Every value came from the network, so each is made
/// printable here.
pub fn render(data: &Value) -> String {
    let field = |v: &Value, key: &str, max: usize| v.get(key).and_then(Value::as_str).map(|s| printable(s, max));
    let mut lines = vec![format!(
        "ML service {} (report {})",
        field(data, "serviceVersion", 40).unwrap_or_else(|| "version unknown".into()),
        field(data, "generatedAt", 40).unwrap_or_else(|| "time unknown".into())
    )];
    for capability in data.get("capabilities").and_then(Value::as_array).into_iter().flatten().take(40) {
        let mut line = format!(
            "  {:<22} {:<15} {}",
            field(capability, "id", 40).unwrap_or_default(),
            field(capability, "kind", 20).unwrap_or_default(),
            field(capability, "readiness", 20).unwrap_or_default()
        );
        if let Some(trained) = field(capability, "trainedAt", 40) {
            line.push_str(&format!(", trained {}", trained));
        }
        if let Some(reason) = field(capability, "reason", 200) {
            line.push_str(&format!(" ({})", reason));
        }
        lines.push(line);
    }
    let not_offered: Vec<String> = data
        .get("notOffered")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .take(12)
        .filter_map(|item| Some(format!("  {}: {}", field(item, "what", 80)?, field(item, "note", 200).unwrap_or_default())))
        .collect();
    if !not_offered.is_empty() {
        lines.push("Not offered:".into());
        lines.extend(not_offered);
    }
    if let Some(training) = data.get("training") {
        lines.push(format!(
            "Training: {}{}",
            field(training, "who", 120).unwrap_or_else(|| "not stated".into()),
            field(training, "note", 200).map(|n| format!("; {}", n)).unwrap_or_default()
        ));
    }
    lines.join("\n")
}

#[cfg(test)]
mod tests {
    use super::render;
    use serde_json::json;

    #[test]
    fn the_report_is_listed_with_reasons_and_what_is_not_offered() {
        let text = render(&json!({
            "serviceVersion": "2.0.0",
            "generatedAt": "2026-10-17T00:00:00Z",
            "capabilities": [
                { "id": "phishing_detection", "kind": "trained_model", "readiness": "ready", "trainedAt": "2026-10-13" },
                { "id": "reasoning_llm", "kind": "language_model", "readiness": "loading", "reason": "loads in the \u{1b}[31mbackground" }
            ],
            "notOffered": [{ "what": "task execution", "note": "reasoning text only" }],
            "training": { "who": "the Space owner only", "note": "same process" }
        }));
        for part in ["ML service 2.0.0", "phishing_detection", "trained 2026-10-13", "reasoning_llm", "loading", "Not offered:", "task execution: reasoning text only", "Training: the Space owner only; same process"] {
            assert!(text.contains(part), "{part} missing from {text}");
        }
        assert!(!text.contains('\u{1b}'), "escape sequences from the network are removed");
    }
}
