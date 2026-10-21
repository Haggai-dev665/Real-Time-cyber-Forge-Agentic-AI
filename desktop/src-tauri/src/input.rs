//! Checks on what pages pass to commands (SEC-05).
//!
//! The pages validate their forms too, but a command cannot rely on that: any
//! script running in the window can call it with any value. These checks run in
//! Rust, before a value is used.

/// A required piece of text: trimmed, not empty, at most `max` characters, and
/// without control characters other than line breaks and tabs.
pub fn text(value: &str, name: &str, max: usize) -> Result<String, String> {
    let t = value.trim();
    if t.is_empty() {
        return Err(format!("{name} is required"));
    }
    optional_text(Some(t), name, max).map(|v| v.unwrap_or_default())
}

/// Like `text`, but empty or missing is allowed (returns None).
pub fn optional_text(value: Option<&str>, name: &str, max: usize) -> Result<Option<String>, String> {
    let Some(t) = value.map(str::trim).filter(|t| !t.is_empty()) else {
        return Ok(None);
    };
    if t.chars().count() > max {
        return Err(format!("{name} is longer than {max} characters"));
    }
    if t.chars().any(|c| c.is_control() && c != '\n' && c != '\r' && c != '\t') {
        return Err(format!("{name} contains control characters"));
    }
    Ok(Some(t.to_string()))
}

/// The ID of a record kept by the backend, which goes into a request path. Only
/// letters, digits, `-` and `_`, so it cannot change which endpoint is called
/// (`../auth/logout`, `x?y`, `%2e%2e`).
pub fn record_id(value: &str, name: &str) -> Result<String, String> {
    let t = value.trim();
    if t.is_empty() || t.len() > 64 || !t.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return Err(format!("{name} is not a valid ID"));
    }
    Ok(t.to_string())
}

/// A count a page asks for, kept within `min..=max`.
pub fn count<T: Ord + Copy>(value: Option<T>, default: T, min: T, max: T) -> T {
    value.unwrap_or(default).clamp(min, max)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn record_ids_cannot_change_the_endpoint() {
        assert_eq!(record_id(" 3f6c1d2a-9b7e-4c1a-8f00-1234567890ab ", "id").unwrap(), "3f6c1d2a-9b7e-4c1a-8f00-1234567890ab");
        for bad in ["../auth/logout", "x?y=1", "a/b", "%2e%2e", "", "a b", "#x", &"a".repeat(65)] {
            assert!(record_id(bad, "id").is_err(), "accepted {bad:?}");
        }
    }

    #[test]
    fn text_is_bounded_and_free_of_control_characters() {
        assert_eq!(text("  hello\nworld ", "q", 20).unwrap(), "hello\nworld");
        assert!(text("   ", "q", 20).is_err());
        assert!(text("abcdef", "q", 5).is_err());
        assert!(text("a\u{0}b", "q", 20).is_err());
        assert!(text("a\u{1b}[31mb", "q", 20).is_err());
        assert_eq!(optional_text(Some("  "), "q", 5).unwrap(), None);
        assert_eq!(optional_text(None, "q", 5).unwrap(), None);
    }

    #[test]
    fn counts_are_clamped() {
        assert_eq!(count(Some(10_000usize), 40, 1, 500), 500);
        assert_eq!(count(Some(0u32), 50, 1, 200), 1);
        assert_eq!(count(None, 50u32, 1, 200), 50);
    }
}
