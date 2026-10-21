//! Text output. Every value that came from elsewhere was made printable by the
//! core (`text::printable`) before it reaches here.

use cyberforge_core::status::{Backend, CredentialStore, DesktopBroker, Session, StatusReport};

pub fn status(report: &StatusReport) -> String {
    let backend = match &report.backend {
        Backend::Reachable { http_status, service_status, latency_ms } => format!(
            "reachable (HTTP {}, {}, {} ms)",
            http_status,
            service_status.as_deref().unwrap_or("no status given"),
            latency_ms
        ),
        Backend::Unhealthy { detail, latency_ms, .. } => format!("answered but not healthy: {} ({} ms)", detail, latency_ms),
        Backend::Unreachable { error } => format!("unreachable: {}", error),
    };
    let store = match &report.credential_store {
        CredentialStore::Available => "system credential store available".to_string(),
        CredentialStore::Unavailable { error } => format!("system credential store unavailable: {}", error),
    };
    let session = match &report.session {
        Session::SignedOut => "signed out (sign in with: cyberforge auth login)".to_string(),
        Session::Valid { email, user_id } => format!(
            "signed in as {}",
            email.as_deref().or(user_id.as_deref()).unwrap_or("an account the backend did not name")
        ),
        Session::Rejected { http_status } => format!("refused by the backend (HTTP {}); sign in again", http_status),
        Session::Unverified { reason } => format!("kept, not checked: {}", reason),
        Session::Unknown => "unknown: the credential store could not be read".to_string(),
    };
    let broker = match &report.desktop_broker {
        DesktopBroker::Attached { owner, version, pid, owns } if owns.is_empty() => {
            format!("{} {} (process {}) holds this computer's state and runs nothing on it", owner, version, pid)
        }
        DesktopBroker::Attached { owner, version, pid, owns } => {
            format!("{} {} (process {}) owns this computer's state: {}", owner, version, pid, owns.join(", "))
        }
        DesktopBroker::NotRunning => "not running: no CyberForge program owns this computer's state".to_string(),
        DesktopBroker::Untrusted { reason } => format!("not trusted: {}", reason),
        DesktopBroker::NotAvailable { reason } => format!("not available: {}", reason),
    };
    format!(
        "Profile      {}\nBackend      {}\n             {}\nCredentials  {}\nSession      {}\nDesktop      {}",
        report.profile, report.origin, backend, store, session, broker
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_part_is_stated() {
        let report = StatusReport {
            profile: "default".into(),
            origin: "https://example.com".into(),
            backend: Backend::Unreachable { error: "connection refused".into() },
            credential_store: CredentialStore::Unavailable { error: "locked".into() },
            session: Session::Unknown,
            desktop_broker: DesktopBroker::NotAvailable { reason: "no broker".into() },
        };
        let text = status(&report);
        for part in ["default", "https://example.com", "unreachable: connection refused", "unavailable: locked", "unknown", "not available: no broker"] {
            assert!(text.contains(part), "{part} missing from {text}");
        }
    }
}
