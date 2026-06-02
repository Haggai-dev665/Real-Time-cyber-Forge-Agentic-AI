// Browser Intelligence Engine
// Tracks browser sessions, detects behavioral patterns, computes behavioral risk scores.
//
// Layered on top of the existing url_monitor.rs — does NOT replace it.
// Uses deterministic logic only — NO AI for detection or scoring.
//
// Privacy-first: only processes URLs/domains already captured by url_monitor.
// No page content, cookies, or browsing history access.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use url::Url;

// ──────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BehavioralWeights {
    pub domain_switch_rate: f64,
    pub redirect_count: f64,
    pub suspicious_tld: f64,
    pub ml_risk_average: f64,
    pub http_downgrade: f64,
    pub rapid_switch_bonus: f64,
}

impl Default for BehavioralWeights {
    fn default() -> Self {
        Self {
            domain_switch_rate: 15.0,
            redirect_count: 10.0,
            suspicious_tld: 20.0,
            ml_risk_average: 30.0,
            http_downgrade: 15.0,
            rapid_switch_bonus: 10.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntelligenceConfig {
    pub weights: BehavioralWeights,
    pub rapid_switch_threshold: usize,     // domains in window
    pub rapid_switch_window_secs: u64,     // time window
    pub alert_threshold: f64,              // 0-100, emit alert above this
    pub max_domain_history: usize,
    pub suspicious_tlds: Vec<String>,
    pub session_timeout_secs: u64,         // session expires after inactivity
}

impl Default for IntelligenceConfig {
    fn default() -> Self {
        Self {
            weights: BehavioralWeights::default(),
            rapid_switch_threshold: 3,
            rapid_switch_window_secs: 15,
            alert_threshold: 40.0,
            max_domain_history: 200,
            session_timeout_secs: 1800, // 30 minutes
            suspicious_tlds: vec![
                ".zip".into(), ".top".into(), ".xyz".into(), ".tk".into(),
                ".ml".into(), ".ga".into(), ".cf".into(), ".gq".into(),
                ".buzz".into(), ".icu".into(), ".cam".into(), ".rest".into(),
                ".quest".into(), ".surf".into(), ".click".into(), ".loan".into(),
                ".racing".into(), ".win".into(), ".bid".into(), ".stream".into(),
                ".download".into(), ".review".into(), ".cricket".into(),
                ".science".into(), ".party".into(), ".date".into(),
            ],
        }
    }
}

// ──────────────────────────────────────────────
// Session State
// ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DomainVisit {
    pub domain: String,
    pub protocol: String,
    pub timestamp: String,
    pub timestamp_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionState {
    pub session_id: String,
    pub browser: String,
    pub browser_key: String,
    pub start_time: String,
    pub start_time_ms: u64,
    pub last_activity: String,
    pub last_url: String,
    pub last_domain: String,
    pub last_protocol: String,
    pub domain_history: Vec<DomainVisit>,
    pub unique_domains: Vec<String>,
    pub redirect_count: u32,
    pub suspicious_flags: Vec<String>,
    pub cumulative_ml_risk: f64,
    pub ml_risk_samples: u32,
    pub behavioral_score: f64,
    pub session_duration_secs: u64,
    pub domain_switch_count: u32,
    pub http_downgrade_count: u32,
    pub rapid_switch_detected: bool,
}

// Internal tracking not exposed via serialization
struct SessionInternal {
    state: SessionState,
    last_activity_instant: Instant,
    domain_timestamps: Vec<(String, Instant)>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BehavioralAlert {
    pub alert_id: String,
    pub session_id: String,
    pub browser: String,
    pub domain: String,
    pub reason: String,
    pub risk_score: f64,
    pub flags: Vec<String>,
    pub timestamp: String,
    pub details: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IntelligenceSnapshot {
    pub sessions: Vec<SessionState>,
    pub alerts: Vec<BehavioralAlert>,
    pub total_domains_visited: usize,
    pub total_alerts: usize,
    pub average_behavioral_score: f64,
    pub timestamp: String,
}

// ──────────────────────────────────────────────
// Engine
// ──────────────────────────────────────────────

pub struct BrowserIntelligenceEngine {
    sessions: HashMap<String, SessionInternal>,
    alerts: Vec<BehavioralAlert>,
    config: IntelligenceConfig,
}

impl BrowserIntelligenceEngine {
    pub fn new(config: IntelligenceConfig) -> Self {
        Self {
            sessions: HashMap::new(),
            alerts: Vec::new(),
            config,
        }
    }

    /// Process a URL observation from url_monitor.
    /// Returns any new alerts generated by this observation.
    pub fn process_url(
        &mut self,
        browser: &str,
        browser_key: &str,
        url_str: &str,
        title: &str,
    ) -> Vec<BehavioralAlert> {
        let now = Instant::now();
        let now_utc = chrono::Utc::now();
        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        // Parse URL for domain and protocol
        let parsed = match Url::parse(url_str) {
            Ok(u) => u,
            Err(_) => return vec![],
        };
        let domain = parsed.host_str().unwrap_or("unknown").to_string();
        let protocol = parsed.scheme().to_string();

        // Get or create session
        let session_key = browser_key.to_string();
        if !self.sessions.contains_key(&session_key) {
            let session_id = format!("{}_{}", browser_key, now_ms);
            let session = SessionState {
                session_id: session_id.clone(),
                browser: browser.to_string(),
                browser_key: browser_key.to_string(),
                start_time: now_utc.to_rfc3339(),
                start_time_ms: now_ms,
                last_activity: now_utc.to_rfc3339(),
                last_url: url_str.to_string(),
                last_domain: domain.clone(),
                last_protocol: protocol.clone(),
                domain_history: vec![],
                unique_domains: vec![],
                redirect_count: 0,
                suspicious_flags: vec![],
                cumulative_ml_risk: 0.0,
                ml_risk_samples: 0,
                behavioral_score: 0.0,
                session_duration_secs: 0,
                domain_switch_count: 0,
                http_downgrade_count: 0,
                rapid_switch_detected: false,
            };
            self.sessions.insert(
                session_key.clone(),
                SessionInternal {
                    state: session,
                    last_activity_instant: now,
                    domain_timestamps: vec![],
                },
            );
        }

        let internal = self.sessions.get_mut(&session_key).unwrap();
        let s = &mut internal.state;

        // Check for session timeout — reset if inactive too long
        if now.duration_since(internal.last_activity_instant)
            > Duration::from_secs(self.config.session_timeout_secs)
        {
            let new_session_id = format!("{}_{}", browser_key, now_ms);
            s.session_id = new_session_id;
            s.start_time = now_utc.to_rfc3339();
            s.start_time_ms = now_ms;
            s.domain_history.clear();
            s.unique_domains.clear();
            s.redirect_count = 0;
            s.suspicious_flags.clear();
            s.cumulative_ml_risk = 0.0;
            s.ml_risk_samples = 0;
            s.behavioral_score = 0.0;
            s.domain_switch_count = 0;
            s.http_downgrade_count = 0;
            s.rapid_switch_detected = false;
            internal.domain_timestamps.clear();
        }

        internal.last_activity_instant = now;
        let prev_domain = s.last_domain.clone();
        let prev_protocol = s.last_protocol.clone();

        // Update session state
        s.last_activity = now_utc.to_rfc3339();
        s.last_url = url_str.to_string();
        s.last_domain = domain.clone();
        s.last_protocol = protocol.clone();
        s.session_duration_secs = now_ms.saturating_sub(s.start_time_ms) / 1000;

        // Track domain visit
        let visit = DomainVisit {
            domain: domain.clone(),
            protocol: protocol.clone(),
            timestamp: now_utc.to_rfc3339(),
            timestamp_ms: now_ms,
        };
        s.domain_history.push(visit);
        if s.domain_history.len() > self.config.max_domain_history {
            s.domain_history.remove(0);
        }

        // Track unique domains
        if !s.unique_domains.contains(&domain) {
            s.unique_domains.push(domain.clone());
        }

        // Track domain timestamps for rapid-switch detection
        internal.domain_timestamps.push((domain.clone(), now));
        // Prune old timestamps outside the window
        let window_duration = Duration::from_secs(self.config.rapid_switch_window_secs);
        internal
            .domain_timestamps
            .retain(|(_, ts)| now.duration_since(*ts) <= window_duration);

        // ── Behavioral Pattern Detection ──────────────────────────────
        let mut new_alerts: Vec<BehavioralAlert> = vec![];

        // 1. Domain switch detection
        if !prev_domain.is_empty() && prev_domain != domain {
            s.domain_switch_count += 1;
        }

        // 2. Rapid domain switching (>= N unique domains in < window seconds)
        let recent_unique: Vec<&String> = {
            let mut seen = vec![];
            for (d, _) in internal.domain_timestamps.iter() {
                if !seen.contains(&d) {
                    seen.push(d);
                }
            }
            seen
        };
        if recent_unique.len() >= self.config.rapid_switch_threshold {
            if !s.rapid_switch_detected {
                s.rapid_switch_detected = true;
                let flag = format!(
                    "Rapid domain switching: {} domains in {}s",
                    recent_unique.len(),
                    self.config.rapid_switch_window_secs
                );
                if !s.suspicious_flags.contains(&flag) {
                    s.suspicious_flags.push(flag.clone());
                }
                let mut details = HashMap::new();
                details.insert(
                    "domains".to_string(),
                    recent_unique.iter().map(|d| d.as_str()).collect::<Vec<_>>().join(", "),
                );
                details.insert(
                    "count".to_string(),
                    recent_unique.len().to_string(),
                );
                new_alerts.push(BehavioralAlert {
                    alert_id: format!("ba_rapid_{}", now_ms),
                    session_id: s.session_id.clone(),
                    browser: s.browser.clone(),
                    domain: domain.clone(),
                    reason: flag,
                    risk_score: 0.0, // Will be computed below
                    flags: s.suspicious_flags.clone(),
                    timestamp: now_utc.to_rfc3339(),
                    details,
                });
            }
        } else {
            // Reset rapid switch flag when below threshold
            s.rapid_switch_detected = false;
        }

        // 3. Suspicious TLD detection
        let has_suspicious_tld = self
            .config
            .suspicious_tlds
            .iter()
            .any(|tld| domain.ends_with(tld.as_str()));
        if has_suspicious_tld {
            let flag = format!("Suspicious TLD: {}", domain);
            if !s.suspicious_flags.contains(&flag) {
                s.suspicious_flags.push(flag.clone());
                let mut details = HashMap::new();
                details.insert("domain".to_string(), domain.clone());
                new_alerts.push(BehavioralAlert {
                    alert_id: format!("ba_tld_{}", now_ms),
                    session_id: s.session_id.clone(),
                    browser: s.browser.clone(),
                    domain: domain.clone(),
                    reason: flag,
                    risk_score: 0.0,
                    flags: s.suspicious_flags.clone(),
                    timestamp: now_utc.to_rfc3339(),
                    details,
                });
            }
        }

        // 4. HTTP downgrade detection (was HTTPS, now HTTP)
        if prev_protocol == "https" && protocol == "http" {
            s.http_downgrade_count += 1;
            let flag = format!(
                "HTTP downgrade: {} → {} ({})",
                prev_domain, domain, protocol
            );
            if !s.suspicious_flags.contains(&flag) {
                s.suspicious_flags.push(flag.clone());
                let mut details = HashMap::new();
                details.insert("from_domain".to_string(), prev_domain.clone());
                details.insert("to_domain".to_string(), domain.clone());
                details.insert("previous_protocol".to_string(), "https".to_string());
                new_alerts.push(BehavioralAlert {
                    alert_id: format!("ba_downgrade_{}", now_ms),
                    session_id: s.session_id.clone(),
                    browser: s.browser.clone(),
                    domain: domain.clone(),
                    reason: flag,
                    risk_score: 0.0,
                    flags: s.suspicious_flags.clone(),
                    timestamp: now_utc.to_rfc3339(),
                    details,
                });
            }
        }

        // 5. Redirect chain detection (same browser rapid domain changes in very short time)
        let very_recent: Vec<&(String, Instant)> = internal
            .domain_timestamps
            .iter()
            .filter(|(_, ts)| now.duration_since(*ts) <= Duration::from_secs(3))
            .collect();
        if very_recent.len() >= 3 {
            s.redirect_count += 1;
            let flag = format!(
                "Redirect chain: {} hops in 3s",
                very_recent.len()
            );
            if !s.suspicious_flags.contains(&flag) {
                s.suspicious_flags.push(flag.clone());
            }
        }

        // ── Compute Behavioral Risk Score ─────────────────────────────
        let w = &self.config.weights;
        let session_mins = (s.session_duration_secs as f64 / 60.0).max(0.5);
        let domain_switch_rate = s.domain_switch_count as f64 / session_mins;
        let redirect_factor = (s.redirect_count as f64).min(10.0) / 10.0;
        let tld_factor = if has_suspicious_tld { 1.0 } else { 0.0 };
        let ml_avg = if s.ml_risk_samples > 0 {
            s.cumulative_ml_risk / s.ml_risk_samples as f64
        } else {
            0.0
        };
        let ml_factor = ml_avg / 100.0; // normalize 0-100 → 0-1
        let downgrade_factor = (s.http_downgrade_count as f64).min(5.0) / 5.0;
        let rapid_switch_factor = if s.rapid_switch_detected { 1.0 } else { 0.0 };

        let raw_score = (domain_switch_rate.min(5.0) / 5.0 * w.domain_switch_rate)
            + (redirect_factor * w.redirect_count)
            + (tld_factor * w.suspicious_tld)
            + (ml_factor * w.ml_risk_average)
            + (downgrade_factor * w.http_downgrade)
            + (rapid_switch_factor * w.rapid_switch_bonus);

        s.behavioral_score = raw_score.min(100.0).max(0.0);

        // Update alert risk scores
        for alert in &mut new_alerts {
            alert.risk_score = s.behavioral_score;
        }

        // Check alert threshold
        if s.behavioral_score >= self.config.alert_threshold && new_alerts.is_empty() {
            // Score crossed threshold but no specific pattern alert — emit generic
            let mut details = HashMap::new();
            details.insert("behavioral_score".to_string(), format!("{:.1}", s.behavioral_score));
            details.insert("domain_switch_rate".to_string(), format!("{:.2}/min", domain_switch_rate));
            details.insert("redirect_count".to_string(), s.redirect_count.to_string());
            details.insert("ml_risk_avg".to_string(), format!("{:.1}", ml_avg));

            new_alerts.push(BehavioralAlert {
                alert_id: format!("ba_threshold_{}", now_ms),
                session_id: s.session_id.clone(),
                browser: s.browser.clone(),
                domain: domain.clone(),
                reason: format!(
                    "Behavioral risk threshold exceeded: {:.1}/100",
                    s.behavioral_score
                ),
                risk_score: s.behavioral_score,
                flags: s.suspicious_flags.clone(),
                timestamp: now_utc.to_rfc3339(),
                details,
            });
        }

        // Store alerts
        self.alerts.extend(new_alerts.clone());
        // Cap stored alerts
        if self.alerts.len() > 500 {
            self.alerts.drain(0..self.alerts.len() - 500);
        }

        new_alerts
    }

    /// Feed ML risk score from scan results back into the session.
    pub fn feed_ml_risk(&mut self, browser_key: &str, risk_score: f64) {
        if let Some(internal) = self.sessions.get_mut(browser_key) {
            internal.state.cumulative_ml_risk += risk_score;
            internal.state.ml_risk_samples += 1;
        }
    }

    /// Get a snapshot of all current sessions and recent alerts.
    pub fn snapshot(&self) -> IntelligenceSnapshot {
        let sessions: Vec<SessionState> = self
            .sessions
            .values()
            .map(|i| i.state.clone())
            .collect();

        let total_domains: usize = sessions.iter().map(|s| s.unique_domains.len()).sum();
        let avg_score = if sessions.is_empty() {
            0.0
        } else {
            sessions.iter().map(|s| s.behavioral_score).sum::<f64>() / sessions.len() as f64
        };

        IntelligenceSnapshot {
            sessions,
            alerts: self.alerts.clone(),
            total_domains_visited: total_domains,
            total_alerts: self.alerts.len(),
            average_behavioral_score: (avg_score * 10.0).round() / 10.0,
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }

    /// Get recent alerts only (since given timestamp ms).
    pub fn recent_alerts(&self, since_ms: u64) -> Vec<&BehavioralAlert> {
        self.alerts
            .iter()
            .filter(|a| {
                chrono::DateTime::parse_from_rfc3339(&a.timestamp)
                    .map(|dt| dt.timestamp_millis() as u64 >= since_ms)
                    .unwrap_or(false)
            })
            .collect()
    }

    /// Get a specific session.
    pub fn get_session(&self, browser_key: &str) -> Option<&SessionState> {
        self.sessions.get(browser_key).map(|i| &i.state)
    }

    /// Prune expired sessions.
    pub fn prune_expired(&mut self) {
        let now = Instant::now();
        let timeout = Duration::from_secs(self.config.session_timeout_secs);
        self.sessions
            .retain(|_, internal| now.duration_since(internal.last_activity_instant) <= timeout);
    }

    /// Get config.
    pub fn config(&self) -> &IntelligenceConfig {
        &self.config
    }

    /// Update config.
    pub fn update_config(&mut self, config: IntelligenceConfig) {
        self.config = config;
    }
}

// ──────────────────────────────────────────────
// Global singleton (thread-safe)
// ──────────────────────────────────────────────

lazy_static::lazy_static! {
    static ref INTELLIGENCE_ENGINE: Mutex<BrowserIntelligenceEngine> = {
        // Try loading config from file, fall back to defaults
        let config = load_config().unwrap_or_default();
        Mutex::new(BrowserIntelligenceEngine::new(config))
    };
}

fn load_config() -> Option<IntelligenceConfig> {
    let config_paths = [
        "browser_intelligence_config.json",
        "config/browser_intelligence.json",
        "../config/browser_intelligence.json",
    ];
    for path in &config_paths {
        if let Ok(content) = std::fs::read_to_string(path) {
            if let Ok(config) = serde_json::from_str::<IntelligenceConfig>(&content) {
                return Some(config);
            }
        }
    }
    None
}

// ──────────────────────────────────────────────
// Public API (called from commands.rs)
// ──────────────────────────────────────────────

/// Process a URL observation and return any new behavioral alerts.
pub fn process_url_observation(
    browser: &str,
    browser_key: &str,
    url: &str,
    title: &str,
) -> Vec<BehavioralAlert> {
    let mut engine = INTELLIGENCE_ENGINE.lock().unwrap();
    engine.process_url(browser, browser_key, url, title)
}

/// Feed ML risk score from scan pipeline results.
pub fn feed_ml_risk_score(browser_key: &str, risk_score: f64) {
    let mut engine = INTELLIGENCE_ENGINE.lock().unwrap();
    engine.feed_ml_risk(browser_key, risk_score);
}

/// Get full intelligence snapshot.
pub fn get_intelligence_snapshot() -> IntelligenceSnapshot {
    let engine = INTELLIGENCE_ENGINE.lock().unwrap();
    engine.snapshot()
}

/// Get intelligence config.
pub fn get_intelligence_config() -> IntelligenceConfig {
    let engine = INTELLIGENCE_ENGINE.lock().unwrap();
    engine.config().clone()
}

/// Update intelligence config.
pub fn update_intelligence_config(config: IntelligenceConfig) {
    let mut engine = INTELLIGENCE_ENGINE.lock().unwrap();
    engine.update_config(config);
}

/// Prune expired sessions.
pub fn prune_expired_sessions() {
    let mut engine = INTELLIGENCE_ENGINE.lock().unwrap();
    engine.prune_expired();
}
