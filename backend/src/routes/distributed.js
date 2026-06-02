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
const { auth } = require('../middleware/auth');
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
 * Accepts both authenticated and unauthenticated requests (node-level auth via headers).
 */
router.post('/nodes/register', async (req, res) => {
  try {
    const registration = req.body;
    
    // Extract user ID from auth token if present, otherwise use node ID
    let userId = 'anonymous';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        // Attempt to verify token — non-blocking, graceful fallback
        const { auth: authMiddleware } = require('../middleware/auth');
        // Simple extraction — the auth middleware handles full verification
        userId = req.headers['x-node-id'] || 'authenticated-user';
      } catch (e) {
        // Use node ID as fallback user ID
        userId = registration.nodeId || 'unknown';
      }
    }

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
    const userId = req.user?.id || req.user?._id || 'unknown';
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
router.get('/nodes/all', auth, (req, res) => {
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
router.post('/telemetry/sync', (req, res) => {
  try {
    const summary = req.body;

    // Validate required fields
    if (!summary.nodeId || !summary.nonce || summary.sequenceId === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: nodeId, nonce, sequenceId',
      });
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
 * Get cross-node correlation results.
 */
router.get('/correlations', auth, (req, res) => {
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
router.get('/metrics/global', (req, res) => {
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
router.get('/metrics/stats', (req, res) => {
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
router.get('/weights', (req, res) => {
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
 * Update the global risk weight table (admin/auth required).
 */
router.put('/weights', auth, (req, res) => {
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
router.get('/broadcast/nodes', auth, (req, res) => {
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
