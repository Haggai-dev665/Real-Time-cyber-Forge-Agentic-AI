/**
 * Sandbox Analysis Service
 * Orchestrates URL/file analysis: ML scan + IOC extraction + MITRE mapping +
 * persistence to an in-memory evidence locker.
 *
 * NOT a true detonation sandbox — static analysis only. File detonation
 * (Cuckoo / Docker containers) is a separate phase.
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { cyberforgeML } = require('./cyberforgeMLService');
const IOCAnalysisService = require('./IOCAnalysisService');
const MITREAttackService = require('./MITREAttackService');

// Regex patterns for IOC extraction from arbitrary text
const IOC_PATTERNS = {
    ipv4:    /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    ipv6:    /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
    url:     /https?:\/\/[^\s"'<>{}|\\^`]+/gi,
    domain:  /\b[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.[a-z]{2,24}\b/gi,
    email:   /\b[\w.+-]+@[a-z0-9-]+\.[a-z]{2,}\b/gi,
    md5:     /\b[a-f0-9]{32}\b/gi,
    sha1:    /\b[a-f0-9]{40}\b/gi,
    sha256:  /\b[a-f0-9]{64}\b/gi,
    btcAddr: /\b(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}\b/g,
    cve:     /\bCVE-\d{4}-\d{4,7}\b/gi,
};

// Curated MITRE technique signals — text patterns to MITRE technique IDs.
// Extends the small set in MITREAttackService with web/cloud-relevant techniques.
const MITRE_SIGNALS = [
    // Initial Access
    { pattern: /(phishing|spear[- ]phish|credential\s*harvest)/i, techniqueId: 'T1566', name: 'Phishing', tactic: 'Initial Access', confidence: 0.85 },
    { pattern: /(drive[- ]?by|exploit\s*kit|malvertis)/i,         techniqueId: 'T1189', name: 'Drive-by Compromise', tactic: 'Initial Access', confidence: 0.8 },
    { pattern: /(public[- ]facing\s*application|web\s*shell|exposed\s*api)/i, techniqueId: 'T1190', name: 'Exploit Public-Facing Application', tactic: 'Initial Access', confidence: 0.8 },
    // Execution
    { pattern: /(javascript|js)\s+(eval|atob|fromcharcode|obfuscat)/i, techniqueId: 'T1059.007', name: 'JavaScript Execution', tactic: 'Execution', confidence: 0.85 },
    { pattern: /\bpowershell\b/i,                                techniqueId: 'T1059.001', name: 'PowerShell',                tactic: 'Execution', confidence: 0.85 },
    { pattern: /\bcmd\.exe|command\s*shell\b/i,                  techniqueId: 'T1059.003', name: 'Windows Command Shell',     tactic: 'Execution', confidence: 0.7 },
    { pattern: /\b(bash|sh|zsh|\/bin\/sh)\b/i,                   techniqueId: 'T1059.004', name: 'Unix Shell',                tactic: 'Execution', confidence: 0.7 },
    // Persistence
    { pattern: /(scheduled\s*task|cron|launchd|registry\s*run)/i, techniqueId: 'T1053',     name: 'Scheduled Task/Job',       tactic: 'Persistence', confidence: 0.75 },
    { pattern: /(startup\s*folder|autorun|run\s*key)/i,           techniqueId: 'T1547',     name: 'Boot/Logon Autostart',     tactic: 'Persistence', confidence: 0.75 },
    // Defense Evasion
    { pattern: /(obfuscat|base64|encod|packed|encrypt[ed]+\s*payload)/i, techniqueId: 'T1027', name: 'Obfuscated Files',     tactic: 'Defense Evasion', confidence: 0.7 },
    { pattern: /(mixed\s*content|insecure\s*request)/i,          techniqueId: 'T1090',     name: 'Proxy',                    tactic: 'Defense Evasion', confidence: 0.5 },
    // Credential Access
    { pattern: /(credential\s*(theft|harvest|stuff)|fake\s*login|password\s*phish)/i, techniqueId: 'T1056', name: 'Input Capture', tactic: 'Credential Access', confidence: 0.85 },
    { pattern: /(keylog|formgrab|keystroke)/i,                   techniqueId: 'T1056.001', name: 'Keylogging',               tactic: 'Credential Access', confidence: 0.9 },
    // Discovery
    { pattern: /(port\s*scan|nmap|recon|enumerat)/i,             techniqueId: 'T1046',     name: 'Network Service Scanning', tactic: 'Discovery', confidence: 0.7 },
    // Command and Control
    { pattern: /(c2|command[- ]and[- ]control|beacon|callback)/i, techniqueId: 'T1071',    name: 'Application Layer Protocol', tactic: 'Command and Control', confidence: 0.85 },
    { pattern: /(dns\s*tunnel|exfil\s*via\s*dns)/i,              techniqueId: 'T1071.004', name: 'DNS C2',                   tactic: 'Command and Control', confidence: 0.9 },
    { pattern: /(dga|domain\s*generation)/i,                     techniqueId: 'T1568.002', name: 'Domain Generation Algorithms', tactic: 'Command and Control', confidence: 0.9 },
    // Exfiltration
    { pattern: /(exfiltrat|data\s*leak|credential\s*dump)/i,     techniqueId: 'T1041',     name: 'Exfiltration Over C2',     tactic: 'Exfiltration', confidence: 0.8 },
    // Impact
    { pattern: /\bransom(ware)?|encrypt(ing|ed)?\s*files/i,      techniqueId: 'T1486',     name: 'Data Encrypted for Impact', tactic: 'Impact', confidence: 0.95 },
    { pattern: /(cryptominer|coin\s*miner|monero|xmr)/i,         techniqueId: 'T1496',     name: 'Resource Hijacking',       tactic: 'Impact', confidence: 0.9 },
];

class SandboxAnalysisService {
    constructor() {
        this.iocService    = new IOCAnalysisService();
        this.mitreService  = new MITREAttackService();
        // Evidence locker — in-memory ring buffer of recent scans
        this.scans         = new Map();    // id → scan record
        this.scanOrder     = [];           // insertion order for pagination
        this.MAX_SCANS     = 200;
    }

    // ────────────────────────────────────────────────────────────
    // IOC EXTRACTION
    // ────────────────────────────────────────────────────────────

    /**
     * Extract IOCs from arbitrary text using regex patterns.
     * Returns a deduplicated list with type + value + first-seen offset.
     */
    extractIOCsFromText(text, sourceLabel = 'text') {
        if (!text || typeof text !== 'string') return [];
        const found = new Map(); // key (type:value) → IOC

        for (const [type, pattern] of Object.entries(IOC_PATTERNS)) {
            // reset lastIndex for global regex
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const value = match[0].toLowerCase();
                // skip common false positives
                if (this._isCommonFalsePositive(type, value)) continue;
                const key = `${type}:${value}`;
                if (!found.has(key)) {
                    found.set(key, {
                        type: this._normalizeType(type),
                        value,
                        source: sourceLabel,
                        offset: match.index,
                        severity: this._iocSeverity(type, value),
                    });
                }
            }
        }
        return Array.from(found.values());
    }

    /**
     * Extract IOCs from a URL: the URL itself, hostname, path components.
     */
    extractIOCsFromUrl(url) {
        const iocs = [];
        try {
            const u = new URL(url);
            iocs.push({ type: 'url', value: url, source: 'target', severity: 'medium' });
            iocs.push({ type: 'domain', value: u.hostname.toLowerCase(), source: 'hostname', severity: this._iocSeverity('domain', u.hostname.toLowerCase()) });
            // IP literal in hostname
            if (IOC_PATTERNS.ipv4.test(u.hostname)) {
                iocs.push({ type: 'ip', value: u.hostname, source: 'hostname', severity: 'high' });
            }
            IOC_PATTERNS.ipv4.lastIndex = 0;
        } catch (_) { /* invalid URL */ }
        return iocs;
    }

    /**
     * Extract IOCs from file metadata + content buffer.
     * Hashes are always included; text-based extraction runs on Buffer if utf8-decodable.
     */
    extractIOCsFromFile(filename, buffer, mimeType = '') {
        const iocs = [];
        if (!buffer) return iocs;

        // SHA256 hash of file
        const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
        const md5    = crypto.createHash('md5').update(buffer).digest('hex');
        const sha1   = crypto.createHash('sha1').update(buffer).digest('hex');
        iocs.push({ type: 'hash', value: sha256, source: 'file:sha256', severity: 'high' });
        iocs.push({ type: 'hash', value: sha1,   source: 'file:sha1',   severity: 'medium' });
        iocs.push({ type: 'hash', value: md5,    source: 'file:md5',    severity: 'medium' });

        // Text scan only for textual files (skip binaries to avoid garbage matches)
        const textualMimes = ['text/', 'application/json', 'application/javascript', 'application/xml', 'application/x-sh'];
        const isTextual = textualMimes.some(m => mimeType.startsWith(m)) || /\.(txt|js|py|sh|json|xml|html|css|md|yml|yaml|conf|log)$/i.test(filename);
        if (isTextual) {
            try {
                const text = buffer.toString('utf-8').slice(0, 200000); // cap at 200KB
                const textIocs = this.extractIOCsFromText(text, `file:${filename}`);
                iocs.push(...textIocs);
            } catch (_) { /* not utf-8 */ }
        }
        return iocs;
    }

    // ────────────────────────────────────────────────────────────
    // MITRE MAPPING
    // ────────────────────────────────────────────────────────────

    /**
     * Map free-form analysis text + structured findings to MITRE techniques.
     * Returns a list of unique techniques with evidence snippets and confidence.
     */
    mapToMITRE(analysisText, findings = []) {
        const haystack = [
            analysisText || '',
            ...findings.map(f => typeof f === 'string' ? f : (f.message || f.title || f.description || JSON.stringify(f))),
        ].join('\n').toLowerCase();

        const matched = new Map(); // techniqueId → match record

        for (const signal of MITRE_SIGNALS) {
            signal.pattern.lastIndex = 0;
            const m = signal.pattern.exec(haystack);
            if (m) {
                const existing = matched.get(signal.techniqueId);
                if (!existing || signal.confidence > existing.confidence) {
                    // Pull a short evidence snippet around the match
                    const start = Math.max(0, m.index - 30);
                    const end   = Math.min(haystack.length, m.index + m[0].length + 30);
                    matched.set(signal.techniqueId, {
                        techniqueId: signal.techniqueId,
                        name:        signal.name,
                        tactic:      signal.tactic,
                        confidence:  signal.confidence,
                        evidence:    haystack.slice(start, end).trim(),
                    });
                }
            }
        }

        const techniques = Array.from(matched.values()).sort((a, b) => b.confidence - a.confidence);
        // Build attack-chain ordering by tactic phase
        const tacticOrder = ['Initial Access', 'Execution', 'Persistence', 'Privilege Escalation', 'Defense Evasion', 'Credential Access', 'Discovery', 'Lateral Movement', 'Collection', 'Command and Control', 'Exfiltration', 'Impact'];
        const chain = [...techniques].sort((a, b) => (tacticOrder.indexOf(a.tactic) - tacticOrder.indexOf(b.tactic)));

        return {
            techniques,
            attackChain: chain,
            tacticsCovered: [...new Set(techniques.map(t => t.tactic))],
        };
    }

    // ────────────────────────────────────────────────────────────
    // ANALYSIS ORCHESTRATION
    // ────────────────────────────────────────────────────────────

    async analyzeUrl(url, additionalFeatures = {}, metadata = {}) {
        const startedAt = Date.now();
        const id = uuidv4();

        // 1. ML threat score (uses the fixed cyberforgeMLService)
        const mlReport = await cyberforgeML.analyzeUrl(url, additionalFeatures);

        // 2. IOC extraction — from URL itself + any analysis text
        const analysisText = mlReport?.aggregate?.recommended_action
            ? `Recommended action: ${mlReport.aggregate.recommended_action}. Risk: ${mlReport.aggregate.overall_risk_level}.`
            : '';
        const iocs = [
            ...this.extractIOCsFromUrl(url),
            ...this.extractIOCsFromText(JSON.stringify(mlReport), 'ml-report'),
        ];

        // 3. MITRE mapping from ML insights + URL features
        const findings = this._urlFeatureFindings(url, mlReport.features_analyzed || {});
        const mitre = this.mapToMITRE(analysisText, findings);

        // 4. Build the scan record (escalate verdict if MITRE/IOC outweigh ML)
        const dedupedIocs = this._dedupeIocs(iocs);
        const scan = {
            id,
            type: 'url',
            target: url,
            verdict: this._escalateVerdict(this._verdict(mlReport.aggregate), { iocs: dedupedIocs, mitre, findings }),
            mlReport,
            iocs: dedupedIocs,
            mitre,
            findings,
            timeline: this._buildTimeline('url', startedAt, Date.now()),
            metadata,
            createdAt: new Date().toISOString(),
            durationMs: Date.now() - startedAt,
        };

        // 5. Persist
        this._store(scan);
        return scan;
    }

    async analyzeFile(filename, buffer, mimeType = '', metadata = {}) {
        const startedAt = Date.now();
        const id = uuidv4();

        // 1. IOC extraction (hash + text scan)
        const iocs = this.extractIOCsFromFile(filename, buffer, mimeType);

        // 2. ML analysis — synthesize features from file metadata for the heuristic
        const features = {
            url_length: filename.length,
            has_suspicious_tld: /\.(exe|bat|scr|vbs|js|jar|ps1)$/i.test(filename),
            html_size: buffer.length,
        };
        const mlPrediction = await cyberforgeML.predict('malware_detection', features);
        const mlReport = {
            file: filename,
            size: buffer.length,
            mimeType,
            aggregate: {
                blended_threat_score: mlPrediction.threat_score,
                overall_risk_level:   mlPrediction.risk_level,
                recommended_action:   mlPrediction.is_threat ? 'block' : 'allow',
            },
            model_predictions: { malware_detection: mlPrediction },
        };

        // 3. MITRE mapping — include actual file text content (capped) so keyword
        //    matching can fire on suspicious payloads even when ML metadata is clean.
        const findings = this._fileFindings(filename, buffer, iocs);
        let textSample = '';
        try {
            textSample = buffer.toString('utf-8').slice(0, 100000);
            // Quick sanity — if it's mostly binary noise, drop it
            const printable = textSample.replace(/[^\x20-\x7E\n\r\t]/g, '').length / Math.max(textSample.length, 1);
            if (printable < 0.7) textSample = '';
        } catch (_) { /* binary */ }
        const analysisText = `File: ${filename} (${mimeType}). Risk: ${mlPrediction.risk_level}.\n${textSample}`;
        const mitre = this.mapToMITRE(analysisText, findings);

        // 4. Verdict escalation — ML alone misses content-only threats. Use a combined
        //    signal: high-confidence MITRE matches OR many high-severity IOCs OR many findings.
        const escalatedVerdict = this._escalateVerdict(
            this._verdict(mlReport.aggregate),
            { iocs, mitre, findings }
        );

        const scan = {
            id,
            type: 'file',
            target: filename,
            fileSize: buffer.length,
            mimeType,
            verdict: escalatedVerdict,
            mlReport,
            iocs: this._dedupeIocs(iocs),
            mitre,
            findings,
            timeline: this._buildTimeline('file', startedAt, Date.now()),
            metadata,
            createdAt: new Date().toISOString(),
            durationMs: Date.now() - startedAt,
        };

        this._store(scan);
        return scan;
    }

    /**
     * Escalate verdict when ML missed content-level signals.
     * Returns the highest of: ML verdict, IOC-derived verdict, MITRE-derived verdict.
     */
    _escalateVerdict(mlVerdict, { iocs, mitre, findings }) {
        const order = { clean: 0, suspicious: 1, malicious: 2, unknown: 0 };
        let best = mlVerdict;

        // High-confidence MITRE technique → at least suspicious; multiple high-conf → malicious
        const highConfTech = mitre.techniques.filter(t => t.confidence >= 0.8).length;
        if (highConfTech >= 2)      best = order[best] < order.malicious  ? 'malicious'  : best;
        else if (highConfTech >= 1) best = order[best] < order.suspicious ? 'suspicious' : best;

        // Critical IOC signals (cryptomining wallet addresses, multiple high-severity IOCs)
        const highSevIocs = iocs.filter(i => i.severity === 'high' && i.type !== 'hash').length;
        if (highSevIocs >= 3)      best = order[best] < order.malicious  ? 'malicious'  : best;
        else if (highSevIocs >= 1) best = order[best] < order.suspicious ? 'suspicious' : best;

        // Many findings = at least suspicious
        if (findings.length >= 4 && order[best] < order.suspicious) best = 'suspicious';

        return best;
    }

    // ────────────────────────────────────────────────────────────
    // EVIDENCE LOCKER
    // ────────────────────────────────────────────────────────────

    _store(scan) {
        this.scans.set(scan.id, scan);
        this.scanOrder.unshift(scan.id);
        // Cap at MAX_SCANS — drop oldest
        while (this.scanOrder.length > this.MAX_SCANS) {
            const oldId = this.scanOrder.pop();
            this.scans.delete(oldId);
        }
    }

    getScan(id) {
        return this.scans.get(id) || null;
    }

    deleteScan(id) {
        const ok = this.scans.delete(id);
        if (ok) {
            const idx = this.scanOrder.indexOf(id);
            if (idx >= 0) this.scanOrder.splice(idx, 1);
        }
        return ok;
    }

    listHistory({ limit = 50, offset = 0, type = null, verdict = null } = {}) {
        let ids = this.scanOrder;
        let scans = ids.map(id => this.scans.get(id)).filter(Boolean);
        if (type)    scans = scans.filter(s => s.type === type);
        if (verdict) scans = scans.filter(s => s.verdict === verdict);
        const total = scans.length;
        const page = scans.slice(offset, offset + limit).map(s => ({
            id: s.id,
            type: s.type,
            target: s.target,
            verdict: s.verdict,
            risk: s.mlReport?.aggregate?.overall_risk_level,
            iocCount: s.iocs.length,
            mitreCount: s.mitre.techniques.length,
            createdAt: s.createdAt,
            durationMs: s.durationMs,
        }));
        return { total, limit, offset, scans: page };
    }

    /**
     * Aggregate IOCs across all stored scans, deduplicated.
     * Useful for the IOC tab/heatmap.
     */
    aggregateIocs({ type = null, severity = null, limit = 200 } = {}) {
        const counter = new Map(); // value → { type, value, severity, hits, lastSeen }
        for (const scan of this.scans.values()) {
            for (const ioc of scan.iocs) {
                if (type && ioc.type !== type) continue;
                if (severity && ioc.severity !== severity) continue;
                const key = `${ioc.type}:${ioc.value}`;
                if (counter.has(key)) {
                    const e = counter.get(key);
                    e.hits++;
                    if (scan.createdAt > e.lastSeen) e.lastSeen = scan.createdAt;
                } else {
                    counter.set(key, {
                        type: ioc.type, value: ioc.value, severity: ioc.severity,
                        hits: 1, lastSeen: scan.createdAt,
                    });
                }
            }
        }
        const list = Array.from(counter.values()).sort((a, b) => b.hits - a.hits || (b.lastSeen > a.lastSeen ? 1 : -1));
        return list.slice(0, limit);
    }

    /**
     * MITRE technique frequency across all scans — for heatmap UI.
     */
    mitreHeatmap() {
        const counter = new Map();
        for (const scan of this.scans.values()) {
            for (const t of scan.mitre.techniques) {
                const e = counter.get(t.techniqueId) || { techniqueId: t.techniqueId, name: t.name, tactic: t.tactic, hits: 0 };
                e.hits++;
                counter.set(t.techniqueId, e);
            }
        }
        return Array.from(counter.values()).sort((a, b) => b.hits - a.hits);
    }

    // ────────────────────────────────────────────────────────────
    // HELPERS
    // ────────────────────────────────────────────────────────────

    _verdict(aggregate) {
        if (!aggregate) return 'unknown';
        const action = aggregate.recommended_action;
        if (action === 'block') return 'malicious';
        if (action === 'warn')  return 'suspicious';
        return 'clean';
    }

    _urlFeatureFindings(url, features) {
        const findings = [];
        if (features.has_ip_address)     findings.push('URL hostname is an IP literal — possible C2 or phishing redirect.');
        if (features.has_suspicious_tld) findings.push('Suspicious TLD detected (free/abused: .tk, .xyz, etc.).');
        if (features.has_at_symbol)      findings.push('"@" symbol in URL — phishing obfuscation technique.');
        if (features.has_double_slash)   findings.push('Double-slash in URL path — possible redirect smuggling.');
        if (features.url_length > 100)   findings.push(`Excessive URL length (${features.url_length}) — possible obfuscation.`);
        if (!features.is_https)          findings.push('Non-HTTPS connection — credentials and data unencrypted.');
        if (features.has_mixed_content)  findings.push('Mixed content — HTTP resources loaded over HTTPS page.');
        if (features.suspicious_apis)    findings.push('Suspicious browser APIs invoked (eval, Function, etc.).');
        return findings;
    }

    _fileFindings(filename, buffer, iocs) {
        const findings = [];
        const ext = (filename.match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase();
        if (['exe','bat','scr','vbs','js','jar','ps1','cmd'].includes(ext)) {
            findings.push(`Executable file extension (.${ext}) — high-risk file type.`);
        }
        if (buffer.length > 10485760) findings.push(`Large file (${(buffer.length/1048576).toFixed(1)} MB).`);
        // PE header MZ
        if (buffer.length >= 2 && buffer[0] === 0x4D && buffer[1] === 0x5A) {
            findings.push('Windows PE executable detected (MZ header).');
        }
        // ELF header
        if (buffer.length >= 4 && buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46) {
            findings.push('Linux ELF executable detected.');
        }
        // ZIP / Office docs
        if (buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4B) {
            findings.push('ZIP container detected — possible Office document or archive.');
        }
        const urlIocs = iocs.filter(i => i.type === 'url');
        if (urlIocs.length > 5) findings.push(`File embeds ${urlIocs.length} URLs — possible callback or downloader.`);
        return findings;
    }

    _buildTimeline(type, startedAt, endedAt) {
        const total = endedAt - startedAt;
        return [
            { step: 'received',        label: type === 'url' ? 'Target URL received' : 'File uploaded',       at: 0 },
            { step: 'extract_features',label: 'Feature extraction',                                            at: Math.round(total * 0.15) },
            { step: 'ml_analysis',     label: 'ML threat analysis',                                            at: Math.round(total * 0.45) },
            { step: 'ioc_extraction',  label: 'IOC extraction',                                                at: Math.round(total * 0.7) },
            { step: 'mitre_mapping',   label: 'MITRE ATT&CK mapping',                                          at: Math.round(total * 0.85) },
            { step: 'completed',       label: 'Analysis complete',                                             at: total },
        ];
    }

    _dedupeIocs(iocs) {
        const seen = new Map();
        for (const ioc of iocs) {
            const key = `${ioc.type}:${ioc.value}`;
            if (!seen.has(key)) seen.set(key, ioc);
        }
        return Array.from(seen.values());
    }

    _normalizeType(rawType) {
        const m = { ipv4: 'ip', ipv6: 'ip', md5: 'hash', sha1: 'hash', sha256: 'hash', btcAddr: 'crypto-address' };
        return m[rawType] || rawType;
    }

    _iocSeverity(type, value) {
        if (type === 'ipv4') {
            // Private/loopback IPs are lower severity
            if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.|0\.|169\.254\.|fe80::)/i.test(value)) return 'low';
            return 'high';
        }
        if (type === 'sha256') return 'high';
        if (type === 'md5' || type === 'sha1') return 'medium';
        if (type === 'cve') return 'high';
        if (type === 'btcAddr') return 'high';
        if (type === 'domain') {
            // Suspicious TLDs
            if (/\.(tk|xyz|top|click|loan|gq|ml|cf|ga)$/i.test(value)) return 'medium';
            return 'low';
        }
        return 'medium';
    }

    _isCommonFalsePositive(type, value) {
        if (type === 'domain') {
            const benign = ['w3.org', 'schema.org', 'example.com', 'localhost', 'mozilla.org', 'github.com', 'google.com'];
            if (benign.includes(value)) return true;
            // Filter out things that look like file extensions or version strings
            if (/^v?\d+\.\d+/.test(value)) return true;
            if (value.split('.').length > 6) return true;
        }
        if (type === 'ipv4') {
            // Filter things that look like version numbers (e.g., 1.0.0.0)
            if (/^[01]\.[01]?\d?\.\d{1,3}\.\d{1,3}$/.test(value) && value.split('.').slice(0, 2).every(p => parseInt(p, 10) <= 1)) {
                return true;
            }
        }
        return false;
    }
}

// Singleton
const sandboxAnalysisService = new SandboxAnalysisService();

module.exports = {
    SandboxAnalysisService,
    sandboxAnalysisService,
};
