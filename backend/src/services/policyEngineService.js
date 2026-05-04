/**
 * CyberForge Policy Engine Service
 * TODO 5: Autonomous Defensive Response Engine
 *
 * ISOLATION: New service file. Does NOT modify any existing service.
 * Manages policies, evaluates risk events against them, and records response actions.
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

// ── Supported policy trigger metrics ──────────────────────────────────────────
const TRIGGER_METRICS = [
  'risk_score',           // 0–100 behavioral risk score
  'alert_count_24h',      // number of alerts in 24h window
  'correlation_count',    // cross-node correlation events
  'malicious_domains',    // count of unique flagged domains
  'threat_severity',      // max severity level (1=low … 4=critical)
];

// ── Supported policy action types ─────────────────────────────────────────────
const ACTION_TYPES = {
  alert_escalate:   { label: 'Escalate Alert',        description: 'Raise alert severity and notify SOC' },
  notify_soc:       { label: 'Notify SOC',             description: 'Send notification to SOC dashboard' },
  log_response:     { label: 'Log Response',           description: 'Record response event to audit trail' },
  soft_block:       { label: 'Soft Block',             description: 'Flag session for review and rate-limit' },
  session_restrict: { label: 'Restrict Session',       description: 'Limit outbound requests from node' },
  weight_boost:     { label: 'Boost Risk Weights',     description: 'Increase domain risk multipliers' },
  agent_task:       { label: 'Dispatch Agent Task',    description: 'Trigger autonomous agent investigation' },
};

// ── Supported operators ────────────────────────────────────────────────────────
const OPERATORS = ['>', '>=', '<', '<=', '==', '!='];

class PolicyEngineService {
  constructor() {
    // In-memory stores — production would back these with Appwrite collections
    this.policies = new Map();        // policyId → PolicyRecord
    this.responseLog = [];            // Ordered append-only response events
    this.evaluationCache = new Map(); // nodeId → { lastEvaluated, suppressUntil }

    this.config = {
      maxPolicies: 200,
      maxResponseLog: 2000,
      defaultCooldownMs: 5 * 60 * 1000,   // 5 min between re-trigger for same policy+node
      suppressionWindowMs: 60 * 1000,      // 1 min minimum between any action for a node
    };

    this._seedDefaultPolicies();
  }

  // ── Defaults ────────────────────────────────────────────────────────────────

  _seedDefaultPolicies() {
    const defaults = [
      {
        name: 'High Risk Score Alert',
        description: 'Escalate when behavioral risk score exceeds 75',
        trigger: { metric: 'risk_score', operator: '>=', threshold: 75 },
        action: { type: 'alert_escalate', params: { priority: 'high' } },
        enabled: true,
        scope: 'global',
      },
      {
        name: 'Critical Risk — Log & Notify',
        description: 'Log and notify SOC when risk score is critical (>= 90)',
        trigger: { metric: 'risk_score', operator: '>=', threshold: 90 },
        action: { type: 'notify_soc', params: { channel: 'soc_dashboard', urgency: 'critical' } },
        enabled: true,
        scope: 'global',
      },
      {
        name: 'Burst Alert Storm',
        description: 'Soft-block session when 20+ alerts occur in 24h',
        trigger: { metric: 'alert_count_24h', operator: '>=', threshold: 20 },
        action: { type: 'soft_block', params: { duration_minutes: 30 } },
        enabled: true,
        scope: 'global',
      },
      {
        name: 'Cross-Node Correlation Response',
        description: 'Dispatch agent task when 3+ cross-node correlations fire',
        trigger: { metric: 'correlation_count', operator: '>=', threshold: 3 },
        action: { type: 'agent_task', params: { task: 'deep_investigation', priority: 'high' } },
        enabled: true,
        scope: 'global',
      },
      {
        name: 'Critical Threat Severity',
        description: 'Escalate and boost weights on critical threat detection',
        trigger: { metric: 'threat_severity', operator: '>=', threshold: 4 },
        action: { type: 'weight_boost', params: { multiplier: 1.5 } },
        enabled: true,
        scope: 'global',
      },
    ];

    for (const def of defaults) {
      const id = crypto.randomUUID();
      this.policies.set(id, {
        id,
        ...def,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system',
        triggerCount: 0,
        lastTriggered: null,
        isDefault: true,
      });
    }

    logger.info(`[PolicyEngine] Seeded ${defaults.length} default policies`);
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  createPolicy({ name, description, trigger, action, enabled = true, scope = 'global' }, userId) {
    if (!name || !trigger || !action) {
      return { success: false, error: 'Missing required fields: name, trigger, action' };
    }
    if (!TRIGGER_METRICS.includes(trigger.metric)) {
      return { success: false, error: `Invalid trigger metric. Allowed: ${TRIGGER_METRICS.join(', ')}` };
    }
    if (!OPERATORS.includes(trigger.operator)) {
      return { success: false, error: `Invalid operator. Allowed: ${OPERATORS.join(', ')}` };
    }
    if (typeof trigger.threshold !== 'number') {
      return { success: false, error: 'trigger.threshold must be a number' };
    }
    if (!ACTION_TYPES[action.type]) {
      return { success: false, error: `Invalid action type. Allowed: ${Object.keys(ACTION_TYPES).join(', ')}` };
    }
    if (this.policies.size >= this.config.maxPolicies) {
      return { success: false, error: 'Policy limit reached' };
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const policy = {
      id,
      name,
      description: description || '',
      trigger,
      action,
      enabled,
      scope,
      createdAt: now,
      updatedAt: now,
      createdBy: userId || 'unknown',
      triggerCount: 0,
      lastTriggered: null,
      isDefault: false,
    };

    this.policies.set(id, policy);
    logger.info(`[PolicyEngine] Policy created: "${name}" (${id}) by ${userId}`);
    return { success: true, policy };
  }

  getPolicy(id) {
    const policy = this.policies.get(id);
    if (!policy) return { success: false, error: 'Policy not found' };
    return { success: true, policy };
  }

  listPolicies({ scope, enabled } = {}) {
    let list = Array.from(this.policies.values());
    if (scope !== undefined) list = list.filter(p => p.scope === scope);
    if (enabled !== undefined) list = list.filter(p => p.enabled === enabled);
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return { success: true, policies: list, total: list.length };
  }

  updatePolicy(id, updates, userId) {
    const policy = this.policies.get(id);
    if (!policy) return { success: false, error: 'Policy not found' };

    const allowed = ['name', 'description', 'trigger', 'action', 'enabled', 'scope'];
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        policy[key] = updates[key];
      }
    }
    policy.updatedAt = new Date().toISOString();
    policy.updatedBy = userId || 'unknown';

    logger.info(`[PolicyEngine] Policy updated: ${id} by ${userId}`);
    return { success: true, policy };
  }

  deletePolicy(id, userId) {
    const policy = this.policies.get(id);
    if (!policy) return { success: false, error: 'Policy not found' };
    if (policy.isDefault) return { success: false, error: 'Cannot delete default policies' };

    this.policies.delete(id);
    logger.info(`[PolicyEngine] Policy deleted: ${id} by ${userId}`);
    return { success: true, message: 'Policy deleted' };
  }

  // ── Evaluation ────────────────────────────────────────────────────────────────

  /**
   * Evaluate a risk event against all enabled policies.
   * @param {Object} riskEvent - { nodeId, metrics: { risk_score, alert_count_24h, ... } }
   * @returns {Object} { triggered: [PolicyAction], suppressed: number }
   */
  evaluate(riskEvent) {
    const { nodeId, metrics = {} } = riskEvent;

    if (!nodeId) return { triggered: [], suppressed: 0, error: 'Missing nodeId' };

    const now = Date.now();
    const nodeCache = this.evaluationCache.get(nodeId) || {};

    // Global suppression window check (prevent action storm)
    if (nodeCache.suppressUntil && now < nodeCache.suppressUntil) {
      return { triggered: [], suppressed: 1, suppressedUntil: new Date(nodeCache.suppressUntil).toISOString() };
    }

    const triggered = [];
    let suppressed = 0;

    for (const policy of this.policies.values()) {
      if (!policy.enabled) continue;

      const metricValue = this._resolveMetric(metrics, policy.trigger.metric);
      if (metricValue === null) continue;

      if (!this._evaluate(metricValue, policy.trigger.operator, policy.trigger.threshold)) continue;

      // Per-policy cooldown check
      const cooldownKey = `${nodeId}:${policy.id}`;
      const lastFired = nodeCache[cooldownKey] || 0;
      if (now - lastFired < this.config.defaultCooldownMs) {
        suppressed++;
        continue;
      }

      // Build response action
      const responseAction = this._buildResponseAction(policy, riskEvent, metricValue);
      triggered.push(responseAction);

      // Update policy stats
      policy.triggerCount++;
      policy.lastTriggered = new Date().toISOString();

      // Record cooldown
      nodeCache[cooldownKey] = now;

      // Append to response log
      this._appendResponseLog(responseAction);
    }

    // Set suppression window if any actions fired
    if (triggered.length > 0) {
      nodeCache.suppressUntil = now + this.config.suppressionWindowMs;
    }

    this.evaluationCache.set(nodeId, nodeCache);

    if (triggered.length > 0) {
      logger.info(`[PolicyEngine] ${triggered.length} policies triggered for node ${nodeId}`);
    }

    return { triggered, suppressed };
  }

  _resolveMetric(metrics, metricName) {
    const value = metrics[metricName];
    return value !== undefined ? Number(value) : null;
  }

  _evaluate(value, operator, threshold) {
    switch (operator) {
      case '>':  return value > threshold;
      case '>=': return value >= threshold;
      case '<':  return value < threshold;
      case '<=': return value <= threshold;
      case '==': return value === threshold;
      case '!=': return value !== threshold;
      default:   return false;
    }
  }

  _buildResponseAction(policy, riskEvent, triggeredValue) {
    return {
      actionId: crypto.randomUUID(),
      policyId: policy.id,
      policyName: policy.name,
      actionType: policy.action.type,
      actionParams: policy.action.params || {},
      trigger: {
        metric: policy.trigger.metric,
        operator: policy.trigger.operator,
        threshold: policy.trigger.threshold,
        actualValue: triggeredValue,
      },
      nodeId: riskEvent.nodeId,
      timestamp: new Date().toISOString(),
      status: 'executed',
    };
  }

  // ── Response Log ──────────────────────────────────────────────────────────────

  _appendResponseLog(action) {
    this.responseLog.push(action);
    while (this.responseLog.length > this.config.maxResponseLog) {
      this.responseLog.shift();
    }
  }

  getResponseLog({ limit = 100, nodeId, actionType, policyId } = {}) {
    let log = [...this.responseLog].reverse(); // newest first

    if (nodeId)     log = log.filter(e => e.nodeId === nodeId);
    if (actionType) log = log.filter(e => e.actionType === actionType);
    if (policyId)   log = log.filter(e => e.policyId === policyId);

    return {
      success: true,
      log: log.slice(0, limit),
      total: log.length,
    };
  }

  // ── Metadata ──────────────────────────────────────────────────────────────────

  getActionTypes() {
    return ACTION_TYPES;
  }

  getTriggerMetrics() {
    return TRIGGER_METRICS;
  }

  getOperators() {
    return OPERATORS;
  }

  getStats() {
    const list = Array.from(this.policies.values());
    return {
      totalPolicies: list.length,
      enabledPolicies: list.filter(p => p.enabled).length,
      totalResponseActions: this.responseLog.length,
      mostTriggered: list
        .sort((a, b) => b.triggerCount - a.triggerCount)
        .slice(0, 5)
        .map(p => ({ id: p.id, name: p.name, triggerCount: p.triggerCount, lastTriggered: p.lastTriggered })),
    };
  }
}

const policyEngineService = new PolicyEngineService();
module.exports = { policyEngineService, PolicyEngineService };
