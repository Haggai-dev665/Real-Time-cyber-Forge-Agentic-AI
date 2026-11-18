"""Reviewed local reference retrieval shared by training, eval and serving.

Facts are editorial summaries of the cited primary sources, reviewed 2026-10-23.
This bounded library is not a live vulnerability feed or a reputation lookup.
"""
import re
import json
import itertools

REVISION = "2026-11-17.1"
POLICY = ("Detector policy: the supervised phishing, malware-URL and web-attack classifiers "
          "flag rescaled scores >= 0.50. The anomaly model measures unusualness, not proof "
          "of maliciousness. Name it separately; never say all detectors are below threshold "
          "when only the supervised classifiers are. No live reputation or page inspection "
          "is implied by these scores.")


def doc(id, title, aliases, facts, source, required, forbidden=(), reviewed="2026-10-23"):
    return dict(id=id, title=title, aliases=aliases, facts=facts, url=source,
                required=required, forbidden=forbidden, reviewed=reviewed)


def doc2(*args, **kwargs):
    """A reference added in the November 2026 review (sources checked to resolve on 2026-11-17)."""
    return doc(*args, reviewed="2026-11-17", **kwargs)


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

    # ── Added 2026-11-17. More specific topics first: retrieval takes the first two matches. ──
    doc2("clickfix", "MITRE ATT&CK: Malicious copy and paste (T1204.004)",
         [r"click.?fix", r"fake captcha", r"(?:paste|copied).*(?:run (?:box|dialog)|powershell|terminal|command)", r"win(?:dows)?\s*(?:key\s*)?\+\s*r\b", r"verify (?:you are|i am) (?:a )?human.*(?:paste|command|run)"],
         "ClickFix pages, often disguised as a CAPTCHA or a fix for an error, trick people into copying a command and pasting it into the Windows Run dialog, PowerShell or a terminal. "
         "Running it usually downloads malware such as an information stealer. A real CAPTCHA or website never asks you to run commands on your computer. "
         "If you already ran one, disconnect from the network, run a full anti-malware scan and change your passwords from a different, clean device.",
         "https://attack.mitre.org/techniques/T1204/004/", [r"(?:paste|copy|copied)", r"(?:command|run|powershell|terminal)"],
         [r"(?:it is|it's|is) (?:safe|fine|ok(?:ay)?) to (?:run|paste)"]),
    doc2("infostealer", "MITRE ATT&CK: Credentials from web browsers (T1555.003)",
         [r"info.?stealer", r"stealer (?:malware|log)", r"\b(?:redline|lumma|raccoon|vidar)\b", r"(?:saved|stored) passwords?.*(?:stolen|steal|browser)"],
         "Information stealers are malware that collect saved browser passwords, cookies, autofill data and cryptocurrency wallets and send them to the attacker. "
         "Stolen session cookies can let an attacker into an account without the password or the MFA prompt. "
         "After an infection, clean or reinstall the device first, then change passwords and sign out all sessions from a clean device. "
         "Passkeys and phishing-resistant MFA make stolen passwords far less useful.",
         "https://attack.mitre.org/techniques/T1555/003/", [r"(?:password|cookie|credential)", r"(?:steal|stolen|collect)"]),
    doc2("keylogger", "MITRE ATT&CK: Keylogging (T1056.001)", [r"key.?logg", r"keystroke (?:log|record|captur)"],
         "A keylogger records keystrokes to capture passwords and other typed information. "
         "It can be malicious software or a small hardware device placed between the keyboard and the computer. "
         "Keep the system updated, use reputable anti-malware, and use MFA or passkeys so a captured password alone is not enough.",
         "https://attack.mitre.org/techniques/T1056/001/", [r"(?:keystroke|typed|type|keys)"]),
    doc2("aitm", "MITRE ATT&CK: Adversary-in-the-middle (T1557)", [r"man.in.the.middle", r"\bmitm\b", r"adversary.in.the.middle", r"\baitm\b"],
         "In an adversary-in-the-middle (man-in-the-middle) attack, the attacker sits between two parties to read or alter their traffic. "
         "Phishing kits use it to relay a real sign-in page and capture the session cookie, which can bypass ordinary MFA codes. "
         "HTTPS with valid certificates protects traffic in transit, and phishing-resistant MFA such as FIDO2 security keys or passkeys resists relayed sign-ins.",
         "https://attack.mitre.org/techniques/T1557/", [r"(?:between|intercept|relay|alter|read)"]),
    doc2("credential-stuffing", "OWASP: Credential stuffing prevention", [r"credential.stuffing", r"(?:leaked|breached|reused) passwords?.*(?:attack|login|sign.in)"],
         "Credential stuffing uses username and password pairs leaked from one site to try to sign in to other sites, relying on password reuse. "
         "A unique password for every account and multi-factor authentication are the main defences for users. "
         "Services add MFA, breached-password checks, rate limiting and bot detection.",
         "https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html", [r"(?:reuse|leak|breach)"]),
    doc2("brute-force", "MITRE ATT&CK: Brute force (T1110)", [r"brute.?forc", r"password spray", r"dictionary attack", r"(?:many|repeated) failed (?:log.?ins?|sign.?ins?|logins?)"],
         "Brute-force attacks guess passwords repeatedly; password spraying tries a few common passwords against many accounts to avoid lockouts. "
         "Long, unique passwords and MFA defeat most guessing. "
         "Rate limiting, lockout or delay policies and alerts on many failed sign-ins slow attacks down and help detect them.",
         "https://attack.mitre.org/techniques/T1110/", [r"(?:guess|tries|trying|attempt)"]),
    doc2("dga", "MITRE ATT&CK: Domain generation algorithms (T1568.002)", [r"\bdga\b", r"domain generation algorithm"],
         "A domain generation algorithm (DGA) lets malware compute many pseudo-random domain names to find its command-and-control server, so blocking one domain does not cut it off. "
         "Such domains often look random, though some DGAs combine dictionary words. "
         "Detection looks at how random a domain is, many failed DNS lookups (NXDOMAIN) and newly registered domains.",
         "https://attack.mitre.org/techniques/T1568/002/", [r"domain", r"(?:command|control|\bc2\b|malware)"]),
    doc2("privilege-escalation", "MITRE ATT&CK: Privilege escalation (TA0004)", [r"privilege escalation", r"escalat\w* privileges?", r"\bpriv.?esc\b"],
         "Privilege escalation is how an attacker gains higher permissions, such as administrator or SYSTEM, than they first obtained. "
         "Common routes are unpatched vulnerabilities, misconfigurations and stolen administrator credentials. "
         "Least privilege, prompt patching and monitoring administrative changes reduce the risk.",
         "https://attack.mitre.org/tactics/TA0004/", [r"(?:permission|privilege|admin)"]),
    doc2("lateral-movement", "MITRE ATT&CK: Lateral movement (TA0008)", [r"lateral movement", r"move\w* laterally"],
         "Lateral movement is how an attacker moves from the first compromised system to others in the network, often with stolen credentials and remote-access tools. "
         "Network segmentation, least privilege, MFA for remote access and monitoring of unusual internal sign-ins limit it.",
         "https://attack.mitre.org/tactics/TA0008/", [r"(?:other|network|systems|machines)"]),
    doc2("sextortion", "NCSC: Sextortion scams", [r"sextortion", r"(?:hacked|recorded).*webcam", r"webcam.*(?:recorded|hacked|video)", r"(?:email|message).*(?:pay|send).*bitcoin.*(?:video|recorded)"],
         "Sextortion scam emails claim to have hacked your webcam or recorded you and demand payment, often in cryptocurrency, sometimes quoting an old password from a data breach to seem credible. "
         "In most cases the claim is false. Do not reply or pay; change any password the email mentions and report the email.",
         "https://www.ncsc.gov.uk/guidance/sextortion-scams-how-to-protect-yourself", [r"(?:do not|don't|never|not) (?:reply|pay|respond)"],
         [r"(?:you should|best to|just) pay"]),
    doc2("bec", "IC3: Business email compromise", [r"business email compromise", r"\bbec\b", r"(?:ceo|invoice|payroll|wire.transfer) (?:fraud|scam)", r"change (?:of |in |to )?(?:the )?(?:bank|payment|account) details"],
         "Business email compromise (BEC) is fraud in which criminals impersonate an executive, supplier or colleague by email to get money or data, for example a request to change bank details or pay an urgent invoice. "
         "It often uses a lookalike domain or a hacked mailbox, so the email can look genuine. "
         "Verify every payment or bank-detail change by calling a known phone number, not one in the email, and require two people to approve transfers.",
         "https://www.ic3.gov/PSA/2023/PSA230609", [r"(?:impersonat|pretend|pos(?:e|ing) as|fake)", r"(?:verif|confirm|call)"]),
    doc2("clicked-phishing", "NCSC: What to do if you clicked a suspicious link", [r"(?:clicked|opened|tapped|followed) (?:on )?(?:a |the |an )?(?:phishing |suspicious |bad |malicious |dodgy |scam )?(?:link|attachment|email)", r"entered my (?:password|details|card|bank)", r"gave (?:them |away )?(?:my )?(?:password|details|otp|code|pin)"],
         "If you clicked a suspicious link but entered nothing, close the page and run an anti-malware scan; the risk is usually low. "
         "If you entered a password, change it straight away on the real site and anywhere else you reused it, and turn on multi-factor authentication. "
         "If you gave card or bank details, contact your bank immediately; if you opened an attachment or ran a file, disconnect the device and scan it.",
         "https://www.ncsc.gov.uk/guidance/suspicious-email-actions", [r"(?:change|password|bank|scan)"]),
    doc2("hacked-account", "NCSC: Recovering a hacked account", [r"(?:account|email|facebook|instagram|whatsapp|gmail|outlook|tiktok).*(?:hacked|compromised|taken over|broken into)", r"hacked (?:account|email)", r"someone (?:logged|signed) (?:in|into) my", r"locked out of my (?:account|email)"],
         "If an account is hacked, use the service's official recovery page to regain access, then change the password to a unique one and turn on multi-factor authentication. "
         "Sign out of all other sessions and check the recovery email, phone number, forwarding rules and connected apps for changes the attacker made. "
         "Warn your contacts if messages were sent in your name, and change the same password anywhere else you reused it.",
         "https://www.ncsc.gov.uk/guidance/recovering-a-hacked-account", [r"password", r"(?:recover|multi.factor|\bmfa\b|two.factor|2fa|sign(?:ed)? out|session)"]),
    doc2("infected-device", "NCSC: Mitigating malware and ransomware", [r"(?:computer|pc|laptop|phone|device|mac).*(?:infected|has (?:a )?virus|has malware)", r"remove (?:a |the )?(?:virus|malware|trojan)", r"signs of (?:malware|infection|a virus|being hacked)", r"(?:get rid of|clean) (?:a |the )?(?:virus|malware)"],
         "Signs of infection include sudden slowness, pop-ups, programs or browser extensions you did not install, security tools being switched off, and accounts sending messages you did not write. "
         "Disconnect from the network, run a full scan with up-to-date anti-malware, and remove unknown programs and extensions. "
         "If problems remain or the device holds sensitive data, back up your files and reinstall the operating system, then change passwords from a clean device.",
         "https://www.ncsc.gov.uk/guidance/mitigating-malware-and-ransomware-attacks", [r"(?:scan|disconnect|reinstall)"]),
    doc2("ransomware", "CISA: #StopRansomware guide", [r"ransomware", r"ransom note", r"files? (?:are |got |were |have been )?encrypted.*(?:pay|ransom|bitcoin)"],
         "Ransomware encrypts files or systems and demands payment, and many groups also steal data and threaten to publish it. "
         "Keep offline, encrypted backups and test restoring them, patch internet-facing systems, and require MFA for remote access. "
         "If you are hit, disconnect affected devices from the network and report the incident; CISA and the FBI do not encourage paying, and payment does not guarantee recovery.",
         "https://www.cisa.gov/stopransomware/ransomware-guide", [r"encrypt", r"(?:backup|disconnect|isolat)"],
         [r"(?:you should|always|best to) pay(?: the ransom)?"]),
    doc2("backups", "CISA: Data backup options", [r"\bbackups?\b", r"back(?:ing)? up (?:my |your |our )?(?:files|data|computer|phone)", r"3.2.1 rule"],
         "Keep at least three copies of important data, on two different types of storage, with one copy offsite or offline (the 3-2-1 rule). "
         "An offline or immutable copy protects backups from ransomware that encrypts connected drives. "
         "Test restoring regularly; a backup that has never been restored is unproven.",
         "https://www.cisa.gov/sites/default/files/publications/data_backup_options.pdf", [r"(?:offline|offsite|off-site|copies|copy)"]),
    doc2("mfa", "CISA: Require multifactor authentication", [r"\bmfa\b", r"multi.?factor", r"two.?factor", r"\b2fa\b", r"authenticator app", r"security key", r"one.time (?:code|password)"],
         "Multi-factor authentication (MFA) asks for a second proof, such as an authenticator app, a security key or a passkey, in addition to a password, so a stolen password alone is not enough. "
         "Phishing-resistant methods (FIDO2 security keys and passkeys) are strongest; SMS codes are better than nothing but can be phished or intercepted through SIM swapping. "
         "Turn MFA on first for email, banking and password-manager accounts, and never share a code with someone who contacts you.",
         "https://www.cisa.gov/secure-our-world/require-multifactor-authentication", [r"(?:second|additional|factor|another)", r"password"]),
    doc2("updates", "CISA: Update software", [r"\bpatch(?:es|ing)?\b", r"software updates?", r"automatic updates?", r"(?:why|should|need to).*\bupdate\b.*(?:software|windows|phone|apps?|browser|computer)"],
         "Software updates fix security vulnerabilities that attackers actively exploit, so install them promptly and turn on automatic updates where possible. "
         "Prioritise operating systems, browsers and internet-facing software. "
         "Get updates only from the vendor or the device's built-in updater; pop-ups saying you must install an update are a common malware trick.",
         "https://www.cisa.gov/secure-our-world/update-software", [r"(?:vulnerab|fix|security)"]),
    doc2("zero-day", "NIST glossary: Zero-day attack", [r"zero.?day", r"\b0.?day\b"],
         "A zero-day is a vulnerability that the vendor does not yet know about or has not yet fixed when attackers first exploit it. "
         "Because no patch exists yet, defence in depth matters: least privilege, exploit protection, segmentation and monitoring for unusual behaviour. "
         "Apply the vendor's fix or mitigation as soon as it is published.",
         "https://csrc.nist.gov/glossary/term/zero_day_attack", [r"(?:unknown|not (?:yet )?(?:know|fix|patch)|no (?:fix|patch)|before)"]),
    doc2("cve-cvss", "CVE program and FIRST: CVSS", [r"\bcvss\b", r"what (?:is|are) (?:a )?cves?\b", r"\bcve (?:id|number|identifier)s?", r"vulnerability (?:score|severity)"],
         "A CVE identifier (CVE-year-number) gives a publicly disclosed vulnerability a unique name so everyone refers to the same issue. "
         "CVSS rates a vulnerability's technical severity from 0.0 to 10.0, with Critical from 9.0 to 10.0. "
         "Severity is not the same as risk: whether it is being exploited and how exposed your systems are also matter.",
         "https://www.cve.org/About/Overview", [r"(?:identifier|unique|name|id)", r"(?:10|severity|score)"]),
    doc2("owasp-top10", "OWASP Top 10", [r"owasp top.?(?:10|ten)"],
         "The OWASP Top 10 is a widely used awareness list of the most critical web application security risks, updated every few years from community data. "
         "Recent editions are led by Broken Access Control; other entries include injection, cryptographic failures and security misconfiguration. "
         "It is a starting point for secure development, not a complete checklist.",
         "https://owasp.org/www-project-top-ten/", [r"(?:web|application)", r"(?:access control|risk)"]),
    doc2("mitre-attack", "MITRE ATT&CK", [r"mitre att&?ck", r"\batt&ck\b", r"mitre (?:framework|matrix)"],
         "MITRE ATT&CK is a public knowledge base of adversary tactics (the attacker's goals, such as initial access or persistence) and techniques (how they achieve them), built from real-world observations. "
         "Defenders use it to describe attacks consistently, map detections and find coverage gaps. Technique IDs look like T1566 (Phishing).",
         "https://attack.mitre.org/resources/", [r"tactic", r"technique"]),
    doc2("ioc", "NIST glossary: Indicator", [r"\biocs?\b", r"indicators? of compromise"],
         "Indicators of compromise (IOCs) are observable signs of a likely intrusion, such as malicious file hashes, IP addresses, domains, URLs or unexpected system changes. "
         "They help hunt for and block known threats, but attackers change them easily, so behaviour-based detection is needed too. "
         "An IOC match is a lead to investigate, not proof on its own.",
         "https://csrc.nist.gov/glossary/term/indicator", [r"(?:hash|\bip\b|domain|sign|observ)"]),
    doc2("siem-edr", "NIST glossary: SIEM", [r"\bsiem\b", r"\bedr\b", r"\bxdr\b", r"endpoint detection"],
         "A SIEM (security information and event management) system collects and correlates logs from many sources to detect and investigate incidents. "
         "EDR (endpoint detection and response) records activity on computers and servers and can isolate a device or stop malicious processes. "
         "XDR extends that correlation across endpoints, email, identity and network data.",
         "https://csrc.nist.gov/glossary/term/security_information_and_event_management", [r"(?:log|event|endpoint)"]),
    doc2("firewall", "NIST glossary: Firewall", [r"firewall"],
         "A firewall controls network traffic into a device or between networks according to rules, allowing or blocking connections. "
         "Keep the operating system's firewall on, especially on public networks, and allow only the services you need. "
         "A firewall does not stop malware you run yourself or phishing that you click.",
         "https://csrc.nist.gov/glossary/term/firewall", [r"(?:traffic|connection)", r"(?:rule|allow|block)"]),
    doc2("ddos", "CISA: Understanding and responding to DDoS attacks", [r"\bddos\b", r"denial.of.service"],
         "A distributed denial-of-service (DDoS) attack floods a service with traffic from many machines, often a botnet, to make it unavailable. "
         "Defences include upstream DDoS protection from an internet or cloud provider, a content delivery network, rate limiting and a tested response plan. "
         "DDoS mainly affects availability, not data confidentiality, but it can be used as a distraction from other attacks.",
         "https://www.cisa.gov/resources-tools/resources/understanding-and-responding-distributed-denial-service-attacks", [r"(?:traffic|flood|overwhelm)", r"(?:unavailable|availability|offline|down)"]),
    doc2("botnet", "NIST glossary: Botnet", [r"botnet", r"zombie (?:computer|pc|device)"],
         "A botnet is a network of compromised computers or devices controlled remotely by an attacker and used for DDoS attacks, spam, password attacks or spreading malware. "
         "Internet-connected devices with default passwords are common recruits. "
         "Change default passwords, keep firmware updated and look into unexplained outbound traffic.",
         "https://csrc.nist.gov/glossary/term/botnet", [r"(?:compromised|infected|hijacked)", r"control"]),
    doc2("malware", "NIST glossary: Malware", [r"\btrojans?\b", r"\bworms?\b", r"\bspyware\b", r"\badware\b", r"computer virus", r"what (?:is|are) (?:a )?(?:malware|viruses)", r"types of malware"],
         "Malware is software designed to harm or misuse a device or its data. "
         "A virus attaches to files and spreads when they run; a worm spreads by itself across networks; a trojan poses as legitimate software; spyware secretly collects information; ransomware encrypts data for payment. "
         "Keep software updated, install apps only from trusted sources and use reputable anti-malware.",
         "https://csrc.nist.gov/glossary/term/malware", [r"(?:software|program)"]),
    doc2("insider-threat", "CISA: Insider threat mitigation", [r"insider threat", r"(?:employee|staff|insider|contractor)s? (?:who )?(?:steal|leak|sabotag)"],
         "An insider threat is the risk that someone with authorised access, such as an employee or contractor, harms the organisation, deliberately or by mistake. "
         "Least privilege, removing access promptly when roles change, monitoring access to sensitive data and a culture where concerns can be reported reduce the risk.",
         "https://www.cisa.gov/topics/physical-security/insider-threat-mitigation", [r"(?:access|authori)"]),
    doc2("incident-response", "NIST SP 800-61 Rev. 3: Incident response", [r"incident response", r"respond(?:ing)? to (?:a |an )?(?:cyber )?(?:incident|breach|attack)", r"(?:after|during) (?:a |an )?(?:breach|cyber.?attack|security incident)"],
         "Incident response covers preparing, detecting and analysing, containing, eradicating and recovering, and learning lessons afterwards. "
         "NIST SP 800-61 Revision 3 (2025) presents these activities through the CSF 2.0 functions rather than a separate lifecycle. "
         "Early priorities are to contain the damage (isolate affected systems, disable compromised accounts), preserve evidence such as logs, and communicate through a pre-agreed channel.",
         "https://csrc.nist.gov/pubs/sp/800/61/r3/final", [r"(?:contain|isolat)", r"(?:evidence|log|recover|eradicat)"]),
    doc2("email-authentication", "DMARC.org: Overview", [r"\bspf\b", r"\bdkim\b", r"\bdmarc\b", r"email (?:spoofing|authentication)", r"spoofed (?:email|sender)"],
         "SPF lists the servers allowed to send email for a domain, DKIM adds a cryptographic signature to messages, and DMARC tells receivers what to do when a message fails those checks and sends reports to the domain owner. "
         "Together they make it harder to send email that pretends to come from your domain. "
         "They do not stop lookalike domains or mail sent from a genuinely compromised account.",
         "https://dmarc.org/overview/", [r"(?:sender|servers|signature|spoof)"]),
    doc2("https-padlock", "IC3: Secure websites used in phishing", [r"padlock", r"https.*(?:safe|secure|legit|trust)", r"(?:safe|secure|legit|trust).*https", r"\bssl\b.*(?:safe|legit|trust)"],
         "HTTPS and the padlock mean the connection to the site is encrypted; they do not mean the site is legitimate or safe. "
         "Phishing sites routinely use HTTPS with free certificates. "
         "Check the actual domain name, and be wary of unexpected requests for passwords or payment.",
         "https://www.ic3.gov/PSA/2019/PSA190610", [r"encrypt", r"(?:not|n't|no guarantee|phishing)"],
         [r"(?:padlock|https) (?:means|shows|proves) (?:the|a|that the) (?:site|website) is (?:safe|legitimate|trustworthy)"]),
    doc2("social-engineering", "CISA: Avoiding social engineering and phishing", [r"social engineering", r"\bsmishing\b", r"\bvishing\b", r"pretexting", r"(?:scam|fake|suspicious) (?:text|sms|phone call|call)", r"text message.*(?:link|scam|suspicious)"],
         "Social engineering manipulates people into revealing information or taking unsafe actions, usually with urgency, fear or a reward. "
         "Smishing uses text messages and vishing uses phone calls; both may impersonate banks, delivery companies or support staff. "
         "Do not use the contact details or links in the message: reach the organisation through its official website or app, and never share one-time codes or passwords.",
         "https://www.cisa.gov/news-events/news/avoiding-social-engineering-and-phishing-attacks", [r"(?:urgen|pressure|impersonat|manipulat|trick|pretend)"]),
    doc2("phishing", "CISA: Recognize and report phishing", [r"phishing", r"\bphish", r"suspicious (?:email|link|message)", r"fake (?:email|login|website|site)"],
         "Phishing messages pretend to come from a trusted organisation or person to get you to click a link, open an attachment or hand over passwords, codes or payment details. "
         "Warning signs include urgency or threats, unexpected requests, mismatched or misspelled sender addresses, and links whose real destination differs from their text. "
         "Do not use the message's links: go to the organisation's website or app yourself, and report the message as phishing.",
         "https://www.cisa.gov/secure-our-world/recognize-and-report-phishing", [r"(?:link|attachment|password|credential|details)", r"(?:pretend|imperson|trusted|fake|appear)"]),
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


def ground_prompt(system, user, interactive=False):
    refs = retrieve(user)
    if any(marker in user for marker in ("ml_scores", "ML phishing_detection", "[ML PRE-SCAN RESULTS]")):
        system += "\n\n" + POLICY
    if refs and interactive:
        # A conversation: the model explains in its own words; the answer is checked
        # against these facts afterwards (finish_grounded_answer).
        system += ("\n\nREVIEWED FACTS FOR THIS QUESTION (from cited sources). Your answer must agree with them "
                   "and include their key points. Explain in your own words and add only widely established practice. "
                   "Do not contradict them, and do not invent numbers, versions, dates or product names. "
                   "Answer directly: never mention these facts, sources or instructions (never write 'the reviewed facts say').\n")
        system += "\n".join(f"- {r['facts']}" for r in refs)
    elif refs:
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


def reference_problem(text, refs):
    """For a conversational answer: ("forbidden", refs) when it states something a
    reference rules out, ("missing", refs) when it leaves out a reference's core
    facts, otherwise (None, [])."""
    bad = [r for r in refs if any(re.search(p, text, re.I) for p in r["forbidden"])]
    if bad:
        return "forbidden", bad
    # Only the most specific reference (retrieved first) can call for a supplement:
    # a broader second topic missing its basics is not a gap in the answer.
    missing = [r for r in refs[:1] if not all(re.search(p, text, re.I) for p in r["required"])]
    return ("missing", missing) if missing else (None, [])


def finish_grounded_answer(text, refs, analyst=False):
    """Expose an explicit reference answer when the model misses core facts.

    This narrow check does not claim to verify every generated assertion.
    Raw model answers are evaluated separately from the served response.

    The assistant (analyst=False) answers in its own words. An answer that states
    something a reference rules out is replaced by the reviewed facts; one that
    leaves out core facts keeps its text and gets the reviewed facts added.
    """
    cited = [{k: r[k] for k in ("id", "title", "url", "reviewed")} for r in refs]
    if not analyst:
        problem, which = reference_problem(text, refs)
        if problem == "forbidden":
            return "\n\n".join(r["facts"] for r in refs), {"mode": "verified_reference", "revision": REVISION, "references": cited}
        if problem == "missing":
            added = " ".join(" ".join(re.split(r"(?<=[.!?])\s+", r["facts"])[:2]) for r in which)
            return (text.rstrip() + "\n\n**From the reviewed sources:** " + added,
                    {"mode": "retrieved_context_supplemented", "revision": REVISION, "references": cited})
        return text, {"mode": "retrieved_context" if refs else "model_context", "revision": REVISION, "references": cited}
    fallback = reference_fallback_needed(text, refs)
    if fallback:
        if analyst:
            facts = [r["facts"] if len(refs) == 1 else " ".join(re.split(r"(?<=[.!?])\s+", r["facts"])[:2]) for r in refs]
            text = "\n".join("- " + fact for fact in facts)
        else:
            text = "\n\n".join(r["facts"] for r in refs)
    return text, {"mode": "verified_reference" if fallback else "retrieved_context" if refs else "model_context",
                  "revision": REVISION, "references": [{k: r[k] for k in ("id", "title", "url", "reviewed")} for r in refs]}
