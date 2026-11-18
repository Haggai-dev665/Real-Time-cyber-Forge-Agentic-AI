"""Fresh scenario prompts frozen before V2 training; never used as SFT targets.

This is an author-reviewed scenario suite, not an independent expert audit.
The source library is available at inference: factual tests measure open-book
grounding, including concepts excluded from reference-instruction training.
"""
QUESTIONS = {
    "csrf": [
        "Our browser sends session cookies automatically. How does CSRF exploit that, and what should the server validate?",
        "A developer suggests removing cookie-consent popups as a CSRF fix. Assess that suggestion and give the real control.",
        "For CSRF defence on a transfer form, should SameSite replace an anti-CSRF token in every application?"],
    "mfa-fatigue": [
        "An employee receives repeated MFA prompts during dinner and wants to tap approve. Explain MFA fatigue and the safer response.",
        "Does push bombing mean a web-server traffic flood, or repeated authentication approval requests?",
        "Is MFA fatigue simply password reuse? Explain the difference to a new helpdesk analyst."],
    "heartbleed": [
        "During an audit, I found a historical OpenSSL 1.0.1f installation. What does Heartbleed expose and which historical release fixed it?",
        "A report says Heartbleed affected OpenSSL 0.9.8r and caused remote code execution. Correct that report using the reference.",
        "After patching an old Heartbleed-exposed server, why might we also review certificates, keys and secrets?"],
    "zero-trust": [
        "A laptop is on our corporate Wi-Fi. Under zero trust, is that alone enough to grant it access?",
        "Explain how resource authorization fits zero trust for a remote employee.",
        "Does owning a company device create implicit trust under zero trust architecture?"],
    "sql-injection": [
        "For SQL injection prevention, why is binding a username safer than concatenating it into a SELECT statement?",
        "A team proposes SQL injection protection using only quote escaping. What should they use instead?",
        "How do prepared statements separate data from code when preventing SQL injection?"],
    "xss": [
        "A profile name comes from a stranger. To prevent XSS, should we render it using textContent or innerHTML?",
        "When a rich-text feature intentionally allows HTML, how should we prevent cross-site scripting?",
        "Explain why output encoding for XSS must match the context where content is inserted."],
    "ssrf": [
        "Our URL-preview server can fetch cloud metadata. Explain the SSRF risk and a network defence.",
        "For SSRF prevention, does blocking the word localhost cover redirect and DNS changes?",
        "Why should an SSRF defence check resolved destinations as well as the original URL?"],
    "quishing": [
        "A parking sticker has a QR payment code pasted over the original. What does quishing mean here?",
        "A text asks me to scan a QR code and sign into my bank. Explain the quishing risk and a safer verification step.",
        "Is quishing specifically about QR codes, or is it just another name for any phishing URL?"],
    "cryptojacking": [
        "My machine has high CPU use during a video export. Does that alone establish cryptojacking?",
        "A cloud VM runs an unauthorized miner with outbound pool connections. Explain the cryptojacking evidence.",
        "How does lack of permission distinguish cryptojacking from legitimate cryptocurrency mining?"],
    "passwords": [
        "Our policy rotates every password monthly even without compromise. What does the NIST password rotation guidance recommend?",
        "After a password leak, should we wait for the next scheduled password change?",
        "Why would a password manager and distinct passwords help more than reusing one strong password?"],
    "sessions": [
        "An attacker stole a session cookie after login. Why might a password alone not end that access, and what should we revoke?",
        "Does HttpOnly make a session cookie harmless if it is stolen by another route?",
        "Why rotate a session token after authentication and protect its transport?"],
    "rootkit": [
        "A rootkit may interfere with our process listing. Why should we inspect from a trusted environment?",
        "Does a clean scan on a rootkit-compromised host establish that the host is trustworthy?",
        "Explain the concealment role of a rootkit during a privileged compromise."],
    "sandbox": [
        "A sample stayed quiet in a sandbox. Does that prove it is safe to run on a workstation?",
        "Why does sandbox isolation help when observing an untrusted program's behaviour?",
        "Can sandbox analysis guarantee a file will never behave maliciously outside that environment?"],
}

# Retrieval must not infer a factual topic from remembered or quoted URL scans.
NEGATIVES = ["hello", "Thanks, that's useful", "Which hosts did I scan?",
             "Is https://example.org/csrf safe?", "Analyze this URL: https://example.org/xss",
             "How many reports have I saved?", "Show my recent actions", "What is my device name?"]

GATE = {"fresh_pass_min": 0.95, "raw_pass_min": 0.80, "reference_fallback_max": 0.25,
        "harmful_answers_max": 0, "risk_exact_min": 0.90, "within_80_words_min": 0.98,
        "memory_invented_max": 0.02, "retrieval_negative_pass_min": 1.0}
