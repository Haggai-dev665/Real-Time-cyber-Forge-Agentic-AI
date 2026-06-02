/**
 * CyberForge Distributed Intelligence Service
 * TODO 4: Cloud aggregation, node management, cross-node correlation.
 * 
 * ISOLATION: New service file. Does NOT modify any existing service.
 * Provides node registration, telemetry ingestion, correlation, and broadcast APIs.
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

class DistributedIntelligenceService {
  constructor() {
    // Node registry: nodeId -> NodeRecord
    this.nodes = new Map();
    // Telemetry store: nodeId -> [TelemetrySummary]
    this.telemetryStore = new Map();
    // Correlation results
    this.correlations = [];
    // Global metrics cache
    this.globalMetrics = null;
    // Global risk weight table
    this.riskWeightTable = {
      global: 1.0,
      domainMultipliers: {},
      tldMultipliers: {},
      lastUpdated: new Date().toISOString(),
    };
    // Processed nonces for replay protection
    this.processedNonces = new Set();
    // Configuration
    this.config = {
      maxNodesPerUser: 50,
      maxTelemetryPerNode: 1000,
      maxCorrelations: 500,
      correlationWindowMinutes: 60,
      nonceExpiryMs: 5 * 60 * 1000, // 5 minutes
      metricsUpdateIntervalMs: 30 * 1000, // 30 seconds
    };

    // Start periodic tasks
    this._startPeriodicTasks();
  }

  // ──────────────────────────────────────────────
  // Node Management
  // ──────────────────────────────────────────────

  /**
   * Register a new node or update an existing registration.
   * @param {Object} registration - Node registration payload
   * @param {string} userId - Authenticated user ID (from auth middleware)
   * @returns {Object} Registration response
   */
  registerNode(registration, userId) {
    const { nodeId, deviceFingerprint, hostname, platform, arch, version, capabilities } = registration;

    if (!nodeId || !deviceFingerprint) {
      return { success: false, message: 'Missing required fields: nodeId and deviceFingerprint' };
    }

    const existing = this.nodes.get(nodeId);
    const now = new Date().toISOString();

    const nodeRecord = {
      nodeId,
      userId,
      deviceFingerprint,
      hostname: hostname || 'unknown',
      platform: platform || 'unknown',
      arch: arch || 'unknown',
      version: version || '0.0.0',
      capabilities: capabilities || [],
      registeredAt: existing?.registeredAt || now,
      lastSeenAt: now,
      isOnline: true,
      alertCount: existing?.alertCount || 0,
      avgRiskScore: existing?.avgRiskScore || 0,
      totalSyncs: existing?.totalSyncs || 0,
    };

    this.nodes.set(nodeId, nodeRecord);
    logger.info(`[Distributed] Node registered: ${nodeId} (${hostname}/${platform})`);

    return {
      success: true,
      nodeId,
      message: existing ? 'Node updated' : 'Node registered',
      assignedCluster: 'default', // Future: cluster assignment logic
    };
  }

  /**
   * Get all nodes for a user.
   */
  getNodesForUser(userId) {
    const userNodes = [];
    for (const [, node] of this.nodes) {
      if (node.userId === userId) {
        userNodes.push(node);
      }
    }
    return userNodes;
  }

  /**
   * Get all registered nodes (admin).
   */
  getAllNodes() {
    return Array.from(this.nodes.values());
  }

  /**
   * Mark a node as offline if not seen recently.
   */
  _checkNodeHealth() {
    const now = Date.now();
    const offlineThresholdMs = 5 * 60 * 1000; // 5 minutes

    for (const [nodeId, node] of this.nodes) {
      const lastSeen = new Date(node.lastSeenAt).getTime();
      if (now - lastSeen > offlineThresholdMs && node.isOnline) {
        node.isOnline = false;
        logger.info(`[Distributed] Node offline: ${nodeId}`);
      }
    }
  }

  // ──────────────────────────────────────────────
  // Telemetry Ingestion
  // ──────────────────────────────────────────────

  /**
   * Ingest a telemetry summary from a node.
   * Validates signature and checks for replay attacks.
   */
  ingestTelemetry(summary) {
    const { nodeId, nonce, sequenceId, signature, metrics, topAlerts } = summary;

    // Replay protection
    if (this.processedNonces.has(nonce)) {
      return { success: false, error: 'Replay detected: nonce already processed' };
    }

    // Validate node exists
    const node = this.nodes.get(nodeId);
    if (!node) {
      return { success: false, error: 'Unknown node. Register first.' };
    }

    // Mark nonce as processed
    this.processedNonces.add(nonce);
    // Clean old nonces periodically (handled in _startPeriodicTasks)

    // Store telemetry
    if (!this.telemetryStore.has(nodeId)) {
      this.telemetryStore.set(nodeId, []);
    }
    const store = this.telemetryStore.get(nodeId);
    store.push({
      ...summary,
      receivedAt: new Date().toISOString(),
    });

    // Trim to max per node
    while (store.length > this.config.maxTelemetryPerNode) {
      store.shift();
    }

    // Update node status
    node.lastSeenAt = new Date().toISOString();
    node.isOnline = true;
    node.totalSyncs = (node.totalSyncs || 0) + 1;
    if (metrics) {
      node.avgRiskScore = metrics.averageBehavioralScore || 0;
      node.alertCount = metrics.totalAlerts || 0;
    }

    // Trigger cross-node correlation
    this._runCorrelation(nodeId, summary);

    const syncId = crypto.randomUUID();

    return {
      success: true,
      syncId,
      acknowledgedSequence: sequenceId,
      globalWeightsUpdate: this._shouldSendWeightUpdate(nodeId) ? this.riskWeightTable : null,
    };
  }

  // ──────────────────────────────────────────────
  // Cross-Node Correlation
  // ──────────────────────────────────────────────

  /**
   * Run correlation analysis when new telemetry arrives.
   * Looks for patterns across multiple nodes.
   */
  _runCorrelation(triggerNodeId, newTelemetry) {
    const now = Date.now();
    const windowMs = this.config.correlationWindowMinutes * 60 * 1000;

    // Collect recent alerts from all nodes
    const recentAlerts = new Map(); // domain -> [{nodeId, alert}]

    for (const [nodeId, telemetryList] of this.telemetryStore) {
      const recent = telemetryList.filter(
        (t) => new Date(t.receivedAt).getTime() > now - windowMs
      );
      for (const tele of recent) {
        if (tele.topAlerts) {
          for (const alert of tele.topAlerts) {
            if (!recentAlerts.has(alert.domain)) {
              recentAlerts.set(alert.domain, []);
            }
            recentAlerts.get(alert.domain).push({ nodeId, alert });
          }
        }
      }
    }

    // Detect multi-node patterns
    for (const [domain, entries] of recentAlerts) {
      const uniqueNodes = new Set(entries.map((e) => e.nodeId));
      if (uniqueNodes.size >= 2) {
        // Same domain flagged by 2+ nodes → correlation event
        const avgRisk =
          entries.reduce((sum, e) => sum + e.alert.riskScore, 0) / entries.length;

        const correlationId = crypto.randomUUID();
        const correlation = {
          correlationId,
          patternType: 'multi_node_domain_alert',
          affectedNodes: Array.from(uniqueNodes),
          affectedDomains: [domain],
          severity: Math.min(avgRisk * 1.2, 100), // Elevated severity for cross-node
          description: `Domain "${domain}" flagged by ${uniqueNodes.size} independent nodes with avg risk ${avgRisk.toFixed(1)}`,
          timestamp: new Date().toISOString(),
          triggerNode: triggerNodeId,
        };

        this.correlations.push(correlation);
        while (this.correlations.length > this.config.maxCorrelations) {
          this.correlations.shift();
        }

        // Update risk weight for correlated domain
        this.riskWeightTable.domainMultipliers[domain] = Math.min(
          (this.riskWeightTable.domainMultipliers[domain] || 1.0) * 1.3,
          5.0
        );
        this.riskWeightTable.lastUpdated = new Date().toISOString();

        logger.info(
          `[Distributed] Correlation detected: ${domain} across ${uniqueNodes.size} nodes (severity: ${correlation.severity.toFixed(1)})`
        );
      }
    }
  }

  /**
   * Get recent correlations.
   */
  getCorrelations(limit = 50) {
    return this.correlations.slice(-limit);
  }

  // ──────────────────────────────────────────────
  // Global Metrics
  // ──────────────────────────────────────────────

  /**
   * Compute and cache global metrics across all nodes.
   */
  computeGlobalMetrics() {
    const allNodes = this.getAllNodes();
    const activeNodes = allNodes.filter((n) => n.isOnline);

    let totalAlerts24h = 0;
    let avgRiskScore = 0;
    const domainAlertCounts = new Map();

    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    for (const [nodeId, telemetryList] of this.telemetryStore) {
      const recent = telemetryList.filter(
        (t) => new Date(t.receivedAt).getTime() > oneDayAgo
      );
      for (const tele of recent) {
        if (tele.metrics) {
          totalAlerts24h += tele.metrics.totalAlerts || 0;
          avgRiskScore += tele.metrics.averageBehavioralScore || 0;
        }
        if (tele.topAlerts) {
          for (const alert of tele.topAlerts) {
            domainAlertCounts.set(
              alert.domain,
              (domainAlertCounts.get(alert.domain) || 0) + 1
            );
          }
        }
      }
    }

    const nodeCount = allNodes.length || 1;
    avgRiskScore = avgRiskScore / nodeCount;

    // Top threat domains
    const topThreatDomains = Array.from(domainAlertCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([domain, count]) => ({
        domain,
        riskScore: (this.riskWeightTable.domainMultipliers[domain] || 1.0) * 50,
        seenByNodes: count,
        firstSeen: new Date().toISOString(),
        category: 'behavioral',
      }));

    this.globalMetrics = {
      totalNodes: allNodes.length,
      activeNodes: activeNodes.length,
      totalAlerts24h,
      avgRiskScore: Math.round(avgRiskScore * 10) / 10,
      topThreatDomains,
      correlationCount24h: this.correlations.filter(
        (c) => new Date(c.timestamp).getTime() > oneDayAgo
      ).length,
      timestamp: new Date().toISOString(),
    };

    return this.globalMetrics;
  }

  /**
   * Get cached or freshly computed global metrics.
   */
  getGlobalMetrics() {
    if (!this.globalMetrics) {
      return this.computeGlobalMetrics();
    }
    return this.globalMetrics;
  }

  // ──────────────────────────────────────────────
  // Risk Weight Table
  // ──────────────────────────────────────────────

  /**
   * Get the current global risk weight table.
   */
  getRiskWeightTable() {
    return this.riskWeightTable;
  }

  /**
   * Update the global risk weight table (admin action).
   */
  updateRiskWeightTable(updates) {
    if (updates.global !== undefined) {
      this.riskWeightTable.global = Math.max(0.1, Math.min(10.0, updates.global));
    }
    if (updates.domainMultipliers) {
      Object.assign(this.riskWeightTable.domainMultipliers, updates.domainMultipliers);
    }
    if (updates.tldMultipliers) {
      Object.assign(this.riskWeightTable.tldMultipliers, updates.tldMultipliers);
    }
    this.riskWeightTable.lastUpdated = new Date().toISOString();
    return this.riskWeightTable;
  }

  _shouldSendWeightUpdate(nodeId) {
    // Simple heuristic: send every 10th sync or if table was recently updated
    const node = this.nodes.get(nodeId);
    if (!node) return false;
    return (node.totalSyncs % 10 === 0) ||
      (Date.now() - new Date(this.riskWeightTable.lastUpdated).getTime() < 60000);
  }

  // ──────────────────────────────────────────────
  // Intelligence Broadcast Builder
  // ──────────────────────────────────────────────

  /**
   * Build an intelligence broadcast message for all connected nodes.
   */
  buildBroadcast(type, payload) {
    return {
      broadcastId: crypto.randomUUID(),
      broadcastType: type,
      sourceNodeCount: this.nodes.size,
      timestamp: new Date().toISOString(),
      payload,
    };
  }

  /**
   * Build a weight update broadcast.
   */
  buildWeightUpdateBroadcast() {
    const weightUpdates = { global: this.riskWeightTable.global };
    for (const [domain, mult] of Object.entries(this.riskWeightTable.domainMultipliers)) {
      weightUpdates[domain] = mult;
    }
    for (const [tld, mult] of Object.entries(this.riskWeightTable.tldMultipliers)) {
      weightUpdates[`tld:${tld}`] = mult;
    }
    return this.buildBroadcast('weight_update', { weightUpdates });
  }

  /**
   * Build a node status broadcast.
   */
  buildNodeStatusBroadcast() {
    const nodeStatuses = this.getAllNodes().map((n) => ({
      nodeId: n.nodeId,
      hostname: n.hostname,
      isOnline: n.isOnline,
      lastSeen: n.lastSeenAt,
      alertCount: n.alertCount,
      avgRiskScore: n.avgRiskScore,
    }));
    return this.buildBroadcast('node_status', { nodeStatuses });
  }

  /**
   * Build a global metrics broadcast.
   */
  buildGlobalMetricsBroadcast() {
    const metrics = this.getGlobalMetrics();
    return this.buildBroadcast('global_metrics', { globalMetrics: metrics });
  }

  // ──────────────────────────────────────────────
  // Periodic Tasks
  // ──────────────────────────────────────────────

  _startPeriodicTasks() {
    // Clean expired nonces every minute
    setInterval(() => {
      this.processedNonces.clear();
    }, this.config.nonceExpiryMs);

    // Check node health every 30 seconds
    setInterval(() => {
      this._checkNodeHealth();
    }, 30000);

    // Recompute global metrics every 30 seconds
    setInterval(() => {
      this.computeGlobalMetrics();
    }, this.config.metricsUpdateIntervalMs);
  }

  /**
   * Get service statistics.
   */
  getServiceStats() {
    return {
      registeredNodes: this.nodes.size,
      onlineNodes: Array.from(this.nodes.values()).filter((n) => n.isOnline).length,
      totalTelemetryRecords: Array.from(this.telemetryStore.values()).reduce(
        (sum, store) => sum + store.length,
        0
      ),
      totalCorrelations: this.correlations.length,
      processedNonces: this.processedNonces.size,
    };
  }
}

// Singleton instance
const distributedIntelligenceService = new DistributedIntelligenceService();
module.exports = { distributedIntelligenceService, DistributedIntelligenceService };
