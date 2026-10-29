"""Reviewed local reference retrieval shared by training, eval and serving.

Facts are editorial summaries of the cited primary sources, reviewed 2026-10-23.
This bounded library is not a live vulnerability feed or a reputation lookup.
"""
import re
import json
import itertools

REVISION = "2026-10-23.3"
POLICY = ("Detector policy: the supervised phishing, malware-URL and web-attack classifiers "
          "flag rescaled scores >= 0.50. The anomaly model measures unusualness, not proof "
          "of maliciousness. Name it separately; never say all detectors are below threshold "
          "when only the supervised classifiers are. No live reputation or page inspection "
          "is implied by these scores.")


def doc(id, title, aliases, facts, source, required, forbidden=()):
    return dict(id=id, title=title, aliases=aliases, facts=facts, url=source,
                required=required, forbidden=forbidden, reviewed="2026-10-23")


REFERENCES = [
    doc("csrf", "OWASP: CSRF prevention", [r"\bcsrf\b", r"cross.site request forgery"],
        "CSRF tricks a signed-in browser into sending unwanted requests using its existing session cookies. "
        "Use the framework's CSRF protection or validate anti-CSRF tokens for state-changing requests. "
        "SameSite cookies and Origin checks add protection. Cookie-consent banners do not prevent CSRF.",
        "https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html",
        [r"csrf|request forgery", r"token"], [r"(?:disable|disabling|remove|removing) cookie.consent"]),
    doc("mfa-fatigue", "MITRE ATT&CK: MFA request generation", [r"mfa fatigue", r"push bomb", r"mfa spam", r"repeated (?:mfa|login|sign.in|authentication) (?:push|prompt)"],
        "MFA fatigue or push bombing floods a user with repeated authentication approval requests. "
        "An attacker hopes the user approves a request to stop them. Reject unexpected prompts, report them, "
        "and investigate the account. Phishing-resistant MFA reduces exposure; password reuse is not its definition.",
        "https://attack.mitre.org/techniques/T1621/", [r"(?:mfa|authentication|sign.in|login)", r"(?:prompt|request|approval|notification)"],
        [r"(?:is|means) (?:the )?(?:risk of )?(?:logging in with a single password|password reuse)"]),
    doc("heartbleed", "OpenSSL: CVE-2014-0160", [r"heartbleed", r"cve.2014.0160"],
        "Heartbleed (CVE-2014-0160) is an OpenSSL TLS heartbeat memory-disclosure bug. "
        "OpenSSL 1.0.1 through 1.0.1f are affected; 1.0.1g fixed it. A historical 1.0.2 beta was also affected. "
        "Use a currently supported patched release. After exposure, assess replacing keys/certificates and rotating secrets.",
        "https://www.openssl-library.org/news/vulnerabilities-1.0.1/index.html",
        [r"(?:memory|disclos)", r"(?:heartbeat|openssl)"], [r"0\.9\.8", r"remote code execution"]),
    doc("zero-trust", "NIST SP 800-207: Zero trust", [r"zero.trust", r"trust.*(?:internal network|corporate network)"],
        "Zero trust grants no implicit trust solely because a user or device is on an internal network "
        "or belongs to the organisation. Authenticate and authorise access to resources explicitly. "
        "Least privilege limits exposure; network location alone is not proof of trust.",
        "https://csrc.nist.gov/pubs/sp/800/207/final", [r"(?:verif|authentic|authoris|authoriz)"]),
    doc("sql-injection", "OWASP: SQL injection prevention", [r"sql injection", r"\bsqli\b", r"parameteri[sz]ed quer"],
        "SQL injection happens when untrusted data changes a database query's meaning. "
        "Use parameterized queries or prepared statements that bind values separately from SQL code. "
        "Allow-list identifiers when binding is impossible and apply least privilege. Escaping alone is a fragile primary defence.",
        "https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html",
        [r"(?:parameter|prepared|bind)"]),
    doc("xss", "OWASP: DOM XSS prevention", [r"\bxss\b", r"cross.site scripting", r"(?:textcontent|innerhtml)"],
        "Cross-site scripting (XSS) lets untrusted content execute as script in a user's browser. "
        "Use context-appropriate output encoding and safe DOM APIs such as textContent for plain text. "
        "Sanitize HTML when HTML is intentionally allowed. Do not insert untrusted text using innerHTML.",
        "https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html",
        [r"(?:encod|saniti|textcontent|safe DOM)"], [r"use innerhtml to (?:display|render) untrusted"]),
    doc("ssrf", "OWASP: SSRF prevention", [r"\bssrf\b", r"server.side request forgery", r"cloud metadata.*url"],
        "Server-side request forgery (SSRF) makes a server issue requests to attacker-chosen destinations, "
        "potentially reaching internal services or cloud metadata. Validate destinations with appropriate allow-lists "
        "and restrict network egress. Validate resolved addresses and redirect destinations; blocking a few URL strings is insufficient.",
        "https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html",
        [r"(?:server|internal|metadata)", r"(?:allow.list|validat|egress)"]),
    doc("quishing", "US Postal Inspection Service: Quishing", [r"quishing", r"qr.*(?:phish|scam|malicious|parking)", r"(?:phish|scam).*qr"],
        "Quishing is phishing delivered through a QR code that leads to a deceptive destination. "
        "Preview and check the destination domain before opening it. Verify unexpected payment or sign-in requests "
        "through a trusted channel instead of the supplied QR code.",
        "https://www.uspis.gov/news/scam-article/quishing", [r"\bqr\b", r"(?:phish|decept|fraud)"]),
    doc("cryptojacking", "MITRE ATT&CK: Resource hijacking", [r"cryptojack", r"unauthori[sz]ed.*(?:crypto|miner|mining)", r"crypto.*without.*permission"],
        "Cryptojacking uses computing resources to mine cryptocurrency without the owner's permission. "
        "Investigate unexpected CPU usage together with processes and outbound mining connections. "
        "High CPU alone does not confirm malicious mining; resource-intensive legitimate work can look similar.",
        "https://attack.mitre.org/techniques/T1496/", [r"(?:permission|unauthor|consent)", r"(?:mining|mine|cryptocurrency)"]),
    doc("passwords", "NIST SP 800-63B: Authentication", [r"password.*(?:rotat|expir|change|reuse|manager)", r"(?:rotat|expir).*password", r"passkey"],
        "Use distinct strong passwords and a password manager. Do not require arbitrary periodic password changes "
        "without evidence of compromise; require changes when compromise is suspected or confirmed. "
        "Phishing-resistant authenticators such as passkeys are preferable to reusable passwords where available.",
        "https://pages.nist.gov/800-63-4/sp800-63b.html", [r"(?:compromis|passkey|manager|distinct|unique)"]),
    doc("sessions", "OWASP: Session management", [r"session (?:cookie|token|hijack)", r"stolen.*cookie", r"httponly"],
        "Session cookies can grant access to an already authenticated session. Protect them with HTTPS, "
        "Secure, HttpOnly and appropriate SameSite settings. Rotate session identifiers after authentication "
        "and revoke exposed sessions. HttpOnly limits script access; it does not prevent every attack or make stolen cookies harmless.",
        "https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html",
        [r"(?:session|cookie)", r"(?:revok|httponly|secure|rotat)"]),
    doc("rootkit", "NIST glossary: Rootkit", [r"rootkit"],
        "A rootkit is malicious software that conceals activity and supports privileged access on a compromised system. "
        "It can interfere with the tools used to inspect that system. Investigate from trusted tools or media; "
        "a clean result from tools running on the compromised host does not establish that it is trustworthy.",
        "https://csrc.nist.gov/glossary/term/rootkit", [r"(?:hid|conceal|stealth)"]),
    doc("sandbox", "NIST glossary: Sandbox", [r"sandbox", r"isolated.*(?:malware|sample)"],
        "A sandbox isolates execution to constrain a program's access to other resources. "
        "Security analysis can observe a sample's behaviour inside such an environment. "
        "Isolation reduces exposure but does not prove a sample is safe; quiet behaviour in one analysis is not a guarantee.",
        "https://csrc.nist.gov/glossary/term/sandbox", [r"(?:isolat|constrain|restrict)"]),
]


def question_text(user):
    # Match the person's current question, never remembered scans or conversation.
    for marker in ("\n\nMy question: ", "\n\nQUESTION: ", "[USER MESSAGE]\n", "\n\nUser: "):
        if marker in user:
            return user.rsplit(marker, 1)[1][:1200]
    return user.split("\n\nCONTEXT:", 1)[0][:1200]


def retrieve(user):
    query = question_text(user)
    if re.search(r"https?://|\[ML PRE-SCAN|ML phishing_detection", query, re.I):
        return []
    return [r for r in REFERENCES if any(re.search(a, query, re.I) for a in r["aliases"])][:2]


def ground_prompt(system, user):
    refs = retrieve(user)
    if any(marker in user for marker in ("ml_scores", "ML phishing_detection", "[ML PRE-SCAN RESULTS]")):
        system += "\n\n" + POLICY
    if refs:
        system += ("\n\nVERIFIED REFERENCE CONTEXT (editorially reviewed; use for factual claims). "
                   "Answer using only complete sentences copied from the facts below. "
                   "Select the relevant sentences; you may omit others and format them as bullets. "
                   "Do not paraphrase, add yes/no introductions, risk labels, causes, versions or remedies. "
                   "If a requested detail is absent, give only the relevant established facts.\n")
        system += "\n".join(f"[{r['id']}] {r['facts']}" for r in refs)
    return system, refs


def reference_fallback_needed(text, refs):
    if not refs:
        return False
    if any(not all(re.search(p, text, re.I) for p in r["required"])
           or any(re.search(p, text, re.I) for p in r["forbidden"]) for r in refs):
        return True
    # Literal sentence support is conservative: a sensible paraphrase may also
    # use the explicit reference response. Keyword presence cannot establish
    # that a newly generated mechanism or recommendation is supported.
    normalize = lambda s: " ".join(re.findall(r"[\w]+", s.lower()))
    sentences = lambda s: re.split(r"(?<=[.!?])\s+|\n+", s.strip())
    allowed = {normalize(s) for r in refs for s in sentences(r["facts"])}
    for sentence in sentences(text):
        sentence = re.sub(r"^\s*(?:[-*•]\s+|\d+\.\s+)", "", sentence)
        sentence = sentence.replace("**", "").strip()
        if normalize(sentence) and normalize(sentence) not in allowed:
            return True
    return False


def reference_choices(refs, analyst=False):
    """Bound decoding to reviewed passages, never to user-supplied strings.

    The model selects a full or concise passage for each retrieved reference.
    This is extractive generation, not a test of unaided factual recall.
    Every option retains the definition and required core facts; the separate
    sentence guard still handles interruption or token-budget truncation.
    """
    if not refs:
        return []
    choices = []
    for ref in refs:
        sentences = re.split(r"(?<=[.!?])\s+", ref["facts"])
        variants = [ref["facts"], " ".join(sentences[:2])]
        choices.append(list(dict.fromkeys(v for v in variants
                       if not reference_fallback_needed(v, [ref]))))
    answers = []
    for parts in itertools.product(*choices):
        text = ("\n".join("- " + p for p in parts) if analyst else "\n\n".join(parts))
        if (not analyst or len(text.split()) <= 80) and not reference_fallback_needed(text, refs):
            answers.append(text)
    if not answers:
        raise ValueError("Reviewed references have no supported response within the answer budget")
    return answers


def reference_grammar(refs, analyst=False):
    """GBNF literals escape only immutable editorial text, not the question."""
    choices = reference_choices(refs, analyst)
    return "root ::= " + " | ".join(json.dumps(c, ensure_ascii=False) for c in choices) if choices else None


def finish_grounded_answer(text, refs, analyst=False):
    """Expose an explicit reference answer when the model misses core facts.

    This narrow check does not claim to verify every generated assertion.
    Raw model answers are evaluated separately from the served response.
    """
    fallback = reference_fallback_needed(text, refs)
    if fallback:
        if analyst:
            facts = [r["facts"] if len(refs) == 1 else " ".join(re.split(r"(?<=[.!?])\s+", r["facts"])[:2]) for r in refs]
            text = "\n".join("- " + fact for fact in facts)
        else:
            text = "\n\n".join(r["facts"] for r in refs)
    return text, {"mode": "verified_reference" if fallback else "retrieved_context" if refs else "model_context",
                  "revision": REVISION, "references": [{k: r[k] for k in ("id", "title", "url", "reviewed")} for r in refs]}
