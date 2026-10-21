//! `cyberforge auth login | status | logout`.
//!
//! The password never comes from an argument: it is read hidden from the
//! terminal, or from the first line of standard input with `--password-stdin`.
//! Without a terminal and without that flag, sign-in fails instead of
//! prompting. The session token is kept only in the credential store and is
//! never printed.

use crate::out::{exit, Outcome};
use crate::Ctx;
use cyberforge_core::session::{self, LoginError};
use cyberforge_core::status::{self, Session};
use serde_json::json;
use std::io::{BufRead, IsTerminal, Write};

fn valid_email(email: &str) -> bool {
    email.len() <= 254 && email.contains('@') && !email.starts_with('@') && !email.ends_with('@') && !email.chars().any(|c| c.is_whitespace() || c.is_control())
}

fn read_line(prompt: Option<&str>) -> Option<String> {
    if let Some(prompt) = prompt {
        eprint!("{}", prompt);
        let _ = std::io::stderr().flush();
    }
    let mut line = String::new();
    std::io::stdin().lock().read_line(&mut line).ok()?;
    Some(line.trim_end_matches(['\r', '\n']).to_string())
}

pub async fn login(ctx: &Ctx, email: Option<&str>, password_stdin: bool) -> Outcome {
    const CMD: &str = "auth login";
    let profile = match ctx.profile(CMD) {
        Ok(profile) => profile,
        Err(outcome) => return outcome,
    };
    let terminal = !ctx.non_interactive && std::io::stdin().is_terminal();
    let email = match email {
        Some(email) => email.trim().to_string(),
        None if terminal && !password_stdin => read_line(Some("Email: ")).unwrap_or_default().trim().to_string(),
        None => return Outcome::failed(CMD, exit::USAGE, "EMAIL_REQUIRED", "Give --email: it cannot be asked for without a terminal or when the password comes from standard input."),
    };
    if !valid_email(&email) {
        return Outcome::failed(CMD, exit::USAGE, "EMAIL_INVALID", "That is not an email address.");
    }
    let password = if password_stdin {
        read_line(None).unwrap_or_default()
    } else if terminal {
        rpassword::prompt_password("Password: ").unwrap_or_default()
    } else {
        return Outcome::failed(CMD, exit::USAGE, "PASSWORD_REQUIRED", "No password: pass --password-stdin and send it on standard input, or run in a terminal.");
    };
    if password.is_empty() {
        return Outcome::failed(CMD, exit::USAGE, "PASSWORD_REQUIRED", "The password was empty.");
    }

    let signed_in = session::login(&profile, &ctx.client(), &email, &password).await;
    drop(password);
    let signed_in = match signed_in {
        Ok(signed_in) => signed_in,
        Err(LoginError::Rejected(message)) => return Outcome::failed(CMD, exit::AUTH, "AUTH_REJECTED", format!("The backend refused the sign-in: {}.", message)),
        Err(LoginError::Invalid(message)) => return Outcome::failed(CMD, exit::USAGE, "INVALID", format!("The backend refused the input: {}.", message)),
        Err(LoginError::RateLimited) => return Outcome::failed(CMD, exit::UNAVAILABLE, "RATE_LIMITED", "Too many sign-in attempts; wait a few minutes and try again."),
        Err(LoginError::Unavailable(detail)) => return Outcome::failed(CMD, exit::UNAVAILABLE, "UNAVAILABLE", format!("The backend at {} did not answer: {}", profile.origin, detail)),
        Err(LoginError::Unexpected(detail)) => return Outcome::failed(CMD, exit::FAILURE, "UNEXPECTED", detail),
    };
    if let Err(error) = session::keep(&ctx.store(), &profile, &signed_in) {
        return Outcome::failed(
            CMD,
            exit::FAILURE,
            "SESSION_NOT_KEPT",
            format!("Signed in, but the session could not be kept in the system credential store ({}). Nothing was saved anywhere else.", error),
        );
    }
    let who = signed_in.account.email.clone().or(signed_in.account.user_id.clone()).unwrap_or_else(|| "your account".into());
    Outcome::done(
        CMD,
        json!({ "profile": profile.name, "origin": profile.origin, "account": signed_in.account, "session_kept": true }),
        format!("Signed in to {} as {} (profile {}). The session is kept in the system credential store.", profile.origin, who, profile.name),
    )
}

pub async fn status(ctx: &Ctx) -> Outcome {
    const CMD: &str = "auth status";
    let profile = match ctx.profile(CMD) {
        Ok(profile) => profile,
        Err(outcome) => return outcome,
    };
    let report = status::check(&profile, &ctx.store(), &ctx.client()).await;
    let (code, text) = match &report.session {
        Session::Valid { email, user_id } => (exit::OK, format!("Signed in as {} (profile {}, {}).", email.as_deref().or(user_id.as_deref()).unwrap_or("an unnamed account"), profile.name, profile.origin)),
        Session::SignedOut => (exit::AUTH, format!("Not signed in (profile {}, {}).", profile.name, profile.origin)),
        Session::Rejected { http_status } => (exit::AUTH, format!("The backend refused the kept session (HTTP {}); sign in again.", http_status)),
        Session::Unverified { reason } => (exit::UNAVAILABLE, format!("A session is kept but could not be checked: {}.", reason)),
        Session::Unknown => (exit::FAILURE, "The system credential store could not be read.".to_string()),
    };
    let data = json!({ "profile": profile.name, "origin": profile.origin, "session": report.session, "credential_store": report.credential_store });
    Outcome { command: CMD, code, data, error: None, warnings: report.warnings(), text }
}

pub async fn logout(ctx: &Ctx) -> Outcome {
    const CMD: &str = "auth logout";
    let profile = match ctx.profile(CMD) {
        Ok(profile) => profile,
        Err(outcome) => return outcome,
    };
    let result = match session::logout(&ctx.store(), &profile, &ctx.client()).await {
        Ok(result) => result,
        Err(error) => return Outcome::failed(CMD, exit::FAILURE, "STORE_UNAVAILABLE", format!("The system credential store could not be used: {}", error)),
    };
    if !result.removed {
        return Outcome::failed(CMD, exit::FAILURE, "NOT_REMOVED", "The session is still in the system credential store after removing it.");
    }
    let text = if !result.was_signed_in {
        format!("Profile {} was not signed in; nothing to remove.", profile.name)
    } else {
        format!(
            "Signed out of profile {}: the session was removed from this computer. The backend {}. It cannot revoke session tokens yet, so the old token stays valid until it expires.",
            profile.name,
            if result.backend_acknowledged { "acknowledged the sign-out and ended the account's live streams" } else { "did not answer" }
        )
    };
    let mut outcome = Outcome::done(CMD, json!({ "profile": profile.name, "origin": profile.origin, "result": result }), text);
    if result.was_signed_in {
        outcome.warnings.push("The backend cannot revoke session tokens yet; the removed token stays valid until it expires.".into());
    }
    outcome
}

#[cfg(test)]
mod tests {
    use super::valid_email;

    #[test]
    fn emails_are_checked_for_shape_only() {
        assert!(valid_email("a@example.com"));
        for bad in ["", "a", "@example.com", "a@", "a b@example.com", "a@example.com\u{1b}"] {
            assert!(!valid_email(bad), "{bad:?}");
        }
    }
}
