/**
 * CyberForge Audit Log Service
 * TODO 6: Enterprise Multi-Tenancy — Immutable Audit Trail
 *
 * ISOLATION: New service file. Does NOT modify any existing service.
 * Append-only log store. In production, back with Appwrite collection for persistence.
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

// ── Audit event categories ─────────────────────────────────────────────────────
const AUDIT_ACTIONS = {
  // Auth
  'auth.login':             'User logged in',
  'auth.logout':            'User logged out',
  'auth.register':          'User registered',
  'auth.password_change':   'Password changed',
  'auth.token_refresh':     'Token refreshed',
  // Policy
  'policy.create':          'Policy created',
  'policy.update':          'Policy updated',
  'policy.delete':          'Policy deleted',
  'policy.evaluate':        'Policy evaluated',
  'policy.triggered':       'Policy response triggered',
  // Threats
  'threat.scan':            'Threat scan initiated',
  'threat.resolve':         'Threat resolved',
  'threat.dismiss':         'Threat dismissed',
  // Distributed
  'node.register':          'Node registered',
  'node.offline':           'Node went offline',
  'weights.update':         'Risk weights updated',
  // Agent
  'agent.start':            'Agent started',
  'agent.stop':             'Agent stopped',
  'agent.task':             'Agent task dispatched',
  // Admin
  'admin.rbac_change':      'RBAC role changed',
  'admin.org_create':       'Organization created',
  'admin.org_update':       'Organization updated',
  // System
  'system.startup':         'System started',
  'system.shutdown':        'System shutdown',
  'system.config_change':   'System configuration changed',
  // SOC
  'soc.alert_ack':          'SOC alert acknowledged',
  'soc.incident_create':    'SOC incident created',
  'soc.incident_close':     'SOC incident closed',
};

class AuditLogService {
  constructor() {
    this.log = [];        // Ordered append-only entries
    this.index = {        // Secondary indices for fast lookup
      byUser: new Map(),  // userId → [entry index]
      byAction: new Map(),// action → [entry index]
    };

    this.config = {
      maxEntries: 10000,
      retentionDays: 90,
    };

    // Seed startup event
    this.append({
      action: 'system.startup',
      userId: 'system',
      resource: 'server',
      details: { message: 'CyberForge audit log initialized' },
      outcome: 'success',
    });
  }

  // ── Append ────────────────────────────────────────────────────────────────────

  /**
   * Append an immutable audit entry.
   * @param {Object} entry - { action, userId, resource, details, outcome, ipAddress, orgId }
   * @returns {Object} The created entry (with generated id + timestamp)
   */
  append({ action, userId, resource, details = {}, outcome = 'success', ipAddress = null, orgId = null }) {
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const entry = Object.freeze({
      id,
      timestamp,
      action: action || 'unknown',
      actionLabel: AUDIT_ACTIONS[action] || action,
      userId: userId || 'anonymous',
      resource: resource || 'unknown',
      details,
      outcome,
      ipAddress,
      orgId,
    });

    this.log.push(entry);
    this._indexEntry(entry, this.log.length - 1);

    // Trim to max entries
    if (this.log.length > this.config.maxEntries) {
      const removed = this.log.shift();
      this._rebuildIndices(); // Rebuild after trim (shift invalidates positional index)
    }

    return entry;
  }

  _indexEntry(entry, idx) {
    // byUser
    if (!this.index.byUser.has(entry.userId)) {
      this.index.byUser.set(entry.userId, []);
    }
    this.index.byUser.get(entry.userId).push(idx);

    // byAction
    if (!this.index.byAction.has(entry.action)) {
      this.index.byAction.set(entry.action, []);
    }
    this.index.byAction.get(entry.action).push(idx);
  }

  _rebuildIndices() {
    this.index.byUser.clear();
    this.index.byAction.clear();
    this.log.forEach((entry, idx) => this._indexEntry(entry, idx));
  }

  // ── Query ─────────────────────────────────────────────────────────────────────

  /**
   * Query the audit log with optional filters.
   * @param {Object} filters - { userId, action, outcome, orgId, resource, since, until, limit, offset }
   * @returns {Object} { entries, total, hasMore }
   */
  query({ userId, action, outcome, orgId, resource, since, until, limit = 100, offset = 0 } = {}) {
    let entries = [...this.log].reverse(); // newest first

    if (userId)   entries = entries.filter(e => e.userId === userId);
    if (action)   entries = entries.filter(e => e.action === action || e.action.startsWith(action));
    if (outcome)  entries = entries.filter(e => e.outcome === outcome);
    if (orgId)    entries = entries.filter(e => e.orgId === orgId);
    if (resource) entries = entries.filter(e => e.resource === resource || (e.resource || '').includes(resource));
    if (since) {
      const sinceMs = new Date(since).getTime();
      entries = entries.filter(e => new Date(e.timestamp).getTime() >= sinceMs);
    }
    if (until) {
      const untilMs = new Date(until).getTime();
      entries = entries.filter(e => new Date(e.timestamp).getTime() <= untilMs);
    }

    const total = entries.length;
    const paginated = entries.slice(offset, offset + limit);

    return {
      success: true,
      entries: paginated,
      total,
      hasMore: offset + limit < total,
    };
  }

  // ── Stats ─────────────────────────────────────────────────────────────────────

  getStats() {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const recent = this.log.filter(e => new Date(e.timestamp).getTime() > oneDayAgo);

    // Action frequency
    const actionCounts = {};
    for (const entry of recent) {
      actionCounts[entry.action] = (actionCounts[entry.action] || 0) + 1;
    }
    const topActions = Object.entries(actionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([action, count]) => ({ action, label: AUDIT_ACTIONS[action] || action, count }));

    // User activity
    const userCounts = {};
    for (const entry of recent) {
      if (entry.userId !== 'system') {
        userCounts[entry.userId] = (userCounts[entry.userId] || 0) + 1;
      }
    }
    const topUsers = Object.entries(userCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([userId, count]) => ({ userId, count }));

    // Outcome breakdown
    const outcomes = { success: 0, failure: 0, warning: 0 };
    for (const entry of recent) {
      if (outcomes[entry.outcome] !== undefined) outcomes[entry.outcome]++;
    }

    return {
      totalEntries: this.log.length,
      last24hEntries: recent.length,
      topActions,
      topUsers,
      outcomes,
      oldestEntry: this.log[0]?.timestamp || null,
      newestEntry: this.log[this.log.length - 1]?.timestamp || null,
    };
  }

  getActionCatalog() {
    return AUDIT_ACTIONS;
  }
}

const auditLogService = new AuditLogService();
module.exports = { auditLogService, AuditLogService };
