//! Removing credentials from an address (SEC-07).
//!
//! The same rules as the backend's `redactUrl` (backend/src/utils/redactUrl.js)
//! and the phone's (mobile-app/src/utils/redact.ts), held to the same examples
//! (backend/tests/security/fixtures/redact-url-vectors.json):
//!   - a query or fragment parameter whose name says it is a credential or a
//!     one-time code;
//!   - any value shaped like a token whatever it is called (a JWT, or a long
//!     unbroken run of letters and digits; text with spaces does not count);
//!   - such a token used as a path segment;
//!   - `user:password@` in the address.
//! Used by the desktop for browser history and scans, and by the CLI before it
//! sends an address anywhere.

pub const REDACTED: &str = "[redacted]";

/// Whether a query parameter's name says its value is a credential or a
/// one-time code.
pub fn is_secret_parameter(name: &str) -> bool {
    let n = name.to_ascii_lowercase();
    const PARTS: &[&str] = &[
        "token", "secret", "passw", "pwd", "apikey", "api_key", "session", "signature",
        "credential", "jwt", "saml", "oauth", "authorization",
    ];
    const WHOLE: &[&str] = &[
        "key", "code", "sig", "ticket", "state", "nonce", "auth", "sid", "otp", "pass", "pin",
        "code_challenge", "code_verifier", "assertion",
    ];
    PARTS.iter().any(|p| n.contains(p)) || WHOLE.contains(&n.as_str())
}

/// Whether a value looks like a credential whatever it is called: a JWT, or a
/// long unbroken run of letters and digits. Text with spaces (a search query)
/// does not count.
fn looks_like_secret(value: &str) -> bool {
    if value.starts_with("eyJ") && value.len() >= 40 && value.contains('.') {
        return true;
    }
    value.len() >= 48
        && !value.contains('+')
        && !value.contains("%20")
        && value.chars().all(|c| c.is_ascii_alphanumeric() || "_-.~%/=".contains(c))
        && value.chars().any(|c| c.is_ascii_digit())
        && value.chars().any(|c| c.is_ascii_alphabetic())
}

fn redact_pairs(pairs: &str) -> String {
    pairs
        .split('&')
        .map(|pair| match pair.split_once('=') {
            Some((name, value)) if !value.is_empty() && (is_secret_parameter(name) || looks_like_secret(value)) => {
                format!("{}={}", name, REDACTED)
            }
            _ => pair.to_string(),
        })
        .collect::<Vec<_>>()
        .join("&")
}

/// Remove credentials from an address.
///
/// A history database holds whatever was in the address bar: sign-in codes,
/// session and auto-login tokens, reset links. Those must not be written to the
/// app's files, shown in its lists, or sent to the backend to be scanned, where
/// a scanner fetching the page would be using the person's credential. The
/// host, path and ordinary parameters are kept, so the address still identifies
/// the page.
pub fn redact_url(url: &str) -> String {
    let (before_fragment, fragment) = match url.split_once('#') {
        Some((b, f)) => (b, Some(f)),
        None => (url, None),
    };
    let (location, query) = match before_fragment.split_once('?') {
        Some((l, q)) => (l, Some(q)),
        None => (before_fragment, None),
    };

    // user:password@host
    let mut out = String::with_capacity(url.len());
    let (scheme, rest) = match location.split_once("://") {
        Some((s, r)) => (Some(s), r),
        None => (None, location),
    };
    let (authority, path) = match rest.find('/') {
        Some(i) => (&rest[..i], &rest[i..]),
        None => (rest, ""),
    };
    if let Some(s) = scheme {
        out.push_str(s);
        out.push_str("://");
    }
    out.push_str(match (scheme, authority.rfind('@')) {
        (Some(_), Some(at)) => &authority[at + 1..],
        _ => authority,
    });
    // a token used as a path segment
    let segments: Vec<String> = path
        .split('/')
        .map(|seg| if looks_like_secret(seg) { REDACTED.to_string() } else { seg.to_string() })
        .collect();
    out.push_str(&segments.join("/"));

    if let Some(q) = query {
        out.push('?');
        out.push_str(&redact_pairs(q));
    }
    if let Some(f) = fragment {
        out.push('#');
        // "#access_token=…&id_token=…" is how some sign-in flows return tokens
        if f.contains('=') {
            out.push_str(&redact_pairs(f));
        } else if looks_like_secret(f) {
            out.push_str(REDACTED);
        } else {
            out.push_str(f);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::redact_url;
    use serde_json::Value;

    /// The examples every implementation must agree on.
    const VECTORS: &str = include_str!("../../../backend/tests/security/fixtures/redact-url-vectors.json");

    #[test]
    fn the_shared_examples_are_redacted_exactly() {
        let vectors: Value = serde_json::from_str(VECTORS).unwrap();
        let redacted = vectors["redacted"].as_array().unwrap();
        assert!(redacted.len() > 5);
        for pair in redacted {
            let (input, expected) = (pair[0].as_str().unwrap(), pair[1].as_str().unwrap());
            assert_eq!(redact_url(input), expected, "{input}");
        }
        for url in vectors["unchanged"].as_array().unwrap() {
            let url = url.as_str().unwrap();
            assert_eq!(redact_url(url), url);
        }
    }
}
