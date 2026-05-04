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
const logger = require('../utils/logger');

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
router.get('/stats', auth, (req, res) => {
  try {
    res.json({ success: true, data: policyEngineService.getStats() });
  } catch (err) {
    logger.error(`[Policy] Stats error: ${err.message}`);
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

// ── Response Log ──────────────────────────────────────────────────────────────

/**
 * GET /api/policy/response-log
 * Query the policy response action log.
 * Query params: limit, nodeId, actionType, policyId
 */
router.get('/response-log', auth, (req, res) => {
  try {
    const { limit, nodeId, actionType, policyId } = req.query;
    const result = policyEngineService.getResponseLog({
      limit: limit ? parseInt(limit) : 100,
      nodeId,
      actionType,
      policyId,
    });
    res.json(result);
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
router.get('/', auth, (req, res) => {
  try {
    const { scope, enabled } = req.query;
    const filters = {};
    if (scope) filters.scope = scope;
    if (enabled !== undefined) filters.enabled = enabled === 'true';
    res.json(policyEngineService.listPolicies(filters));
  } catch (err) {
    logger.error(`[Policy] List error: ${err.message}`);
    res.status(500).json({ success: false, error: 'Failed to list policies' });
  }
});

/**
 * POST /api/policy
 * Create a new policy. Requires analyst or admin role.
 */
router.post('/', auth, authorize('analyst', 'admin'), (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.email || 'unknown';
    const result = policyEngineService.createPolicy(req.body, userId);
    if (!result.success) {
      return res.status(400).json(result);
    }
    logger.info(`[Policy] Created by ${userId}: ${result.policy.name}`);
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
router.get('/:id', auth, (req, res) => {
  try {
    const result = policyEngineService.getPolicy(req.params.id);
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
router.put('/:id', auth, authorize('analyst', 'admin'), (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.email || 'unknown';
    const result = policyEngineService.updatePolicy(req.params.id, req.body, userId);
    if (!result.success) return res.status(404).json(result);
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
router.delete('/:id', auth, authorize('admin'), (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.email || 'unknown';
    const result = policyEngineService.deletePolicy(req.params.id, userId);
    if (!result.success) return res.status(400).json(result);
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
router.post('/evaluate', (req, res) => {
  try {
    const { nodeId, metrics } = req.body;
    if (!nodeId || !metrics) {
      return res.status(400).json({ success: false, error: 'Missing nodeId or metrics' });
    }
    const result = policyEngineService.evaluate({ nodeId, metrics });
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error(`[Policy] Evaluate error: ${err.message}`);
    res.status(500).json({ success: false, error: 'Evaluation failed' });
  }
});

module.exports = router;
