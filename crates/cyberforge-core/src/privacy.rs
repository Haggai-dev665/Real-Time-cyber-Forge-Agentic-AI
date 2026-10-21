//! What CyberForge may collect and send, as the user chose it (SEC-07).
//!
//! Five separate controls, each off until the user decides:
//!   history_access   read the browsers' history files on this computer
//!   active_tab       watch the address in the active browser tab
//!   cloud_scanning   send addresses to the CyberForge backend for analysis
//!   llm_processing   send assistant questions to a language model
//!   sync             copy local memory and browser information to the account
//!
//! The choices are kept in `privacy.json` with the consent version they were
//! made under and when; a later consent version counts as undecided again.
//! This module is the model and its file format, shared by the desktop app and
//! (later) the CLI and MCP server; where the file lives, and the commands that
//! change it, belong to the program that owns this computer's state.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::Path;

/// Raise when what a control does or sends changes: every choice is asked again.
pub const CONSENT_VERSION: u32 = 1;
const MAX_LOG: usize = 50;

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Feature {
    HistoryAccess,
    ActiveTab,
    CloudScanning,
    LlmProcessing,
    Sync,
}

/// id, label, what it sends and where, for the settings screen
pub const FEATURES: &[(Feature, &str, &str, &str)] = &[
    (Feature::HistoryAccess, "history_access", "Read browser history",
     "Reads the history files of the browsers on this computer, for the History page and history scans. Nothing leaves this computer because of this alone."),
    (Feature::ActiveTab, "active_tab", "Watch the active tab",
     "Reads the address in the browser tab you are looking at, so the agent can offer to scan it as you browse. Nothing leaves this computer because of this alone."),
    (Feature::CloudScanning, "cloud_scanning", "Cloud scanning",
     "Sends each address you scan, with sign-in codes and tokens removed, to the CyberForge backend. It checks the address with the ML service on Hugging Face and may load the page with the page scanner. Without this, scans and URL checks are not available."),
    (Feature::LlmProcessing, "llm_processing", "Assistant (language model)",
     "Sends your assistant questions, and the findings they refer to, to a language model: the ML service's model on Hugging Face through the backend, or DeepSeek on Hugging Face if you saved your own token."),
    (Feature::Sync, "sync", "Sync to your account",
     "Copies your local memory (scan results, actions, reports) and the list of your browsers to your CyberForge account, so your other devices can show them. Only what was recorded while you were signed in to that account is copied."),
];

pub fn id_of(feature: Feature) -> &'static str {
    FEATURES.iter().find(|(f, ..)| *f == feature).map(|(_, id, ..)| *id).unwrap_or("unknown")
}
pub fn label_of(feature: Feature) -> &'static str {
    FEATURES.iter().find(|(f, ..)| *f == feature).map(|(_, _, label, _)| *label).unwrap_or("This")
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Change {
    pub at: u64,
    pub feature: String,
    pub enabled: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    #[serde(default)]
    pub consent_version: u32,
    #[serde(default)]
    pub decided_at: Option<u64>,
    #[serde(default)]
    pub history_access: bool,
    #[serde(default)]
    pub active_tab: bool,
    #[serde(default)]
    pub cloud_scanning: bool,
    #[serde(default)]
    pub llm_processing: bool,
    #[serde(default)]
    pub sync: bool,
    #[serde(default)]
    pub log: Vec<Change>,
}

impl Settings {
    /// Whether the user decided under the current consent version.
    pub fn decided(&self) -> bool {
        self.consent_version == CONSENT_VERSION && self.decided_at.is_some()
    }

    pub fn allows(&self, feature: Feature) -> bool {
        self.decided()
            && match feature {
                Feature::HistoryAccess => self.history_access,
                Feature::ActiveTab => self.active_tab,
                Feature::CloudScanning => self.cloud_scanning,
                Feature::LlmProcessing => self.llm_processing,
                Feature::Sync => self.sync,
            }
    }

    fn slot(&mut self, id: &str) -> Option<&mut bool> {
        match id {
            "history_access" => Some(&mut self.history_access),
            "active_tab" => Some(&mut self.active_tab),
            "cloud_scanning" => Some(&mut self.cloud_scanning),
            "llm_processing" => Some(&mut self.llm_processing),
            "sync" => Some(&mut self.sync),
            _ => None,
        }
    }

    /// Apply the user's choices; returns the features turned off by them.
    /// Saving any choice records consent under the current version.
    pub fn apply(&mut self, choices: &serde_json::Map<String, Value>, now: u64) -> Result<Vec<String>, String> {
        let mut turned_off = Vec::new();
        for (id, value) in choices {
            let enabled = value.as_bool().ok_or_else(|| format!("{id} must be true or false"))?;
            let was_decided = self.decided();
            let before = self.slot(id).map(|s| *s).ok_or_else(|| format!("unknown privacy control: {id}"))? && was_decided;
            if let Some(slot) = self.slot(id) {
                *slot = enabled;
            }
            if before != enabled || !was_decided {
                self.log.push(Change { at: now, feature: id.clone(), enabled });
            }
            if before && !enabled {
                turned_off.push(id.clone());
            }
        }
        if self.consent_version != CONSENT_VERSION {
            // choices made under an older version do not carry over
            for (_, id, ..) in FEATURES {
                if !choices.contains_key(*id) {
                    if let Some(slot) = self.slot(id) {
                        *slot = false;
                    }
                }
            }
        }
        self.consent_version = CONSENT_VERSION;
        self.decided_at = Some(now);
        if self.log.len() > MAX_LOG {
            let extra = self.log.len() - MAX_LOG;
            self.log.drain(0..extra);
        }
        Ok(turned_off)
    }
}

pub fn load_at(path: &Path) -> Settings {
    std::fs::read_to_string(path).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default()
}

pub fn save_at(path: &Path, settings: &Settings) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let staged = path.with_extension("json.new");
    std::fs::write(&staged, serde_json::to_string_pretty(settings).unwrap_or_default()).map_err(|e| e.to_string())?;
    std::fs::rename(&staged, path).map_err(|e| e.to_string())
}

/// The settings as the settings screen shows them.
pub fn describe(settings: &Settings) -> Value {
    json!({
        "consentVersion": CONSENT_VERSION,
        "decided": settings.decided(),
        "decidedAt": settings.decided_at,
        "features": FEATURES.iter().map(|(feature, id, label, sends)| json!({
            "id": id, "label": label, "sends": sends, "enabled": settings.allows(*feature)
        })).collect::<Vec<_>>(),
        "log": settings.log.iter().rev().take(20).collect::<Vec<_>>(),
    })
}

/// What a command says when a control is off. Pages match `PRIVACY_OFF:<id>`.
pub fn refusal(feature: Feature) -> String {
    format!("{} is off in Privacy settings (PRIVACY_OFF:{}). Turn it on there to use this.", label_of(feature), id_of(feature))
}

#[cfg(test)]
mod privacy_tests {
    use super::*;

    fn choices(pairs: &[(&str, bool)]) -> serde_json::Map<String, Value> {
        pairs.iter().map(|(k, v)| (k.to_string(), json!(v))).collect()
    }

    #[test]
    fn everything_is_off_until_the_user_decides() {
        let settings = Settings::default();
        assert!(!settings.decided());
        for (feature, ..) in FEATURES {
            assert!(!settings.allows(*feature));
        }
    }

    #[test]
    fn each_control_is_separate_and_changes_are_logged() {
        let mut settings = Settings::default();
        settings.apply(&choices(&[("history_access", true), ("cloud_scanning", false)]), 1).unwrap();
        assert!(settings.allows(Feature::HistoryAccess));
        assert!(!settings.allows(Feature::CloudScanning));
        assert!(!settings.allows(Feature::Sync));
        let off = settings.apply(&choices(&[("history_access", false)]), 2).unwrap();
        assert_eq!(off, vec!["history_access".to_string()]);
        assert_eq!(settings.log.iter().map(|c| (c.feature.as_str(), c.enabled, c.at)).collect::<Vec<_>>(),
                   vec![("cloud_scanning", false, 1), ("history_access", true, 1), ("history_access", false, 2)]); // one save is logged in key order
    }

    #[test]
    fn a_new_consent_version_asks_again() {
        let mut settings = Settings::default();
        settings.apply(&choices(&[("sync", true)]), 1).unwrap();
        settings.consent_version = CONSENT_VERSION - 1 + 100; // as if decided under another version
        assert!(!settings.allows(Feature::Sync));
        settings.apply(&choices(&[("history_access", true)]), 2).unwrap();
        assert!(settings.allows(Feature::HistoryAccess));
        assert!(!settings.allows(Feature::Sync), "an earlier choice does not carry over to a new version");
    }

    #[test]
    fn unknown_controls_and_non_booleans_are_refused() {
        let mut settings = Settings::default();
        assert!(settings.apply(&choices(&[("upload_everything", true)]), 1).is_err());
        let mut bad = serde_json::Map::new();
        bad.insert("sync".into(), json!("yes"));
        assert!(settings.apply(&bad, 1).is_err());
    }

    #[test]
    fn choices_survive_a_restart() {
        let dir = std::env::temp_dir().join(format!("cf-privacy-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let path = dir.join("privacy.json");
        let mut settings = Settings::default();
        settings.apply(&choices(&[("cloud_scanning", true)]), 5).unwrap();
        save_at(&path, &settings).unwrap();
        assert_eq!(load_at(&path), settings);
        assert!(load_at(&path).allows(Feature::CloudScanning));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
