/**
 * Orchestrator Routes — REST API for the 8-agent pipeline.
 *
 * Endpoints:
 *   POST  /api/orchestrator/analyze              — run 8-agent analysis on a URL
 *   GET   /api/orchestrator/recent?limit=N       — recent report summaries (in-memory ring)
 *   GET   /api/orchestrator/stats                — aggregated stats + agent roster + memory
 *   GET   /api/orchestrator/agents               — static agent catalog
 *   GET   /api/orchestrator/health               — quick health probe
 *   GET   /api/orchestrator/health/deep          — deep health: HF Space + ML + memory
 *   GET   /api/orchestrator/memory/domain/:host  — domain memory record
 *   GET   /api/orchestrator/memory/session/:sid  — session journey
 *   GET   /api/orchestrator/reports/filter       — server-side filter of recent reports
 *   GET   /api/orchestrator/session/:sid/summary — per-session risk summary
 */

const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const { agentOrchestrator } = require('../services/agentOrchestrator');
const { memoryService }     = require('../services/memoryService');

/**
 * POST /api/orchestrator/analyze
 * Body: { url, sessionId?, userId? }
 * Returns full 8-agent report (verdict, score, IOCs, MITRE chain, LLM summary, agent statuses).
 */
router.post('/analyze', async (req, res) => {
    try {
        const { url, sessionId, userId } = req.body;
        if (!url) return res.status(400).json({ error: 'url required' });
        const report = await agentOrchestrator.analyze({ url, sessionId, userId });
        res.json({ success: true, report });
    } catch (e) {
        console.error('[orchestrator] analyze failed:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/orchestrator/recent?limit=20
 * Returns recent report summaries (for live dashboard).
 */
router.get('/recent', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    res.json({ success: true, reports: agentOrchestrator.getRecentReports(limit) });
});

/**
 * GET /api/orchestrator/stats
 * Aggregated stats — verdict breakdown, average latency, agent roster, memory state.
 */
router.get('/stats', (req, res) => {
    res.json({ success: true, stats: agentOrchestrator.getStats() });
});

/**
 * GET /api/orchestrator/agents
 * Static catalog of agents and their roles (for the floating panel UI).
 */
router.get('/agents', (req, res) => {
    res.json({
        success: true,
        agents: Object.entries(agentOrchestrator.agents).map(([name, a]) => ({ name, role: a.role })),
    });
});

/**
 * GET /api/orchestrator/memory/domain/:host
 * Inspect what we know about a domain (visit count, prior verdicts, IOCs).
 */
router.get('/memory/domain/:host', async (req, res) => {
    try {
        const mem = await memoryService.getDomainMemory(req.params.host);
        if (!mem) return res.status(404).json({ error: 'no memory for host' });
        res.json({ success: true, memory: mem });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/orchestrator/memory/session/:sid
 * Session journey + per-session stats.
 */
router.get('/memory/session/:sid', (req, res) => {
    const session = memoryService.getSession(req.params.sid);
    if (!session) return res.status(404).json({ error: 'no memory for session' });
    // Convert Set → array for JSON serialization
    res.json({
        success: true,
        session: { ...session, hosts: Array.from(session.hosts || []) },
        stats:   memoryService.sessionStats(req.params.sid),
    });
});

/**
 * GET /api/orchestrator/health
 */
router.get('/health', (req, res) => {
    const stats = agentOrchestrator.getStats();
    res.json({
        status: 'ok',
        engine: 'orchestrator-v1',
        agentCount: stats.agents.length,
        memory: stats.memory,
        timestamp: new Date().toISOString(),
    });
});

/**
 * GET /api/orchestrator/health/deep
 * Deep health check — probes HF Space /health, checks memory tiers, and
 * reports each agent dependency status.
 * Response: { status, hfSpace, memory, agents, timestamp }
 */
router.get('/health/deep', async (req, res) => {
    const HF_URL = process.env.AI_SERVICE_URL || 'https://che237-cyberforge.hf.space';
    const stats  = agentOrchestrator.getStats();

    // Probe HF Space
    let hfSpaceStatus = 'unknown';
    let hfData        = null;
    try {
        const r = await axios.get(`${HF_URL}/health`, { timeout: 10000 });
        hfSpaceStatus = r.data?.status || 'ok';
        hfData        = r.data;
    } catch (e) {
        hfSpaceStatus = `unreachable: ${e.message?.slice(0, 80)}`;
    }

    // Probe Redis via memoryService.stats()
    const memStats = memoryService.stats();

    // Agent dependency check (lightweight, no actual HF calls)
    const agentDeps = {
        url_classifier:  { dep: 'hf-space /api/v2/url-classify',  status: hfSpaceStatus.startsWith('unreachable') ? 'degraded' : 'ok' },
        dga_detector:    { dep: 'hf-space /api/v2/dga-detect',     status: hfSpaceStatus.startsWith('unreachable') ? 'degraded' : 'ok' },
        web_scraper:     { dep: 'webscrapper.live api',            status: 'ok' },
        memory:          { dep: 'redis / in-process',              status: memStats.redisReady ? 'ok' : 'degraded-local-only' },
        ioc_extractor:   { dep: 'sandboxAnalysisService (local)',  status: 'ok' },
        behavioral:      { dep: 'local html analysis',            status: 'ok' },
        mitre_mapper:    { dep: 'sandboxAnalysisService (local)',  status: 'ok' },
        threat_intel:    { dep: 'otx alienvault',                  status: process.env.OTX_API_KEY ? 'ok' : 'degraded-no-key' },
        reporter:        { dep: 'llmFallbackChain + appwrite',     status: 'ok' },
    };

    const overallStatus = hfSpaceStatus.startsWith('unreachable') ? 'degraded' : 'healthy';

    res.json({
        status:    overallStatus,
        engine:    'orchestrator-v1',
        hfSpace: {
            url:    HF_URL,
            status: hfSpaceStatus,
            detail: hfData,
        },
        memory: {
            ...memStats,
            status: memStats.redisReady ? 'redis+local' : 'local-only',
        },
        agents:    agentDeps,
        stats: {
            totalReports:  stats.totalReports,
            avgDurationMs: stats.avgDurationMs,
        },
        timestamp: new Date().toISOString(),
    });
});

/**
 * GET /api/orchestrator/reports/filter
 * Server-side filter of in-memory recent reports.
 * Query params:
 *   verdict   — malicious | suspicious | low-risk | clean
 *   minScore  — minimum riskScore (0-100)
 *   maxScore  — maximum riskScore (0-100)
 *   limit     — max results (default 50, max 100)
 *   sessionId — filter to a specific session
 *
 * Response: { success, count, reports: [...] }
 */
router.get('/reports/filter', (req, res) => {
    try {
        const { verdict, minScore, maxScore, limit: limitRaw, sessionId } = req.query;
        const limit = Math.min(parseInt(limitRaw, 10) || 50, 100);

        let reports = agentOrchestrator.getRecentReports(100);

        if (verdict)   reports = reports.filter(r => r.verdict === verdict);
        if (sessionId) reports = reports.filter(r => r.sessionId === sessionId);
        if (minScore !== undefined) {
            const min = parseFloat(minScore);
            if (!isNaN(min)) reports = reports.filter(r => (r.riskScore || 0) >= min);
        }
        if (maxScore !== undefined) {
            const max = parseFloat(maxScore);
            if (!isNaN(max)) reports = reports.filter(r => (r.riskScore || 0) <= max);
        }

        res.json({
            success: true,
            count:   Math.min(reports.length, limit),
            reports: reports.slice(0, limit),
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/orchestrator/session/:sid/summary
 * Summarise all URLs scanned in a session: verdict distribution, top threats,
 * session memory record.
 *
 * Response: { success, sessionId, stats, verdictCounts, topThreats, memory }
 */
router.get('/session/:sid/summary', (req, res) => {
    try {
        const sid     = req.params.sid;
        const session = memoryService.getSession(sid);
        const sStats  = memoryService.sessionStats(sid);

        // Pull matching in-memory reports for this session
        const sessionReports = agentOrchestrator.getRecentReports(100).filter(r => r.sessionId === sid);

        // Verdict counts
        const verdictCounts = sessionReports.reduce((acc, r) => {
            acc[r.verdict || 'unknown'] = (acc[r.verdict || 'unknown'] || 0) + 1;
            return acc;
        }, {});

        // Top 5 highest-risk
        const topThreats = sessionReports
            .filter(r => (r.riskScore || 0) > 0)
            .sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0))
            .slice(0, 5)
            .map(r => ({ url: r.url, verdict: r.verdict, riskScore: r.riskScore, durationMs: r.durationMs, createdAt: r.createdAt }));

        res.json({
            success:      true,
            sessionId:    sid,
            stats:        sStats,
            verdictCounts,
            topThreats,
            totalReports: sessionReports.length,
            memory:       session ? { ...session, hosts: Array.from(session.hosts || []) } : null,
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
