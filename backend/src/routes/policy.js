/**
 * CyberForge Policy Engine Routes
 * TODO 5: Autonomous Defensive Response Engine
 *
 * ISOLATION: New route file. Does NOT modify any existing route.
 * Mounted at /api/policy in server.js
 */

const express = require('express');
const router = express.Router();
const { policyEngineService } = require('../services/policyEngineService');
const { auth, authorize } = require('../middleware/auth');
const { requireWorkspace } = require('../middleware/workspace');
const realtimeBus = require('../services/realtimeBus');
const audit = require('../services/auditLogService');
const logger = require('../utils/logger');

// "Notify SOC" is carried out here: it publishes to the live feed of the
// account whose evaluation triggered the policy. The receipt is the published
// event; with no account, or nothing published, the action is recorded as failed.
policyEngineService.registerExecutor('notify_soc', {
  name: 'live-feed',
  run: (action) => {
    if (!action.userId) throw new Error('the action has no account to notify');
    const event = realtimeBus.emit('alert:new', {
      userId: action.userId,
      severity: 'high',
      source: 'policy',
      message: `Policy "${action.policyName}" triggered on ${action.nodeId}`,
      policyId: action.policyId,
      actionId: action.actionId,
      nodeId: action.nodeId,
    });
    if (!event || typeof event.id !== 'string') throw new Error('the notification was not published');
    return { target: `live feed of account ${action.userId}`, verification: `published as event ${event.id}` };
  },
});

// ── Metadata (no auth required) ───────────────────────────────────────────────

/**
 * GET /api/policy/meta
 * Return supported trigger metrics, operators, and action types.
 */
router.get('/meta', (req, res) => {
  res.json({
    success: true,
    data: {
      triggerMetrics: policyEngineService.getTriggerMetrics(),
      operators: policyEngineService.getOperators(),
      actionTypes: policyEngineService.getActionTypes(),
    },
  });
});

// ── Stats (auth required) ─────────────────────────────────────────────────────

/**
 * GET /api/policy/stats
 * Get policy engine statistics.
 */
router.get('/stats', auth, requireWorkspace, async (req, res) => {
  const platform = wantsPlatform(req, res);
  if (platform === null) return undefined;
  try {
    const data = await policyEngineService.getStats(platform ? null : req.user);
    res.json({ success: true, scope: platform ? 'platform' : 'workspace', data });
  } catch (err) {
    logger.error(`[Policy] Stats error: ${err.message}`);
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

// ── Response Log ──────────────────────────────────────────────────────────────

/** `?scope=platform` is for platform administrators; anyone else asking is refused, not quietly narrowed. */
function wantsPlatform(req, res) {
  if (req.query.scope !== 'platform') return false;
  if (req.user.role !== 'admin') {
    res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'The platform view is for administrators.' });
    return null;
  }
  return true;
}

/**
 * GET /api/policy/response-log
 * Query the policy response action log.
 * Query params: limit, nodeId, actionType, policyId
 */
router.get('/response-log', auth, requireWorkspace, async (req, res) => {
  const platform = wantsPlatform(req, res);
  if (platform === null) return undefined;
  try {
    const { limit, nodeId, actionType, policyId, status } = req.query;
    const filters = { limit, nodeId, actionType, policyId, status };
    // A member sees their workspace's responses. Every workspace's is the
    // administrators' platform view. (Analysts used to see every account's.)
    const result = platform
      ? await policyEngineService.getPlatformResponseLog(filters)
      : await policyEngineService.getResponseLog(req.user, filters);
    res.json({ ...result, scope: platform ? 'platform' : 'workspace' });
  } catch (err) {
    logger.error(`[Policy] Response log error: ${err.message}`);
    res.status(500).json({ success: false, error: 'Failed to retrieve response log' });
  }
});

// ── Policy CRUD ───────────────────────────────────────────────────────────────

/**
 * GET /api/policy
 * List all policies. Query params: scope, enabled.
 */
router.get('/', auth, async (req, res) => {
  try {
    const { scope, enabled } = req.query;
    const filters = {};
    if (scope) filters.scope = scope;
    if (enabled !== undefined) filters.enabled = enabled === 'true';
    res.json(await policyEngineService.listPolicies(filters));
  } catch (err) {
    logger.error(`[Policy] List error: ${err.message}`);
    res.status(500).json({ success: false, error: 'Failed to list policies' });
  }
});

/**
 * POST /api/policy
 * Create a new policy. Requires analyst or admin role.
 */
router.post('/', auth, authorize('analyst', 'admin'), async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.email || 'unknown';
    const result = await policyEngineService.createPolicy(req.body, userId);
    if (!result.success) {
      return res.status(400).json(result);
    }
    logger.info(`[Policy] Created by ${userId}: ${result.policy.name}`);
    audit.record({ principal: req.user, platform: true, action: 'policy.create', resource: `policy ${result.policy.id}`, details: { name: result.policy.name, actionType: result.policy.action && result.policy.action.type }, req });
    res.status(201).json(result);
  } catch (err) {
    logger.error(`[Policy] Create error: ${err.message}`);
    res.status(500).json({ success: false, error: 'Failed to create policy' });
  }
});

/**
 * GET /api/policy/:id
 * Get a single policy by ID.
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await policyEngineService.getPolicy(req.params.id);
    if (!result.success) return res.status(404).json(result);
    res.json(result);
  } catch (err) {
    logger.error(`[Policy] Get error: ${err.message}`);
    res.status(500).json({ success: false, error: 'Failed to get policy' });
  }
});

/**
 * PUT /api/policy/:id
 * Update a policy. Requires analyst or admin.
 */
router.put('/:id', auth, authorize('analyst', 'admin'), async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.email || 'unknown';
    const result = await policyEngineService.updatePolicy(req.params.id, req.body, userId);
    if (!result.success) return res.status(result.error === 'Policy not found' ? 404 : 400).json(result);
    audit.record({ principal: req.user, platform: true, action: 'policy.update', resource: `policy ${req.params.id}`, details: { fields: Object.keys(req.body || {}) }, req });
    res.json(result);
  } catch (err) {
    logger.error(`[Policy] Update error: ${err.message}`);
    res.status(500).json({ success: false, error: 'Failed to update policy' });
  }
});

/**
 * DELETE /api/policy/:id
 * Delete a policy. Admin only.
 */
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.email || 'unknown';
    const result = await policyEngineService.deletePolicy(req.params.id, userId);
    if (!result.success) return res.status(400).json(result);
    audit.record({ principal: req.user, platform: true, action: 'policy.delete', resource: `policy ${req.params.id}`, req });
    res.json(result);
  } catch (err) {
    logger.error(`[Policy] Delete error: ${err.message}`);
    res.status(500).json({ success: false, error: 'Failed to delete policy' });
  }
});

// ── Policy Evaluation ─────────────────────────────────────────────────────────

/**
 * POST /api/policy/evaluate
 * Evaluate a risk event against all enabled policies.
 * Body: { nodeId, metrics: { risk_score, alert_count_24h, ... } }
 */
router.post('/evaluate', auth, requireWorkspace, async (req, res) => {
  try {
    const { nodeId, metrics } = req.body;
    if (!nodeId || !metrics) {
      return res.status(400).json({ success: false, error: 'Missing nodeId or metrics' });
    }
    const result = await policyEngineService.evaluate({ nodeId, metrics, userId: String(req.user.userId), workspaceId: req.user.workspaceId });
    for (const action of result.triggered || []) {
      audit.record({
        principal: req.user,
        action: 'policy.triggered',
        resource: `node ${nodeId}`,
        outcome: action.status === 'applied' ? 'success' : action.status === 'failed' ? 'failure' : 'warning',
        details: { policyId: action.policyId, policyName: action.policyName, actionType: action.actionType, status: action.status, actionId: action.actionId, reason: action.reason || null },
        req
      });
    }
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error(`[Policy] Evaluate error: ${err.message}`);
    res.status(500).json({ success: false, error: 'Evaluation failed' });
  }
});

module.exports = router;
