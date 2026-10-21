/**
 * The audit trail, mounted at /api/audit.
 *
 * A member reads the events of their own workspace. A platform administrator
 * can also read everything, by asking for `?scope=platform`; nobody else can.
 * (Before, any analyst could read every account's events, and the events were
 * a list in memory that a restart emptied.)
 *
 * There is no route that changes or deletes an event. `GET /integrity` checks
 * the trail against its signed checkpoints (SEC-08).
 */
const express = require('express');
const audit = require('../services/auditLogService');
const integrity = require('../services/auditIntegrityService');
const { auth } = require('../middleware/auth');
const { requireWorkspace } = require('../middleware/workspace');
const logger = require('../utils/logger');

const router = express.Router();

/** `?scope=platform` is for platform administrators; anyone else asking is refused, not quietly narrowed. */
function wantsPlatform(req, res) {
  if (req.query.scope !== 'platform') return false;
  if (req.user.role !== 'admin') {
    res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'The platform audit trail is for administrators.' });
    return null;
  }
  return true;
}

/** GET /api/audit/catalog — the actions the trail knows, with labels. */
router.get('/catalog', (req, res) => {
  res.json({ success: true, data: audit.getActionCatalog() });
});

/** GET /api/audit/stats — counts over the last day for this workspace (or, for an administrator, the platform). */
router.get('/stats', auth, requireWorkspace, async (req, res) => {
  const platform = wantsPlatform(req, res);
  if (platform === null) return undefined;
  try {
    const data = platform ? await audit.platformStats() : await audit.workspaceStats(req.user);
    return res.json({ success: true, scope: platform ? 'platform' : 'workspace', data });
  } catch (error) {
    logger.error(`[Audit] Stats error: ${error.message}`);
    return res.status(500).json({ success: false, error: 'Failed to get audit stats' });
  }
});

/**
 * GET /api/audit/logs — events, newest first.
 * Query: action (exact, or a prefix ending in "."), outcome, origin, since, until, limit (≤ 200), offset.
 */
router.get('/logs', auth, requireWorkspace, async (req, res) => {
  const platform = wantsPlatform(req, res);
  if (platform === null) return undefined;
  try {
    const result = platform ? await audit.queryPlatform(req.query) : await audit.queryWorkspace(req.user, req.query);
    return res.json({ success: true, scope: platform ? 'platform' : 'workspace', ...result });
  } catch (error) {
    logger.error(`[Audit] Query error: ${error.message}`);
    return res.status(500).json({ success: false, error: 'Failed to query audit logs' });
  }
});

/**
 * GET /api/audit/integrity — the trail of this workspace (or, for an
 * administrator, the platform) checked against its signed checkpoints. It
 * writes a fresh checkpoint first, so the answer covers everything up to a
 * minute ago.
 */
router.get('/integrity', auth, requireWorkspace, async (req, res) => {
  const platform = wantsPlatform(req, res);
  if (platform === null) return undefined;
  try {
    const data = platform ? await integrity.verify('platform', null) : await integrity.verify('workspace', req.user.workspaceId);
    return res.status(data.available ? 200 : 501).json({ success: data.available, scope: platform ? 'platform' : 'workspace', data });
  } catch (error) {
    logger.error(`[Audit] Integrity check error: ${error.message}`);
    return res.status(500).json({ success: false, error: 'Failed to check the audit trail' });
  }
});

/**
 * POST /api/audit/log — an event reported by a client (for example, an alert
 * acknowledged on a dashboard). It is kept in the caller's workspace and marked
 * as client-reported; the actor is the session, never the body.
 */
router.post('/log', auth, requireWorkspace, async (req, res) => {
  const { action, resource, details, outcome } = req.body || {};
  if (typeof action !== 'string' || !/^[a-z][a-z_]*(\.[a-z][a-z_]*)+$/.test(action) || action.length > 64) {
    return res.status(400).json({ success: false, error: 'action must look like "area.verb"' });
  }
  if (['auth.', 'policy.', 'system.', 'evidence.', 'device.', 'agent.', 'account.', 'finding.', 'alert.', 'report.'].some(prefix => action.startsWith(prefix))) {
    return res.status(400).json({ success: false, error: 'This action is recorded by the server and cannot be reported by a client' });
  }
  const event = await audit.record({
    principal: req.user,
    action,
    resource: typeof resource === 'string' ? resource : 'client',
    outcome: ['success', 'failure', 'warning'].includes(outcome) ? outcome : 'success',
    details,
    origin: 'client',
    req
  });
  if (!event) return res.status(500).json({ success: false, error: 'The event was not recorded' });
  return res.status(201).json({ success: true, entry: { id: String(event._id), action: event.action, origin: event.origin } });
});

module.exports = router;
