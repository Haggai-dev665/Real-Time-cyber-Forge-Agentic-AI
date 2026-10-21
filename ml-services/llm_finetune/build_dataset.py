"""Build the supervised fine-tuning set for the CyberForge chat model.

Every example is a (mode, user message, answer) triple in the exact form the
Space sends to the model (serving.py). The answers are written from the
evidence in the message by the rules below, never from a hidden label, so the
model learns to reason from what it is shown, not to recall facts it cannot
verify. Labels only decide which examples are drawn and are kept with each
example for evaluation.

Sources
  URLs        the URL detectors' own training sources (hf_space_deploy/trainer.py):
              Mitake/PhishingURLsANDBenignURLs, bgspaditya/byt-malicious-url-treatment,
              pirocheto/phishing-url, shengqin/web-attacks (payloads placed on benign
              URLs as the trainer does). Scored with the deployed detectors (detectors.py).
  Records     the owner's dataset (Che237/cyberforge-datasets, also in ml-services/datasets):
              TLS certificates, DNS queries, HTTP requests, host logs, mining-script
              telemetry, PE features, the IPsum IP feed and Windows CBS log lines.
  Knowledge   knowledge.py (hand-written) and training_data/cybersecurity_scenarios.json.

Output: <out>/train.jsonl, val.jsonl, test.jsonl and stats.json. Each line:
  {"id", "mode", "family", "split", "messages": [system, user, assistant], "meta": {...}}

Run:  python build_dataset.py --out data            (HF_TOKEN read from the environment)
"""

import argparse
import hashlib
import json
import os
import random
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd

HERE = Path(__file__).resolve().parent
ML = HERE.parent
sys.path.insert(0, str(ML / "hf_space_deploy"))
sys.path.insert(0, str(HERE))

import trainer  # noqa: E402  the detectors' data loaders, reused as is
from url_features import extract_url_features, registered_domain, split_url  # noqa: E402

from detectors import Detectors, popularity, red_flags  # noqa: E402
from knowledge import SMALL_TALK, TOPICS  # noqa: E402
from serving import messages  # noqa: E402

LEVELS = ["Low", "Medium", "High", "Critical"]
ANALYST_MAX_WORDS = 80
DATASETS = ML / "datasets"

# Topics kept out of training entirely, so the test set measures questions the
# model has not been taught (the knowledge it already had must survive).
HELD_OUT_TOPICS = {"What is CSRF?", "What is cryptojacking?", "What is zero trust?", "What is a rootkit?",
                   "What is MFA fatigue?", "What was Heartbleed?", "What is malvertising?", "What is a sandbox in security?"}


# ---------------------------------------------------------------------------
# Splits: by registered domain for URLs, so no site is in two splits
# ---------------------------------------------------------------------------

def split_of(key: str, test: float = 0.08, val: float = 0.04) -> str:
    h = int(hashlib.sha1(key.encode("utf-8")).hexdigest()[:8], 16) / 0xFFFFFFFF
    return "test" if h < test else "val" if h < test + val else "train"


def words(text: str) -> int:
    return len(re.findall(r"\S+", text))


def bullets(lines: List[str], limit: int = ANALYST_MAX_WORDS, head: Optional[str] = None) -> str:
    """'- ' bullets, dropping the last ones until the answer fits the word limit
    (the first bullet always stays)."""
    lines = [l for l in lines if l]
    while True:
        body = "\n".join(f"- {l}" for l in lines)
        text = f"{head}\n{body}" if head else body
        if words(text) <= limit or len(lines) <= 1:
            return text
        lines = lines[:-1] if len(lines) > 2 else lines[:1]


def pct(x: float) -> str:
    return f"{x:.0%}"


# ---------------------------------------------------------------------------
# URLs: evidence -> risk level -> answer
# ---------------------------------------------------------------------------

DETECTOR_LABEL = {
    "phishing_detection": "phishing detector",
    "malware_detection": "malware-URL detector",
    "web_attack_detection": "web-attack detector",
    "anomaly_detection": "anomaly model",
}
STRONG = ("bare IP", "punycode", "@ sign", "executable", "script file", "full of account words",
          "abused for throwaway", "embedded inside", "SQL syntax", "JavaScript markup", "traversal")


def strong_flags(flags: List[str]) -> List[str]:
    return [f for f in flags if any(s in f for s in STRONG)]


def url_assessment(url: str, scores: Optional[Dict[str, float]]) -> Dict:
    """The risk level an analyst should state for a URL from the evidence in
    the prompt, and the reasons. `scores` is None when the prompt carries no
    detector result (then only the URL text is evidence)."""
    flags = red_flags(url)
    strong = strong_flags(flags)
    feats = extract_url_features(url)
    pop = 0.0 if feats["host_is_ip"] else popularity(url)
    user_host = bool(feats["is_user_content_host"])
    notes = []
    if scores is None:
        level = 2 if len(strong) >= 3 else 1 if len(strong) >= 1 else 0
        if pop >= 0.5 and not user_host and level:
            level -= 1
        return {"level": LEVELS[level], "flags": flags, "strong": strong, "top": None, "pop": pop,
                "user_host": user_host, "hits": [], "notes": notes}
    supervised = {k: v for k, v in scores.items() if k != "anomaly_detection"}
    top_name, top = max(supervised.items(), key=lambda kv: kv[1])
    hits = [k for k, v in supervised.items() if v >= 0.5]
    if top >= 0.9:
        level = 3 if (strong or top >= 0.97) else 2
    elif top >= 0.7:
        level = 2
    elif top >= 0.5:
        level = 1
    elif len(strong) >= 2:
        level = 1
    else:
        level = 0
    # A single detector hit on a well-known domain with nothing else behind it
    # is the recorded false-positive pattern (sign-in and file-sharing pages):
    # one level lower, and said so. Reputation never erases a strong signal.
    if pop >= 0.5 and not user_host and len(hits) == 1 and not strong and top < 0.97 and level:
        level -= 1
        notes.append("well-known")
    if user_host:
        notes.append("user-content")
    if scores.get("anomaly_detection", 0) >= 0.5 and level == 0 and not hits:
        notes.append("anomaly-only")
    return {"level": LEVELS[level], "flags": flags, "strong": strong, "top": top, "top_name": top_name,
            "pop": pop, "user_host": user_host, "hits": hits, "notes": notes}


ACTIONS = {
    "Critical": ["Do not open it or enter any details; block the host.",
                 "Block the host and do not sign in or download anything from it.",
                 "Treat it as hostile: block it, and change any password entered there."],
    "High": ["Avoid it; block the host unless you can confirm it is legitimate.",
             "Do not enter credentials; verify the site through an address you trust."],
    "Medium": ["Treat with caution and verify the site before signing in or downloading.",
               "Open it only if you expected it, and reach the site by typing its address yourself."],
    "Low": ["No action needed beyond normal caution.",
            "Nothing here calls for blocking it."],
}


def host_of(url: str) -> str:
    return split_url(url if "://" in url else "//" + url)["hostname"] or url[:60]


def url_answer(url: str, a: Dict, rng: random.Random, evidence: str, prescan=None) -> str:
    """Analyst answer for a URL. `evidence` names what the prompt showed:
    'scores' (every detector's score) or 'none' (the URL alone). `prescan` is
    (max_threat, flagged_by) when the prompt shows only the chat route's
    one-line pre-scan: then only those two numbers may be quoted."""
    host = host_of(url)
    lines = []
    if prescan is not None:
        mx, flagged = prescan
        if flagged:
            names = [DETECTOR_LABEL[n] for n in flagged]
            joined = names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]
            lines.append(f"The pre-scan flags it ({joined}), top score {mx:.0%}.")
        else:
            lines.append(rng.choice([f"The pre-scan flagged nothing; its highest score is {mx:.0%}.",
                                     f"No detector flagged it in the pre-scan (top score {mx:.0%})."]))
    elif a["top"] is not None:
        name = DETECTOR_LABEL[a["top_name"]]
        if a["hits"]:
            others = [DETECTOR_LABEL[h] for h in a["hits"] if h != a["top_name"]]
            line = f"The {name} scores it {a['top']:.2f}, above the 0.50 threat line"
            line += f"; the {' and '.join(others)} also flag{'s' if len(others) == 1 else ''} it." if others else "."
        else:
            line = rng.choice([f"No detector flags it; the highest score is {a['top']:.2f} ({name}).",
                               f"All detectors stay below the 0.50 threat line (highest {a['top']:.2f})."])
        lines.append(line)
    for f in (a["strong"] or a["flags"])[: 2 if a["level"] != "Low" else 1]:
        lines.append(f[0].upper() + f[1:] + ".")
    if "well-known" in a["notes"]:
        lines.append(f"{host} is a well-known domain and only one detector fired, a known false-positive pattern for sign-in pages.")
    if "user-content" in a["notes"]:
        lines.append("Anyone can publish on this host, so its reputation does not vouch for this page.")
    if "anomaly-only" in a["notes"]:
        lines.append("Only the anomaly model finds it unusual; unusual is not the same as malicious.")
    if evidence == "none":
        lines.append(rng.choice(["No detector result or reputation check was provided, so this is from the URL text alone (unverified).",
                                 "Reputation and page content are unverified; only the address itself was assessed."]))
    elif rng.random() < 0.5:
        lines.append(rng.choice(["Page content and live reputation were not checked.",
                                 "This rests on the URL text; the page itself was not inspected."]))
    action = rng.choice(ACTIONS[a["level"]])
    # the action is the line to keep; trim evidence first
    head = f"Risk Level: {a['level']}"
    while True:
        text = bullets(lines + [action], head=head)
        if words(text) <= ANALYST_MAX_WORDS or len(lines) <= 1:
            return text
        lines = lines[:-1]


def aggregate(scores: Dict[str, float]) -> int:
    """cyberforgeMLService.js: 60% average plus 40% maximum, out of 100."""
    vals = list(scores.values())
    return round((0.6 * sum(vals) / len(vals) + 0.4 * max(vals)) * 100)


ASK_URL = ["Is this link safe? {u}", "check {u}", "Can you analyze {u} for me?", "Is {u} a phishing site?",
           "Should I open this? {u}", "Got this link in an email: {u} — is it legit?", "what do you think of {u}",
           "Assess this URL: {u}", "Is it safe to log in at {u}?", "My friend sent me {u}, is it dangerous?"]


def url_examples(item: Dict, rng: random.Random) -> List[Dict]:
    """Analyst examples for one scored URL, in the prompt formats the app uses."""
    url, scores = item["url"], item["scores"]
    out = []
    fmt = rng.choice(["explain", "chat", "analyze", "explain", "chat"])
    a = url_assessment(url, scores)
    if fmt == "explain":
        # backend llmFallbackChain.explainThreat
        findings = [f"ML {k}: {v:.2f}{' (flagged)' if v >= 0.5 else ''}" for k, v in scores.items()]
        findings += [f for f in red_flags(url)[:2]]
        mitre = "T1566 (initial-access)" if scores["phishing_detection"] >= 0.5 else "none"
        ioc = f"ip:{host_of(url)}" if extract_url_features(url)["host_is_ip"] else f"domain:{host_of(url)}"
        user = (f'Explain the security risk of "{url}" in 3-4 sentences.\nRisk score: {aggregate(scores)}/100\n'
                f"Findings: {chr(10).join('- ' + f for f in findings[:6])}\nMITRE: {mitre}\nIOCs: {ioc}\n\n"
                "Be concise. Lead with the verdict.")
    elif fmt == "chat":
        # app.py /api/v1/chat: [ML PRE-SCAN RESULTS] appended to the message
        mx = max(scores.values())
        flagged = [n for n, p in scores.items() if p >= 0.5]
        user = rng.choice(ASK_URL).format(u=url)
        user += f"\n\n[ML PRE-SCAN RESULTS]\nML scan of {url[:60]}: max_threat={mx:.2%}, flagged_by={flagged or 'none'}"
        # the level may only rest on what this line shows: flagged detectors at the top score
        a = url_assessment(url, {n: (mx if n in flagged else min(mx, 0.49)) for n in scores})
    else:
        # app.py ReasoningService.analyze: query + CONTEXT json
        context = {"url": url, "ml_scores": scores, "source": "cyberforge-url-scan"}
        user = f"Analyze this URL: {url}\n\nCONTEXT:\n{json.dumps(context, indent=1)[:2000]}"
    prescan = (mx, flagged) if fmt == "chat" else None
    out.append(dict(mode="analyst", family=f"url_{fmt}", user=user, answer=url_answer(url, a, rng, "scores", prescan),
                    meta={"label": item["label"], "source": item["source"], "risk": a["level"], "url": url}))
    if rng.random() < 0.25:
        b = url_assessment(url, None)
        out.append(dict(mode="analyst", family="url_noevidence", user=rng.choice(ASK_URL).format(u=url),
                        answer=url_answer(url, b, rng, "none"),
                        meta={"label": item["label"], "source": item["source"], "risk": b["level"], "url": url}))
    return out


def load_urls(token: Optional[str], rng: random.Random, n: Dict[str, int]) -> List[Dict]:
    """Labelled URLs from the detectors' own sources (same loaders as trainer.py)."""
    pick = lambda xs, k: rng.sample(xs, min(k, len(xs)))
    rows = []
    coll = trainer.load_phishing_collection(token)
    rows += [{"url": u, "label": "phishing", "source": trainer.PHISHING_COLLECTION} for u in pick(coll["phishing"], n["phishing"])]
    rows += [{"url": u, "label": "benign", "source": trainer.PHISHING_COLLECTION} for u in pick(coll["benign"], n["benign"])]
    older = trainer.load_url_collection(token)
    rows += [{"url": u, "label": "malware", "source": trainer.URL_COLLECTION} for u in pick(older["malware"], n["malware"])]
    rows += [{"url": u, "label": "benign", "source": trainer.URL_COLLECTION} for u in pick(older["benign"], n["older_benign"])]
    ref = trainer.load_phishing_reference(token)
    for split in ("train", "test"):
        rows += [{"url": u, "label": "phishing" if s == "phishing" else "benign", "source": trainer.PHISHING_REFERENCE}
                 for s in ("legitimate", "phishing") for u in pick(ref[split][s], n["reference"] // 4)]
    payloads = trainer.load_payloads(token)
    bases = [r["url"] for r in rows if r["label"] == "benign"]
    prng = random.Random(7)
    for p in pick(payloads["attack"], n["attack"]):
        rows.append({"url": "https://" + trainer.compose_url(prng.choice(bases), p, prng), "label": "web_attack",
                     "source": trainer.ATTACK_PAYLOADS})
    for p in pick(payloads["normal"], n["attack"] // 3):
        rows.append({"url": "https://" + trainer.compose_url(prng.choice(bases), p, prng), "label": "benign",
                     "source": trainer.ATTACK_PAYLOADS + " (normal)"})
    # the known-good and known-bad URLs the detectors are checked against
    for name, urls in trainer.KNOWN_HOSTILE.items():
        rows += [{"url": u, "label": "hostile", "source": "trainer known_hostile"} for u in urls]
    rows += [{"url": u, "label": "benign", "source": "trainer known_legitimate"} for u in trainer.KNOWN_LEGITIMATE]
    seen, out = set(), []
    for r in rows:
        if r["url"] not in seen and len(r["url"]) <= 300:
            seen.add(r["url"])
            out.append(r)
    return out


# ---------------------------------------------------------------------------
# Records from the owner's dataset
# ---------------------------------------------------------------------------

RECORD_ACTIONS = {
    "tls_certificate": {"High": "Do not enter credentials on this site; treat the connection as untrusted.",
                        "Medium": "Fix or replace the certificate, and avoid signing in until it is valid.",
                        "Low": "No action needed."},
    "dns_query": {"High": "Find the process making these queries and block the destination domain.",
                  "Medium": "Watch query volume to this domain and check which process sends it.",
                  "Low": "No action needed."},
    "http_request": {"High": "Block the source, review server logs for success, and confirm inputs are parameterised.",
                     "Medium": "Review the request in the server logs and confirm the parameter is validated.",
                     "Low": "No action needed."},
    "host_log_window": {"High": "Block the source addresses, check the targeted accounts and enforce MFA.",
                        "Medium": "Review which accounts and sources caused the failures.",
                        "Low": "No action needed."},
    "page_script_telemetry": {"High": "Close the page, block the script's domains and check browser extensions.",
                              "Medium": "Check the page's scripts and extensions if the CPU load continues.",
                              "Low": "No action needed."},
    "pe_file_features": {"High": "Quarantine the file and run it in the Sandbox before anyone opens it.",
                         "Medium": "Do not run it until its hash and signer are checked.",
                         "Low": "No action needed unless other evidence appears."},
    "ip_reputation": {"High": "Block the IP at the firewall and review any connections it made.",
                      "Medium": "Review connections to it and block it if they are unexpected.",
                      "Low": "Watch it, but a lone listing is not enough to block."},
}


def record_answer(kind: str, level: str, reasons: List[str], unverified: str, rng: random.Random) -> str:
    return bullets(reasons[:3] + [unverified, RECORD_ACTIONS[kind][level]], head=f"Risk Level: {level}")


def num(v):
    """A record value as it should read: 2 not 2.0, 0.596 not 0.59612."""
    if isinstance(v, str):
        return v
    v = float(v)
    return int(v) if v.is_integer() else round(v, 3)


ASK_RECORD = ["Assess this alert from the CyberForge sensor:\n{r}", "Is this a threat?\n{r}",
              "Explain this security event and how serious it is:\n{r}", "Triage this:\n{r}"]


def records(rng: random.Random, per: int) -> List[Dict]:
    out = []

    def add(kind: str, row: Dict, level: str, reasons: List[str], unverified: str, label):
        rec = json.dumps({"type": kind, **{k: num(v) for k, v in row.items()}}, indent=1)
        out.append(dict(mode="analyst", family=f"record_{kind}", user=rng.choice(ASK_RECORD).format(r=rec),
                        answer=record_answer(kind, level, reasons, unverified, rng),
                        meta={"label": label, "source": f"Che237/cyberforge-datasets {kind}", "risk": level}))

    ws = DATASETS / "web_security"

    def sample(path: Path, label_col: str) -> pd.DataFrame:
        df = pd.read_csv(path, dtype=str)
        # some files carry git conflict markers ("<<<<<<< Updated upstream") as rows
        df = df[~df.iloc[:, 0].str.match(r"^(<{7}|={7}|>{7})", na=True)]
        for col in df.columns:
            converted = pd.to_numeric(df[col], errors="coerce")
            if converted.notna().all():
                df[col] = converted
        df = df[df[label_col].isin([0, 1])]
        pos, neg = df[df[label_col] == 1], df[df[label_col] == 0]
        k = per // 2
        return pd.concat([pos.sample(min(k, len(pos)), random_state=1), neg.sample(min(k, len(neg)), random_state=1)])

    # TLS certificates: the issues in the record decide the level
    for _, r in sample(ws / "ssl_certificates/ssl_certificates_processed.csv", "is_suspicious").iterrows():
        issues = []
        if r.domain_mismatch: issues.append("The certificate does not match the domain it was served for.")
        if r.self_signed: issues.append("It is self-signed, so no trusted authority vouches for it.")
        if not r.issuer_trusted and not r.self_signed: issues.append("The issuer is not a trusted authority.")
        if r.expired: issues.append("The certificate has expired.")
        if r.weak_cipher: issues.append("The connection offers a weak cipher.")
        if r.key_size < 2048: issues.append(f"The key is only {int(r.key_size)} bits.")
        level = "High" if (r.domain_mismatch or len(issues) >= 3) else "Medium" if issues else "Low"
        if not issues:
            issues = [f"Trusted issuer, valid for {int(r.cert_validity_days)} days, {int(r.key_size)}-bit key, no mismatch."]
        row = {k: (int(v) if k != "cert_validity_days" else int(v)) for k, v in r.items() if k != "is_suspicious"}
        add("tls_certificate", row, level, issues, "The site's identity and reputation beyond the certificate are unverified.", int(r.is_suspicious))

    # DNS queries
    for _, r in sample(DATASETS / "dns_tunneling/dns_tunneling_processed.csv", "is_tunneling").iterrows():
        reasons, score = [], 0
        if r.query_name_length >= 60: reasons.append(f"The query name is {int(r.query_name_length)} characters long, typical of data packed into DNS."); score += 2
        elif r.query_name_length >= 45: reasons.append(f"The query name is long ({int(r.query_name_length)} characters)."); score += 1
        if r.subdomain_count >= 5: reasons.append(f"It has {int(r.subdomain_count)} subdomain levels."); score += 1
        if r.query_type in ("TXT", "NULL"): reasons.append(f"{r.query_type} records are a common tunneling carrier."); score += 1
        if r.response_code == "NXDOMAIN": reasons.append("The name does not resolve (NXDOMAIN), seen with DGA and tunneling."); score += 1
        level = "High" if score >= 3 else "Medium" if score >= 2 else "Low"
        if not reasons: reasons = [f"An ordinary {r.query_type} lookup of normal length that resolved ({r.response_code})."]
        add("dns_query", {k: (v if isinstance(v, str) else int(v)) for k, v in r.items() if k != "is_tunneling"},
            level, reasons, "Query volume over time and the destination domain's reputation are unverified.", int(r.is_tunneling))

    # HTTP requests (the record's attack_type column is the label; it is not shown)
    for _, r in sample(ws / "http_csic_requests/http_csic_requests_processed.csv", "is_attack").iterrows():
        reasons = []
        if r.sql_keywords >= 2: reasons.append(f"{int(r.sql_keywords)} SQL keywords in the request, a SQL-injection pattern.")
        if r.script_tags: reasons.append(f"{int(r.script_tags)} script tag(s), a cross-site scripting pattern.")
        if r.path_traversal: reasons.append(f"{int(r.path_traversal)} directory-traversal sequence(s) such as ../.")
        if r.encoded_chars >= 10: reasons.append(f"{int(r.encoded_chars)} encoded characters, often used to slip payloads past filters.")
        if r.special_chars >= 30: reasons.append(f"{int(r.special_chars)} special characters for a {int(r.url_length)}-character URL.")
        n = len(reasons)
        level = "High" if (r.sql_keywords >= 2 or r.script_tags or r.path_traversal) and n >= 2 else "Medium" if n else "Low"
        if not reasons: reasons = [f"A {r.method} request with {int(r.param_count)} parameter(s) and no injection markers."]
        row = {k: (v if isinstance(v, str) else int(v)) for k, v in r.items() if k not in ("is_attack", "attack_type")}
        add("http_request", row, level, reasons, "Whether the server is actually vulnerable is unverified.", int(r.is_attack))

    # Host logs
    for _, r in sample(ws / "system_logs_hdfs/system_logs_hdfs_processed.csv", "is_anomaly").iterrows():
        reasons, score = [], 0
        if r.failed_auth_count >= 20: reasons.append(f"{int(r.failed_auth_count)} failed logins in the window, consistent with brute force or password spraying."); score += 2
        elif r.failed_auth_count >= 8: reasons.append(f"{int(r.failed_auth_count)} failed logins, above normal."); score += 1
        if r.error_rate >= 0.2: reasons.append(f"An error rate of {r.error_rate:.0%}."); score += 1
        if r.unique_ips >= 100: reasons.append(f"{int(r.unique_ips)} distinct source IPs."); score += 1
        if r.log_level in ("CRITICAL", "ERROR"): reasons.append(f"Logged at {r.log_level} level."); score += 1
        if r.hour_of_day in (0, 1, 2, 3, 4) and score: reasons.append(f"It happened at {int(r.hour_of_day)}:00, outside working hours.")
        level = "High" if score >= 3 else "Medium" if score >= 1 else "Low"
        if not reasons: reasons = [f"Normal volume, {int(r.failed_auth_count)} failed login(s) and a {r.error_rate:.0%} error rate."]
        row = {k: (v if isinstance(v, str) else round(float(v), 3)) for k, v in r.items() if k != "is_anomaly"}
        add("host_log_window", row, level, reasons, "Which accounts and source addresses were involved is unverified.", int(r.is_anomaly))

    # Mining-script telemetry from a page
    for _, r in sample(ws / "cryptomining_scripts/cryptomining_scripts_processed.csv", "is_miner").iterrows():
        reasons, score = [], 0
        if r.cpu_usage_spike >= 70: reasons.append(f"CPU spiked to {r.cpu_usage_spike:.0f}% while the page was open."); score += 1
        if r.wasm_modules: reasons.append(f"{int(r.wasm_modules)} WebAssembly module(s), common in browser miners."); score += 1
        if r.crypto_api_calls >= 500: reasons.append(f"{int(r.crypto_api_calls)} crypto API calls."); score += 1
        if r.websocket_connections >= 3: reasons.append(f"{int(r.websocket_connections)} WebSocket connections, as miners use to reach pools."); score += 1
        if r.obfuscation_level >= 0.5: reasons.append(f"Obfuscation level {r.obfuscation_level:.2f}."); score += 1
        level = "High" if score >= 3 else "Medium" if score >= 2 else "Low"
        if not reasons: reasons = [f"CPU at {r.cpu_usage_spike:.0f}%, no WebAssembly and few crypto calls: no mining pattern."]
        row = {k: round(float(v), 3) for k, v in r.items() if k != "is_miner"}
        add("page_script_telemetry", row, level, reasons, "The script's origin and the mining pool are unverified.", int(r.is_miner))

    # PE file features
    for _, r in sample(ws / "malware_pe_features/malware_pe_features_processed.csv", "is_malware").iterrows():
        reasons, score = [], 0
        if r.entropy >= 7.0: reasons.append(f"Entropy {r.entropy:.2f} suggests packed or encrypted content."); score += 1
        if r.packed: reasons.append("The file is flagged as packed."); score += 1
        if r.suspicious_api_calls >= 10: reasons.append(f"{int(r.suspicious_api_calls)} suspicious API imports (injection, keylogging or persistence)."); score += 2
        elif r.suspicious_api_calls >= 5: reasons.append(f"{int(r.suspicious_api_calls)} suspicious API imports."); score += 1
        if r.suspicious_strings >= 20: reasons.append(f"{int(r.suspicious_strings)} suspicious strings."); score += 1
        level = "High" if score >= 3 else "Medium" if score >= 2 else "Low"
        if not reasons: reasons = [f"Entropy {r.entropy:.2f}, not packed, {int(r.suspicious_api_calls)} suspicious imports: nothing stands out."]
        row = {k: (round(float(v), 3) if isinstance(v, float) else int(v)) for k, v in r.items() if k != "is_malware"}
        add("pe_file_features", row, level, reasons, "The file hash, signer and sandbox behaviour are unverified; static features alone are not proof.", int(r.is_malware))

    # IPsum: how many blocklists list an IP (the real public feed)
    lines = [l.split() for l in (DATASETS / "threat_intelligence/threat_intelligence.txt").read_text().splitlines()
             if l and not l.startswith("#")]
    lines = [(ip, int(n)) for ip, n in lines if n.isdigit()]
    by_n: Dict[int, List[str]] = {}
    for ip, n in lines:
        by_n.setdefault(n, []).append(ip)
    picks = []
    for n, ips in sorted(by_n.items()):
        picks += [(ip, n) for ip in rng.sample(ips, min(len(ips), max(4, per // len(by_n))))]
    for ip, n in rng.sample(picks, min(per, len(picks))):
        level = "High" if n >= 6 else "Medium" if n >= 3 else "Low"
        reasons = [f"{ip} appears on {n} public blocklist{'s' if n > 1 else ''} in the IPsum feed."]
        reasons.append("Several independent lists agree, so it is likely abusive (scanning, brute force or spam)." if n >= 3
                       else "A single or double listing is weak evidence; shared and cloud IPs get listed too.")
        row = {"ip": ip, "feed": "IPsum", "blocklists": n}
        add("ip_reputation", row, level, reasons, "What the IP does today and who uses it now are unverified; listings age quickly.", n)

    # Windows CBS servicing log lines (real logs, routine by nature)
    logs = pd.read_csv(DATASETS / "anomaly_detection/anomaly_detection.csv")
    for _, r in logs.sample(min(per // 2, len(logs)), random_state=2).iterrows():
        user = rng.choice(["Is this Windows log line a sign of an attack?\n", "Explain this log entry:\n", "Triage this:\n"])
        user += f"{r.Date} {r.Time}, {r.Level}, {r.Component}: {str(r.Content)[:300]}"
        reasons = [f"This is a {r.Component} (Component-Based Servicing) entry: Windows Update and component servicing.",
                   "It records routine servicing activity, not an attack technique."]
        if str(r.Level).lower() in ("error", "warning"):
            reasons.append(f"The {r.Level} level usually means a failed or deferred update step, worth checking only if it repeats.")
        out.append(dict(mode="analyst", family="record_windows_log", user=user,
                        answer=bullets(reasons + ["No action needed beyond keeping updates healthy."], head="Risk Level: Low"),
                        meta={"label": 0, "source": "Che237/cyberforge-datasets anomaly_detection (CBS log)", "risk": "Low"}))
    return out


# ---------------------------------------------------------------------------
# Claims the prompt gives no evidence for
# ---------------------------------------------------------------------------

def unverified(rng: random.Random, n: int) -> List[Dict]:
    out = []
    for _ in range(n):
        kind = rng.choice(["hash", "hash", "ip", "cve", "domain"])
        if kind == "hash":
            h = "".join(rng.choice("0123456789abcdef") for _ in range(rng.choice([32, 40, 64])))
            user = rng.choice(["What is the reputation of the file hash {x}?", "Is {x} malware?", "Check this hash: {x}",
                               "Our EDR quarantined a file with SHA {x}. How bad is it?"]).format(x=h)
            lines = ["No reputation lookup for this hash was provided, so its verdict is unverified.",
                     "Low here reflects missing evidence, not a clean result.",
                     "Look it up in a reputation service such as VirusTotal, or run the file in the Sandbox.",
                     "Keep the file quarantined until it is checked."]
        elif kind == "ip":
            ip = ".".join(str(rng.randint(1, 223)) for _ in range(4))
            user = rng.choice(["Is {x} a malicious IP?", "We see connections to {x}. Is that bad?", "reputation of {x}?"]).format(x=ip)
            lines = [f"No reputation or threat-intel record for {ip} was provided, so it is unverified.",
                     "Low reflects the absence of evidence, not a clean bill of health.",
                     "Check it against a threat-intel feed and review which process made the connections."]
        elif kind == "cve":
            cve = f"CVE-{rng.randint(2019, 2026)}-{rng.randint(20000, 59999)}"
            user = rng.choice(["Explain {x} and whether we are affected.", "How severe is {x}?", "Is {x} being exploited?"]).format(x=cve)
            lines = [f"No advisory or scan result for {cve} was provided, so its details here are unverified.",
                     "Exposure depends on whether you run an affected version.",
                     "Check the vendor advisory and NVD entry for affected versions, CVSS and fixes, then patch."]
        else:
            d = rng.choice(["secure", "login", "account", "portal", "my", "app", "online"]) + rng.choice(["-", ""]) + \
                rng.choice(["wallet", "billing", "support", "verify", "service", "center"]) + rng.choice([".com", ".net", ".info", ".co"])
            user = rng.choice(["Has {x} been reported for phishing?", "What do threat feeds say about {x}?"]).format(x=d)
            lines = [f"No threat-feed or reputation result for {d} was provided, so its reports are unverified.",
                     "Low reflects missing evidence, not proof that it is safe.",
                     "Scan it in the Analyzer to get detector results before visiting."]
        out.append(dict(mode="analyst", family=f"unverified_{kind}", user=user,
                        answer=bullets(lines, head="Risk Level: Low"), meta={"risk": "Low", "label": None}))
    return out


# ---------------------------------------------------------------------------
# General knowledge: analyst bullets and assistant prose
# ---------------------------------------------------------------------------

def assistant_prose(points: List[str], steps: bool, rng: random.Random) -> str:
    if steps:
        lead = rng.choice(["Here's what to do:", "These steps help:", "Here is what I'd do:"])
        return lead + "\n" + "\n".join(f"{i}. {p}" for i, p in enumerate(points, 1))
    return " ".join(points)


def knowledge(rng: random.Random) -> List[Dict]:
    out = []
    for t in TOPICS:
        held = t["q"][0] in HELD_OUT_TOPICS
        for q in t["q"]:
            split = "test" if held else None
            pts = t["points"]
            out.append(dict(mode="analyst", family="general", user=q, answer=bullets(pts), split=split,
                            meta={"risk": None, "topic": t["q"][0]}))
            out.append(dict(mode="assistant", family="general", user=q, split=split,
                            answer=assistant_prose(pts, t.get("steps", False), rng), meta={"risk": None, "topic": t["q"][0]}))
    for user_variants, answers in SMALL_TALK:
        for u in user_variants:
            for variant in {u, u.capitalize(), u.rstrip("!?.")}:
                out.append(dict(mode="assistant", family="small_talk", user=variant, answer=rng.choice(answers), meta={"risk": None}))
    # the owner's hand-written scenarios (training_data/cybersecurity_scenarios.json), in the analyst format
    for s in json.loads((ML / "training_data/cybersecurity_scenarios.json").read_text()):
        level = re.search(r"RISK LEVEL:\s*(\w+)", s["output"]).group(1).capitalize()
        analysis = re.search(r"ANALYSIS:\s*(.+?)\n", s["output"]).group(1)
        recs = re.findall(r"\d\)\s*([^0-9]+?)(?=\s*\d\)|$)", re.search(r"RECOMMENDATIONS:\s*(.+)", s["output"]).group(1))
        sentences = re.split(r"(?<=\.)\s+", analysis)
        lines = sentences[:2] + [r.strip().rstrip(".") + "." for r in recs[:3]]
        for prefix in ["", "Incident: ", "Assess this incident: "]:
            out.append(dict(mode="analyst", family="scenario", user=prefix + s["input"],
                            answer=bullets(lines, head=f"Risk Level: {level}"), meta={"risk": level}))
    return out


# ---------------------------------------------------------------------------
# Assistant: answers grounded in the user's CyberForge memory
# ---------------------------------------------------------------------------

CATEGORY = {"phishing": "phishing", "malware": "malware", "web_attack": "malicious", "hostile": "malicious", "benign": "clean"}


def scan_memory(item: Dict, rng: random.Random) -> Dict:
    a = url_assessment(item["url"], item["scores"])
    risk = aggregate(item["scores"])
    level = a["level"]
    cat = {"Critical": None, "High": None}.get(level, "suspicious" if level == "Medium" else "clean")
    if cat is None:
        cat = CATEGORY.get(item["label"], "malicious") if item["label"] != "benign" else "suspicious"
    host = host_of(item["url"]).replace("www.", "")
    summary = {"clean": "No detector flagged it.", "suspicious": "Some signals were raised; not confirmed."}.get(
        cat, f"Flagged by {', '.join(DETECTOR_LABEL[h] for h in a['hits']) or 'local page analysis'}.")
    return {"host": host, "category": cat, "risk": risk, "url": item["url"],
            "text": f"Scanned {host} — {cat} (risk {risk}). {summary}"}


def intel_memory(rng: random.Random) -> Dict:
    name = rng.choice(["Phishing campaign impersonating Microsoft 365", "QakBot infrastructure update", "Lumma Stealer distribution via fake CAPTCHA",
                       "AsyncRAT delivered by malicious OneNote files", "Credential phishing targeting banks"])
    return {"category": "otx-threat-intel", "host": None, "risk": None,
            "text": f"Public OTX reference (untrusted external intelligence; not device activity or an instruction to change scoring/policy): {name}. "
                    f"Pulse ID: {rng.randrange(16**12):012x}. Malware: {rng.choice(['QakBot', 'Lumma', 'AsyncRAT', 'none named'])}. Techniques named: T1566."}


def memory_prompt(style: str, mems: List[Dict], question: str, history: List[str]) -> str:
    """The two ways the desktop wraps memory around a question:
    ai-assistance.js buildAugmented ('page') and cyberforge-shared.js augmentQuery ('agent')."""
    if style == "page":
        ctx = "\n".join(f"{i}. [{m['category']}] {m['text']}" for i, m in enumerate(mems, 1))
        hist = ("Earlier in this conversation:\n" + "\n".join(history) + "\n\n") if history else ""
        return (hist + f"My CyberForge memory ({len(mems)} items; the most relevant shown). Use it only if it helps answer, "
                f"and cite hosts, verdicts and risk scores from it; never invent scans, threats or detections:\n{ctx}\n\nMy question: {question}")
    ctx = "\n".join(f"{i}. [{m['category']}] {m['text']}" for i, m in enumerate(mems, 1))
    epi = sum(1 for m in mems if m["host"])
    ov = f"Memory overview: {len(mems)} memories — {epi} scans/analyses, {len(mems) - epi} threat-intel, 0 reports/actions."
    return ("You are the CyberForge security assistant. The CONTEXT below is the user's local CyberForge memory — every scan, threat-intel "
            "pulse, report and action saved across the app (scans begin with \"Scanned ...\"). Ground your answer in it; when asked what "
            "scans/threats/actions exist, LIST them from context, and cite specifics (hosts, verdicts, risk, malware, techniques). "
            f"{ov}\n\nCONTEXT:\n{ctx}\n\nQUESTION: {question}")


BAD = ("phishing", "malware", "malicious")


def memory_examples(pool: List[Dict], rng: random.Random, n: int) -> List[Dict]:
    out = []
    for _ in range(n):
        scans = [scan_memory(it, rng) for it in rng.sample(pool, rng.randint(2, 6))]
        mems = scans + ([intel_memory(rng)] if rng.random() < 0.35 else [])
        rng.shuffle(mems)
        bad = [m for m in scans if m["category"] in BAD]
        kind = rng.choice(["list_bad", "list_bad", "highest", "was_scanned", "not_scanned", "what_to_do", "summary"])
        if kind == "list_bad":
            q = rng.choice(["Have any of my scans found phishing or malware?", "what threats have you found?",
                            "Did CyberForge flag anything dangerous?", "List the risky sites I've scanned."])
            if bad:
                ans = (rng.choice(["Yes. ", "Yes, your memory shows "]) +
                       f"{len(bad)} flagged scan{'s' if len(bad) > 1 else ''}:\n" +
                       "\n".join(f"- {m['host']}: {m['category']}, risk {m['risk']}" for m in bad) +
                       "\nI'd avoid " + ("these sites" if len(bad) > 1 else "that site") + " and block them from Security Functions if you haven't.")
            else:
                ans = (f"No. None of the {len(scans)} scans in your memory was flagged as phishing or malware"
                       + ("; " + ", ".join(m["host"] for m in scans if m["category"] == "suspicious") + " raised some signals but nothing confirmed."
                          if any(m["category"] == "suspicious" for m in scans) else ".")
                       + " That only covers what was scanned.")
        elif kind == "highest":
            q = rng.choice(["Which scan had the highest risk?", "what's the most dangerous thing in my memory?"])
            m = max(scans, key=lambda s: s["risk"])
            ans = f"The highest-risk scan is {m['host']}, marked {m['category']} with risk {m['risk']}."
            ans += " Avoid it and consider blocking it." if m["category"] in BAD else " It was not confirmed as a threat."
        elif kind == "was_scanned":
            m = rng.choice(scans)
            q = rng.choice(["Is {h} safe?", "What did you find about {h}?", "did i scan {h}?"]).format(h=m["host"])
            verdict = {"clean": "no detector flagged it", "suspicious": "it raised some signals but nothing was confirmed"}.get(
                m["category"], f"it was flagged as {m['category']}")
            ans = f"Your memory has a scan of {m['host']}: {verdict} (risk {m['risk']})."
            ans += {"clean": " That's a good sign, though a scan covers that moment and that URL only.",
                    "suspicious": " Be careful there and avoid entering passwords unless you're sure it's the real site."}.get(
                m["category"], " I'd stay away from it and block it.")
        elif kind == "not_scanned":
            other = scan_memory(rng.choice(pool), rng)["host"]
            if any(other == m["host"] for m in scans):
                continue
            q = rng.choice(["Is {h} safe?", "Have you checked {h}?", "what do you know about {h}"]).format(h=other)
            ans = (f"I don't see a scan of {other} in your CyberForge memory, so I can't say whether it's safe. "
                   "Run it through the Analyzer and I can explain the result.")
        elif kind == "what_to_do":
            if not bad:
                continue
            m = rng.choice(bad)
            q = rng.choice(["I opened {h}, what should I do?", "What should I do about {h}?"]).format(h=m["host"])
            ans = (f"Your memory shows {m['host']} flagged as {m['category']} (risk {m['risk']}). If you entered a password there, "
                   "change it from the real site and turn on two-factor authentication. If you downloaded anything, run a full scan. "
                   "Then block the host from Security Functions.")
        else:
            q = rng.choice(["Summarize my recent scans.", "Give me an overview of my security memory."])
            parts = [f"{m['host']} ({m['category']}, risk {m['risk']})" for m in scans]
            ans = f"You have {len(scans)} scans in memory: " + "; ".join(parts) + "."
            ans += f" {len(bad)} {'were' if len(bad) != 1 else 'was'} flagged." if bad else " None was flagged."
            if any(m["category"] == "otx-threat-intel" for m in mems):
                ans += " The OTX pulse is public intelligence, not activity on your device."
        history = []
        if rng.random() < 0.25:
            history = ["User: hi", "Assistant: Hi! How can I help with your security today?"]
        style = rng.choice(["page", "page", "agent"])
        out.append(dict(mode="assistant", family=f"memory_{kind}", user=memory_prompt(style, mems, q, history), answer=ans,
                        meta={"risk": None, "hosts": [m["host"] for m in scans], "bad": [m["host"] for m in bad]}))
    return out


def assistant_link_examples(pool: List[Dict], rng: random.Random, n: int) -> List[Dict]:
    """A person asks about a link with no scan or memory in the message."""
    out = []
    for it in rng.sample(pool, min(n, len(pool))):
        url = it["url"]
        a = url_assessment(url, None)
        q = rng.choice(ASK_URL).format(u=url)
        if a["strong"]:
            obs = " and ".join(a["strong"][:2])
            ans = (f"I haven't scanned it, so I can't confirm, but the address itself has warning signs: {obs}. "
                   "Don't enter any passwords there. Run it through the Analyzer for a proper verdict.")
        else:
            ans = ("I haven't scanned it, so I can't tell you it's safe. Nothing in the address itself stands out, "
                   "but that doesn't rule out a malicious page. Run it through the Analyzer and I can explain the result.")
        out.append(dict(mode="assistant", family="assistant_link", user=q, answer=ans,
                        meta={"label": it["label"], "risk": None, "url": url}))
    return out


# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=str(HERE / "data"))
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--scale", type=float, default=1.0, help="multiply every sample size (0.1 for a quick run)")
    args = ap.parse_args()
    token = os.environ.get("HF_TOKEN") or None
    rng = random.Random(args.seed)
    s = lambda k: max(2, int(k * args.scale))

    print("loading URLs from the detectors' training sources ...", flush=True)
    urls = load_urls(token, rng, {"phishing": s(800), "benign": s(600), "malware": s(260), "older_benign": s(180),
                                  "reference": s(400), "attack": s(250)})
    print(f"  {len(urls)} URLs; scoring with the deployed detectors ...", flush=True)
    det = Detectors(token)
    for u in urls:
        u["scores"] = det.score(u["url"])
        u["split"] = split_of(registered_domain(u["url"]) or host_of(u["url"]))

    examples: List[Dict] = []
    for u in urls:
        for ex in url_examples(u, rng):
            ex["split"] = u["split"]
            examples.append(ex)
    for split in ("train", "val", "test"):
        pool = [u for u in urls if u["split"] == split]
        k = {"train": 1.0, "val": 0.05, "test": 0.1}[split]
        for ex in memory_examples(pool, rng, s(int(900 * k))) + assistant_link_examples(pool, rng, s(int(300 * k))):
            ex["split"] = split
            examples.append(ex)
    for ex in records(rng, s(130)) + unverified(rng, s(220)) + knowledge(rng):
        ex.setdefault("split", None)
        if ex["split"] is None:
            ex["split"] = split_of(ex["user"], test=0.06, val=0.04)
        examples.append(ex)

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    files = {k: open(out / f"{k}.jsonl", "w", encoding="utf-8") for k in ("train", "val", "test")}
    stats = {k: Counter() for k in files}
    risk_stats = {k: Counter() for k in files}
    seen = set()
    rng.shuffle(examples)
    for i, ex in enumerate(examples):
        key = (ex["mode"], ex["user"])
        if key in seen:
            continue
        seen.add(key)
        if ex["mode"] == "analyst":
            assert words(ex["answer"]) <= ANALYST_MAX_WORDS, ex["answer"]
        rec = {"id": f"cf-{i:05d}", "mode": ex["mode"], "family": ex["family"], "split": ex["split"],
               "messages": messages(ex["mode"], ex["user"], ex["answer"]), "meta": ex.get("meta", {})}
        files[ex["split"]].write(json.dumps(rec, ensure_ascii=False) + "\n")
        stats[ex["split"]][ex["family"]] += 1
        risk_stats[ex["split"]][str(rec["meta"].get("risk"))] += 1
    for f in files.values():
        f.close()
    summary = {k: {"total": sum(v.values()), "families": dict(sorted(v.items())), "risk": dict(risk_stats[k])} for k, v in stats.items()}
    summary["urls"] = {"total": len(urls), "by_label": dict(Counter(u["label"] for u in urls)),
                       "by_source": dict(Counter(u["source"] for u in urls))}
    (out / "stats.json").write_text(json.dumps(summary, indent=1))
    print(json.dumps({k: summary[k]["total"] for k in ("train", "val", "test")}))


if __name__ == "__main__":
    main()
