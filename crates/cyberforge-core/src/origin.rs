//! Backend origins.
//!
//! An origin is a scheme, host and port, nothing else. It must be HTTPS, or
//! plain HTTP to this computer for development. Credentials, paths, queries and
//! fragments are refused, so a session token can be bound to exactly one origin
//! and is never sent somewhere a typo or a pasted link points.

use reqwest::Url;
use serde::Serialize;
use std::fmt;

/// The deployed CyberForge backend.
pub const DEFAULT_BACKEND_URL: &str = "https://cyberforge-f3249b5a0919.herokuapp.com";

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(transparent)]
pub struct Origin(String);

impl Origin {
    /// The deployed backend.
    pub fn default_backend() -> Origin {
        Origin(DEFAULT_BACKEND_URL.to_string())
    }

    /// Parse and normalise an origin. The error never repeats the input, which
    /// may hold a password.
    pub fn parse(input: &str) -> Result<Origin, String> {
        const RULE: &str = "A backend origin is https://host[:port] (or http:// to localhost), with no user name, password, path, query or fragment.";
        let url = Url::parse(input.trim()).map_err(|_| RULE.to_string())?;
        let loopback = matches!(url.host_str(), Some("localhost") | Some("127.0.0.1") | Some("[::1]"));
        let scheme_ok = url.scheme() == "https" || (url.scheme() == "http" && loopback);
        let bare = url.username().is_empty()
            && url.password().is_none()
            && matches!(url.path(), "" | "/")
            && url.query().is_none()
            && url.fragment().is_none();
        if !scheme_ok || !bare || url.host_str().is_none() {
            return Err(RULE.to_string());
        }
        Ok(Origin(url.origin().ascii_serialization()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// A URL on this origin. `path` must start with `/`.
    pub fn join(&self, path: &str) -> String {
        debug_assert!(path.starts_with('/'));
        format!("{}{}", self.0, path)
    }
}

impl fmt::Display for Origin {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn https_origins_are_normalised() {
        assert_eq!(Origin::parse(" https://Example.COM/ ").unwrap().as_str(), "https://example.com");
        assert_eq!(Origin::parse("https://example.com:8443").unwrap().as_str(), "https://example.com:8443");
        assert_eq!(Origin::parse("https://example.com:443").unwrap().as_str(), "https://example.com");
        assert_eq!(Origin::default_backend().as_str(), DEFAULT_BACKEND_URL);
    }

    #[test]
    fn plain_http_only_to_this_computer() {
        assert_eq!(Origin::parse("http://127.0.0.1:8000").unwrap().as_str(), "http://127.0.0.1:8000");
        assert_eq!(Origin::parse("http://localhost:8000/").unwrap().as_str(), "http://localhost:8000");
        assert!(Origin::parse("http://[::1]:8000").is_ok());
        assert!(Origin::parse("http://example.com").is_err());
        assert!(Origin::parse("http://192.168.1.10:8000").is_err());
    }

    #[test]
    fn anything_beyond_an_origin_is_refused_without_being_repeated() {
        for input in [
            "https://user:secret@example.com", "https://example.com/api", "https://example.com/?token=secret",
            "https://example.com/#secret", "ftp://example.com", "file:///secret", "example.com", "", "https://",
        ] {
            let error = Origin::parse(input).expect_err(input);
            assert!(!error.contains("secret"), "{input}");
        }
    }

    #[test]
    fn join_appends_a_path() {
        assert_eq!(Origin::parse("https://example.com").unwrap().join("/health"), "https://example.com/health");
    }
}
