/**
 * Sandbox Analysis Routes
 * REST API for URL/file analysis with IOC + MITRE extraction + evidence locker.
 */

const express = require('express');
const multer  = require('multer');
const router  = express.Router();
const { sandboxAnalysisService } = require('../services/sandboxAnalysisService');

// Files up to 50MB, kept in memory (no disk persistence — buffer is hashed + scanned then dropped)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
});

/**
 * POST /api/sandbox/analyze/url
 * Body: { url, features?: object, metadata?: object }
 */
router.post('/analyze/url', async (req, res) => {
    try {
        const { url, features = {}, metadata = {} } = req.body;
        if (!url) return res.status(400).json({ error: 'url required' });
        const scan = await sandboxAnalysisService.analyzeUrl(url, features, metadata);
        res.json({ success: true, scan });
    } catch (e) {
        console.error('[sandbox] analyze/url failed:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/sandbox/analyze/file
 * Multipart form-data: file=<file> [, metadata=<json>]
 */
router.post('/analyze/file', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'file required (multipart field "file")' });
        let metadata = {};
        if (req.body.metadata) {
            try { metadata = JSON.parse(req.body.metadata); } catch (_) { /* ignore */ }
        }
        const scan = await sandboxAnalysisService.analyzeFile(
            req.file.originalname,
            req.file.buffer,
            req.file.mimetype || '',
            metadata
        );
        res.json({ success: true, scan });
    } catch (e) {
        console.error('[sandbox] analyze/file failed:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/sandbox/history?limit=&offset=&type=&verdict=
 */
router.get('/history', (req, res) => {
    try {
        const limit   = Math.min(parseInt(req.query.limit, 10) || 50, 200);
        const offset  = parseInt(req.query.offset, 10) || 0;
        const type    = req.query.type    || null;
        const verdict = req.query.verdict || null;
        const result  = sandboxAnalysisService.listHistory({ limit, offset, type, verdict });
        res.json({ success: true, ...result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/sandbox/scan/:id   — full scan record with IOCs + MITRE chain
 */
router.get('/scan/:id', (req, res) => {
    const scan = sandboxAnalysisService.getScan(req.params.id);
    if (!scan) return res.status(404).json({ error: 'scan not found' });
    res.json({ success: true, scan });
});

/**
 * DELETE /api/sandbox/scan/:id
 */
router.delete('/scan/:id', (req, res) => {
    const ok = sandboxAnalysisService.deleteScan(req.params.id);
    if (!ok) return res.status(404).json({ error: 'scan not found' });
    res.json({ success: true });
});

/**
 * GET /api/sandbox/iocs?type=&severity=&limit=
 *      → aggregated IOCs across all scans (with hit counts)
 */
router.get('/iocs', (req, res) => {
    try {
        const type     = req.query.type     || null;
        const severity = req.query.severity || null;
        const limit    = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
        const iocs = sandboxAnalysisService.aggregateIocs({ type, severity, limit });
        res.json({ success: true, count: iocs.length, iocs });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/sandbox/mitre/heatmap   — technique frequency across stored scans
 */
router.get('/mitre/heatmap', (req, res) => {
    try {
        const heatmap = sandboxAnalysisService.mitreHeatmap();
        res.json({ success: true, count: heatmap.length, techniques: heatmap });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/sandbox/health
 */
router.get('/health', (req, res) => {
    const total = sandboxAnalysisService.scanOrder.length;
    res.json({
        status:    'ok',
        engine:    'static-sandbox-v1',
        capacity:  sandboxAnalysisService.MAX_SCANS,
        stored:    total,
        timestamp: new Date().toISOString(),
    });
});

module.exports = router;
