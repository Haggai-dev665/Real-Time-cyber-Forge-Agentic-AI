/**
 * The audit trail (SEC-08): security events, kept in the database, each in the
 * workspace it belongs to or at platform level.
 *
 * Events are recorded by the server at the operation that changes something
 * (a sign-in, a policy change, a policy response). A client may report an event
 * too; it is kept with `origin: 'client'` so it is never mistaken for one the
 * server saw. Recording never throws: a failure is logged, and the operation
 * that was being recorded goes on.
 *
 * This replaces an in-memory list that held 10,000 entries until the next
 * restart, and that no server code wrote to.
 */
const crypto = require('crypto');
const AuditEvent = require('../models/AuditEvent');
const { workspaceIdFor } = require('./workspaceService');
const { workspaceRepository, MAX_PAGE } = require('../repositories/workspaceRepository');
const logger = require('../utils/logger');
const { hashOf } = require('../utils/canonical');

const events = workspaceRepository(AuditEvent);

// The fields an event's content hash covers (SEC-08): everything that says what happened.
const HASHED_FIELDS = ['scope', 'workspaceId', 'actorType', 'actorUserId', 'action', 'resource', 'outcome', 'origin', 'details', 'correlationId', 'ipAddress', 'createdAt'];
function contentHashOf(event) {
  const picked = {};
  for (const field of HASHED_FIELDS) {
    const value = event[field];
    picked[field] = value === undefined || value === null ? null
      : (field === 'workspaceId' || field === 'actorUserId') ? String(value)
        : field === 'createdAt' ? new Date(value).toISOString()
          : value;
  }
  return hashOf(picked);
}

const AUDIT_ACTIONS = {
  'auth.login': 'Signed in',
  'auth.logout': 'Signed out',
  'auth.register': 'Account created',
  'policy.create': 'Policy created',
  'policy.update': 'Policy updated',
  'policy.delete': 'Policy deleted',
  'policy.triggered': 'Policy response triggered',
  'system.startup': 'Server started',
  'evidence.delete': 'Evidence deleted',
  'evidence.export': 'Evidence exported with a signed manifest',
  'device.enrollment_create': 'Device enrollment code created',
  'device.enrollment_cancel': 'Device enrollment code cancelled',
  'device.claim': 'Device claimed an enrollment code',
  'device.approve': 'Device approved',
  'device.rename': 'Device renamed',
  'device.revoke': 'Device revoked',
  'device.key_rotate': 'Device key rotated',
  'device.command_create': 'Command sent to a device',
  'device.command_cancel': 'Command to a device cancelled',
  'device.command_receipt': 'Device reported a command result',
  'agent.create': 'Agent created',
  'agent.update': 'Agent changed',
  'agent.activate': 'Agent activated',
  'agent.pause': 'Agent paused',
  'agent.resume': 'Agent resumed',
  'agent.archive': 'Agent archived',
  'agent.run_request': 'Agent run requested',
  'agent.run_cancel': 'Agent run cancelled',
  'agent.run_retry': 'Agent run retried (failed checks only)',
  'finding.state_change': 'Finding moved through its workflow',
  'finding.exception_create': 'Exception made for a finding',
  'finding.exception_revoke': 'Exception revoked',
  'alert.state_change': 'Agent alert moved through its workflow',
  'report.generate': 'Evidence report generated',
  'agent.action_approve': 'Agent proposal approved',
  'agent.action_reject': 'Agent proposal rejected',
  'device.inventory_create': 'Inventory record added',
  'account.export': 'Account data exported',
  'account.data_delete': 'Account data deleted',
  'account.delete': 'Account deleted',
  // reported by clients
  'threat.resolve': 'Threat resolved',
  'threat.dismiss': 'Threat dismissed',
  'soc.alert_ack': 'Alert acknowledged',
  'soc.incident_create': 'Incident created',
  'soc.incident_close': 'Incident closed'
};

const MAX_DETAILS_BYTES = 4096;
const SECRET_KEY = /pass|secret|token|apikey|api_key|authorization|cookie|credential|^code$|^key$/i;

/**
 * A bounded, credential-free copy of the details: keys named like a secret
 * are replaced, long strings are cut, depth is limited, and if the result is
 * still too large only its keys are kept.
 */
function cleanDetails(value, depth = 0) {
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  if (depth >= 4) return '[nested too deep]';
  if (Array.isArray(value)) return value.slice(0, 50).map(item => cleanDetails(item, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 50).map(([key, item]) =>
      [key, SECRET_KEY.test(key) ? '[redacted]' : cleanDetails(item, depth + 1)]));
  }
  return String(value);
}

function boundedDetails(details) {
  const cleaned = cleanDetails(details && typeof details === 'object' ? details : {});
  if (Buffer.byteLength(JSON.stringify(cleaned)) <= MAX_DETAILS_BYTES) return cleaned;
  return { truncated: true, keys: Object.keys(cleaned).slice(0, 50) };
}

/** The ID that ties an event to the request that caused it: Heroku's request ID when present. */
function correlationOf(req) {
  const given = req && req.headers && req.headers['x-request-id'];
  return typeof given === 'string' && /^[A-Za-z0-9._:-]{1,100}$/.test(given) ? given : crypto.randomUUID();
}

/**
 * Record an event. `principal` is the verified account (`req.user`), or null
 * for the system. A workspace event goes to the principal's workspace; if there
 * is none to be had it is not recorded, and that is logged. `platform: true`
 * records an event that belongs to no single workspace.
 */
async function record({ principal = null, platform = false, action, resource, outcome = 'success', details, origin = 'server', req = null }) {
  try {
    const workspaceId = platform ? null : await workspaceIdFor(principal);
    if (!platform && !workspaceId) {
      logger.warn(`[Audit] Not recorded: "${action}" has no workspace to belong to`);
      return null;
    }
    const fields = {
      scope: platform ? 'platform' : 'workspace',
      actorType: principal ? 'user' : 'system',
      actorUserId: principal ? String(principal.userId) : null,
      action,
      resource: String(resource || 'unknown').slice(0, 200),
      outcome,
      origin,
      details: boundedDetails(details),
      correlationId: req ? correlationOf(req) : null,
      ipAddress: req && req.ip ? String(req.ip).slice(0, 64) : null,
      createdAt: new Date()
    };
    if (platform) {
      const event = { ...fields, workspaceId: null };
      return await AuditEvent.create({ ...event, contentHash: contentHashOf(event) });
    }
    const stored = await events.create({ userId: principal.userId, workspaceId }, { ...fields, contentHash: contentHashOf({ ...fields, workspaceId }) });
    // Private invalidation only after persistence; no audit details or resource IDs.
    if (origin === 'server' && outcome === 'success' && /^(device|agent|policy|report|finding|alert)\./.test(action)) {
      try { require('./realtimeBus').emit('console:changed', { userId: String(principal.userId), category: action.split('.')[0] }); } catch (_) { /* polling reconciles missed invalidations */ }
    }
    return stored;
  } catch (error) {
    logger.warn(`[Audit] Failed to record "${action}": ${error.message}`);
    return null;
  }
}

/** The filter a caller may ask for. Anything else is ignored. */
function filterOf({ action, outcome, origin, since, until } = {}) {
  const filter = {};
  if (typeof action === 'string' && /^[a-z_.]{1,64}$/.test(action)) {
    filter.action = action.endsWith('.') ? { $regex: `^${action.replace(/\./g, '\\.')}` } : action;
  }
  if (AuditEvent.OUTCOMES.includes(outcome)) filter.outcome = outcome;
  if (origin === 'server' || origin === 'client') filter.origin = origin;
  const range = {};
  if (since && !Number.isNaN(Date.parse(since))) range.$gte = new Date(since);
  if (until && !Number.isNaN(Date.parse(until))) range.$lte = new Date(until);
  if (Object.keys(range).length) filter.createdAt = range;
  return filter;
}

function present(event) {
  return {
    id: String(event._id),
    timestamp: new Date(event.createdAt).toISOString(),
    scope: event.scope,
    action: event.action,
    actionLabel: AUDIT_ACTIONS[event.action] || event.action,
    actor: { type: event.actorType, userId: event.actorUserId ? String(event.actorUserId) : null },
    resource: event.resource,
    outcome: event.outcome,
    origin: event.origin,
    details: event.details || {},
    correlationId: event.correlationId || null
  };
}

function pageOf({ limit, offset } = {}) {
  const size = Math.min(Math.max(parseInt(limit, 10) || 100, 1), MAX_PAGE);
  const skip = Math.max(parseInt(offset, 10) || 0, 0);
  return { limit: size, skip };
}

/** The events of the caller's workspace, newest first. */
async function queryWorkspace(principal, query = {}) {
  const filter = filterOf(query);
  const page = pageOf(query);
  const [found, total] = await Promise.all([events.find(principal, filter, page), events.count(principal, filter)]);
  return { entries: found.map(present), total, hasMore: page.skip + found.length < total };
}

/**
 * Every event, of every workspace and of the platform. For platform
 * administrators only: the route checks the role before calling this.
 */
async function queryPlatform(query = {}) {
  const filter = filterOf(query);
  const page = pageOf(query);
  const [found, total] = await Promise.all([
    AuditEvent.find(filter).sort({ _id: -1 }).skip(page.skip).limit(page.limit),
    AuditEvent.countDocuments(filter)
  ]);
  return { entries: found.map(present), total, hasMore: page.skip + found.length < total };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function summarise(latest, counts) {
  const byAction = {};
  for (const event of latest) byAction[event.action] = (byAction[event.action] || 0) + 1;
  return {
    last24h: counts,
    // counted over the newest events of the last day, at most one page of them
    topActions: Object.entries(byAction).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([action, count]) => ({ action, label: AUDIT_ACTIONS[action] || action, count })),
    sampled: latest.length,
    retentionDays: AuditEvent.RETENTION_DAYS
  };
}

/** Counts for the caller's workspace over the last day. */
async function workspaceStats(principal) {
  const since = { createdAt: { $gte: new Date(Date.now() - DAY_MS) } };
  const counts = { total: await events.count(principal, since) };
  for (const outcome of AuditEvent.OUTCOMES) counts[outcome] = await events.count(principal, { ...since, outcome });
  const latest = await events.find(principal, since, { limit: MAX_PAGE });
  return summarise(latest, counts);
}

/** Counts across the platform over the last day, including the most active accounts. Administrators only. */
async function platformStats() {
  const since = { createdAt: { $gte: new Date(Date.now() - DAY_MS) } };
  const counts = { total: await AuditEvent.countDocuments(since) };
  for (const outcome of AuditEvent.OUTCOMES) counts[outcome] = await AuditEvent.countDocuments({ ...since, outcome });
  const latest = await AuditEvent.find(since).sort({ _id: -1 }).limit(MAX_PAGE);
  const byUser = {};
  for (const event of latest) if (event.actorUserId) byUser[event.actorUserId] = (byUser[event.actorUserId] || 0) + 1;
  return {
    ...summarise(latest, counts),
    topUsers: Object.entries(byUser).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([userId, count]) => ({ userId: String(userId), count }))
  };
}

module.exports = {
  AUDIT_ACTIONS,
  record,
  queryWorkspace,
  queryPlatform,
  workspaceStats,
  platformStats,
  getActionCatalog: () => AUDIT_ACTIONS,
  contentHashOf,
  HASHED_FIELDS,
  // for tests
  boundedDetails,
  correlationOf
};
