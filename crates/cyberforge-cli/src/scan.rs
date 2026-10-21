//! `cyberforge scan url <URL> [--fail-on …]`: one address analysed by the ML
//! service through the backend (`POST /api/v1/ml/analyze-url`, V2-ML02), as a
//! versioned record.
//!
//! The address is redacted here before it leaves this computer (and again by
//! the backend). A verdict is data, not an execution error: the command exits
//! 0 whatever the verdict, unless `--fail-on` names a verdict that came back,
//! which exits 1, for scripts and CI (plan-update-v2.md §6.2).

use crate::out::{exit, Outcome};
use crate::Ctx;
use clap::ValueEnum;
use cyberforge_core::text::printable;
use serde_json::{json, Value};

#[derive(Clone, Copy, Debug, PartialEq, ValueEnum)]
pub enum FailOn {
    /// Exit 1 when the verdict is threat.
    Threat,
    /// Exit 1 when the verdict is unknown (no trained model answered).
    Unknown,
    /// Exit 1 when the verdict is threat or unknown.
    ThreatOrUnknown,
}

/// Whether the policy matches a verdict.
pub fn fails(policy: Option<FailOn>, verdict: &str) -> bool {
    match policy {
        None => false,
        Some(FailOn::Threat) => verdict == "threat",
        Some(FailOn::Unknown) => verdict == "unknown",
        Some(FailOn::ThreatOrUnknown) => verdict == "threat" || verdict == "unknown",
    }
}

/// The address to send (see `cyberforge_core::ops::analysis_target`).
pub fn target(input: &str) -> Result<(String, bool), String> {
    cyberforge_core::ops::analysis_target(input)
}

pub async fn url(ctx: &Ctx, input: &str, fail_on: Option<FailOn>) -> Outcome {
    const CMD: &str = "scan url";
    // The address is checked first, before a profile or a session is needed.
    if let Err(message) = target(input) {
        return Outcome::failed(CMD, exit::USAGE, "URL_INVALID", message);
    }
    let profile = match ctx.profile(CMD) {
        Ok(profile) => profile,
        Err(outcome) => return outcome,
    };
    let (data, redacted) = match cyberforge_core::ops::analyze_url(&profile, &ctx.store(), &ctx.client(), input).await {
        Ok(found) => found,
        Err(error) => return crate::out::from_op(CMD, error),
    };
    let verdict = data.get("verdict").and_then(Value::as_str).unwrap_or("unknown").to_string();
    let mut warnings = Vec::new();
    if redacted {
        warnings.push("Credentials were removed from the address before it was sent.".to_string());
    }
    for warning in data.get("warnings").and_then(Value::as_array).into_iter().flatten().take(20) {
        if let Some(text) = warning.as_str() {
            warnings.push(printable(text, 300));
        }
    }
    let matched = fails(fail_on, &verdict);
    Outcome {
        command: CMD,
        code: if matched { exit::FAILURE } else { exit::OK },
        error: matched.then(|| json!({ "code": "FAIL_ON", "message": format!("The verdict is {}, which --fail-on names.", verdict) })),
        text: render(&data),
        data,
        warnings,
    }
}

/// The record as text; every value came from the network.
pub fn render(data: &Value) -> String {
    let field = |v: &Value, key: &str, max: usize| v.get(key).and_then(Value::as_str).map(|s| printable(s, max));
    let mut lines = vec![
        format!("Verdict   {} ({})", field(data, "verdict", 20).unwrap_or_else(|| "unknown".into()), field(data, "verdictReason", 300).unwrap_or_default()),
        format!("Address   {}", field(data, "target", 2300).unwrap_or_default()),
    ];
    if let Some(coverage) = data.get("coverage") {
        let n = |key: &str| coverage.get(key).and_then(Value::as_u64).map(|v| v.to_string()).unwrap_or_else(|| "?".into());
        lines.push(format!(
            "Coverage  {} of {} detectors answered by trained models, {} rule-based estimates",
            n("trainedModelsAnswered"),
            n("detectors"),
            n("heuristicEstimates")
        ));
    }
    for detector in data.get("detectors").and_then(Value::as_array).into_iter().flatten().take(20) {
        let score = detector.get("rawScore").and_then(Value::as_f64).map(|s| format!("raw score {:.2}", s)).unwrap_or_else(|| "no score".into());
        lines.push(format!(
            "  {:<22} {:<14} {:<8} {}",
            field(detector, "id", 40).unwrap_or_default(),
            field(detector, "engine", 20).unwrap_or_default(),
            field(detector, "verdict", 10).unwrap_or_default(),
            score
        ));
    }
    lines.push(format!(
        "Analysis  {} (policy {}, ML service {}, {} ms)",
        field(data, "analysisId", 64).unwrap_or_default(),
        field(data, "policy", 60).unwrap_or_default(),
        field(data, "serviceVersion", 40).unwrap_or_default(),
        data.get("durationMs").and_then(Value::as_f64).map(|d| format!("{:.0}", d)).unwrap_or_else(|| "?".into())
    ));
    lines.join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn addresses_are_checked_and_redacted_before_they_leave() {
        assert_eq!(target(" https://example.com/login?next=/home&token=abc123 ").unwrap(), ("https://example.com/login?next=/home&token=[redacted]".to_string(), true));
        assert_eq!(target("https://example.com/").unwrap(), ("https://example.com/".to_string(), false));
        for bad in ["example.com", "ftp://example.com/", "javascript:alert(1)", "https://exa mple.com/", ""] {
            assert!(target(bad).is_err(), "{bad}");
        }
        assert!(target(&format!("https://example.com/{}", "a".repeat(2100))).is_err());
    }

    #[test]
    fn fail_on_matches_only_what_it_names() {
        assert!(!fails(None, "threat"));
        assert!(fails(Some(FailOn::Threat), "threat"));
        assert!(!fails(Some(FailOn::Threat), "unknown"));
        assert!(fails(Some(FailOn::Unknown), "unknown"));
        assert!(fails(Some(FailOn::ThreatOrUnknown), "unknown"));
        assert!(!fails(Some(FailOn::ThreatOrUnknown), "benign"));
    }

    #[test]
    fn the_record_is_rendered_with_coverage_and_raw_scores() {
        let text = render(&json!({
            "verdict": "threat", "verdictReason": "flagged by phishing_detection", "target": "https://example.com/",
            "coverage": { "detectors": 4, "trainedModelsAnswered": 4, "heuristicEstimates": 0 },
            "detectors": [{ "id": "phishing_detection", "engine": "trained_model", "verdict": "threat", "rawScore": 0.912 }],
            "analysisId": "abc", "policy": "trained_models_v1", "serviceVersion": "2.0.0", "durationMs": 41.6
        }));
        for part in ["Verdict   threat (flagged by phishing_detection)", "4 of 4 detectors answered by trained models", "raw score 0.91", "policy trained_models_v1", "42 ms"] {
            assert!(text.contains(part), "{part} missing from {text}");
        }
    }
}
