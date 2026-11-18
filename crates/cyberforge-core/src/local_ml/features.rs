//! Port of hf_space_deploy/url_features.py. The export fixture verifies every
//! feature (including decoded attacks and popularity) at training precision.
use regex::Regex;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
fn rx(pattern: &str) -> Regex {
    static CACHE: OnceLock<Mutex<HashMap<String, Regex>>> = OnceLock::new();
    CACHE
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .unwrap()
        .entry(pattern.into())
        .or_insert_with(|| Regex::new(pattern).unwrap())
        .clone()
}
fn count(s: &str, c: char) -> f64 {
    s.chars().filter(|&v| v == c).count() as f64
}
fn len(s: &str) -> f64 {
    s.chars().count() as f64
}
fn round(v: f64) -> f64 {
    (v * 10000.).round() / 10000.
}
fn entropy(s: &str) -> f64 {
    let n = len(s);
    if n == 0. {
        return 0.;
    }
    let mut c = HashMap::new();
    for ch in s.chars() {
        *c.entry(ch).or_insert(0usize) += 1;
    }
    round(
        -c.values()
            .map(|&v| {
                let p = v as f64 / n;
                p * p.log2()
            })
            .sum::<f64>(),
    )
}
fn flag(v: bool) -> f64 {
    if v {
        1.
    } else {
        0.
    }
}
fn any_end(s: &str, ext: &[&str]) -> bool {
    ext.iter().any(|e| s.ends_with(e))
}
fn ip(s: &str) -> bool {
    let p: Vec<_> = s.split('.').collect();
    (p.len() == 4
        && p.iter()
            .all(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_digit())))
        || (s.contains(':')
            && s.chars()
                .all(|c| c.is_ascii_hexdigit() || c == ':' || c == '.'))
}
const SPECIAL: &str = "!@#$%^&*()+={}[]|\\:;<>?,";
const TLDS: &[&str] = &[".xyz", ".tk", ".ml", ".ga", ".cf", ".top", ".buzz"];
const PLATFORMS: &[&str] = &[
    "github.io",
    "gitlab.io",
    "blogspot.com",
    "wordpress.com",
    "weebly.com",
    "wixsite.com",
    "wix.com",
    "000webhostapp.com",
    "firebaseapp.com",
    "web.app",
    "pages.dev",
    "vercel.app",
    "netlify.app",
    "herokuapp.com",
    "glitch.me",
    "repl.co",
    "replit.app",
    "godaddysites.com",
    "square.site",
    "webflow.io",
    "myshopify.com",
    "tumblr.com",
    "livejournal.com",
    "medium.com",
    "notion.site",
    "sites.google.com",
    "storage.googleapis.com",
    "firebasestorage.googleapis.com",
    "appspot.com",
    "azurewebsites.net",
    "blob.core.windows.net",
    "amazonaws.com",
    "cloudfront.net",
    "r2.dev",
    "workers.dev",
    "duckdns.org",
    "ngrok.io",
    "ngrok-free.app",
    "trycloudflare.com",
    "surge.sh",
    "hf.space",
    "onrender.com",
    "fly.dev",
    "start.page",
    "carrd.co",
    "linktr.ee",
    "yolasite.com",
];
const SQL: &str = r"(?i)\b(select|union|insert|update|delete|drop|from|where|having|sleep|benchmark|waitfor|information_schema|load_file|outfile|concat|char|cast|exec|xp_cmdshell|order\s+by|group\s+by|or\s+1\s*=\s*1|and\s+1\s*=\s*1)\b";
const SCRIPT: &str = r"(?i)(<\s*script|<\s*img|<\s*svg|<\s*iframe|<\s*body|<\s*object|<\s*embed|javascript:|vbscript:|data:text/html|on(?:error|load|click|mouseover|focus|toggle|start)\s*=|alert\s*\(|prompt\s*\(|confirm\s*\(|eval\s*\(|document\.(?:cookie|domain|write)|fromcharcode|expression\s*\()";
struct Parts {
    scheme: String,
    host: String,
    path: String,
    query: String,
    port: bool,
}
fn split(s: &str) -> Parts {
    let s = s
        .trim_start_matches(|c: char| c <= ' ')
        .replace(['\r', '\n', '\t'], "");
    let (scheme, rest) = if let Some((a, b)) = s.split_once("://") {
        (a.to_lowercase(), b)
    } else {
        (String::new(), s.strip_prefix("//").unwrap_or(&s))
    };
    let authority = s.contains("://") || s.starts_with("//");
    let end = rest.find(['/', '?', '#']).unwrap_or(rest.len());
    let (auth, tail) = if authority {
        (&rest[..end], &rest[end..])
    } else {
        ("", rest)
    };
    let auth = auth.rsplit('@').next().unwrap_or("");
    let (host, port) = if auth.starts_with('[') {
        let end = auth.find(']').unwrap_or(auth.len());
        (
            auth.get(1..end).unwrap_or(""),
            auth.get(end + 1..).unwrap_or("").starts_with(':'),
        )
    } else {
        let parts = auth.split_once(':');
        (
            parts.map(|p| p.0).unwrap_or(auth),
            parts
                .map(|p| !p.1.is_empty() && p.1 != "0")
                .unwrap_or(false),
        )
    };
    let tail = tail.split('#').next().unwrap_or("");
    let (path, query) = tail.split_once('?').unwrap_or((tail, ""));
    // urllib.parse.urlparse separates parameters after the final path segment.
    let path = if let Some(last) = path.rfind('/') {
        let (a, b) = path.split_at(last + 1);
        format!("{}{}", a, b.split(';').next().unwrap_or(""))
    } else {
        path.split(';').next().unwrap_or("").to_string()
    };
    Parts {
        scheme,
        host: host.to_lowercase(),
        path,
        query: query.into(),
        port,
    }
}
fn unquote(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::new();
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            if let Ok(v) =
                u8::from_str_radix(std::str::from_utf8(&b[i + 1..i + 3]).unwrap_or(""), 16)
            {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

pub fn extract(url: &str, popular: &HashMap<String, usize>) -> HashMap<String, f64> {
    let original = split(url);
    let mut f = HashMap::new();
    macro_rules! put {
        ($k:expr,$v:expr) => {
            f.insert($k.to_string(), $v as f64);
        };
    }
    put!("url_length", len(url));
    put!("hostname_length", len(&original.host));
    put!("path_length", len(&original.path));
    put!("is_https", flag(original.scheme == "https"));
    let legacy_ip: Vec<_> = original.host.split('.').collect();
    put!(
        "has_ip_address",
        flag(
            legacy_ip.len() == 4
                && legacy_ip
                    .iter()
                    .all(|l| !l.is_empty() && l.chars().all(|c| c.is_ascii_digit()))
        )
    );
    put!("has_suspicious_tld", flag(any_end(&original.host, TLDS)));
    put!(
        "subdomain_count",
        original.host.split('.').count().saturating_sub(2)
    );
    put!("has_port", flag(original.port));
    put!(
        "query_params_count",
        if original.query.is_empty() {
            0
        } else {
            original.query.split('&').count()
        }
    );
    put!("has_at_symbol", flag(url.contains('@')));
    put!("has_double_slash", flag(original.path.contains("//")));
    put!(
        "special_char_count",
        url.chars().filter(|c| SPECIAL.contains(*c)).count()
    );
    let stripped = rx(r"^[a-zA-Z][a-zA-Z0-9+.-]*://")
        .replace(url.trim(), "")
        .into_owned();
    let bare = if stripped
        .get(..4)
        .map(|s| s.eq_ignore_ascii_case("www."))
        .unwrap_or(false)
        && stripped.len() > 4
    {
        &stripped[4..]
    } else {
        &stripped
    };
    let seen = split(&format!("//{bare}"));
    let host = seen.host;
    let path = seen.path;
    let query = seen.query;
    let labels: Vec<_> = host.split('.').filter(|v| !v.is_empty()).collect();
    let isip = ip(&host);
    let tld = if isip || labels.len() < 2 {
        ""
    } else {
        labels[labels.len() - 1]
    };
    let tokens: Vec<_> = path
        .split(['/', '.', '_', '-'])
        .filter(|v| !v.is_empty())
        .collect();
    let values: Vec<_> = if query.is_empty() {
        vec![]
    } else {
        query
            .split('&')
            .map(|p| p.split_once('=').map(|p| p.1).unwrap_or(p))
            .collect()
    };
    let lower_path = path.to_lowercase();
    let rest = if query.is_empty() {
        lower_path.clone()
    } else {
        format!("{path}?{query}").to_lowercase()
    };
    let letters: Vec<_> = host.chars().filter(|c| c.is_alphabetic()).collect();
    let digits = host.chars().filter(|c| c.is_ascii_digit()).count() as f64;
    put!("bare_length", len(bare));
    put!("host_length", len(&host));
    put!("bare_path_length", len(&path));
    put!("query_length", len(&query));
    put!("host_dots", count(&host, '.'));
    put!(
        "host_subdomains",
        if isip {
            0
        } else {
            labels.len().saturating_sub(2)
        }
    );
    put!("host_hyphens", count(&host, '-'));
    put!("host_digits", digits);
    put!(
        "host_digit_ratio",
        if host.is_empty() {
            0.
        } else {
            round(digits / len(&host))
        }
    );
    put!("host_entropy", entropy(&host));
    put!(
        "host_longest_label",
        labels.iter().map(|l| len(l) as usize).max().unwrap_or(0)
    );
    put!(
        "host_vowel_ratio",
        if letters.is_empty() {
            0.
        } else {
            round(
                letters.iter().filter(|c| "aeiou".contains(**c)).count() as f64
                    / letters.len() as f64,
            )
        }
    );
    put!("host_is_ip", flag(isip));
    put!("host_has_port", flag(seen.port));
    put!("host_suspicious_tld", flag(any_end(&host, TLDS)));
    put!("tld_length", len(tld));
    put!("has_punycode", flag(host.contains("xn--")));
    put!(
        "path_depth",
        path.split('/').filter(|s| !s.is_empty()).count()
    );
    put!(
        "path_digits",
        path.chars().filter(|c| c.is_ascii_digit()).count()
    );
    put!("path_entropy", entropy(&path));
    put!(
        "path_longest_token",
        tokens.iter().map(|v| v.chars().count()).max().unwrap_or(0)
    );
    put!(
        "query_params",
        if query.is_empty() {
            0
        } else {
            query.split('&').count()
        }
    );
    put!(
        "query_longest_value",
        values.iter().map(|v| v.chars().count()).max().unwrap_or(0)
    );
    put!("bare_at_symbol", flag(bare.contains('@')));
    put!("path_double_slash", flag(path.contains("//")));
    put!("count_percent", count(bare, '%'));
    put!("count_equals", count(bare, '='));
    put!("count_underscore", count(bare, '_'));
    put!("count_hyphen_path", count(&path, '-'));
    put!("count_tilde", count(bare, '~'));
    put!(
        "bare_special_chars",
        bare.chars().filter(|c| SPECIAL.contains(*c)).count()
    );
    put!(
        "has_executable_extension",
        flag(any_end(
            &lower_path,
            &[
                ".exe", ".dll", ".scr", ".msi", ".bat", ".cmd", ".com", ".pif", ".apk", ".jar",
                ".bin", ".elf", ".dmg", ".iso"
            ]
        ))
    );
    put!(
        "has_script_extension",
        flag(any_end(
            &lower_path,
            &[".sh", ".ps1", ".vbs", ".js", ".hta", ".py", ".pl", ".wsf", ".lnk"]
        ))
    );
    put!(
        "has_archive_extension",
        flag(any_end(
            &lower_path,
            &[".zip", ".rar", ".7z", ".gz", ".tar", ".tgz", ".cab", ".img"]
        ))
    );
    put!(
        "credential_words",
        [
            "login", "signin", "sign-in", "verify", "account", "update", "secure", "banking",
            "confirm", "password", "webscr", "wallet", "recover", "unlock", "suspend", "billing"
        ]
        .iter()
        .filter(|w| bare.to_lowercase().contains(**w))
        .count()
    );
    put!(
        "is_shortener",
        flag(
            [
                "bit.ly",
                "tinyurl.com",
                "goo.gl",
                "t.co",
                "ow.ly",
                "is.gd",
                "buff.ly",
                "cutt.ly",
                "rebrand.ly",
                "tiny.cc",
                "shorturl.at",
                "rb.gy",
                "t.ly",
                "s.id",
                "lnkd.in"
            ]
            .contains(&host.as_str())
        )
    );
    put!(
        "has_embedded_url",
        flag(rx(r"(?i)(https?:|https?%3a|www\.)").is_match(&rest))
    );
    let user_content = PLATFORMS
        .iter()
        .any(|p| host == *p || host.ends_with(&format!(".{p}")));
    put!("is_user_content_host", flag(user_content));
    let mut popularity = 0.;
    if !isip && !user_content {
        let labels: Vec<_> = host.trim_matches('.').split('.').collect();
        for start in 0..labels.len().saturating_sub(1) {
            let parts = &labels[start..];
            if parts.len() == 2
                && ["co", "com", "org", "net", "gov", "edu", "ac"].contains(&parts[0])
                && parts[1].len() == 2
            {
                continue;
            }
            if let Some(rank) = popular.get(&parts.join(".")) {
                popularity = round((1. - (*rank as f64).log10() / 6.).max(0.05));
                break;
            }
        }
    }
    put!("domain_popularity", popularity);
    let carried = if query.is_empty() {
        path.clone()
    } else {
        format!("{path}?{query}")
    };
    let decoded = unquote(&carried.replace('+', " "));
    let specials = decoded
        .chars()
        .filter(|c| !(c.is_alphanumeric() || c.is_whitespace() || "/._~-".contains(*c)))
        .count() as f64;
    put!("payload_length", len(&decoded));
    put!(
        "payload_quotes",
        count(&decoded, '\'') + count(&decoded, '"') + count(&decoded, '`')
    );
    put!(
        "payload_angle_brackets",
        count(&decoded, '<') + count(&decoded, '>')
    );
    put!(
        "payload_parentheses",
        count(&decoded, '(') + count(&decoded, ')')
    );
    put!("payload_semicolons", count(&decoded, ';'));
    put!(
        "payload_spaces",
        decoded.chars().filter(|c| c.is_whitespace()).count()
    );
    put!("payload_sql_keywords", rx(SQL).find_iter(&decoded).count());
    put!(
        "payload_script_tokens",
        rx(SCRIPT).find_iter(&decoded).count()
    );
    put!(
        "payload_comment_markers",
        rx(r"(--|/\*|\*/|#\s*$|;\s*--)").find_iter(&decoded).count()
    );
    put!(
        "payload_traversal",
        decoded.matches("../").count() + decoded.matches("..\\").count()
    );
    put!(
        "payload_pipes_backticks",
        count(&decoded, '|') + count(&decoded, '`') + decoded.matches("$(").count() as f64
    );
    put!(
        "payload_encoded_specials",
        rx(r"(?i)%(?:27|22|3c|3e|28|29|3b|2d%2d|00|0a|0d|7c|60|5c)")
            .find_iter(&carried)
            .count()
    );
    put!(
        "payload_special_ratio",
        if decoded.is_empty() {
            0.
        } else {
            round(specials / len(&decoded))
        }
    );
    put!(
        "payload_longest_run_specials",
        rx(r"[^A-Za-z0-9\s/._~-]{2,}")
            .find_iter(&decoded)
            .map(|m| m.as_str().chars().count())
            .max()
            .unwrap_or(0)
    );
    put!(
        "payload_equals_in_value",
        values.iter().map(|v| v.matches('=').count()).sum::<usize>()
    );
    put!(
        "payload_null_bytes",
        carried.to_lowercase().matches("%00").count() + decoded.matches('\0').count()
    );
    f
}
