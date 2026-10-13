/**
 * CyberForge Distributed Intelligence Routes
 * TODO 4: REST API endpoints for distributed node management, telemetry, and correlation.
 * 
 * ISOLATION: New route file. Does NOT modify any existing route.
 * Mounted at /api/distributed in server.js
 */

const express = require('express');
const router = express.Router();
const { distributedIntelligenceService } = require('../services/distributedIntelligenceService');
const { auth, adminOnly, analystOrAdmin } = require('../middleware/auth');
const logger = require('../utils/logger');

// ──────────────────────────────────────────────
// Health Check (no auth required)
// ──────────────────────────────────────────────

router.get('/health', (req, res) => {
  const stats = distributedIntelligenceService.getServiceStats();
  res.json({
    status: 'healthy',
    service: 'distributed-intelligence',
    ...stats,
    timestamp: new Date().toISOString(),
  });
});

// ──────────────────────────────────────────────
// Node Registration
// ──────────────────────────────────────────────

/**
 * POST /api/distributed/nodes/register
 * Register a node with the distributed intelligence network.
 * Requires a signed-in user; the node is recorded as owned by that account.
 */
router.post('/nodes/register', auth, async (req, res) => {
  try {
    const registration = req.body;

    // The node belongs to the signed-in account. Node signatures are still not
    // verified (finding F06), so this is an ownership record, not device trust.
    const userId = String(req.user.userId);

    const nodeSignature = req.headers['x-node-signature'];
    const nodeTimestamp = req.headers['x-node-timestamp'];
    const nodeId = req.headers['x-node-id'];

    // Basic validation
    if (!registration.nodeId) {
      return res.status(400).json({ success: false, message: 'Missing nodeId' });
    }

    const result = distributedIntelligenceService.registerNode(registration, userId);

    logger.info(`[Distributed] Node registration request from ${registration.nodeId}: ${result.success}`);

    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    logger.error(`[Distributed] Node registration error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * GET /api/distributed/nodes
 * List all registered nodes (requires auth).
 */
router.get('/nodes', auth, (req, res) => {
  try {
    const userId = String(req.user.userId);
    const nodes = distributedIntelligenceService.getNodesForUser(userId);
    res.json({
      success: true,
      data: {
        nodes,
        total: nodes.length,
      },
    });
  } catch (error) {
    logger.error(`[Distributed] Get nodes error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to retrieve nodes' });
  }
});

/**
 * GET /api/distributed/nodes/all
 * List all nodes across all users (admin endpoint).
 */
router.get('/nodes/all', auth, adminOnly, (req, res) => {
  try {
    const allNodes = distributedIntelligenceService.getAllNodes();
    res.json({
      success: true,
      data: {
        nodes: allNodes,
        total: allNodes.length,
      },
    });
  } catch (error) {
    logger.error(`[Distributed] Get all nodes error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to retrieve all nodes' });
  }
});

// ──────────────────────────────────────────────
// Telemetry Sync
// ──────────────────────────────────────────────

/**
 * POST /api/distributed/telemetry/sync
 * Ingest telemetry summary from a node.
 */
router.post('/telemetry/sync', auth, (req, res) => {
  try {
    const summary = req.body;

    // Validate required fields
    if (!summary.nodeId || !summary.nonce || summary.sequenceId === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: nodeId, nonce, sequenceId',
      });
    }

    // Telemetry is accepted only for a node registered to the signed-in
    // account. Another account's node answers exactly like an unregistered one.
    if (!distributedIntelligenceService.isNodeOwnedBy(summary.nodeId, req.user.userId)) {
      return res.status(400).json({ success: false, error: 'Unknown node. Register first.' });
    }

    const result = distributedIntelligenceService.ingestTelemetry(summary);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    logger.error(`[Distributed] Telemetry sync error: ${error.message}`);
    res.status(500).json({
      success: false,
      syncId: '',
      acknowledgedSequence: 0,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/distributed/telemetry/:nodeId
 * Get telemetry history for a specific node.
 */
router.get('/telemetry/:nodeId', auth, (req, res) => {
  try {
    const { nodeId } = req.params;
    // A node's telemetry is for its owner and administrators.
    if (req.user.role !== 'admin' && !distributedIntelligenceService.isNodeOwnedBy(nodeId, req.user.userId)) {
      return res.status(404).json({ success: false, message: 'Node not found' });
    }
    const limit = parseInt(req.query.limit) || 50;
    const store = distributedIntelligenceService.telemetryStore.get(nodeId) || [];
    
    res.json({
      success: true,
      data: {
        nodeId,
        telemetry: store.slice(-limit),
        total: store.length,
      },
    });
  } catch (error) {
    logger.error(`[Distributed] Get telemetry error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to retrieve telemetry' });
  }
});

// ──────────────────────────────────────────────
// Cross-Node Correlation
// ──────────────────────────────────────────────

/**
 * GET /api/distributed/correlations
 * Get cross-node correlation results. They name the nodes of every account
 * that reported a domain, so they are for analysts and administrators.
 */
router.get('/correlations', auth, analystOrAdmin, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const correlations = distributedIntelligenceService.getCorrelations(limit);
    
    res.json({
      success: true,
      data: {
        correlations,
        total: correlations.length,
      },
    });
  } catch (error) {
    logger.error(`[Distributed] Get correlations error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to retrieve correlations' });
  }
});

// ──────────────────────────────────────────────
// Global Metrics
// ──────────────────────────────────────────────

/**
 * GET /api/distributed/metrics/global
 * Get aggregated global metrics across all nodes.
 */
router.get('/metrics/global', auth, (req, res) => {
  try {
    const metrics = distributedIntelligenceService.getGlobalMetrics();
    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    logger.error(`[Distributed] Get global metrics error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to retrieve global metrics' });
  }
});

/**
 * GET /api/distributed/metrics/stats
 * Get service-level statistics.
 */
router.get('/metrics/stats', auth, (req, res) => {
  try {
    const stats = distributedIntelligenceService.getServiceStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error(`[Distributed] Get stats error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to retrieve stats' });
  }
});

// ──────────────────────────────────────────────
// Risk Weight Table
// ──────────────────────────────────────────────

/**
 * GET /api/distributed/weights
 * Get the current global risk weight table.
 */
router.get('/weights', auth, (req, res) => {
  try {
    const table = distributedIntelligenceService.getRiskWeightTable();
    res.json({
      success: true,
      data: table,
    });
  } catch (error) {
    logger.error(`[Distributed] Get weights error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to retrieve weight table' });
  }
});

/**
 * PUT /api/distributed/weights
 * Update the global risk weight table (administrators only).
 */
router.put('/weights', auth, adminOnly, (req, res) => {
  try {
    const updates = req.body;
    const table = distributedIntelligenceService.updateRiskWeightTable(updates);
    res.json({
      success: true,
      data: table,
    });
  } catch (error) {
    logger.error(`[Distributed] Update weights error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to update weight table' });
  }
});

// ──────────────────────────────────────────────
// Intelligence Broadcasts (used by WebSocket layer)
// ──────────────────────────────────────────────

/**
 * GET /api/distributed/broadcast/weights
 * Get a weight update broadcast message (for WebSocket forwarding).
 */
router.get('/broadcast/weights', auth, (req, res) => {
  try {
    const broadcast = distributedIntelligenceService.buildWeightUpdateBroadcast();
    res.json({ success: true, data: broadcast });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to build broadcast' });
  }
});

/**
 * GET /api/distributed/broadcast/nodes
 * Get a node status broadcast message.
 */
router.get('/broadcast/nodes', auth, adminOnly, (req, res) => {
  try {
    const broadcast = distributedIntelligenceService.buildNodeStatusBroadcast();
    res.json({ success: true, data: broadcast });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to build broadcast' });
  }
});

/**
 * GET /api/distributed/broadcast/metrics
 * Get a global metrics broadcast message.
 */
router.get('/broadcast/metrics', auth, (req, res) => {
  try {
    const broadcast = distributedIntelligenceService.buildGlobalMetricsBroadcast();
    res.json({ success: true, data: broadcast });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to build broadcast' });
  }
});

module.exports = router;
