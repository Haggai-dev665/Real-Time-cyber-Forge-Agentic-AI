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
const SandboxScan = require('../models/SandboxScan');
const { workspaceRepository } = require('../repositories/workspaceRepository');
const { workspaceIdFor } = require('./workspaceService');
const audit = require('./auditLogService');
const { safeFilename, describeContent } = require('./uploadPolicy');
const { integritySigner, verifySignature } = require('./integrityKey');
const { hashOf } = require('../utils/canonical');
const AuditEvent = require('../models/AuditEvent');

const MANIFEST_FORMAT = 'cyberforge-evidence-manifest-v1';
const manifestMessage = manifestHash => `${MANIFEST_FORMAT}\n${manifestHash}`;

const scans = workspaceRepository(SandboxScan);

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

// canonical(): the same evidence always gives the same hash (utils/canonical.js)
const { canonical } = require('../utils/canonical');

const EVIDENCE_FIELDS = ['scanId', 'type', 'target', 'verdict', 'mlReport', 'iocs', 'mitre', 'findings', 'timeline', 'metadata', 'fileSize', 'mimeType', 'durationMs', 'ownerId', 'createdAt'];

/** SHA-256 of the evidence fields of a scan, in canonical form. */
function evidenceHashOf(scan) {
    const evidence = {};
    for (const field of EVIDENCE_FIELDS) evidence[field] = scan[field] === undefined ? null : scan[field];
    return crypto.createHash('sha256').update(JSON.stringify(canonical(evidence))).digest('hex');
}

const MAX_LISTED = 200;

class SandboxAnalysisService {
    constructor() {
        this.iocService    = new IOCAnalysisService();
        this.mitreService  = new MITREAttackService();
        // The evidence locker is the database (models/SandboxScan.js), one
        // workspace at a time. Until October 2026 it was a ring of 200 scans
        // in this process's memory, gone after every restart.
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

    async analyzeUrl(url, additionalFeatures = {}, metadata = {}, principal = null) {
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

        // 5. Keep it in the caller's workspace
        return this._store(scan, principal);
    }

    async analyzeFile(rawFilename, buffer, mimeType = '', metadata = {}, principal = null) {
        const startedAt = Date.now();
        const id = uuidv4();
        // The name and claimed type come from the uploader: cleaned before use,
        // and the type is read from the content (SEC-04).
        const filename = safeFilename(rawFilename);
        mimeType = String(mimeType || '').replace(/[^\w.+\/-]/g, '').slice(0, 100);
        const content = describeContent(filename, buffer, mimeType);

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
            detectedType: content.detected.type,
            aggregate: {
                blended_threat_score: mlPrediction.threat_score,
                overall_risk_level:   mlPrediction.risk_level,
                recommended_action:   mlPrediction.is_threat ? 'block' : 'allow',
            },
            model_predictions: { malware_detection: mlPrediction },
        };

        // 3. MITRE mapping — include actual file text content (capped) so keyword
        //    matching can fire on suspicious payloads even when ML metadata is clean.
        const findings = [...this._fileFindings(filename, buffer, iocs), ...content.findings];
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

        return this._store(scan, principal);
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

    /**
     * Keep a scan in the caller's workspace, with a fingerprint of its
     * evidence. Returns the scan as the API presents it. A scan with no
     * signed-in account behind it, or that cannot be stored, is an error:
     * evidence that was not kept is not reported as kept.
     */
    async _store(scan, principal) {
        const workspaceId = await workspaceIdFor(principal);
        if (!workspaceId) throw new Error('A scan needs a signed-in account with a workspace to be kept');
        const record = { ...scan, scanId: scan.id, ownerId: String(principal.userId) };
        delete record.id;
        record.evidenceHash = evidenceHashOf(record);
        const stored = await scans.create({ userId: principal.userId, workspaceId }, { ...record, createdAt: new Date(record.createdAt) });
        return this._present(stored);
    }

    /** A stored scan as the API returns it, with the result of checking its fingerprint. */
    _present(doc) {
        const record = {};
        for (const field of EVIDENCE_FIELDS) record[field] = doc[field];
        record.createdAt = new Date(doc.createdAt).toISOString();
        const recomputed = evidenceHashOf({ ...record, createdAt: record.createdAt });
        const { scanId, ...rest } = record;
        return {
            id: scanId,
            ...rest,
            integrity: { algorithm: 'sha256', evidenceHash: doc.evidenceHash, intact: recomputed === doc.evidenceHash },
        };
    }

    /** The scan, or null when it is not in the caller's workspace. */
    async getScan(id, principal) {
        const doc = await scans.findOne(principal, { scanId: String(id) });
        return doc ? this._present(doc) : null;
    }

    /**
     * Delete a scan of the caller's workspace. The evidence goes; a minimal
     * audit event stays, naming what was deleted, by whom, and its fingerprint.
     */
    async deleteScan(id, principal) {
        const doc = await scans.findOne(principal, { scanId: String(id) });
        if (!doc) return false;
        const removed = await scans.deleteOne(principal, { scanId: String(id) });
        if (removed) {
            await audit.record({
                principal, action: 'evidence.delete', resource: `sandbox scan ${doc.scanId}`,
                details: { type: doc.type, target: doc.target, verdict: doc.verdict, evidenceHash: doc.evidenceHash, collectedAt: new Date(doc.createdAt).toISOString() },
            });
        }
        return removed;
    }

    /**
     * Export evidence with a signed manifest (SEC-08): the chosen scans (or the
     * latest MAX_LISTED) as stored, and a manifest naming each one's ID, source,
     * collection time and fingerprint, signed with the server's key. Items are
     * exported exactly as stored, so the manifest records no transformation.
     */
    async exportEvidence(principal, ids = null) {
        const workspaceId = await workspaceIdFor(principal);
        if (!workspaceId) throw new Error('An export needs a signed-in account with a workspace');
        let docs;
        if (Array.isArray(ids) && ids.length) {
            docs = [];
            for (const id of ids.slice(0, MAX_LISTED)) {
                const doc = await scans.findOne(principal, { scanId: String(id) });
                if (doc) docs.push(doc);
            }
        } else {
            docs = await scans.find(principal, {}, { limit: MAX_LISTED, sort: { createdAt: -1 } });
        }
        const items = docs.map(doc => this._present(doc));
        const manifest = {
            format: MANIFEST_FORMAT,
            workspaceId: String(workspaceId),
            exportedAt: new Date().toISOString(),
            hashAlgorithm: 'sha256',
            hashedFields: EVIDENCE_FIELDS,
            transformations: [],
            items: items.map(item => ({
                id: item.id,
                kind: 'sandbox_scan',
                source: `sandbox ${item.type} analysis`,
                collectedAt: item.createdAt,
                evidenceHash: item.integrity.evidenceHash,
                intactAtExport: item.integrity.intact,
            })),
            requested: Array.isArray(ids) && ids.length ? ids.slice(0, MAX_LISTED).map(String) : null,
        };
        const manifestHash = hashOf(manifest);
        const signer = integritySigner();
        const signature = signer ? { keyId: signer.keyId, publicKey: signer.publicKey, value: signer.sign(manifestMessage(manifestHash)) } : null;
        await audit.record({ principal, action: 'evidence.export', resource: `${items.length} sandbox scans`, details: { manifestHash, items: items.length, signed: Boolean(signature) } });
        return { manifest, manifestHash, signature, items, note: signature ? null : 'No signing key is configured, so the manifest is not signed.' };
    }

    /**
     * Check an exported manifest: its signature, and each item against what is
     * stored now — intact, changed since export, deleted (with the time of its
     * deletion record) or missing without a deletion record.
     */
    async verifyExport(principal, { manifest, signature } = {}) {
        const workspaceId = await workspaceIdFor(principal);
        if (!manifest || manifest.format !== MANIFEST_FORMAT || !Array.isArray(manifest.items)) {
            return { valid: false, reason: 'not an evidence manifest' };
        }
        const manifestHash = hashOf(manifest);
        const signer = integritySigner();
        let signed = 'unsigned';
        if (signature && signature.value) {
            signed = !signer || signature.keyId !== signer.keyId ? 'other_key'
                : verifySignature(signer.publicKey, manifestMessage(manifestHash), signature.value) ? 'valid' : 'invalid';
        }
        if (String(manifest.workspaceId) !== String(workspaceId)) {
            return { valid: false, signature: signed, manifestHash, reason: 'the manifest is for another workspace; its items are not looked up' };
        }
        const deletions = (await AuditEvent.find({ workspaceId, action: 'evidence.delete' }).lean());
        const items = [];
        for (const entry of manifest.items.slice(0, MAX_LISTED)) {
            const doc = await scans.findOne(principal, { scanId: String(entry.id) });
            if (doc) {
                const now = this._present(doc);
                const same = now.integrity.evidenceHash === entry.evidenceHash && now.integrity.intact;
                items.push({ id: entry.id, state: same ? 'intact' : 'changed', storedHash: now.integrity.evidenceHash, recomputedIntact: now.integrity.intact });
                continue;
            }
            const deletion = deletions.find(e => e.resource === `sandbox scan ${entry.id}`);
            items.push(deletion
                ? { id: entry.id, state: 'deleted', deletedAt: new Date(deletion.createdAt).toISOString(), deletionHashMatches: deletion.details && deletion.details.evidenceHash === entry.evidenceHash }
                : { id: entry.id, state: 'missing' });
        }
        return {
            valid: signed === 'valid' && items.every(i => i.state === 'intact'),
            signature: signed,
            manifestHash,
            items,
            counts: items.reduce((c, i) => ({ ...c, [i.state]: (c[i.state] || 0) + 1 }), {}),
            keyId: signer ? signer.keyId : null,
            publicKey: signer ? signer.publicKey : null,
        };
    }

    /** A page of the caller's scans, newest first. */
    async listHistory({ limit = 50, offset = 0, type = null, verdict = null } = {}, principal) {
        const filter = {};
        if (type === 'url' || type === 'file') filter.type = type;
        if (SandboxScan.VERDICTS.includes(verdict)) filter.verdict = verdict;
        const [found, total] = await Promise.all([
            scans.find(principal, filter, { limit, skip: offset }),
            scans.count(principal, filter),
        ]);
        const page = found.map(s => ({
            id: s.scanId,
            type: s.type,
            target: s.target,
            verdict: s.verdict,
            risk: s.mlReport?.aggregate?.overall_risk_level,
            iocCount: (s.iocs || []).length,
            mitreCount: ((s.mitre && s.mitre.techniques) || []).length,
            createdAt: new Date(s.createdAt).toISOString(),
            durationMs: s.durationMs,
        }));
        return { total, limit, offset, scans: page };
    }

    /** The caller's latest scans, for the summaries below (at most MAX_LISTED). */
    async _latest(principal) {
        return scans.find(principal, {}, { limit: MAX_LISTED });
    }

    /**
     * Aggregate IOCs across the caller's latest scans (up to 200), deduplicated.
     * Useful for the IOC tab/heatmap.
     */
    async aggregateIocs({ type = null, severity = null, limit = 200 } = {}, principal) {
        const counter = new Map(); // value → { type, value, severity, hits, lastSeen }
        for (const scan of await this._latest(principal)) {
            const seenAt = new Date(scan.createdAt).toISOString();
            for (const ioc of scan.iocs || []) {
                if (type && ioc.type !== type) continue;
                if (severity && ioc.severity !== severity) continue;
                const key = `${ioc.type}:${ioc.value}`;
                if (counter.has(key)) {
                    const e = counter.get(key);
                    e.hits++;
                    if (seenAt > e.lastSeen) e.lastSeen = seenAt;
                } else {
                    counter.set(key, { type: ioc.type, value: ioc.value, severity: ioc.severity, hits: 1, lastSeen: seenAt });
                }
            }
        }
        const list = Array.from(counter.values()).sort((a, b) => b.hits - a.hits || (b.lastSeen > a.lastSeen ? 1 : -1));
        return list.slice(0, limit);
    }

    /** MITRE technique frequency across the caller's latest scans (up to 200) — for the heatmap. */
    async mitreHeatmap(principal) {
        const counter = new Map();
        for (const scan of await this._latest(principal)) {
            for (const t of (scan.mitre && scan.mitre.techniques) || []) {
                const e = counter.get(t.techniqueId) || { techniqueId: t.techniqueId, name: t.name, tactic: t.tactic, hits: 0 };
                e.hits++;
                counter.set(t.techniqueId, e);
            }
        }
        return Array.from(counter.values()).sort((a, b) => b.hits - a.hits);
    }

    /** How many scans the caller's workspace holds. */
    async countScans(principal) {
        return scans.count(principal, {});
    }

    // ────────────────────────────────────────────────────────────
    // HELPERS
    // ────────────────────────────────────────────────────────────

    _verdict(aggregate) {
        if (!aggregate) return 'unknown';
        const action = aggregate.recommended_action;
        if (action === 'block') return 'malicious';
        if (action === 'warn')  return 'suspicious';
        if (action === 'allow') return 'clean';
        // no model answered, or an action this does not know: no verdict, not "clean"
        return 'unknown';
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
        // ZIP and other archives are reported by describeContent (uploadPolicy)
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
