/**
 * CyberForge Policy Engine
 *
 * Evaluates risk events against policies and records what each policy that
 * fires asked for and what then happened.
 *
 * Storage:
 *   - Policies are platform-wide records in the database (models/Policy.js).
 *     The five built-in policies are created once and never duplicated.
 *   - Each response is a record in the workspace of the account whose event
 *     fired it (models/ResponseAction.js), read through the workspace
 *     repository, so one workspace never sees another's.
 *   - The cooldown that stops a node triggering the same policy again within a
 *     few minutes is kept in memory: losing it on restart only lets a response
 *     through a little early.
 *
 * Until October 2026 all three lived in this process's memory, and the
 * policies and responses were gone after every restart.
 */

const crypto = require('crypto');
const Policy = require('../models/Policy');
const ResponseAction = require('../models/ResponseAction');
const { workspaceRepository, MAX_PAGE } = require('../repositories/workspaceRepository');
const { workspaceIdFor } = require('./workspaceService');
const logger = require('../utils/logger');

const responses = workspaceRepository(ResponseAction);

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

const DEFAULT_POLICIES = [
  {
    defaultKey: 'high-risk-score',
    name: 'High Risk Score Alert',
    description: 'Escalate when behavioral risk score exceeds 75',
    trigger: { metric: 'risk_score', operator: '>=', threshold: 75 },
    action: { type: 'alert_escalate', params: { priority: 'high' } },
  },
  {
    defaultKey: 'critical-risk-notify',
    name: 'Critical Risk — Log & Notify',
    description: 'Log and notify SOC when risk score is critical (>= 90)',
    trigger: { metric: 'risk_score', operator: '>=', threshold: 90 },
    action: { type: 'notify_soc', params: { channel: 'soc_dashboard', urgency: 'critical' } },
  },
  {
    defaultKey: 'burst-alert-storm',
    name: 'Burst Alert Storm',
    description: 'Soft-block session when 20+ alerts occur in 24h',
    trigger: { metric: 'alert_count_24h', operator: '>=', threshold: 20 },
    action: { type: 'soft_block', params: { duration_minutes: 30 } },
  },
  {
    defaultKey: 'cross-node-correlation',
    name: 'Cross-Node Correlation Response',
    description: 'Dispatch agent task when 3+ cross-node correlations fire',
    trigger: { metric: 'correlation_count', operator: '>=', threshold: 3 },
    action: { type: 'agent_task', params: { task: 'deep_investigation', priority: 'high' } },
  },
  {
    defaultKey: 'critical-threat-severity',
    name: 'Critical Threat Severity',
    description: 'Escalate and boost weights on critical threat detection',
    trigger: { metric: 'threat_severity', operator: '>=', threshold: 4 },
    action: { type: 'weight_boost', params: { multiplier: 1.5 } },
  },
];

/** How long this process trusts its copy of the policies before reading them again. */
const POLICY_CACHE_MS = 30 * 1000;

/** The public shape of a policy, as the API has always returned it. */
function presentPolicy(doc) {
  return {
    id: doc.policyId,
    name: doc.name,
    description: doc.description || '',
    trigger: doc.trigger && { metric: doc.trigger.metric, operator: doc.trigger.operator, threshold: doc.trigger.threshold },
    action: doc.action && { type: doc.action.type, params: doc.action.params || {} },
    enabled: doc.enabled !== false,
    scope: doc.scope || 'global',
    isDefault: Boolean(doc.isDefault),
    createdBy: doc.createdBy || 'system',
    updatedBy: doc.updatedBy || undefined,
    triggerCount: doc.triggerCount || 0,
    lastTriggered: doc.lastTriggered ? new Date(doc.lastTriggered).toISOString() : null,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };
}

/** The public shape of a response record. */
function presentResponse(doc) {
  const out = {
    actionId: doc.actionId,
    policyId: doc.policyId,
    policyName: doc.policyName,
    actionType: doc.actionType,
    actionParams: doc.actionParams || {},
    trigger: doc.trigger,
    nodeId: doc.nodeId,
    userId: doc.userId,
    workspaceId: doc.workspaceId ? String(doc.workspaceId) : null,
    timestamp: new Date(doc.createdAt).toISOString(),
    status: doc.status,
  };
  if (doc.reason) out.reason = doc.reason;
  if (doc.executor) out.executor = doc.executor;
  if (doc.receipt) out.receipt = doc.receipt;
  return out;
}

/** A trigger and an action that the engine can evaluate, or the reason not. */
function invalidRule(trigger, action) {
  if (!trigger || typeof trigger !== 'object') return 'trigger is required';
  if (!TRIGGER_METRICS.includes(trigger.metric)) return `Invalid trigger metric. Allowed: ${TRIGGER_METRICS.join(', ')}`;
  if (!OPERATORS.includes(trigger.operator)) return `Invalid operator. Allowed: ${OPERATORS.join(', ')}`;
  if (typeof trigger.threshold !== 'number' || !Number.isFinite(trigger.threshold)) return 'trigger.threshold must be a number';
  if (!action || typeof action !== 'object' || !ACTION_TYPES[action.type]) {
    return `Invalid action type. Allowed: ${Object.keys(ACTION_TYPES).join(', ')}`;
  }
  return null;
}

class PolicyEngineService {
  /** @param {{ seedDefaults?: boolean }} options - tests turn the built-in policies off */
  constructor({ seedDefaults = true } = {}) {
    this.evaluationCache = new Map(); // "account:node" → { suppressUntil, "<node>:<policy>": lastFired }
    this.config = {
      maxPolicies: 200,
      defaultCooldownMs: 5 * 60 * 1000,   // 5 min between re-trigger for same policy+node
      suppressionWindowMs: 60 * 1000,      // 1 min minimum between any action for a node
    };
    this.seedDefaults = seedDefaults;
    this._seeded = false;
    this._policies = null;
    this._loadedAt = 0;

    // What actually carries out each action type in this deployment. An
    // action type with no executor here is recorded as unsupported: a policy
    // that fires says what it wanted done, and never that it was done.
    this.executors = new Map();
    this.registerExecutor('log_response', {
      name: 'response-log',
      // The action is the record itself: it is applied once the record can be read back.
      run: async (action) => {
        const stored = await ResponseAction.findOne({ actionId: action.actionId });
        if (!stored) throw new Error('the entry is not in the response log');
        return { target: `response log entry ${action.actionId}`, verification: 'entry read back from the response log' };
      },
    });
  }

  // ── Executors ───────────────────────────────────────────────────────────────

  /**
   * Register what carries out an action type.
   * @param {string} actionType - one of ACTION_TYPES
   * @param {{ name: string, run: (action: object) => ({ target: string, verification: string } | Promise<…>) }} executor
   *        `run` does the work and returns what it acted on and how that was
   *        checked. It throws when the action could not be carried out.
   */
  registerExecutor(actionType, executor) {
    if (!ACTION_TYPES[actionType]) throw new Error(`Unknown action type: ${actionType}`);
    if (!executor || typeof executor.name !== 'string' || typeof executor.run !== 'function') {
      throw new Error('An executor needs a name and a run function');
    }
    this.executors.set(actionType, executor);
  }

  /**
   * Carry out a recorded action and set its outcome:
   *   applied      an executor ran and returned a receipt (executor, target, time, verification)
   *   failed       an executor ran and could not do it
   *   unsupported  nothing in this deployment carries out this action type
   */
  async _execute(action) {
    const executor = this.executors.get(action.actionType);
    if (!executor) {
      action.status = 'unsupported';
      action.reason = 'No executor for this action type in this deployment; nothing was done.';
      return action;
    }
    try {
      const outcome = await executor.run(action);
      if (!outcome || typeof outcome.target !== 'string' || !outcome.target || typeof outcome.verification !== 'string' || !outcome.verification) {
        throw new Error('the executor returned no receipt');
      }
      action.status = 'applied';
      action.receipt = {
        executor: executor.name,
        target: outcome.target,
        appliedAt: new Date().toISOString(),
        verification: outcome.verification,
      };
    } catch (error) {
      action.status = 'failed';
      action.reason = String(error && error.message ? error.message : error).slice(0, 300);
      action.executor = executor.name;
    }
    return action;
  }

  // ── Policies ────────────────────────────────────────────────────────────────

  /** Create the built-in policies that do not exist yet. An administrator's changes to one are kept. */
  async _seed() {
    for (const def of DEFAULT_POLICIES) {
      await Policy.updateOne(
        { defaultKey: def.defaultKey },
        { $setOnInsert: { ...def, policyId: crypto.randomUUID(), enabled: true, scope: 'global', isDefault: true, createdBy: 'system', triggerCount: 0, lastTriggered: null } },
        { upsert: true }
      );
    }
  }

  /** The current policies, read from the database at most every POLICY_CACHE_MS. */
  async _currentPolicies() {
    if (this._policies && Date.now() - this._loadedAt < POLICY_CACHE_MS) return this._policies;
    if (this.seedDefaults && !this._seeded) {
      await this._seed();
      this._seeded = true;
    }
    this._policies = (await Policy.find({})).map(presentPolicy);
    this._loadedAt = Date.now();
    return this._policies;
  }

  _forget() {
    this._policies = null;
  }

  async createPolicy({ name, description, trigger, action, enabled = true, scope = 'global' } = {}, userId) {
    if (!name || !trigger || !action) {
      return { success: false, error: 'Missing required fields: name, trigger, action' };
    }
    const invalid = invalidRule(trigger, action);
    if (invalid) return { success: false, error: invalid };
    if (await Policy.countDocuments({}) >= this.config.maxPolicies) {
      return { success: false, error: 'Policy limit reached' };
    }
    const doc = await Policy.create({
      policyId: crypto.randomUUID(),
      name: String(name).slice(0, 120),
      description: description ? String(description).slice(0, 500) : '',
      trigger: { metric: trigger.metric, operator: trigger.operator, threshold: trigger.threshold },
      action: { type: action.type, params: action.params || {} },
      enabled: enabled !== false,
      scope,
      createdBy: userId ? String(userId) : 'unknown',
      isDefault: false,
    });
    this._forget();
    logger.info(`[PolicyEngine] Policy created: "${doc.name}" (${doc.policyId}) by ${userId}`);
    return { success: true, policy: presentPolicy(doc) };
  }

  async getPolicy(id) {
    const doc = await Policy.findOne({ policyId: String(id) });
    if (!doc) return { success: false, error: 'Policy not found' };
    return { success: true, policy: presentPolicy(doc) };
  }

  async listPolicies({ scope, enabled } = {}) {
    let list = await this._currentPolicies();
    if (scope !== undefined) list = list.filter(p => p.scope === scope);
    if (enabled !== undefined) list = list.filter(p => p.enabled === enabled);
    list = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return { success: true, policies: list, total: list.length };
  }

  async updatePolicy(id, updates = {}, userId) {
    const existing = await Policy.findOne({ policyId: String(id) });
    if (!existing) return { success: false, error: 'Policy not found' };
    // A change is checked as strictly as a new policy: the engine has to be able to evaluate it.
    const invalid = invalidRule(updates.trigger || existing.trigger, updates.action || existing.action);
    if (invalid) return { success: false, error: invalid };
    const set = { updatedBy: userId ? String(userId) : 'unknown' };
    if (updates.name !== undefined) set.name = String(updates.name).slice(0, 120);
    if (updates.description !== undefined) set.description = String(updates.description).slice(0, 500);
    if (updates.trigger !== undefined) set.trigger = { metric: updates.trigger.metric, operator: updates.trigger.operator, threshold: updates.trigger.threshold };
    if (updates.action !== undefined) set.action = { type: updates.action.type, params: updates.action.params || {} };
    if (updates.enabled !== undefined) set.enabled = updates.enabled !== false;
    if (updates.scope !== undefined) set.scope = String(updates.scope).slice(0, 40);
    await Policy.updateOne({ policyId: String(id) }, { $set: set });
    this._forget();
    logger.info(`[PolicyEngine] Policy updated: ${id} by ${userId}`);
    return this.getPolicy(id);
  }

  async deletePolicy(id, userId) {
    const existing = await Policy.findOne({ policyId: String(id) });
    if (!existing) return { success: false, error: 'Policy not found' };
    if (existing.isDefault) return { success: false, error: 'Cannot delete default policies' };
    await Policy.deleteOne({ policyId: String(id) });
    this._forget();
    logger.info(`[PolicyEngine] Policy deleted: ${id} by ${userId}`);
    return { success: true, message: 'Policy deleted' };
  }

  // ── Evaluation ────────────────────────────────────────────────────────────────

  /**
   * Evaluate a risk event against all enabled policies.
   * @param {Object} riskEvent - { nodeId, metrics, userId, workspaceId? }
   * @returns {Promise<Object>} { triggered: [ResponseAction], suppressed: number }
   */
  async evaluate(riskEvent) {
    const { nodeId, metrics = {} } = riskEvent || {};
    if (!nodeId) return { triggered: [], suppressed: 0, error: 'Missing nodeId' };

    // Cooldowns are kept per account, so one account naming another's node
    // cannot suppress that node's policies.
    const cacheKey = `${riskEvent.userId == null ? '' : riskEvent.userId}:${nodeId}`;
    const now = Date.now();
    const nodeCache = this.evaluationCache.get(cacheKey) || {};

    // Global suppression window check (prevent action storm)
    if (nodeCache.suppressUntil && now < nodeCache.suppressUntil) {
      return { triggered: [], suppressed: 1, suppressedUntil: new Date(nodeCache.suppressUntil).toISOString() };
    }

    const policies = await this._currentPolicies();
    const principal = { userId: riskEvent.userId, workspaceId: riskEvent.workspaceId };
    const workspaceId = await workspaceIdFor(principal);
    const triggered = [];
    let suppressed = 0;

    for (const policy of policies) {
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
      nodeCache[cooldownKey] = now;

      const action = this._buildResponseAction(policy, riskEvent, metricValue, workspaceId);
      triggered.push(action);

      // Record what the policy asks for, then carry it out (or record that
      // nothing here can), then record what happened. An action that cannot be
      // recorded is not carried out.
      if (!workspaceId) {
        action.status = 'failed';
        action.reason = 'The response has no workspace to be recorded in; nothing was done.';
        continue;
      }
      try {
        await responses.create({ userId: riskEvent.userId, workspaceId }, { ...action, createdAt: new Date(action.timestamp) });
      } catch (error) {
        action.status = 'failed';
        action.reason = 'The response could not be recorded; nothing was done.';
        logger.warn(`[PolicyEngine] Response not recorded: ${error.message}`);
        continue;
      }
      await this._execute(action);
      try {
        await ResponseAction.updateOne({ actionId: action.actionId }, {
          $set: { status: action.status, reason: action.reason || null, executor: action.executor || null, receipt: action.receipt || null }
        });
        await Policy.updateOne({ policyId: policy.id }, { $inc: { triggerCount: 1 }, $set: { lastTriggered: new Date() } });
      } catch (error) {
        logger.warn(`[PolicyEngine] Outcome not recorded for ${action.actionId}: ${error.message}`);
      }
    }

    // Set suppression window if any actions fired
    if (triggered.length > 0) {
      nodeCache.suppressUntil = now + this.config.suppressionWindowMs;
      this._forget(); // trigger counts changed
      logger.info(`[PolicyEngine] ${triggered.length} policies triggered for node ${nodeId}`);
    }
    this.evaluationCache.set(cacheKey, nodeCache);

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

  _buildResponseAction(policy, riskEvent, triggeredValue, workspaceId) {
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
      nodeId: String(riskEvent.nodeId).slice(0, 200),
      userId: riskEvent.userId == null ? null : String(riskEvent.userId),
      workspaceId: workspaceId || null,
      timestamp: new Date().toISOString(),
      // What the policy asks for. _execute() replaces this with what happened.
      status: 'proposed',
    };
  }

  // ── Response Log ──────────────────────────────────────────────────────────────

  _responseFilter({ nodeId, actionType, policyId, status } = {}) {
    const filter = {};
    if (typeof nodeId === 'string' && nodeId) filter.nodeId = nodeId.slice(0, 200);
    if (ACTION_TYPES[actionType]) filter.actionType = actionType;
    if (typeof policyId === 'string' && policyId) filter.policyId = policyId;
    if (ResponseAction.STATUSES.includes(status)) filter.status = status;
    return filter;
  }

  /** The responses of the caller's workspace, newest first. */
  async getResponseLog(principal, { limit = 100, ...filters } = {}) {
    const filter = this._responseFilter(filters);
    const size = Math.min(Math.max(parseInt(limit, 10) || 100, 1), MAX_PAGE);
    const [found, total] = await Promise.all([
      responses.find(principal, filter, { limit: size }),
      responses.count(principal, filter),
    ]);
    return { success: true, log: found.map(presentResponse), total };
  }

  /** Every workspace's responses. For platform administrators only: the route checks the role. */
  async getPlatformResponseLog({ limit = 100, ...filters } = {}) {
    const filter = this._responseFilter(filters);
    const size = Math.min(Math.max(parseInt(limit, 10) || 100, 1), MAX_PAGE);
    const [found, total] = await Promise.all([
      ResponseAction.find(filter).sort({ _id: -1 }).limit(size),
      ResponseAction.countDocuments(filter),
    ]);
    return { success: true, log: found.map(presentResponse), total };
  }

  // ── Metadata ──────────────────────────────────────────────────────────────────

  getActionTypes() {
    // Each type says whether anything in this deployment carries it out, so a
    // client can show the others as unavailable instead of offering them.
    return Object.fromEntries(Object.entries(ACTION_TYPES).map(
      ([type, info]) => [type, { ...info, supported: this.executors.has(type) }]
    ));
  }

  getTriggerMetrics() {
    return TRIGGER_METRICS;
  }

  getOperators() {
    return OPERATORS;
  }

  /**
   * Policy counts (platform-wide, like the policies) and response counts for
   * one workspace, or for every workspace when `principal` is null (an
   * administrator's platform view).
   */
  async getStats(principal) {
    const list = await this._currentPolicies();
    const countOf = filter => (principal ? responses.count(principal, filter) : ResponseAction.countDocuments(filter));
    const byStatus = {};
    for (const status of ResponseAction.STATUSES) {
      const count = await countOf({ status });
      if (count) byStatus[status] = count;
    }
    return {
      totalPolicies: list.length,
      enabledPolicies: list.filter(p => p.enabled).length,
      totalResponseActions: await countOf({}),
      // How many of those were actually carried out, failed, or had nothing to carry them out.
      responseActionsByStatus: byStatus,
      supportedActionTypes: Array.from(this.executors.keys()),
      mostTriggered: [...list]
        .sort((a, b) => b.triggerCount - a.triggerCount)
        .slice(0, 5)
        .map(p => ({ id: p.id, name: p.name, triggerCount: p.triggerCount, lastTriggered: p.lastTriggered })),
      retentionDays: ResponseAction.RETENTION_DAYS,
    };
  }
}

const policyEngineService = new PolicyEngineService();
module.exports = { policyEngineService, PolicyEngineService, DEFAULT_POLICIES };
