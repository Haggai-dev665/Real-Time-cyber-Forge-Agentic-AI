//! The pieces of the desktop's Google sign-in that protect the loopback flow
//! (RFC 8252 with PKCE, RFC 7636):
//!
//! - `state`: a random value sent with the consent request. The callback is
//!   accepted only when it brings the same value back, so a page that sends the
//!   browser to the loopback port with its own code cannot sign this app in.
//! - PKCE: a random verifier the app keeps, and its SHA-256 challenge sent with
//!   the consent request. Google gives tokens for the code only with the
//!   verifier, so a code intercepted on its way to the app is useless.

use base64::Engine;
use sha2::{Digest, Sha256};

fn b64url(bytes: &[u8]) -> String {
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}

/// `bytes` random bytes, as unpadded base64url (43 characters for 32 bytes).
pub fn random_token(bytes: usize) -> Result<String, String> {
    let mut buf = vec![0u8; bytes];
    getrandom::fill(&mut buf).map_err(|e| format!("could not make a random value: {e}"))?;
    Ok(b64url(&buf))
}

/// The S256 code challenge for a verifier.
pub fn pkce_challenge(verifier: &str) -> String {
    b64url(&Sha256::digest(verifier.as_bytes()))
}

/// Equal, in time that does not depend on where they differ.
pub fn same_secret(a: &str, b: &str) -> bool {
    let (a, b) = (a.as_bytes(), b.as_bytes());
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

/// What a request to the loopback port says.
#[derive(Debug, PartialEq)]
pub enum Callback {
    /// The consent screen's answer: a code and the state it came with.
    Code { code: String, state: String },
    /// The user refused, or Google reported an error.
    Refused(String),
    /// Anything else (a favicon request, a stray page): not the callback.
    Other,
}

/// Read the request line's path, e.g. `/?state=…&code=…`.
pub fn parse_callback(path: &str, decode: impl Fn(&str) -> String) -> Callback {
    let Some(query) = path.strip_prefix("/?") else { return Callback::Other };
    let (mut code, mut state, mut error) = (None, None, None);
    for pair in query.split('&') {
        let mut it = pair.splitn(2, '=');
        match (it.next(), it.next()) {
            (Some("code"), Some(v)) => code = Some(decode(v)),
            (Some("state"), Some(v)) => state = Some(decode(v)),
            (Some("error"), Some(v)) => error = Some(decode(v)),
            _ => {}
        }
    }
    match (code, state, error) {
        (_, _, Some(e)) => Callback::Refused(e),
        (Some(code), Some(state), None) if !code.is_empty() => Callback::Code { code, state },
        _ => Callback::Other,
    }
}

#[cfg(test)]
mod oauth_tests {
    use super::*;

    #[test]
    fn the_challenge_is_rfc_7636_s256() {
        // the example in RFC 7636, appendix B
        assert_eq!(pkce_challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
        let v = random_token(32).unwrap();
        assert_eq!(v.len(), 43);
        assert!(v.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'));
        assert_ne!(v, random_token(32).unwrap());
    }

    #[test]
    fn only_the_callback_with_both_values_is_taken() {
        let id = |s: &str| s.to_string();
        assert_eq!(parse_callback("/?state=abc&code=4/xyz&scope=email", id), Callback::Code { code: "4/xyz".into(), state: "abc".into() });
        assert_eq!(parse_callback("/?error=access_denied&state=abc", id), Callback::Refused("access_denied".into()));
        assert_eq!(parse_callback("/favicon.ico", id), Callback::Other);
        assert_eq!(parse_callback("/?code=4/xyz", id), Callback::Other); // no state: not ours
        assert_eq!(parse_callback("/?state=abc", id), Callback::Other);
    }

    #[test]
    fn secrets_are_compared_whole() {
        assert!(same_secret("abc", "abc"));
        assert!(!same_secret("abc", "abd"));
        assert!(!same_secret("abc", "abcd"));
        assert!(!same_secret("", "a"));
    }
}
