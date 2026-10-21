/**
 * Sandbox Analysis Routes
 * REST API for URL/file analysis with IOC + MITRE extraction + evidence locker.
 */

const express = require('express');
const multer  = require('multer');
const { verifiedUser } = require('../middleware/verifiedUser');
const { requireWorkspace } = require('../middleware/workspace');
const router  = express.Router();

// Every route below requires a signed-in user, and takes the user's identity
// and workspace from the session rather than from the request. Scans are kept
// in the database in the workspace of the account that ran them: history, IOCs
// and the heatmap cover that workspace's scans only, and another workspace's
// scan ID answers as "not found".
router.use(verifiedUser, requireWorkspace);
const { sandboxAnalysisService } = require('../services/sandboxAnalysisService');
const { analysisQuota } = require('../middleware/analysisQuota');
const { boundedMetadata } = require('../services/uploadPolicy');

// One file of at most MAX_UPLOAD_MB, kept in memory (no disk persistence —
// the buffer is hashed and scanned, then dropped). The form may carry only the
// file and a small metadata field (SEC-04).
const MAX_UPLOAD_MB = 25;
const upload = multer({
    storage: multer.memoryStorage(),
    defParamCharset: 'utf8', // file names as sent (multer's default reads them as Latin-1)
    limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 1, fields: 2, parts: 3, fieldSize: 16 * 1024, fieldNameSize: 100 },
});

// Multer's refusals as JSON, before any analysis starts
function receiveFile(req, res, next) {
    upload.single('file')(req, res, error => {
        if (!error) return next();
        if (error instanceof multer.MulterError) {
            const tooLarge = error.code === 'LIMIT_FILE_SIZE';
            return res.status(tooLarge ? 413 : 400).json({
                error: tooLarge ? `file is larger than ${MAX_UPLOAD_MB} MB` : `upload refused: ${error.message}`,
                code: error.code,
            });
        }
        return next(error);
    });
}

/**
 * POST /api/sandbox/analyze/url
 * Body: { url, features?: object, metadata?: object }
 */
router.post('/analyze/url', analysisQuota(), async (req, res) => {
    try {
        const { url, features = {} } = req.body;
        if (!url || typeof url !== 'string') return res.status(400).json({ error: 'url required' });
        if (url.length > 2048) return res.status(400).json({ error: 'url is longer than 2048 characters' });
        const meta = boundedMetadata(req.body.metadata);
        if (meta.invalid) return res.status(400).json({ error: 'metadata must be an object' });
        const scan = await sandboxAnalysisService.analyzeUrl(url, features, meta.metadata, req.user);
        res.json({ success: true, scan });
    } catch (e) {
        console.error('[sandbox] analyze/url failed:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/sandbox/analyze/file
 * Multipart form-data: file=<file> [, metadata=<json object>]
 * The file name and type are the uploader's and are cleaned by the service.
 */
router.post('/analyze/file', analysisQuota(), receiveFile, async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'file required (multipart field "file")' });
        if (req.file.size === 0) return res.status(400).json({ error: 'file is empty' });
        const meta = boundedMetadata(req.body.metadata);
        if (meta.invalid) return res.status(400).json({ error: 'metadata must be a JSON object' });
        const scan = await sandboxAnalysisService.analyzeFile(
            req.file.originalname,
            req.file.buffer,
            req.file.mimetype || '',
            meta.metadata,
            req.user
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
router.get('/history', async (req, res) => {
    try {
        const limit   = Math.min(parseInt(req.query.limit, 10) || 50, 200);
        const offset  = Math.max(parseInt(req.query.offset, 10) || 0, 0);
        const type    = req.query.type    || null;
        const verdict = req.query.verdict || null;
        const result  = await sandboxAnalysisService.listHistory({ limit, offset, type, verdict }, req.user);
        res.json({ success: true, ...result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/sandbox/scan/:id   — full scan record with IOCs + MITRE chain
 */
router.get('/scan/:id', async (req, res) => {
    try {
        const scan = await sandboxAnalysisService.getScan(req.params.id, req.user);
        if (!scan) return res.status(404).json({ error: 'scan not found' });
        res.json({ success: true, scan });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/sandbox/export?ids=a,b — evidence with a signed manifest (SEC-08);
 * without ids, the latest 200 scans.
 */
router.get('/export', async (req, res) => {
    try {
        const ids = typeof req.query.ids === 'string' && req.query.ids ? req.query.ids.split(',').map(s => s.trim()).filter(Boolean) : null;
        const data = await sandboxAnalysisService.exportEvidence(req.user, ids);
        res.setHeader('Cache-Control', 'no-store');
        res.json({ success: true, data });
    } catch (e) {
        res.status(500).json({ error: 'export failed' });
    }
});

/**
 * POST /api/sandbox/export/verify { manifest, signature } — the manifest's
 * signature, and each item against what is stored now.
 */
router.post('/export/verify', async (req, res) => {
    try {
        res.json({ success: true, data: await sandboxAnalysisService.verifyExport(req.user, req.body || {}) });
    } catch (e) {
        res.status(500).json({ error: 'verification failed' });
    }
});

/**
 * DELETE /api/sandbox/scan/:id
 */
router.delete('/scan/:id', async (req, res) => {
    try {
        const ok = await sandboxAnalysisService.deleteScan(req.params.id, req.user);
        if (!ok) return res.status(404).json({ error: 'scan not found' });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/sandbox/iocs?type=&severity=&limit=
 *      → aggregated IOCs across the caller's scans (with hit counts)
 */
router.get('/iocs', async (req, res) => {
    try {
        const type     = req.query.type     || null;
        const severity = req.query.severity || null;
        const limit    = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
        const iocs = await sandboxAnalysisService.aggregateIocs({ type, severity, limit }, req.user);
        res.json({ success: true, count: iocs.length, iocs });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/sandbox/mitre/heatmap   — technique frequency across the caller's scans
 */
router.get('/mitre/heatmap', async (req, res) => {
    try {
        const heatmap = await sandboxAnalysisService.mitreHeatmap(req.user);
        res.json({ success: true, count: heatmap.length, techniques: heatmap });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/sandbox/health
 */
router.get('/health', async (req, res) => {
    let stored = null;
    try { stored = await sandboxAnalysisService.countScans(req.user); } catch (_) { /* reported as null */ }
    res.json({
        status:        stored === null ? 'degraded' : 'ok',
        engine:        'static-sandbox-v1',
        stored,                                   // this workspace's scans
        retentionDays: require('../models/SandboxScan').RETENTION_DAYS,
        timestamp:     new Date().toISOString(),
    });
});

module.exports = router;
