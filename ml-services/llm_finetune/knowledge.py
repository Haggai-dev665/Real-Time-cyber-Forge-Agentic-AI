"""Hand-written security answers for the fine-tuning set.

Each topic has several phrasings of a question and a short answer made of
points. The analyst mode renders the points as bullets (its prompt asks for at
most 80 words of bullets, no risk line for a general question); the assistant
mode renders them as plain sentences, or a numbered list when `steps` is set.
Only well-established, stable facts are written here: nothing that changes
month to month, no statistics, no product claims.
"""

TOPICS = [
    {
        "q": ["What are the most common signs of a phishing email?", "How can I tell if an email is phishing?",
              "what does a phishing email usually look like", "Give me the red flags of a phishing message."],
        "points": [
            "The sender address or reply-to does not match the organisation it claims to be.",
            "It creates urgency or fear: account locked, payment failed, act within 24 hours.",
            "Links point to a different domain than the text shows; hover to check before clicking.",
            "It asks for passwords, codes or payment details, which real services do not request by email.",
            "Unexpected attachments, especially archives, macros or HTML files.",
        ],
    },
    {
        "q": ["What is spear phishing?", "How is spear phishing different from normal phishing?",
              "explain spear phishing"],
        "points": [
            "Spear phishing targets a specific person or team instead of a mass audience.",
            "The attacker researches the target first, so the message uses real names, projects or suppliers.",
            "Because it looks personal and plausible, it bypasses the instincts that catch bulk phishing.",
            "Verify unusual requests through a separate, known channel before acting.",
        ],
    },
    {
        "q": ["What is smishing?", "what's smishing and vishing", "Explain SMS phishing."],
        "points": [
            "Smishing is phishing by text message; vishing is phishing by voice call.",
            "Common lures are parcel delivery fees, bank alerts and fake two-factor prompts.",
            "Do not tap links or call numbers given in the message.",
            "Contact the company through its official app or a number you already trust.",
        ],
    },
    {
        "q": ["What should I do if I clicked a phishing link?", "I clicked a suspicious link, what now?",
              "I think I entered my password on a fake site. What should I do?"],
        "steps": True,
        "points": [
            "Close the page and do not enter anything else.",
            "Change the password for that account from the real site, and anywhere you reused it.",
            "Turn on two-factor authentication and sign out other sessions.",
            "Check the account for changes you did not make, such as forwarding rules or new devices.",
            "If you downloaded a file, run a full malware scan, and tell your bank if payment details were entered.",
        ],
    },
    {
        "q": ["What is ransomware?", "How does ransomware work?", "explain ransomware to me"],
        "points": [
            "Ransomware encrypts files or systems and demands payment for the key.",
            "Many groups also steal data first and threaten to publish it (double extortion).",
            "It usually arrives through phishing, exposed remote access or unpatched software.",
            "Offline, tested backups are the most important defence; paying does not guarantee recovery.",
        ],
    },
    {
        "q": ["How do I protect myself from ransomware?", "Best ways to prevent ransomware?",
              "ransomware prevention tips"],
        "steps": True,
        "points": [
            "Keep offline or immutable backups and test restoring them.",
            "Patch operating systems, browsers and internet-facing services promptly.",
            "Do not expose RDP directly to the internet; use a VPN with multi-factor authentication.",
            "Use least privilege so a single account cannot encrypt everything.",
            "Train people to report suspicious emails and attachments.",
        ],
    },
    {
        "q": ["What is a trojan?", "What is a trojan horse in computing?"],
        "points": [
            "A trojan is malware disguised as something useful, such as a cracked app or fake update.",
            "Once run, it can open a backdoor, steal credentials or download further malware.",
            "It does not spread by itself; the user is tricked into running it.",
            "Install software only from official sources and verify publishers.",
        ],
    },
    {
        "q": ["What is the difference between a virus and a worm?", "virus vs worm?"],
        "points": [
            "A virus attaches to a file or program and spreads when that host is run or shared.",
            "A worm spreads by itself across networks, usually by exploiting a vulnerability.",
            "Worms can spread very fast because no user action is needed.",
            "Patching and network segmentation limit worms; caution with files limits viruses.",
        ],
    },
    {
        "q": ["What is a rootkit?", "Explain rootkits."],
        "points": [
            "A rootkit hides an attacker's presence by tampering with the operating system or firmware.",
            "It can conceal files, processes and network connections from normal tools.",
            "Detection often needs offline scanning or integrity checks from trusted media.",
            "A confirmed rootkit usually means reinstalling the system from a clean image.",
        ],
    },
    {
        "q": ["What is spyware?", "what does spyware do", "What is an infostealer?"],
        "points": [
            "Spyware and infostealers collect data without consent: passwords, cookies, keystrokes or files.",
            "Stolen browser session cookies can let attackers skip passwords and two-factor prompts.",
            "They often come from pirated software, fake installers and malicious ads.",
            "After an infection, change passwords from a clean device and revoke active sessions.",
        ],
    },
    {
        "q": ["What is a botnet?", "explain what a botnet is"],
        "points": [
            "A botnet is a network of compromised devices controlled remotely by an attacker.",
            "It is used for DDoS attacks, spam, credential stuffing and spreading malware.",
            "Infected devices receive commands from command-and-control (C2) servers.",
            "Weak default passwords on routers and IoT devices are a common way in.",
        ],
    },
    {
        "q": ["What is a C2 server?", "What does command and control mean in malware?", "What is C2 beaconing?"],
        "points": [
            "Command and control (C2) is the infrastructure an attacker uses to direct compromised machines.",
            "Implants beacon: they contact the C2 server at regular intervals for instructions.",
            "Regular small connections to an unfamiliar host, especially at odd hours, can be a sign.",
            "Blocking the C2 destination helps, but the infected host still needs investigation.",
        ],
    },
    {
        "q": ["What is a DDoS attack?", "Explain distributed denial of service."],
        "points": [
            "A DDoS attack floods a service with traffic from many sources so real users cannot reach it.",
            "Floods can target bandwidth, network protocols or the application itself.",
            "Mitigation uses upstream filtering, rate limiting and content delivery networks.",
            "It disrupts availability; it does not by itself steal data.",
        ],
    },
    {
        "q": ["What is SQL injection?", "explain sql injection", "How does SQLi work?"],
        "points": [
            "SQL injection happens when user input is placed directly into a database query.",
            "An attacker adds SQL syntax, such as ' OR 1=1 --, to read or change data.",
            "The fix is parameterised queries or prepared statements, never string concatenation.",
            "Least-privilege database accounts and input validation reduce the damage.",
        ],
    },
    {
        "q": ["What is cross-site scripting?", "What is XSS?", "explain xss attacks"],
        "points": [
            "Cross-site scripting (XSS) injects attacker JavaScript into a page other users view.",
            "It can steal session cookies, change page content or act as the victim.",
            "Defences are output encoding, a strict Content Security Policy and HttpOnly cookies.",
            "Reflected XSS often arrives as a crafted link with script in the query string.",
        ],
    },
    {
        "q": ["What is directory traversal?", "What is a path traversal attack?"],
        "points": [
            "Path traversal uses sequences like ../ to reach files outside the intended folder.",
            "A typical target is a download parameter, for example file=../../etc/passwd.",
            "Applications should resolve paths and check they stay inside an allowed directory.",
            "Never build file paths directly from user input.",
        ],
    },
    {
        "q": ["What is CSRF?", "Explain cross-site request forgery."],
        "points": [
            "CSRF tricks a signed-in browser into sending a request the user did not intend.",
            "It works because the browser attaches the site's cookies automatically.",
            "Defences are anti-CSRF tokens, SameSite cookies and re-authentication for sensitive actions.",
        ],
    },
    {
        "q": ["What is a man-in-the-middle attack?", "What is MITM?"],
        "points": [
            "In a man-in-the-middle attack, someone intercepts traffic between two parties.",
            "It is common on untrusted Wi-Fi, through rogue access points or DNS spoofing.",
            "HTTPS with valid certificates prevents reading or changing the traffic.",
            "Never click through browser certificate warnings on sites that ask for credentials.",
        ],
    },
    {
        "q": ["Is public Wi-Fi safe?", "Is it safe to use airport wifi?", "public wifi risks?"],
        "points": [
            "Public Wi-Fi is usable for most browsing because HTTPS encrypts traffic to each site.",
            "Risks are fake hotspots, captive portals asking for credentials and unencrypted services.",
            "Check the network name with staff, avoid certificate warnings and keep your OS updated.",
            "A trusted VPN adds protection for apps that do not use encryption.",
        ],
    },
    {
        "q": ["What is DNS tunneling?", "How do attackers use DNS for exfiltration?"],
        "points": [
            "DNS tunneling hides data or commands inside DNS queries and responses.",
            "Signs are very long, random-looking subdomains and a high volume of queries to one domain.",
            "Unusual record types such as TXT or NULL in bulk are another indicator.",
            "Monitoring resolver logs and limiting external DNS to approved resolvers helps.",
        ],
    },
    {
        "q": ["What is a DGA domain?", "What are domain generation algorithms?"],
        "points": [
            "A domain generation algorithm lets malware compute many pseudo-random domain names.",
            "The attacker registers only a few, so blocking single domains does not stop the malware.",
            "Generated names are often long, high-entropy and hard to pronounce.",
            "Entropy alone is not proof: CDNs and some services also use random-looking names.",
        ],
    },
    {
        "q": ["What is typosquatting?", "What are look-alike domains?", "What is a homograph attack?"],
        "points": [
            "Typosquatting registers misspellings of real domains, such as paypa1.com.",
            "Homograph attacks use look-alike characters from other alphabets, shown as punycode (xn--).",
            "Brand names in a subdomain, like paypal.com.account-check.info, are another trick.",
            "Read the registered domain just before the first single slash; that part decides the owner.",
        ],
    },
    {
        "q": ["How do I check if a link is safe before clicking?", "How can I verify a URL?",
              "how do i know if a website is legit"],
        "steps": True,
        "points": [
            "Hover or long-press to see the real destination.",
            "Find the registered domain and check it is the organisation you expect.",
            "Be wary of IP addresses, shorteners, odd top-level domains and many hyphens.",
            "Scan it in CyberForge's Analyzer before opening it.",
            "When in doubt, type the site's address yourself instead of following the link.",
        ],
    },
    {
        "q": ["Does HTTPS mean a website is safe?", "is a padlock icon enough to trust a site?"],
        "points": [
            "No. HTTPS only means the connection to that site is encrypted.",
            "Phishing sites commonly have valid certificates because they are free and automatic.",
            "Check who owns the domain, not just the padlock.",
            "HTTPS is still necessary: without it, anyone on the network can read the traffic.",
        ],
    },
    {
        "q": ["What is two-factor authentication?", "Why should I use 2FA?", "what is mfa"],
        "points": [
            "Two-factor or multi-factor authentication asks for a second proof besides the password.",
            "It stops most attacks that rely on stolen or guessed passwords.",
            "Authenticator apps and security keys are stronger than SMS codes.",
            "Passkeys and hardware keys also resist phishing because they check the site's domain.",
        ],
    },
    {
        "q": ["What is MFA fatigue?", "What is push bombing?"],
        "points": [
            "MFA fatigue is when an attacker with your password sends repeated sign-in prompts.",
            "They hope you approve one just to make them stop.",
            "Never approve a prompt you did not start; it means your password is known, so change it.",
            "Number matching and phishing-resistant keys reduce this risk.",
        ],
    },
    {
        "q": ["How do I create a strong password?", "What makes a good password?", "password tips?"],
        "points": [
            "Length matters most: use a passphrase of several random words, or 16+ random characters.",
            "Use a different password for every account.",
            "A password manager makes unique passwords practical.",
            "Add two-factor authentication to important accounts, starting with email.",
        ],
    },
    {
        "q": ["Are password managers safe?", "Should I use a password manager?"],
        "points": [
            "Yes, a reputable password manager is much safer than reusing passwords.",
            "It generates unique passwords and only fills them on the matching domain, which helps against phishing.",
            "Protect it with a strong master password and two-factor authentication.",
        ],
    },
    {
        "q": ["What is credential stuffing?", "Explain credential stuffing attacks."],
        "points": [
            "Credential stuffing replays usernames and passwords leaked from one site against other sites.",
            "It works because people reuse passwords.",
            "Unique passwords and two-factor authentication defeat it.",
            "Services detect it through login rate limits and unusual sign-in patterns.",
        ],
    },
    {
        "q": ["What is a brute force attack?", "What is password spraying?"],
        "points": [
            "Brute force tries many passwords against one account.",
            "Password spraying tries a few common passwords against many accounts to avoid lockouts.",
            "Many failed logins from one source, or one failure each across many accounts, are the signs.",
            "Lockout policies, MFA and blocking legacy authentication protocols help.",
        ],
    },
    {
        "q": ["What is social engineering?", "explain social engineering attacks"],
        "points": [
            "Social engineering manipulates people rather than systems.",
            "Attackers use authority, urgency, curiosity or helpfulness to get access or information.",
            "Phishing, pretext calls to the help desk and tailgating are common forms.",
            "A habit of verifying requests through a known channel stops most attempts.",
        ],
    },
    {
        "q": ["What is business email compromise?", "What is BEC fraud?"],
        "points": [
            "Business email compromise uses a hijacked or spoofed email account to request payments or data.",
            "Typical requests are changed bank details for an invoice or urgent gift card purchases.",
            "Verify any payment change by phone using a number you already have.",
            "Watch for new mailbox forwarding rules, a sign of a compromised account.",
        ],
    },
    {
        "q": ["What is a zero-day vulnerability?", "explain zero day"],
        "points": [
            "A zero-day is a vulnerability the vendor does not yet know about or has not yet fixed.",
            "There is no patch at first, so defenders rely on mitigations and detection.",
            "Once a patch is released, applying it quickly matters most.",
        ],
    },
    {
        "q": ["What is a CVE?", "What does CVE mean?", "What is CVSS?"],
        "points": [
            "A CVE identifier is a public ID for a disclosed vulnerability, such as CVE-2021-44228.",
            "CVSS is a 0 to 10 score of technical severity; it is not the same as risk to you.",
            "Your risk depends on whether you run the affected version and whether it is exposed or exploited.",
            "Check the vendor advisory for affected versions and fixes.",
        ],
    },
    {
        "q": ["What was Log4Shell?", "Explain CVE-2021-44228."],
        "points": [
            "Log4Shell (CVE-2021-44228) is a remote code execution flaw in Apache Log4j 2.",
            "Logging attacker-controlled text such as ${jndi:ldap://...} could make the server load remote code.",
            "It affected a huge number of Java applications because Log4j is widely embedded.",
            "The fix is upgrading Log4j to a patched 2.x release.",
        ],
    },
    {
        "q": ["What was Heartbleed?", "Explain CVE-2014-0160."],
        "points": [
            "Heartbleed (CVE-2014-0160) was a bug in OpenSSL's TLS heartbeat extension.",
            "It let attackers read chunks of server memory, which could include private keys and passwords.",
            "Fixing it meant patching OpenSSL, replacing certificates and rotating credentials.",
        ],
    },
    {
        "q": ["What was EternalBlue?", "What is MS17-010?"],
        "points": [
            "EternalBlue exploits an SMBv1 flaw in Windows fixed by Microsoft bulletin MS17-010 (CVE-2017-0144).",
            "It was used by the WannaCry and NotPetya outbreaks in 2017 to spread between machines.",
            "Patch Windows, disable SMBv1 and never expose SMB (port 445) to the internet.",
        ],
    },
    {
        "q": ["What is the MITRE ATT&CK framework?", "explain mitre attack"],
        "points": [
            "MITRE ATT&CK is a public knowledge base of attacker tactics and techniques seen in real intrusions.",
            "Tactics are goals, such as initial access or persistence; techniques are how they are achieved.",
            "Techniques have IDs, for example T1566 for phishing.",
            "Teams use it to map detections and find coverage gaps.",
        ],
    },
    {
        "q": ["What is an IOC?", "What are indicators of compromise?"],
        "points": [
            "Indicators of compromise are artefacts that suggest an intrusion: IPs, domains, file hashes, URLs.",
            "They are useful for searching logs and blocking known infrastructure.",
            "They age quickly: attackers change infrastructure, and IPs are often reused by others.",
            "An IOC match is a lead to investigate, not proof on its own.",
        ],
    },
    {
        "q": ["What is threat intelligence?", "What is a threat intel feed?", "What are OTX pulses?"],
        "points": [
            "Threat intelligence is information about attackers, their infrastructure and their methods.",
            "Feeds such as AlienVault OTX pulses share indicators and context from the community.",
            "Quality varies: check the source, the age and whether it fits your environment.",
            "A public pulse is not evidence that your own devices are affected.",
        ],
    },
    {
        "q": ["What is a file hash used for?", "How do I check a file hash?"],
        "points": [
            "A hash (SHA-256 is preferred) is a fingerprint of a file's exact contents.",
            "It lets you look the file up in reputation services or compare it with a vendor's published value.",
            "Any change to the file changes the hash, so new malware variants will not match old hashes.",
            "No match in a database means unknown, not safe.",
        ],
    },
    {
        "q": ["What is endpoint detection and response?", "What is EDR?"],
        "points": [
            "EDR records process, file and network activity on devices and flags suspicious behaviour.",
            "Unlike signature antivirus, it can detect techniques, not just known files.",
            "It also lets responders isolate a machine and investigate remotely.",
        ],
    },
    {
        "q": ["What is a firewall?", "do I need a firewall"],
        "points": [
            "A firewall allows or blocks network traffic based on rules.",
            "Host firewalls on laptops block unsolicited inbound connections; keep them on.",
            "Network firewalls separate segments and limit what can reach the internet.",
            "A firewall does not stop threats you invite in, such as a malicious download.",
        ],
    },
    {
        "q": ["What is a VPN and does it make me safe?", "Do I need a VPN?"],
        "points": [
            "A VPN encrypts traffic between your device and the VPN provider.",
            "It hides your browsing from the local network, but the provider can see it.",
            "It does not block phishing, malware or tracking by websites.",
            "For companies, a VPN with MFA is a safer way to reach internal systems than exposed services.",
        ],
    },
    {
        "q": ["What is network segmentation?", "Why segment a network?"],
        "points": [
            "Segmentation divides a network into zones with controlled traffic between them.",
            "It limits how far an attacker or worm can move after one device is compromised.",
            "Separating IoT devices, guests and servers from workstations is a common start.",
        ],
    },
    {
        "q": ["What is lateral movement?", "explain lateral movement in an attack"],
        "points": [
            "Lateral movement is an attacker moving from the first compromised machine to others.",
            "It often uses stolen credentials with remote tools such as RDP, SMB or PowerShell remoting.",
            "Signs are unusual logins between workstations and admin tools run by ordinary accounts.",
            "Least privilege, segmentation and unique local admin passwords make it harder.",
        ],
    },
    {
        "q": ["What is privilege escalation?", "explain privilege escalation"],
        "points": [
            "Privilege escalation is gaining higher rights than an account was given, such as admin or root.",
            "It uses vulnerabilities, misconfigurations or stored credentials.",
            "Patching, removing unnecessary admin rights and monitoring new admin accounts help.",
        ],
    },
    {
        "q": ["What is data exfiltration?", "How do I detect data exfiltration?"],
        "points": [
            "Exfiltration is unauthorised transfer of data out of an organisation.",
            "Signs include large uploads to unfamiliar hosts, unusual cloud storage use and off-hours transfers.",
            "DNS tunneling and encrypted channels can be used to hide it.",
            "Egress monitoring and data loss prevention controls help detect it.",
        ],
    },
    {
        "q": ["What is cryptojacking?", "How do I know if my computer is mining crypto?"],
        "points": [
            "Cryptojacking uses your device to mine cryptocurrency without permission.",
            "Signs are sustained high CPU or GPU use, heat, fan noise and battery drain when idle.",
            "It can come from malware or from a script on a web page.",
            "Check running processes and browser extensions, and run a malware scan.",
        ],
    },
    {
        "q": ["What is a supply chain attack?", "explain software supply chain attacks"],
        "points": [
            "A supply chain attack compromises a trusted vendor, update or library to reach its customers.",
            "Examples are poisoned software updates and malicious open-source packages.",
            "Pin and verify dependencies, use signed updates and limit what third-party software can access.",
        ],
    },
    {
        "q": ["What is malvertising?", "Can ads give me malware?"],
        "points": [
            "Malvertising places malicious ads on legitimate sites or search results.",
            "Ads for popular software downloads are a common lure that leads to fake installers.",
            "Download software from the vendor's own site, typed directly, not from ads.",
            "An ad blocker reduces exposure.",
        ],
    },
    {
        "q": ["Are browser extensions dangerous?", "Can a browser extension steal my data?"],
        "points": [
            "Yes. Extensions with access to all sites can read pages, forms and sometimes cookies.",
            "Popular extensions are sometimes sold and updated with malicious code.",
            "Install only what you need from known publishers and review permissions regularly.",
        ],
    },
    {
        "q": ["What is a QR code phishing attack?", "Is it safe to scan QR codes?", "what is quishing"],
        "points": [
            "QR phishing (quishing) hides a malicious link in a QR code, often on posters, parking meters or emails.",
            "Your phone shows the URL before opening; check the domain first.",
            "Be suspicious of QR codes asking you to log in or pay.",
        ],
    },
    {
        "q": ["What is a deepfake scam?", "Can attackers clone voices?"],
        "points": [
            "Attackers can now imitate voices and faces convincingly from public recordings.",
            "Scams use a fake call from a manager or relative asking for money or access urgently.",
            "Agree on a verification step, such as calling back on a known number, for any urgent request.",
        ],
    },
    {
        "q": ["What should I do if my account was hacked?", "Someone hacked my email, help",
              "My account got compromised, what do I do?"],
        "steps": True,
        "points": [
            "Reset the password from a clean device, or use the provider's account recovery.",
            "Turn on two-factor authentication and sign out all other sessions.",
            "Remove unknown recovery emails, phone numbers, forwarding rules and connected apps.",
            "Change the password anywhere you reused it.",
            "Warn your contacts if messages were sent from your account.",
        ],
    },
    {
        "q": ["My computer is acting strange, could it be infected?", "How do I know if I have malware?",
              "signs of a malware infection?"],
        "points": [
            "Possible signs: new programs or extensions you did not install, pop-ups, a changed browser home page.",
            "Also unusual slowness, high CPU when idle, or security tools that were turned off.",
            "These can have harmless causes too, so check rather than assume.",
            "Run a full scan, review startup items and installed programs, and update everything.",
        ],
    },
    {
        "q": ["What is incident response?", "What are the steps of incident response?"],
        "steps": True,
        "points": [
            "Preparation: plans, contacts, logging and backups in place beforehand.",
            "Detection and analysis: confirm what happened and its scope.",
            "Containment: isolate affected systems and accounts.",
            "Eradication and recovery: remove the cause and restore from clean sources.",
            "Lessons learned: fix the gaps that allowed it.",
        ],
    },
    {
        "q": ["Should I pay a ransomware demand?", "is it ok to pay the ransom"],
        "points": [
            "Paying is discouraged: there is no guarantee of a working key or that stolen data is deleted.",
            "It also funds further attacks, and some payments may be legally restricted.",
            "Contact your incident response provider and law enforcement before any decision.",
            "Restoring from tested backups is the reliable path.",
        ],
    },
    {
        "q": ["What is the principle of least privilege?", "explain least privilege"],
        "points": [
            "Least privilege gives each account and program only the access it needs.",
            "It limits what an attacker can do with one compromised account.",
            "Use separate admin accounts and remove rights that are no longer needed.",
        ],
    },
    {
        "q": ["What is zero trust?", "Explain zero trust security."],
        "points": [
            "Zero trust means no user or device is trusted just because it is on the internal network.",
            "Every request is checked for identity, device health and context.",
            "In practice: strong MFA, least privilege, segmentation and continuous monitoring.",
        ],
    },
    {
        "q": ["Why are software updates important?", "Do I really need to install updates?"],
        "points": [
            "Updates fix vulnerabilities that attackers actively exploit once they are public.",
            "Browsers, operating systems and internet-facing apps matter most.",
            "Turn on automatic updates where possible and restart to finish installing them.",
        ],
    },
    {
        "q": ["What is an SSL certificate warning?", "Should I ignore certificate errors?",
              "What does a self-signed certificate mean?"],
        "points": [
            "A certificate warning means the browser cannot confirm it is talking to the real site.",
            "Causes include expired, self-signed or mismatched certificates, or interception.",
            "Do not continue to a site that asks for credentials or payment when you see one.",
            "On internal tools, ask the administrator to install a proper certificate.",
        ],
    },
    {
        "q": ["What is a sandbox in security?", "What does sandbox analysis do?"],
        "points": [
            "A sandbox runs a file or page in an isolated environment and observes what it does.",
            "It reveals behaviour such as dropped files, registry changes and network connections.",
            "Some malware detects sandboxes and stays quiet, so a clean result is not a guarantee.",
        ],
    },
    {
        "q": ["What is anomaly detection?", "How does anomaly detection work in security?"],
        "points": [
            "Anomaly detection learns what normal looks like and flags what differs from it.",
            "It can catch new attacks without signatures.",
            "Unusual is not the same as malicious, so anomaly alerts need context before action.",
        ],
    },
    {
        "q": ["What is a false positive?", "Why do security tools flag safe sites?"],
        "points": [
            "A false positive is a benign item flagged as malicious.",
            "URL models can flag real sign-in pages because they share features with phishing pages.",
            "Check the registered domain and other evidence before acting on a single detection.",
            "Marking it as allowed in CyberForge records your decision for that host.",
        ],
    },
    {
        "q": ["What is the hosts file?", "How does blocking a site with the hosts file work?"],
        "points": [
            "The hosts file maps host names to IP addresses before DNS is asked.",
            "Pointing a host to 0.0.0.0 makes it unreachable from that computer.",
            "It applies to the whole device, but not to other devices or to browsers using their own DNS-over-HTTPS.",
        ],
    },
]

# Greetings and small talk for the assistant mode: (message, answers)
SMALL_TALK = [
    (["hi", "hello", "hey", "hi there!", "hello!", "hey there", "good morning", "good evening", "yo"],
     ["Hi! How can I help with your security today?",
      "Hello! I'm the CyberForge assistant. Ask me about a link, an alert or anything security-related.",
      "Hey! What would you like to check or learn about today?"]),
    (["how are you?", "how's it going", "how are you doing today?"],
     ["I'm doing well, thanks for asking! Is there anything you'd like me to look at, like a suspicious link or an alert?",
      "All good here, thanks! What can I help you with?"]),
    (["thanks", "thank you!", "thanks a lot", "cheers, that helped"],
     ["You're welcome! Let me know if anything else looks suspicious.",
      "Glad I could help. Stay safe!"]),
    (["what can you do?", "what are you?", "who are you", "what can you help me with"],
     ["I'm the CyberForge assistant. I can explain scans, alerts and threats in your CyberForge memory, help you judge whether a link or message looks suspicious, and answer security questions. I can't browse the web or scan anything myself here; use the Analyzer to scan a URL.",
      "I can answer security questions, explain what CyberForge found in your scans and alerts, and suggest next steps. For a new link, run it through the Analyzer first and I can explain the result."]),
    (["bye", "goodbye", "see you later"],
     ["Bye! Stay safe out there.", "See you later! I'm here whenever you need a second opinion."]),
    (["tell me a joke", "say something funny"],
     ["Why did the password break up with the username? It needed more space and a few special characters. Anything security-related I can help with?"]),
    (["are you chatgpt?", "which model are you?", "are you an AI?"],
     ["I'm the CyberForge assistant, an AI model running inside the CyberForge service. I can help with security questions and explain what CyberForge has found."]),
]
