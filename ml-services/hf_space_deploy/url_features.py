"""
URL features for the CyberForge detection models.

One function, `extract_url_features`, is used both when the models are trained
(trainer.py) and when they answer (app.py), so the two cannot drift apart. It is
plain string processing: no ML library, no network, and it never raises.

Two groups of features come back in one dictionary:

  * the twelve original names (url_length, is_https, ...), kept because API
    responses and the backend's risk factors use them;
  * scheme-free features, which the models are trained on. Public URL
    collections mostly list benign URLs without "http://" and malicious ones
    with it, so anything computed from the scheme would teach a model the way
    the list was written instead of anything about the URL. The models therefore
    see the URL with its scheme removed. Whether a page uses HTTPS is still
    reported, as a risk factor, not as model input.
"""

import math
import re
from collections import Counter
from typing import Dict, List, Optional
from urllib.parse import unquote, urlparse

SUSPICIOUS_TLDS = (".xyz", ".tk", ".ml", ".ga", ".cf", ".top", ".buzz")

# The twelve features the first models used. Still returned for compatibility.
LEGACY_FEATURES = [
    "url_length", "hostname_length", "path_length", "is_https",
    "has_ip_address", "has_suspicious_tld", "subdomain_count",
    "has_port", "query_params_count", "has_at_symbol",
    "has_double_slash", "special_char_count",
]

# What a URL's host and path look like. Used by the phishing, malware and
# anomaly models.
LEXICAL_FEATURES = [
    "bare_length", "host_length", "bare_path_length", "query_length",
    "host_dots", "host_subdomains", "host_hyphens", "host_digits", "host_digit_ratio",
    "host_entropy", "host_longest_label", "host_vowel_ratio",
    "host_is_ip", "host_has_port", "host_suspicious_tld", "tld_length", "has_punycode",
    "path_depth", "path_digits", "path_entropy", "path_longest_token",
    "query_params", "query_longest_value",
    "bare_at_symbol", "path_double_slash", "count_percent", "count_equals",
    "count_underscore", "count_hyphen_path", "count_tilde", "bare_special_chars",
    "has_executable_extension", "has_script_extension", "has_archive_extension",
    "credential_words", "is_shortener", "has_embedded_url",
    "domain_popularity", "is_user_content_host",
]

# What an injected payload looks like, read from the decoded path and query.
# Used by the web-attack model, together with a few lexical features.
PAYLOAD_FEATURES = [
    "payload_length", "payload_quotes", "payload_angle_brackets", "payload_parentheses",
    "payload_semicolons", "payload_spaces", "payload_sql_keywords", "payload_script_tokens",
    "payload_comment_markers", "payload_traversal", "payload_pipes_backticks",
    "payload_encoded_specials", "payload_special_ratio", "payload_longest_run_specials",
    "payload_equals_in_value", "payload_null_bytes",
]

ATTACK_FEATURES = PAYLOAD_FEATURES + [
    "bare_path_length", "query_length", "query_params", "count_percent", "path_depth", "query_longest_value",
]

ALL_FEATURES = list(dict.fromkeys(LEGACY_FEATURES + LEXICAL_FEATURES + PAYLOAD_FEATURES))

EXECUTABLE_EXTENSIONS = (".exe", ".dll", ".scr", ".msi", ".bat", ".cmd", ".com", ".pif", ".apk", ".jar", ".bin", ".elf", ".dmg", ".iso")
SCRIPT_EXTENSIONS = (".sh", ".ps1", ".vbs", ".js", ".hta", ".py", ".pl", ".wsf", ".lnk")
ARCHIVE_EXTENSIONS = (".zip", ".rar", ".7z", ".gz", ".tar", ".tgz", ".cab", ".img")
CREDENTIAL_WORDS = ("login", "signin", "sign-in", "verify", "account", "update", "secure", "banking",
                    "confirm", "password", "webscr", "wallet", "recover", "unlock", "suspend", "billing")
SHORTENERS = {"bit.ly", "tinyurl.com", "goo.gl", "t.co", "ow.ly", "is.gd", "buff.ly", "cutt.ly",
              "rebrand.ly", "tiny.cc", "shorturl.at", "rb.gy", "t.ly", "s.id", "lnkd.in"}
SQL_KEYWORDS = re.compile(
    r"\b(select|union|insert|update|delete|drop|from|where|having|sleep|benchmark|waitfor|"
    r"information_schema|load_file|outfile|concat|char|cast|exec|xp_cmdshell|order\s+by|group\s+by|or\s+1\s*=\s*1|and\s+1\s*=\s*1)\b",
    re.IGNORECASE)
SCRIPT_TOKENS = re.compile(
    r"(<\s*script|<\s*img|<\s*svg|<\s*iframe|<\s*body|<\s*object|<\s*embed|javascript:|vbscript:|data:text/html|"
    r"on(?:error|load|click|mouseover|focus|toggle|start)\s*=|alert\s*\(|prompt\s*\(|confirm\s*\(|eval\s*\(|"
    r"document\.(?:cookie|domain|write)|fromcharcode|expression\s*\()",
    re.IGNORECASE)
COMMENT_MARKERS = re.compile(r"(--|/\*|\*/|#\s*$|;\s*--)")
ENCODED_SPECIALS = re.compile(r"%(?:27|22|3c|3e|28|29|3b|2d%2d|00|0a|0d|7c|60|5c)", re.IGNORECASE)
SPECIAL_RUN = re.compile(r"[^A-Za-z0-9\s/._~-]{2,}")
LEGACY_SPECIALS = "!@#$%^&*()+={}[]|\\:;<>?,"
SCHEME = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*://")
EMBEDDED_URL = re.compile(r"(https?:|https?%3a|www\.)", re.IGNORECASE)


# ---------------------------------------------------------------------------
# Domain reputation
# ---------------------------------------------------------------------------
# The text of a URL cannot tell paypal.com/signin from a copy of it: a real
# sign-in page and a fake one look alike. What separates them is who the site
# is. `domain_popularity` says how high the URL's registered domain ranks in a
# public list of the most visited sites (Tranco), from 1.0 for the top of the
# list to 0.0 for a domain that is not on it. Free hosting and user-content
# platforms are on that list too, but a page on one of them is its author's,
# not the platform's, so those hosts count as unknown and are marked.

USER_CONTENT_HOSTS = (
    "github.io", "gitlab.io", "blogspot.com", "wordpress.com", "weebly.com", "wixsite.com", "wix.com",
    "000webhostapp.com", "firebaseapp.com", "web.app", "pages.dev", "vercel.app", "netlify.app",
    "herokuapp.com", "glitch.me", "repl.co", "replit.app", "godaddysites.com", "square.site",
    "webflow.io", "myshopify.com", "tumblr.com", "livejournal.com", "medium.com", "notion.site",
    "sites.google.com", "storage.googleapis.com", "firebasestorage.googleapis.com", "appspot.com",
    "azurewebsites.net", "blob.core.windows.net", "amazonaws.com", "cloudfront.net", "r2.dev",
    "workers.dev", "duckdns.org", "ngrok.io", "ngrok-free.app", "trycloudflare.com", "surge.sh",
    "hf.space", "onrender.com", "fly.dev", "start.page", "carrd.co", "linktr.ee", "yolasite.com",
)
SECOND_LEVEL_SUFFIXES = {"co", "com", "org", "net", "gov", "edu", "ac"}

_popular: Dict[str, int] = {}


def build_popularity(domains: List[str]) -> Dict[str, int]:
    """{domain: rank} from a list in rank order (most visited first)."""
    table: Dict[str, int] = {}
    for rank, domain in enumerate(domains, start=1):
        domain = str(domain).strip().lower()
        if domain and domain not in table:
            table[domain] = rank
    return table


def set_popular_domains(domains: List[str]) -> None:
    """Install the list the service scores URLs with."""
    global _popular
    _popular = build_popularity(domains)


def popular_domains_loaded() -> int:
    return len(_popular)


def is_user_content_host(host: str) -> int:
    host = host.lower()
    return 1 if any(host == platform or host.endswith("." + platform) for platform in USER_CONTENT_HOSTS) else 0


def domain_popularity(host: str, popular: Optional[Dict[str, int]] = None) -> float:
    """0.0 for a domain that is not on the list (or a user-content host); up to
    1.0 for the top of the list. The most specific listed name wins, and a bare
    second-level suffix such as "co.uk" never counts."""
    table = _popular if popular is None else popular
    host = host.lower().strip(".")
    if not table or not host or is_user_content_host(host):
        return 0.0
    labels = host.split(".")
    for start in range(0, len(labels) - 1):
        candidate = ".".join(labels[start:])
        parts = labels[start:]
        if len(parts) == 2 and parts[0] in SECOND_LEVEL_SUFFIXES and len(parts[1]) == 2:
            continue
        rank = table.get(candidate)
        if rank:
            return round(max(0.05, 1.0 - math.log10(rank) / 6.0), 4)
    return 0.0


def rescale_score(probability: float, threshold: float) -> float:
    """Map a model's raw probability so that its decision threshold lands on
    0.5, keeping the order of scores. Every model in the service is read the
    same way (0.5 or more is a threat) whatever threshold it was given when it
    was trained."""
    if not 0.0 < threshold < 1.0:
        return float(probability)
    if probability < threshold:
        return 0.5 * probability / threshold
    return 0.5 + 0.5 * (probability - threshold) / (1.0 - threshold)


def split_url(url: str) -> Dict:
    """The parts of a URL that the features are built from. Never raises: text
    that is not a well-formed URL (an unclosed "[" in the host, a port that is
    not a number) still yields whatever could be read, because callers also
    score URLs picked out of free text."""
    try:
        parsed = urlparse(url)
        parts = {
            "scheme": parsed.scheme, "hostname": parsed.hostname or "",
            "path": parsed.path or "", "query": parsed.query or "",
        }
    except ValueError:
        scheme = url.split("://", 1)[0].lower() if "://" in url else ""
        return {"scheme": scheme, "hostname": "", "path": "", "query": "", "has_port": 0}
    try:
        parts["has_port"] = 1 if parsed.port else 0
    except ValueError:
        parts["has_port"] = 1  # a port is given, but it is not a valid number
    return parts


def bare_url(url: str) -> str:
    """The URL as the models see it: no scheme, no leading "www.", no
    surrounding space. Like the scheme, "www." says how a list was written, not
    what the site is: one collection writes every benign URL without it and
    another with it."""
    bare = SCHEME.sub("", str(url).strip(), count=1)
    return bare[4:] if bare[:4].lower() == "www." and len(bare) > 4 else bare


def _entropy(text: str) -> float:
    if not text:
        return 0.0
    total = len(text)
    return round(-sum((n / total) * math.log2(n / total) for n in Counter(text).values()), 4)


def _is_ip(host: str) -> int:
    labels = host.split(".")
    if len(labels) == 4 and all(label.isdigit() for label in labels):
        return 1
    return 1 if ":" in host and all(c in "0123456789abcdefABCDEF:." for c in host) else 0


def registered_domain(url: str) -> str:
    """A rough registered domain, used only to keep one site's URLs together
    when data is split for testing. No public-suffix list: the last two labels,
    or three when the second-to-last is a common second-level suffix."""
    host = split_url("//" + bare_url(url))["hostname"].lower()
    if not host or _is_ip(host):
        return host or "unknown"
    labels = host.split(".")
    if len(labels) >= 3 and labels[-2] in {"co", "com", "org", "net", "gov", "edu", "ac"} and len(labels[-1]) == 2:
        return ".".join(labels[-3:])
    return ".".join(labels[-2:])


def extract_url_features(url: str, popular: Optional[Dict[str, int]] = None) -> Dict:
    """Every feature for one URL: the twelve original names and the
    scheme-free ones. All values are numbers. `popular` is a {domain: rank}
    table to use instead of the installed one (training passes its own)."""
    url = "" if url is None else str(url)
    parts = split_url(url)
    hostname = parts["hostname"]

    # --- the twelve original features, computed exactly as before ---
    features = {
        "url_length": len(url),
        "hostname_length": len(hostname),
        "path_length": len(parts["path"]),
        "is_https": 1 if parts["scheme"] == "https" else 0,
        "has_ip_address": 1 if all(p.isdigit() for p in hostname.split(".")) and len(hostname.split(".")) == 4 else 0,
        "has_suspicious_tld": 1 if any(hostname.endswith(t) for t in SUSPICIOUS_TLDS) else 0,
        "subdomain_count": max(0, len(hostname.split(".")) - 2),
        "has_port": parts["has_port"],
        "query_params_count": len(parts["query"].split("&")) if parts["query"] else 0,
        "has_at_symbol": 1 if "@" in url else 0,
        "has_double_slash": 1 if "//" in parts["path"] else 0,
        "special_char_count": sum(1 for c in url if c in LEGACY_SPECIALS),
    }

    # --- scheme-free features: the URL is read again without its scheme, so a
    # URL listed as "example.com/x" and one listed as "http://example.com/x"
    # give the same values. They have their own names; the twelve above are
    # never overwritten ---
    bare = bare_url(url)
    seen = split_url("//" + bare)
    host = seen["hostname"].lower()
    path = seen["path"]
    query = seen["query"]
    labels = [label for label in host.split(".") if label]
    is_ip = _is_ip(host)
    tld = "" if is_ip or len(labels) < 2 else labels[-1]
    path_tokens = [token for token in re.split(r"[/._\-]", path) if token]
    values = [pair.split("=", 1)[1] if "=" in pair else pair for pair in query.split("&")] if query else []
    lower_path = path.lower()
    lower_rest = (path + "?" + query).lower() if query else lower_path
    host_letters = [c for c in host if c.isalpha()]

    features.update({
        "bare_length": len(bare),
        "host_length": len(host),
        "bare_path_length": len(path),
        "query_length": len(query),
        "host_dots": host.count("."),
        "host_subdomains": 0 if is_ip else max(0, len(labels) - 2),
        "host_hyphens": host.count("-"),
        "host_digits": sum(c.isdigit() for c in host),
        "host_digit_ratio": round(sum(c.isdigit() for c in host) / len(host), 4) if host else 0.0,
        "host_entropy": _entropy(host),
        "host_longest_label": max((len(label) for label in labels), default=0),
        "host_vowel_ratio": round(sum(c in "aeiou" for c in host_letters) / len(host_letters), 4) if host_letters else 0.0,
        "host_is_ip": is_ip,
        "host_has_port": seen["has_port"],
        "host_suspicious_tld": 1 if any(host.endswith(t) for t in SUSPICIOUS_TLDS) else 0,
        "tld_length": len(tld),
        "has_punycode": 1 if "xn--" in host else 0,
        "path_depth": len([segment for segment in path.split("/") if segment]),
        "path_digits": sum(c.isdigit() for c in path),
        "path_entropy": _entropy(path),
        "path_longest_token": max((len(token) for token in path_tokens), default=0),
        "query_params": len(query.split("&")) if query else 0,
        "query_longest_value": max((len(value) for value in values), default=0),
        "bare_at_symbol": 1 if "@" in bare else 0,
        "path_double_slash": 1 if "//" in path else 0,
        "count_percent": bare.count("%"),
        "count_equals": bare.count("="),
        "count_underscore": bare.count("_"),
        "count_hyphen_path": path.count("-"),
        "count_tilde": bare.count("~"),
        "bare_special_chars": sum(1 for c in bare if c in LEGACY_SPECIALS),
        "has_executable_extension": 1 if lower_path.endswith(EXECUTABLE_EXTENSIONS) else 0,
        "has_script_extension": 1 if lower_path.endswith(SCRIPT_EXTENSIONS) else 0,
        "has_archive_extension": 1 if lower_path.endswith(ARCHIVE_EXTENSIONS) else 0,
        "credential_words": sum(1 for word in CREDENTIAL_WORDS if word in bare.lower()),
        "is_shortener": 1 if host in SHORTENERS else 0,
        "has_embedded_url": 1 if EMBEDDED_URL.search(lower_rest) else 0,
        "domain_popularity": 0.0 if is_ip else domain_popularity(host, popular),
        "is_user_content_host": is_user_content_host(host),
    })

    # --- payload features: what is carried in the path and query, decoded once ---
    carried = path + ("?" + query if query else "")
    try:
        decoded = unquote(carried.replace("+", " "))
    except Exception:
        decoded = carried
    specials = sum(1 for c in decoded if not (c.isalnum() or c.isspace() or c in "/._~-"))
    features.update({
        "payload_length": len(decoded),
        "payload_quotes": decoded.count("'") + decoded.count('"') + decoded.count("`"),
        "payload_angle_brackets": decoded.count("<") + decoded.count(">"),
        "payload_parentheses": decoded.count("(") + decoded.count(")"),
        "payload_semicolons": decoded.count(";"),
        "payload_spaces": sum(c.isspace() for c in decoded),
        "payload_sql_keywords": len(SQL_KEYWORDS.findall(decoded)),
        "payload_script_tokens": len(SCRIPT_TOKENS.findall(decoded)),
        "payload_comment_markers": len(COMMENT_MARKERS.findall(decoded)),
        "payload_traversal": decoded.count("../") + decoded.count("..\\"),
        "payload_pipes_backticks": decoded.count("|") + decoded.count("`") + decoded.count("$("),
        "payload_encoded_specials": len(ENCODED_SPECIALS.findall(carried)),
        "payload_special_ratio": round(specials / len(decoded), 4) if decoded else 0.0,
        "payload_longest_run_specials": max((len(run) for run in SPECIAL_RUN.findall(decoded)), default=0),
        "payload_equals_in_value": sum(value.count("=") for value in values),
        "payload_null_bytes": carried.lower().count("%00") + decoded.count("\x00"),
    })
    return features


def feature_row(features: Dict, names: List[str]) -> List[float]:
    """The named features as a list of floats, in the order given."""
    return [float(features.get(name, 0) or 0) for name in names]
