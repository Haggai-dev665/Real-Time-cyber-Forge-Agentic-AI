/**
 * Agent Orchestrator — fans out 8 specialist agents on every URL visit.
 *
 * DAG (3 stages):
 *   Stage 1 (parallel, no deps):
 *     • URLClassifierAgent  — BERT phishing/malware classifier (HF)
 *     • DGADetectorAgent    — entropy heuristic (HF)
 *     • WebScraperAgent     — webscrapper.live → DOM/network/headers
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
    constructor() { super('web_scraper', 'Page scraper — DOM, network, headers'); }
    async _run({ url }) {
        const r = await webScraperAPIService.scrapeWebsite(url);
        if (!r.success) throw new Error(r.error || 'scrape failed');
        const d = r.data || {};
        return {
            networkRequests: (d.network_requests || []).length,
            consoleLogs:     (d.console_logs || []).length,
            isHttps:         d.security_report?.is_https,
            mixedContent:    d.security_report?.mixed_content,
            missingHeaders:  d.security_report?.missing_security_headers || [],
            htmlSize:        (d.html_content || '').length,
            scrapedAt:       d.scraped_at,
            // Keep slices accessible to downstream agents
            _raw: {
                html_content:     d.html_content?.slice(0, 50000) || '',
                network_requests: d.network_requests || [],
                console_logs:     d.console_logs || [],
                response_headers: d.response_headers || {},
                security_report:  d.security_report || {},
            },
        };
    }
}

class MemoryAgent extends AgentBase {
    constructor() { super('memory', 'Domain history + session context loader'); }
    async _run({ url, sessionId }) {
        let host;
        try { host = new URL(url).hostname; } catch { host = url; }
        const domain    = await memoryService.getDomainMemory(host);
        const session   = memoryService.sessionStats(sessionId);
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
        const html = scraperResult?._raw?.html_content || '';
        if (html) iocs.push(...sandboxAnalysisService.extractIOCsFromText(html, 'page-html'));
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
    constructor() { super('behavioral', 'JS APIs, forms, cookies, redirect chains'); }
    async _run({ scraperResult }) {
        const html = scraperResult?._raw?.html_content || '';
        const headers = scraperResult?._raw?.response_headers || {};
        const network = scraperResult?._raw?.network_requests || [];

        const findings = [];
        // Forms
        const formCount = (html.match(/<form\b/gi) || []).length;
        const passwordFields = (html.match(/type=["']?password["']?/gi) || []).length;
        if (passwordFields > 0 && !scraperResult.isHttps) findings.push('Password input on non-HTTPS page');
        if (formCount > 5) findings.push(`${formCount} forms detected — possible phishing kit`);
        // Suspicious JS APIs
        const suspiciousApis = [];
        if (/eval\s*\(/.test(html)) suspiciousApis.push('eval()');
        if (/atob\s*\(/.test(html)) suspiciousApis.push('atob() — base64 decode');
        if (/document\.write\s*\(/.test(html)) suspiciousApis.push('document.write()');
        if (/Function\s*\(['"`]/.test(html)) suspiciousApis.push('Function() constructor');
        if (/crypto\.subtle/.test(html)) suspiciousApis.push('Web Crypto API');
        if (suspiciousApis.length) findings.push(`Suspicious JS APIs: ${suspiciousApis.join(', ')}`);
        // Cookies
        const setCookies = headers['set-cookie'] || headers['Set-Cookie'];
        const cookieCount = Array.isArray(setCookies) ? setCookies.length : (setCookies ? 1 : 0);
        if (cookieCount > 8) findings.push(`${cookieCount} cookies set — heavy tracking`);
        // External requests
        let externalCount = 0;
        try {
            const baseHost = new URL(scraperResult?._raw?.security_report?.url || '').hostname;
            externalCount = network.filter(r => {
                try { return new URL(r.url).hostname !== baseHost; } catch { return false; }
            }).length;
        } catch { /* ignore */ }
        // Redirect chain
        const redirects = network.filter(r => r.status >= 300 && r.status < 400).length;
        if (redirects > 2) findings.push(`${redirects} redirects detected`);
        return {
            forms: formCount,
            passwordFields,
            suspiciousApis,
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
        if (scraper) {
            let s = 0;
            if (!scraper.isHttps)      s += 8;
            if (scraper.mixedContent)  s += 5;
            if ((scraper.missingHeaders?.length || 0) > 3) s += 4;
            signals.push(s);
        }
        if (behavioral) {
            let s = 0;
            if (behavioral.passwordFields && !scraper?.isHttps) s += 12;
            if (behavioral.suspiciousApis?.length > 1)          s += 8;
            if (behavioral.findings?.length > 2)                s += 5;
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
        const verdict = riskScore >= 65 ? 'malicious'
                      : riskScore >= 35 ? 'suspicious'
                      : riskScore >= 15 ? 'low-risk'
                      : 'clean';

        // Build human-readable findings list
        const findings = [];
        if (urlClass?.verdict === 'malicious') findings.push(`URL classifier: malicious (${urlClass.confidence}% confidence)`);
        if (dga?.verdict === 'dga')             findings.push(`DGA detector: looks generated (${dga.confidence}% confidence)`);
        if (!scraper?.isHttps)                  findings.push('Site does not use HTTPS');
        if (scraper?.mixedContent)              findings.push('Mixed HTTP/HTTPS content');
        if (behavioral?.findings?.length)       findings.push(...behavioral.findings);
        if (threatIntel?.flagged > 0)           findings.push(`${threatIntel.flagged} IOCs known to OTX threat intel`);
        if (memory?.lastVerdict === 'malicious') findings.push(`Domain previously flagged malicious (${memory.visitCount} visits)`);

        // LLM summary (chained: Gemini → ZySec → heuristic)
        const llmContextKey = sessionId ? `session:${sessionId}` : null;
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
            summary:    llm.text,
            llmSource:  llm.source,
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
            memoryService.recordUrlInSession(sessionId, { url, verdict, host: memory?.host });
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
            this.agents.memory.execute({ url, sessionId }),
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

    getRecentReports(limit = 20) { return this.recentReports.slice(0, limit); }

    getStats() {
        const recent = this.recentReports.slice(0, 50);
        return {
            totalReports: this.recentReports.length,
            avgDurationMs: recent.length ? Math.round(recent.reduce((a, r) => a + r.durationMs, 0) / recent.length) : 0,
            verdictBreakdown: recent.reduce((acc, r) => { acc[r.verdict || 'unknown'] = (acc[r.verdict || 'unknown'] || 0) + 1; return acc; }, {}),
            agents: Object.keys(this.agents).map(k => ({ name: k, role: this.agents[k].role })),
            memory: memoryService.stats(),
        };
    }
}

const agentOrchestrator = new AgentOrchestrator();
module.exports = { AgentOrchestrator, agentOrchestrator };
