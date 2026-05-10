/**
 * Orchestrator Routes — REST API for the 8-agent pipeline.
 */

const express = require('express');
const router  = express.Router();
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

module.exports = router;
