"""Additional scenario phrasings, excluded from training; authored after review."""
QUESTIONS = {
 "csrf": ["An admin panel authenticates with cookies and changes email addresses. Explain its CSRF protections.", "In a CSRF review, how should a framework developer combine token validation with SameSite cookies?"],
 "mfa-fatigue": ["Our helpdesk saw a burst of authentication approval notifications. Describe MFA fatigue using the reviewed facts.", "For push bombing, what should a user do with approvals they did not initiate?"],
 "heartbleed": ["An old asset inventory lists Heartbleed. Summarize the affected historical OpenSSL branch and memory exposure.", "What established facts should an incident report include about CVE-2014-0160 and credential review?"],
 "zero-trust": ["Under zero trust, what evidence does a corporate-owned workstation still need before accessing a resource?", "Explain zero trust to a team relying entirely on office-network membership."],
 "sql-injection": ["A query builder interpolates customer input into SQL. Explain SQL injection prevention from the source.", "In SQL injection prevention, do prepared statements separate query code and values or act as an attack detector?"],
 "xss": ["A comment widget displays arbitrary plain text. Explain the safe DOM approach for XSS prevention.", "A CMS permits formatted HTML comments. Summarize the reviewed cross-site scripting defences."],
 "ssrf": ["A document-fetching backend accepts user-supplied URLs. Explain SSRF destination validation.", "What does the SSRF reference recommend for an internal-service boundary and outbound requests?"],
 "quishing": ["A restaurant QR code sends visitors to an unexpected login page. Explain quishing and verification.", "What verified guidance applies to quishing when a QR code requests a payment?"],
 "cryptojacking": ["A cryptojacking report claims mined coins disappear from the victim's account. Give only the established facts about resource misuse.", "What process and connection evidence does the cryptojacking reference recommend investigating?"],
 "passwords": ["Distinguish password uniqueness from phishing-resistant passkeys using the password guidance.", "What does the reviewed password rotation material establish when an account secret may have leaked?"],
 "sessions": ["A proposal rotates a session cookie on every single request. State the reviewed session-management guidance.", "Which established session cookie controls protect transport and revoke exposed access?"],
 "rootkit": ["An investigation distrusts host inspection tools after a rootkit compromise. Explain why.", "What does the rootkit reference establish about concealment and trusted inspection?"],
 "sandbox": ["A file is inactive during isolated execution. Explain what a sandbox result establishes.", "What does sandbox isolation constrain, and what safety guarantee can an analyst make?"],
}
