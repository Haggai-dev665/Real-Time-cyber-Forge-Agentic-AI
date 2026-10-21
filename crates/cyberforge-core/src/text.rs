//! Text that came from elsewhere (a server, an error, a page), made safe to
//! print in a terminal.

/// Remove control characters, including the escape character that starts
/// terminal control sequences, and cap the length. Tabs and newlines become
/// spaces so one value stays on one line.
pub fn printable(input: &str, max_chars: usize) -> String {
    let mut out: String = input
        .chars()
        .map(|c| if c == '\t' || c == '\n' || c == '\r' { ' ' } else { c })
        .filter(|c| !c.is_control() && !matches!(*c, '\u{202a}'..='\u{202e}' | '\u{2066}'..='\u{2069}'))
        .take(max_chars)
        .collect();
    if input.chars().count() > max_chars {
        out.push('…');
    }
    out
}

#[cfg(test)]
mod tests {
    use super::printable;

    #[test]
    fn escape_sequences_and_bidi_controls_are_removed() {
        assert_eq!(printable("ok\u{1b}[2J\u{1b}]0;title\u{7}done", 100), "ok[2J]0;titledone");
        assert_eq!(printable("a\u{202e}b\u{2066}c", 100), "abc");
        assert_eq!(printable("line one\nline two", 100), "line one line two");
    }

    #[test]
    fn long_text_is_capped() {
        assert_eq!(printable("abcdef", 3), "abc…");
        assert_eq!(printable("abc", 3), "abc");
    }
}
