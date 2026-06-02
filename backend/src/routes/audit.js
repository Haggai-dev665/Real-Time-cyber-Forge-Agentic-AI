/**
 * CyberForge Audit Log Routes
 * TODO 6: Enterprise Multi-Tenancy — Immutable Audit Trail
 *
 * ISOLATION: New route file. Does NOT modify any existing route.
 * Mounted at /api/audit in server.js
 */

const express = require('express');
const router = express.Router();
const { auditLogService } = require('../services/auditLogService');
const { auth, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

// ── Internal helper used by other route files ─────────────────────────────────

/**
 * Middleware factory — attaches auditLog helper to req so any route can call
 * req.auditLog({ action, resource, details, outcome }) without importing the service.
 */
router.use((req, res, next) => {
  req.auditLog = (entry) => {
    try {
      auditLogService.append({
        ...entry,
        userId: req.user?.userId || req.user?.email || 'anonymous',
        ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
        orgId: req.user?.orgId || null,
      });
    } catch (e) {
      // Audit failures must never break request flow
      logger.warn(`[Audit] Failed to log event: ${e.message}`);
    }
  };
  next();
});

// ── Action catalog ────────────────────────────────────────────────────────────

/**
 * GET /api/audit/catalog
 * Return all known audit action codes and labels.
 */
router.get('/catalog', (req, res) => {
  res.json({ success: true, data: auditLogService.getActionCatalog() });
});

// ── Stats ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/audit/stats
 * Get aggregate audit log statistics. Auth required.
 */
router.get('/stats', auth, (req, res) => {
  try {
    res.json({ success: true, data: auditLogService.getStats() });
  } catch (err) {
    logger.error(`[Audit] Stats error: ${err.message}`);
    res.status(500).json({ success: false, error: 'Failed to get audit stats' });
  }
});

// ── Log Query ─────────────────────────────────────────────────────────────────

/**
 * GET /api/audit/logs
 * Query audit log entries with optional filters.
 * Query params: userId, action, outcome, orgId, resource, since, until, limit, offset
 * Requires analyst or admin role.
 */
router.get('/logs', auth, authorize('analyst', 'admin'), (req, res) => {
  try {
    const { userId, action, outcome, orgId, resource, since, until, limit, offset } = req.query;
    const result = auditLogService.query({
      userId,
      action,
      outcome,
      orgId,
      resource,
      since,
      until,
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0,
    });
    res.json(result);
  } catch (err) {
    logger.error(`[Audit] Query error: ${err.message}`);
    res.status(500).json({ success: false, error: 'Failed to query audit logs' });
  }
});

// ── Manual log entry (for SOC dashboard / client-side events) ─────────────────

/**
 * POST /api/audit/log
 * Append a client-reported audit event (e.g. SOC acknowledgement).
 * Auth required — userId is taken from token, not body.
 */
router.post('/log', auth, (req, res) => {
  try {
    const { action, resource, details, outcome } = req.body;
    if (!action) {
      return res.status(400).json({ success: false, error: 'Missing action' });
    }
    const entry = auditLogService.append({
      action,
      userId: req.user?.userId || req.user?.email || 'anonymous',
      resource: resource || 'client',
      details: details || {},
      outcome: outcome || 'success',
      ipAddress: req.ip || null,
      orgId: req.user?.orgId || null,
    });
    res.status(201).json({ success: true, entry });
  } catch (err) {
    logger.error(`[Audit] Manual log error: ${err.message}`);
    res.status(500).json({ success: false, error: 'Failed to append audit entry' });
  }
});

module.exports = router;
