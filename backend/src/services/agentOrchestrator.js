/**
 * Agent Orchestrator — fans out 8 specialist agents on every URL visit.
 *
 * DAG (3 stages):
 *   Stage 1 (parallel, no deps):
 *     • URLClassifierAgent  — BERT phishing/malware classifier (HF)
 *     • DGADetectorAgent    — entropy heuristic (HF)
 *     • WebScraperAgent     — webscrapper.live v1 → signals, coverage, forms, network
 *     • MemoryAgent         — load domain history + session context
 *   Stage 2 (uses scraper output):
 *     • IOCExtractorAgent    — regex extract IOCs from scraped text
 *     • BehavioralAgent      — JS APIs, forms, cookies, redirect chains
 *     • MITREMapperAgent     — map findings to ATT&CK techniques
 *   Stage 3 (uses IOCs from Stage 2):
 *     • ThreatIntelAgent     — OTX enrichment for each IOC
 *
 * Final: ReportAgent aggregates everything → persist to Appwrite + memory + return.
 *
 * Each agent emits a result object. Failures are isolated (one agent crashing
 * doesn't kill the report).
 */

const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { cyberforgeML }            = require('./cyberforgeMLService');
const { sandboxAnalysisService }  = require('./sandboxAnalysisService');
const { webScraperAPIService }    = require('./WebScraperAPIService');
const { memoryService }           = require('./memoryService');
const { llmFallbackChain }        = require('./llmFallbackChain');
const { appwriteService }         = require('./appwriteService');
const otxService                  = require('./otx');

// ────────────────────────────────────────────────────────────────
// AGENT BASE — wraps each specialist with timing + error isolation
// ────────────────────────────────────────────────────────────────

class AgentBase {
    constructor(name, role) {
        this.name = name;
        this.role = role;
    }
    async execute(input) {
        const start = Date.now();
        try {
            const result = await this._run(input);
            return {
                agent:    this.name,
                role:     this.role,
                status:   'ok',
                latencyMs: Date.now() - start,
                result,
            };
        } catch (e) {
            return {
                agent:    this.name,
                role:     this.role,
                status:   'failed',
                latencyMs: Date.now() - start,
                error:    e.message?.slice(0, 200),
            };
        }
    }
    async _run() { throw new Error('subclass must implement _run'); }
}

// ────────────────────────────────────────────────────────────────
// SPECIALIST AGENTS — each is a focused, isolated unit of work
// ────────────────────────────────────────────────────────────────

class URLClassifierAgent extends AgentBase {
    constructor() { super('url_classifier', 'BERT phishing/malware URL classifier'); }
    async _run({ url }) {
        const r = await cyberforgeML.classifyUrlPhishing(url);
        if (r.error) throw new Error(r.error);
        return {
            verdict:    r.is_threat ? 'malicious' : 'benign',
            confidence: r.confidence,
            score:      r.threat_score,
            label:      r.prediction,
            source:     r.inference_source,
        };
    }
}

class DGADetectorAgent extends AgentBase {
    constructor() { super('dga_detector', 'Domain Generation Algorithm detector'); }
    async _run({ url }) {
        let host;
        try { host = new URL(url).hostname; } catch { host = url; }
        const r = await cyberforgeML.detectDga(host);
        if (r.error) throw new Error(r.error);
        return {
            verdict:    r.is_threat ? 'dga' : 'legit',
            confidence: r.confidence,
            score:      r.threat_score,
            features:   r.features,
        };
    }
}

class WebScraperAgent extends AgentBase {
    constructor() { super('web_scraper', 'Rendered-page scan — forms, scripts, network, TLS, signals'); }
    async _run({ url }) {
        const r = await webScraperAPIService.scrapeWebsite(url);
        // A scanner that is unavailable fails this agent. The reporter then
        // records the gap; it must not be read as "nothing found".
        if (!r.success) throw new Error(`${r.error_code}: ${r.error}`);
        const analysis = webScraperAPIService.formatForAIAnalysis(r);
        const d = r.data;
        return {
            scanId:          d.scan_id,
            pageLoaded:      d.page.loaded,
            loadError:       d.page.load_error,
            evidenceStatus:  analysis.evidence_status,
            coverageGaps:    analysis.coverage_gaps,
            signals:         d.signals,
            evidenceScore:   analysis.risk_score,
            aiContext:       d.ai_context,
            finalUrl:        d.page.final_url,
            networkRequests: d.performance_metrics.total_requests,
            consoleLogs:     d.console_logs.length,
            // undefined, not false, when the page was not observed
            isHttps:         d.security_report.is_https ?? undefined,
            mixedContent:    d.security_report.mixed_content ?? undefined,
            missingHeaders:  d.security_report.missing_security_headers,
            htmlSize:        d.page.html_bytes ?? 0,
            scrapedAt:       d.scraped_at,
            // Structured evidence for downstream agents
            _raw: {
                forms:            d.result.forms || [],
                scripts:          (d.result.scripts || []).map(script => ({ src: script.src, inline: script.inline, third_party: script.third_party, obfuscation: script.obfuscation })),
                cookies:          d.result.cookies || [],
                redirects:        d.result.redirects || [],
                iocs:             d.result.iocs || null,
                network_requests: d.network_requests.slice(0, 100),
                response_headers: d.response_headers,
                security_report:  d.security_report,
            },
        };
    }
}

class MemoryAgent extends AgentBase {
    constructor() { super('memory', 'Domain history + session context loader'); }
    async _run({ url, sessionId, userId }) {
        let host;
        try { host = new URL(url).hostname; } catch { host = url; }
        const domain    = await memoryService.getDomainMemory(host);
        const session   = memoryService.sessionStats(sessionId, userId);
        const similar   = await memoryService.findSimilarVisits(url, 3);
        return {
            host,
            visitCount:        domain?.visitCount || 0,
            firstSeen:         domain?.firstSeen || null,
            lastVerdict:       domain?.lastVerdict || null,
            iocsSeenCount:     domain?.iocsSeen?.length || 0,
            historyMultiplier: memoryService.domainHistoryMultiplier(domain),
            sessionStats:      session,
            similarPastVisits: (similar || []).slice(0, 3).map(s => ({
                target: s.target || s.metadata?.target,
                verdict: s.verdict || s.metadata?.verdict,
                score:   s.score,
            })),
        };
    }
}

class IOCExtractorAgent extends AgentBase {
    constructor() { super('ioc_extractor', 'IOC extraction from URL + scraped content'); }
    async _run({ url, scraperResult }) {
        const iocs = [];
        iocs.push(...sandboxAnalysisService.extractIOCsFromUrl(url));
        // Indicators the rendered-page scan found in the page, its scripts and its requests
        const scanned = scraperResult?._raw?.iocs;
        if (scanned) {
            const add = (type, value, source, severityType = type) => iocs.push({
                type, value, source: `page-scan:${source}`, severity: sandboxAnalysisService._iocSeverity(severityType, value),
            });
            for (const e of scanned.domains || [])          add('domain', e.value, e.source);
            for (const e of scanned.ips || [])              add('ip', e.value, e.source, 'ipv4');
            for (const e of scanned.urls || [])             add('url', e.value, e.source);
            for (const e of scanned.emails || [])           add('email', e.value, e.source);
            for (const e of scanned.hashes || [])           add(e.algorithm, e.value, e.source);
            for (const e of scanned.crypto_addresses || []) add(e.currency === 'bitcoin' ? 'btcAddr' : 'ethAddr', e.value, e.source, 'btcAddr');
        }
        // Also pull IOCs from network request URLs
        const reqs = scraperResult?._raw?.network_requests || [];
        for (const req of reqs.slice(0, 50)) {
            if (req.url) iocs.push(...sandboxAnalysisService.extractIOCsFromUrl(req.url));
        }
        // Dedupe
        const seen = new Map();
        for (const ioc of iocs) {
            const k = `${ioc.type}:${ioc.value}`;
            if (!seen.has(k)) seen.set(k, ioc);
        }
        const unique = Array.from(seen.values());
        return {
            count: unique.length,
            iocs: unique.slice(0, 100), // cap for transport
            byType: unique.reduce((acc, i) => { acc[i.type] = (acc[i.type] || 0) + 1; return acc; }, {}),
        };
    }
}

class MITREMapperAgent extends AgentBase {
    constructor() { super('mitre_mapper', 'Map observed signals to MITRE ATT&CK'); }
    async _run({ url, scraperResult, iocResult }) {
        const text = [
            url,
            ...(scraperResult?.missingHeaders || []),
            scraperResult?.mixedContent ? 'mixed content' : '',
            scraperResult?.consoleLogs > 5 ? 'console errors' : '',
            ...(iocResult?.iocs || []).slice(0, 20).map(i => `${i.type} ${i.value}`),
        ].join(' ');
        const mapped = sandboxAnalysisService.mapToMITRE(text, []);
        return {
            techniqueCount: mapped.techniques.length,
            tacticsCovered: mapped.tacticsCovered,
            techniques:     mapped.techniques.slice(0, 10),
            attackChain:    mapped.attackChain.slice(0, 10),
        };
    }
}

class BehavioralAgent extends AgentBase {
    constructor() { super('behavioral', 'Forms, script APIs, cookies, redirect chain'); }
    async _run({ scraperResult }) {
        // Reads the structured evidence of the rendered-page scan. With no page
        // there is nothing to inspect, and saying so beats returning zeros.
        if (!scraperResult || !scraperResult.pageLoaded) throw new Error('no rendered page to inspect');
        const raw = scraperResult._raw || {};
        const forms = raw.forms || [];
        const scripts = raw.scripts || [];
        const network = raw.network_requests || [];

        const findings = [];
        // Forms: what the page asks for, and where it sends it
        const passwordFields = forms.filter(f => f.password).length;
        const credentialForms = forms.filter(f => f.password || f.otp || f.card || f.seed_phrase);
        if (passwordFields > 0 && scraperResult.isHttps === false) findings.push('Password input on non-HTTPS page');
        if (credentialForms.some(f => f.action_cross_site)) findings.push('Credential form submits to a different site');
        if (credentialForms.some(f => f.action_insecure)) findings.push('Credential form submits over plain HTTP');
        if (forms.some(f => f.seed_phrase)) findings.push('Form asks for a wallet recovery phrase or private key');
        if (forms.length > 5) findings.push(`${forms.length} forms on one page`);
        // Script APIs, counted in the scripts that actually ran
        const total = key => scripts.reduce((sum, script) => sum + ((script.obfuscation && script.obfuscation[key]) || 0), 0);
        const suspiciousApis = [];
        if (total('eval_count') > 0) suspiciousApis.push('eval() / Function()');
        if (total('atob_count') > 0) suspiciousApis.push('atob() — base64 decode');
        if (total('fromcharcode_count') >= 10) suspiciousApis.push('String.fromCharCode() used heavily');
        const obfuscated = scripts.filter(script => script.obfuscation && script.obfuscation.indicators.some(i => ['eval_of_decoded_data', 'char_code_heavy', 'escape_dense'].includes(i))).length;
        if (obfuscated) findings.push(`${obfuscated} script(s) with obfuscation indicators`);
        else if (suspiciousApis.length > 1) findings.push(`Script APIs in use: ${suspiciousApis.join(', ')}`);
        // Cookies, from the browser's cookie jar
        const cookieCount = (raw.cookies || []).length;
        if (cookieCount > 8) findings.push(`${cookieCount} cookies set`);
        // Requests to other sites, and the redirect chain
        const externalCount = network.filter(r => r.third_party).length;
        const redirects = Math.max(0, (raw.redirects || []).length - 1);
        if (redirects > 2) findings.push(`${redirects} redirects before the final page`);
        return {
            forms: forms.length,
            passwordFields,
            credentialForms: credentialForms.length,
            suspiciousApis,
            obfuscatedScripts: obfuscated,
            cookies: cookieCount,
            externalRequests: externalCount,
            redirects,
            findings,
        };
    }
}

class ThreatIntelAgent extends AgentBase {
    constructor() { super('threat_intel', 'OTX enrichment of extracted IOCs'); }
    async _run({ iocResult }) {
        const iocs = iocResult?.iocs || [];
        const enrichable = iocs
            .filter(i => i.type === 'ip' || i.type === 'domain' || i.type === 'hash')
            .slice(0, 5); // limit to avoid OTX rate limits
        const lookups = await Promise.all(enrichable.map(async ioc => {
            try {
                const otxType = ioc.type === 'ip' ? 'IPv4' : ioc.type === 'domain' ? 'domain' : 'FileHash-SHA256';
                const detail = await otxService.getIndicatorDetails(otxType, ioc.value);
                const pulses = detail?.pulse_info?.count || 0;
                return {
                    ioc: `${ioc.type}:${ioc.value}`,
                    knownToOtx: pulses > 0,
                    pulseCount: pulses,
                    reputation: detail?.reputation || 0,
                    references: (detail?.pulse_info?.references || []).slice(0, 3),
                };
            } catch (e) {
                return { ioc: `${ioc.type}:${ioc.value}`, knownToOtx: false, error: e.message };
            }
        }));
        const flagged = lookups.filter(l => l.knownToOtx);
        return {
            checked: enrichable.length,
            flagged: flagged.length,
            lookups,
            verdict: flagged.length >= 1 ? 'known-bad' : 'unknown',
        };
    }
}

class ReportAgent extends AgentBase {
    constructor() { super('reporter', 'Aggregate, persist, generate explanation'); }
    async _run({ url, sessionId, userId, agents }) {
        // Pull each agent result by name (safe lookups, all may fail)
        const get = name => agents[name]?.status === 'ok' ? agents[name].result : null;
        const urlClass    = get('url_classifier');
        const dga         = get('dga_detector');
        const scraper     = get('web_scraper');
        const memory      = get('memory');
        const ioc         = get('ioc_extractor');
        const mitre       = get('mitre_mapper');
        const behavioral  = get('behavioral');
        const threatIntel = get('threat_intel');

        // Aggregate scoring (0-100 scale)
        const signals = [];
        if (urlClass)     signals.push((urlClass.score || 0) * 100 * 0.30);          // 30% weight
        if (dga?.verdict === 'dga')         signals.push((dga.score || 0) * 100 * 0.10);
        // Rendered-page evidence: the heuristic summary of the scanner's
        // signals (WebScraperAPIService.evidenceScore), weighted at 35%. It is
        // null, and contributes nothing, when the page was not observed.
        if (scraper && typeof scraper.evidenceScore === 'number') signals.push(scraper.evidenceScore * 0.35);
        if (behavioral) {
            let s = 0;
            if (behavioral.passwordFields && scraper?.isHttps === false) s += 12;
            if (behavioral.suspiciousApis?.length > 1) s += 8;
            if (behavioral.findings?.length > 2)       s += 5;
            signals.push(s);
        }
        if (threatIntel?.verdict === 'known-bad') signals.push(40);   // strong signal
        if (mitre?.techniqueCount >= 3)            signals.push(15);
        if (ioc?.count >= 8)                       signals.push(8);
        let baseScore = signals.reduce((a, b) => a + b, 0);
        // Apply domain history multiplier
        if (memory?.historyMultiplier > 1.0) baseScore *= memory.historyMultiplier;
        const riskScore = Math.min(100, Math.round(baseScore));

        // Verdict tiers
        // How much of the page the verdict rests on. Missing page evidence
        // can never produce "clean": the lowest tier is then "unknown".
        const scraperFailure = agents.web_scraper?.status === 'ok' ? null : (agents.web_scraper?.error || 'the rendered-page scan did not run');
        const evidenceStatus = scraper ? scraper.evidenceStatus : 'unavailable';
        const coverage = {
            rendered_page: evidenceStatus,
            reason: scraperFailure || (scraper && !scraper.pageLoaded ? scraper.loadError : null),
            gaps: scraper ? scraper.coverageGaps : [],
            agents_failed: Object.keys(agents).filter(name => agents[name].status !== 'ok'),
        };
        const verdict = riskScore >= 65 ? 'malicious'
                      : riskScore >= 35 ? 'suspicious'
                      : riskScore >= 15 ? 'low-risk'
                      : evidenceStatus === 'complete' ? 'clean' : 'unknown';

        // Build human-readable findings list
        const findings = [];
        if (urlClass?.verdict === 'malicious') findings.push(`URL classifier: malicious (${urlClass.confidence}% confidence)`);
        if (dga?.verdict === 'dga')             findings.push(`DGA detector: looks generated (${dga.confidence}% confidence)`);
        // The scanner's own observations, most severe first
        for (const signal of (scraper?.signals || []).filter(sig => sig.severity === 'high' || sig.severity === 'medium').slice(0, 8)) {
            findings.push(signal.title);
        }
        if (evidenceStatus !== 'complete') {
            findings.push(`Page evidence ${evidenceStatus}: ${coverage.reason || coverage.gaps.slice(0, 3).join('; ') || 'some checks did not run'}`);
        }
        if (behavioral?.findings?.length)       findings.push(...behavioral.findings);
        if (threatIntel?.flagged > 0)           findings.push(`${threatIntel.flagged} IOCs known to OTX threat intel`);
        if (memory?.lastVerdict === 'malicious') findings.push(`Domain previously flagged malicious (${memory.visitCount} visits)`);

        // Summary from the backend's language-model order (llmFallbackChain.js); the report says which engine wrote it
        const llmContextKey = sessionId ? `session:${userId == null ? '' : userId}:${sessionId}` : null;
        const llm = await llmFallbackChain.explainThreat({
            target: url,
            riskScore,
            findings,
            mitre: mitre?.techniques || [],
            iocs:  ioc?.iocs || [],
        });

        const report = {
            id:         uuidv4(),
            url,
            sessionId,
            userId,
            verdict,
            riskScore,
            evidenceStatus,
            coverage,
            signals:    scraper?.signals || [],
            summary:    llm.text,
            llmSource:  llm.source,
            summaryEngine: llm.engine || null,
            findings,
            agents,                 // raw agent reports for transparency
            iocs:        (ioc?.iocs || []).slice(0, 50),
            mitre:       mitre?.techniques || [],
            attackChain: mitre?.attackChain || [],
            scraperSummary: scraper ? {
                networkRequests: scraper.networkRequests,
                consoleLogs:     scraper.consoleLogs,
                isHttps:         scraper.isHttps,
                missingHeaders:  scraper.missingHeaders,
                htmlSize:        scraper.htmlSize,
                scanId:          scraper.scanId,
                finalUrl:        scraper.finalUrl,
                evidenceScore:   scraper.evidenceScore,
            } : null,
            createdAt: new Date().toISOString(),
        };

        // Persist to Appwrite alerts (only if userId + risk warrants it)
        if (userId && riskScore >= 25) {
            try {
                await appwriteService.createAlert({
                    userId,
                    deviceId: 'desktop',
                    severity: riskScore >= 65 ? 'high' : 'medium',
                    source:   'orchestrator',
                    description: `[${verdict}] ${report.summary?.slice(0, 1000) || ''} — ${url}`.slice(0, 4096),
                    evidence: [
                        `URL: ${url}`,
                        `Verdict: ${verdict}`,
                        `Risk: ${riskScore}/100`,
                        `Agents: ${Object.keys(agents).filter(k => agents[k].status === 'ok').length}/8 ok`,
                        ...findings.slice(0, 4),
                    ],
                    confidence: Math.min(1, riskScore / 100),
                    riskScore,
                });
                report.persistedAlert = true;
            } catch (e) {
                report.persistError = e.message?.slice(0, 200);
            }
        }

        // Update memory
        if (memory?.host) {
            await memoryService.recordDomainVisit(memory.host, {
                verdict, riskScore, iocs: report.iocs, summary: report.summary,
            });
        }
        if (sessionId) {
            memoryService.recordUrlInSession(sessionId, { url, verdict, host: memory?.host, ownerId: userId });
        }
        // Best-effort vector store
        memoryService.storeVisitVector({
            id: report.id,
            target: url,
            verdict,
            riskScore,
            summary: report.summary?.slice(0, 500),
            createdAt: report.createdAt,
        }).catch(() => {});

        return report;
    }
}

// ────────────────────────────────────────────────────────────────
// ORCHESTRATOR — runs the DAG
// ────────────────────────────────────────────────────────────────

class AgentOrchestrator {
    constructor() {
        this.agents = {
            url_classifier: new URLClassifierAgent(),
            dga_detector:   new DGADetectorAgent(),
            web_scraper:    new WebScraperAgent(),
            memory:         new MemoryAgent(),
            ioc_extractor:  new IOCExtractorAgent(),
            behavioral:     new BehavioralAgent(),
            mitre_mapper:   new MITREMapperAgent(),
            threat_intel:   new ThreatIntelAgent(),
            reporter:       new ReportAgent(),
        };
        // In-memory ring of recent reports (for dashboard / status)
        this.recentReports = [];
        this.MAX_RECENT = 100;
    }

    /**
     * Analyze a URL through the 8-agent DAG. Returns the full report.
     */
    async analyze({ url, sessionId, userId }) {
        if (!url) throw new Error('url required');
        const startedAt = Date.now();

        // ── Stage 1: parallel, no deps ──
        const stage1 = await Promise.all([
            this.agents.url_classifier.execute({ url }),
            this.agents.dga_detector.execute({ url }),
            this.agents.web_scraper.execute({ url }),
            this.agents.memory.execute({ url, sessionId, userId }),
        ]);
        const s1 = Object.fromEntries(stage1.map(r => [r.agent, r]));

        // ── Stage 2: depends on scraper output ──
        const scraperResult = s1.web_scraper?.status === 'ok' ? s1.web_scraper.result : null;
        const stage2 = await Promise.all([
            this.agents.ioc_extractor.execute({ url, scraperResult }),
            this.agents.behavioral.execute({ scraperResult }),
        ]);
        const s2 = Object.fromEntries(stage2.map(r => [r.agent, r]));

        // ── Stage 3: depends on IOCs ──
        const iocResult = s2.ioc_extractor?.status === 'ok' ? s2.ioc_extractor.result : null;
        const stage3 = await Promise.all([
            this.agents.mitre_mapper.execute({ url, scraperResult, iocResult }),
            this.agents.threat_intel.execute({ iocResult }),
        ]);
        const s3 = Object.fromEntries(stage3.map(r => [r.agent, r]));

        const allAgents = { ...s1, ...s2, ...s3 };

        // ── Reporter: aggregate + persist ──
        const reporterResult = await this.agents.reporter.execute({
            url, sessionId, userId, agents: allAgents,
        });
        const finalReport = reporterResult.status === 'ok'
            ? reporterResult.result
            : { error: reporterResult.error, partial: allAgents };

        // Track for status endpoint
        this._track({
            ownerId: userId == null ? null : String(userId), sessionId: sessionId || null,
            id: finalReport.id, url, verdict: finalReport.verdict, riskScore: finalReport.riskScore,
            durationMs: Date.now() - startedAt, createdAt: finalReport.createdAt || new Date().toISOString(),
        });

        return {
            ...finalReport,
            durationMs: Date.now() - startedAt,
            agentSummary: this._summarizeAgents(allAgents),
        };
    }

    _track(rec) {
        this.recentReports.unshift(rec);
        if (this.recentReports.length > this.MAX_RECENT) this.recentReports.pop();
    }

    _summarizeAgents(agents) {
        const summary = {};
        for (const [name, r] of Object.entries(agents)) {
            summary[name] = { status: r.status, latencyMs: r.latencyMs, error: r.error };
        }
        return summary;
    }

    // Reports are always read for one account; a read that names no account,
    // and a report tracked without one, match nothing.
    _reportsOf(ownerId) {
        if (ownerId == null) return [];
        const owner = String(ownerId);
        return this.recentReports.filter(report => report.ownerId === owner);
    }

    getRecentReports(limit = 20, ownerId) {
        return this._reportsOf(ownerId).slice(0, limit).map(({ ownerId: _owner, ...report }) => report);
    }

    getStats(ownerId) {
        const own = this._reportsOf(ownerId);
        const recent = own.slice(0, 50);
        return {
            totalReports: own.length,
            avgDurationMs: recent.length ? Math.round(recent.reduce((a, r) => a + r.durationMs, 0) / recent.length) : 0,
            verdictBreakdown: recent.reduce((acc, r) => { acc[r.verdict || 'unknown'] = (acc[r.verdict || 'unknown'] || 0) + 1; return acc; }, {}),
            agents: Object.keys(this.agents).map(k => ({ name: k, role: this.agents[k].role })),
            memory: memoryService.stats(),
        };
    }
}

const agentOrchestrator = new AgentOrchestrator();
module.exports = { AgentOrchestrator, agentOrchestrator };
