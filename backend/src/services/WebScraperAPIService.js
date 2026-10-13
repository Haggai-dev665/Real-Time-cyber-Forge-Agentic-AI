/**
 * Rendered-page scanner client (WebScraper.live, API v1).
 *
 * The scanner loads a page in an isolated browser and returns observations:
 * `signals` (each with the evidence it rests on), a `coverage` map of which
 * checks ran, and a short `ai_context`. It does not return a verdict.
 *
 * This client never turns a missing answer into a clean one. When the scanner
 * is not configured, unreachable, refuses the target or runs out of time, the
 * result says so in `status` and `coverage`, and every score derived from page
 * evidence is null rather than zero (SEC-06, UX-03).
 */

const axios = require('axios');
const { getScraperConfig } = require('../config/scraper.config');

// The backend answers through a router that closes requests at 30 seconds, and
// the URL models and the explanation still have to run after the scan.
const DEFAULT_WAIT_SECONDS = 15;
const DEFAULT_BUDGET_MS = 20000;
const POLL_INTERVAL_MS = 1000;

// Signals that describe the scan rather than the page. They explain missing
// coverage and carry no weight in the evidence score.
const COVERAGE_SIGNALS = new Set(['page_not_loaded', 'scan_limit_reached']);
const CORE_CHECKS = ['navigation', 'redirect_chain', 'dom', 'forms', 'iframes', 'scripts', 'network', 'cookies', 'security_headers', 'tls', 'mixed_content', 'brand', 'iocs'];
const SEVERITY_WEIGHT = { high: { each: 30, max: 2 }, medium: { each: 12, max: 3 }, low: { each: 3, max: 4 }, info: { each: 0, max: 0 } };
const EXPECTED_HEADERS = [
    ['Strict-Transport-Security', 'hsts'],
    ['Content-Security-Policy', 'csp'],
    ['X-Frame-Options', 'x_frame_options'],
    ['X-Content-Type-Options', 'x_content_type_options'],
    ['Referrer-Policy', 'referrer_policy']
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

class WebScraperAPIService {
    constructor(env = process.env) {
        this.config = getScraperConfig(env);
        if (!this.config.available) {
            // The reason names the setting, never its value.
            console.warn(`⚠️ Rendered-page scanner unavailable: ${this.config.reason}. URL scans will report partial coverage.`);
        }
        this.http = axios.create({
            headers: { 'Content-Type': 'application/json', 'X-API-Key': this.config.apiKey },
            // Every status is a statement from the provider and is read as one.
            validateStatus: () => true,
            maxRedirects: 0
        });
    }

    /** Whether the scanner can be called at all, and why not. */
    status() {
        return { available: this.config.available, reason: this.config.reason };
    }

    /**
     * Scan a URL and return its evidence.
     *
     * Always resolves. `success` is true only when the scanner completed a
     * scan; read `data.page.loaded` and `coverage` to know what it covers.
     *
     * @param {string} url
     * @param {{ profile?: 'fast'|'full', waitSeconds?: number, budgetMs?: number, fresh?: boolean }} [options]
     */
    async scrapeWebsite(url, options = {}) {
        const { profile = 'fast', fresh = false } = options;
        const budgetMs = Math.max(1000, Math.min(options.budgetMs || DEFAULT_BUDGET_MS, 28000));
        const waitSeconds = Math.max(0, Math.min(options.waitSeconds === undefined ? DEFAULT_WAIT_SECONDS : options.waitSeconds, 25, Math.floor((budgetMs - 3000) / 1000)));
        const deadline = Date.now() + budgetMs;

        if (!this.config.available) {
            return this.unavailable(url, 'unavailable', 'SCRAPER_NOT_CONFIGURED', this.config.reason);
        }

        let scan;
        try {
            const created = await this.http.post(
                `${this.config.baseUrl}/api/v1/scans`,
                { url, profile, wait_seconds: waitSeconds, fresh },
                { timeout: Math.max(1000, deadline - Date.now()) }
            );
            const failure = this.envelopeFailure(url, created);
            if (failure) return failure;
            scan = created.data.data;

            // 202: the scan is still running. Poll for what is left of the budget.
            while ((scan.status === 'queued' || scan.status === 'running') && deadline - Date.now() > POLL_INTERVAL_MS + 500) {
                await sleep(POLL_INTERVAL_MS);
                const polled = await this.http.get(`${this.config.baseUrl}/api/v1/scans/${encodeURIComponent(scan.scan_id)}`, { timeout: Math.max(1000, deadline - Date.now()) });
                const pollFailure = this.envelopeFailure(url, polled);
                if (pollFailure) return pollFailure;
                scan = polled.data.data;
            }
        } catch (error) {
            const timedOut = error.code === 'ECONNABORTED' || /timeout/i.test(error.message || '');
            return this.unavailable(
                url,
                'unavailable',
                timedOut ? 'SCRAPER_TIMEOUT' : 'SCRAPER_UNREACHABLE',
                timedOut ? 'the scanner did not answer in time' : 'the scanner could not be reached'
            );
        }

        if (scan.status === 'queued' || scan.status === 'running') {
            return { ...this.unavailable(url, 'pending', 'SCAN_PENDING', 'the scan had not finished when the time allowed for it ran out'), scan_id: scan.scan_id };
        }
        if (scan.status === 'failed') {
            const code = (scan.error && scan.error.code) || 'SCAN_FAILED';
            return { ...this.unavailable(url, 'failed', code, (scan.error && scan.error.message) || 'the scan failed'), scan_id: scan.scan_id };
        }
        if (scan.status !== 'completed' || !scan.result || !scan.result.page || !scan.coverage || !Array.isArray(scan.signals)) {
            return this.unavailable(url, 'unavailable', 'SCRAPER_CONTRACT_MISMATCH', 'the scanner answered in a form this client does not understand');
        }
        return { success: true, status: 'completed', url, scan_id: scan.scan_id, error: null, error_code: null, coverage: scan.coverage, data: this.project(url, scan) };
    }

    /** Turn a non-success response into a result, or return null when the response carries a scan. */
    envelopeFailure(url, response) {
        const body = response.data;
        if (response.status >= 200 && response.status < 300 && body && body.success === true && body.data && typeof body.data.scan_id === 'string') {
            return null;
        }
        const error = body && typeof body === 'object' ? body.error : null;
        const code = error && typeof error === 'object' && typeof error.code === 'string' ? error.code : null;
        if (code === 'TARGET_NOT_ALLOWED') {
            return this.unavailable(url, 'refused', code, 'the scanner does not fetch this destination (internal or non-public address)');
        }
        if (code) {
            return this.unavailable(url, 'unavailable', code, typeof error.message === 'string' ? error.message.slice(0, 200) : 'the scanner refused the request');
        }
        return this.unavailable(url, 'unavailable', 'SCRAPER_CONTRACT_MISMATCH', `the scanner answered HTTP ${response.status} in a form this client does not understand`);
    }

    /** A result that carries no page evidence, with the reason as coverage. */
    unavailable(url, status, code, reason) {
        return {
            success: false,
            status,
            url,
            scan_id: null,
            error: reason,
            error_code: code,
            coverage: { rendered_page: { status: status === 'refused' ? 'skipped' : 'failed', reason } },
            data: null
        };
    }

    /**
     * The scan as this backend uses it: the v1 evidence itself, plus the older
     * field names that existing consumers read, filled from that evidence.
     */
    project(url, scan) {
        const result = scan.result;
        const headers = result.security_headers;
        const timing = result.timing || {};
        const network = result.network || {};
        const requests = (network.requests || []).map(request => ({
            url: request.url,
            method: request.method,
            status: request.status,
            contentType: request.resource_type,
            sizeBytes: request.bytes,
            third_party: request.third_party
        }));
        return {
            url,
            scan_id: scan.scan_id,
            scraped_at: scan.finished_at,
            profile: scan.profile,
            partial: Boolean(scan.partial),
            cache: scan.cache || { hit: false, age_seconds: null },
            page: result.page,
            signals: scan.signals,
            coverage: scan.coverage,
            ai_context: typeof scan.ai_context === 'string' ? scan.ai_context : '',
            artifacts: scan.artifacts || [],
            result,

            // Older names, kept for existing consumers. HTML is no longer inlined;
            // it is an artifact, referenced in `artifacts`.
            html_content: '',
            console_logs: (result.console && result.console.sample) || [],
            network_requests: requests,
            response_headers: result.response_headers || {},
            security_report: {
                url: result.page.final_url || url,
                is_https: result.page.loaded ? String(result.page.final_url || '').startsWith('https://') : null,
                mixed_content: result.page.loaded ? Boolean(network.mixed_content) : null,
                missing_security_headers: headers ? EXPECTED_HEADERS.filter(([, key]) => !headers[key] || !headers[key].present).map(([name]) => name) : [],
                insecure_cookies: result.page.loaded ? (result.cookies || []).some(cookie => !cookie.secure) : null,
                csp: headers && headers.csp ? headers.csp.value : null
            },
            performance_metrics: {
                total_load_time_ms: timing.load_ms ?? null,
                dom_ready_time_ms: timing.dom_content_loaded_ms ?? null,
                first_paint_ms: timing.first_contentful_paint_ms ?? null,
                largest_contentful_paint_ms: timing.largest_contentful_paint_ms ?? null,
                cumulative_layout_shift: timing.cumulative_layout_shift ?? null,
                total_requests: network.total_requests ?? requests.length,
                total_size_kb: typeof network.transferred_bytes === 'number' ? Math.round(network.transferred_bytes / 102.4) / 10 : null
            }
        };
    }

    /**
     * How complete the page evidence is.
     *   complete     every check ran
     *   partial      the page loaded but some checks failed, or the scan was cut short
     *   unavailable  there is no page evidence
     */
    evidenceStatus(scrapedData) {
        if (!scrapedData || !scrapedData.success || !scrapedData.data) return 'unavailable';
        const { page, coverage, partial } = scrapedData.data;
        if (!page.loaded) return 'unavailable';
        // A missing favicon or screenshot is listed as a gap but does not make
        // the page evidence partial; a check the verdict leans on does.
        const failed = CORE_CHECKS.some(name => coverage[name] && coverage[name].status === 'failed');
        return partial || failed ? 'partial' : 'complete';
    }

    /**
     * A 0–100 summary of the scanner's signals, for ranking and for the models
     * that expect one number. It is a fixed heuristic, not a probability and
     * not a measurement: 30 for each high-severity signal (two counted), 12 for
     * each medium (three counted), 3 for each low (four counted). Null when
     * there is no page evidence and nothing else was observed.
     */
    evidenceScore(signals, pageLoaded) {
        const scoring = (signals || []).filter(signal => !COVERAGE_SIGNALS.has(signal.id));
        if (!pageLoaded && scoring.length === 0) return null;
        let score = 0;
        for (const [severity, weight] of Object.entries(SEVERITY_WEIGHT)) {
            score += Math.min(scoring.filter(signal => signal.severity === severity).length, weight.max) * weight.each;
        }
        return Math.min(100, score);
    }

    /**
     * Shape a scan for the classifier, the explanation prompt and the UI.
     * Works for failed scans too: the result then carries the coverage gap and
     * null scores, so nothing downstream can mistake it for a clean page.
     */
    formatForAIAnalysis(scrapedData) {
        const evidenceStatus = this.evidenceStatus(scrapedData);
        const coverage = (scrapedData && scrapedData.coverage) || { rendered_page: { status: 'failed', reason: 'no scan result' } };
        const url = scrapedData && scrapedData.url;

        if (!scrapedData || !scrapedData.success || !scrapedData.data) {
            return {
                url,
                scraped_at: null,
                scan_id: (scrapedData && scrapedData.scan_id) || null,
                evidence_status: evidenceStatus,
                coverage,
                coverage_gaps: this.coverageGaps(coverage),
                signals: [],
                ai_context: `Rendered-page evidence for ${url} is unavailable (${(scrapedData && scrapedData.error) || 'no scan result'}). Nothing was observed about the page, so nothing here indicates it is safe.`,
                error: (scrapedData && scrapedData.error) || 'Scraping failed',
                error_code: (scrapedData && scrapedData.error_code) || null,
                risk_score: null,
                risk_level: 'unknown',
                security_summary: null,
                missing_headers: [],
                external_domains: [],
                suspicious_requests: [],
                performance: {},
                console_issues: { errors: [], warnings: [] },
                network_summary: { total_requests: 0, by_type: {}, failed_requests: 0 },
                html_size_bytes: null
            };
        }

        const data = scrapedData.data;
        const result = data.result;
        const report = data.security_report;
        const network = result.network || {};
        const signals = data.signals;
        const riskScore = this.evidenceScore(signals, data.page.loaded);
        const consoleLogs = data.console_logs || [];
        const consoleErrors = consoleLogs.filter(log => log.level === 'error');
        const consoleWarnings = consoleLogs.filter(log => log.level === 'warn' || log.level === 'warning');

        return {
            url: data.url,
            final_url: data.page.final_url,
            registrable_domain: data.page.registrable_domain,
            title: data.page.title || null,
            scraped_at: data.scraped_at,
            scan_id: data.scan_id,
            cache: data.cache,

            // What was observed, and how much of the page it covers
            evidence_status: evidenceStatus,
            coverage: data.coverage,
            coverage_gaps: this.coverageGaps(data.coverage),
            signals,
            ai_context: data.ai_context,

            // Heuristic summary of the signals (see evidenceScore)
            risk_score: riskScore,
            risk_level: this.getRiskLevel(riskScore),
            risk_score_basis: signals.filter(signal => !COVERAGE_SIGNALS.has(signal.id) && signal.severity !== 'info').map(signal => signal.id),

            security_summary: {
                is_https: report.is_https,
                has_mixed_content: report.mixed_content,
                missing_security_headers: report.missing_security_headers,
                has_insecure_cookies: report.insecure_cookies,
                external_domains_count: (network.third_party_domains || []).length,
                suspicious_requests_count: (network.blocked_requests || []).length + (network.cross_origin_posts || []).length,
                third_party_scripts_count: (result.scripts || []).filter(script => script.third_party).length,
                console_errors_count: (result.console && result.console.errors) || 0,
                console_warnings_count: (result.console && result.console.warnings) || 0
            },

            missing_headers: report.missing_security_headers,
            external_domains: (network.third_party_domains || []).slice(0, 20),
            // Requests the scanner itself flagged, each with the reason it gave.
            suspicious_requests: [
                ...(network.blocked_requests || []).map(request => ({ url: request.url, reason: `blocked: ${request.reason}`, status: null })),
                ...(network.cross_origin_posts || []).map(request => ({ url: request.url, reason: 'data sent to another site on load', status: null }))
            ].slice(0, 10),

            forms: result.forms || [],
            redirects: result.redirects || [],
            tls: result.tls || null,
            brand: result.brand || null,
            iocs: result.iocs || null,

            performance: {
                total_load_time_ms: data.performance_metrics.total_load_time_ms,
                dom_ready_time_ms: data.performance_metrics.dom_ready_time_ms,
                first_paint_ms: data.performance_metrics.first_paint_ms,
                total_requests: data.performance_metrics.total_requests,
                total_size_kb: data.performance_metrics.total_size_kb
            },

            console_issues: {
                errors: consoleErrors.slice(0, 5).map(entry => entry.message),
                warnings: consoleWarnings.slice(0, 5).map(entry => entry.message)
            },

            network_summary: {
                total_requests: network.total_requests ?? data.network_requests.length,
                by_type: this.categorizeRequests(data.network_requests),
                failed_requests: network.failed_requests ?? 0
            },

            html_size_bytes: data.page.html_bytes ?? null
        };
    }

    /** Checks that did not produce evidence, as `name: reason` strings. */
    coverageGaps(coverage) {
        return Object.entries(coverage || {})
            .filter(([, entry]) => entry && (entry.status === 'failed' || entry.status === 'unsupported' || (entry.status === 'skipped' && /did not load|destination/i.test(entry.reason || ''))))
            .map(([name, entry]) => `${name}: ${entry.reason || entry.status}`);
    }

    categorizeRequests(networkRequests) {
        const categories = {};
        (networkRequests || []).forEach(request => {
            const type = request.contentType || 'other';
            categories[type] = (categories[type] || 0) + 1;
        });
        return categories;
    }

    extractDomain(url) {
        try {
            return new URL(url).hostname;
        } catch {
            return null;
        }
    }

    /** `unknown` when there is no score; a missing score is never "minimal". */
    getRiskLevel(score) {
        if (score === null || score === undefined) return 'unknown';
        if (score >= 70) return 'critical';
        if (score >= 50) return 'high';
        if (score >= 30) return 'medium';
        if (score >= 10) return 'low';
        return 'minimal';
    }

    /**
     * Text for a language model or a report panel. It is the scanner's own
     * `ai_context`, written from what the scan observed, with the coverage
     * status stated first. Nothing is added that the scan did not see.
     */
    generateAIContext(analysisData) {
        const lines = ['=== RENDERED-PAGE SCAN ===', `URL: ${analysisData.url}`];
        if (analysisData.evidence_status === 'unavailable') {
            lines.push('Coverage: UNAVAILABLE. The page was not observed.');
        } else if (analysisData.evidence_status === 'partial') {
            lines.push('Coverage: PARTIAL. Some checks did not run; see "Not checked".');
        } else {
            lines.push('Coverage: complete for the checks the scanner supports.');
        }
        if (analysisData.scraped_at) {
            const cached = analysisData.cache && analysisData.cache.hit ? ` (cached result, ${analysisData.cache.age_seconds}s old)` : '';
            lines.push(`Scanned at: ${analysisData.scraped_at}${cached}`);
        }
        lines.push('', analysisData.ai_context || '');
        if (analysisData.risk_score !== null && analysisData.risk_score !== undefined) {
            lines.push('', `Evidence score (heuristic summary of the signals, not a probability): ${analysisData.risk_score}/100`);
        }
        const gaps = (analysisData.coverage_gaps || []).filter(gap => !gap.startsWith('favicon_brand_match'));
        if (gaps.length) lines.push('', `Not checked: ${gaps.join('; ')}`);
        return lines.join('\n');
    }
}

// Singleton instance
const webScraperAPIService = new WebScraperAPIService();

module.exports = { WebScraperAPIService, webScraperAPIService };
