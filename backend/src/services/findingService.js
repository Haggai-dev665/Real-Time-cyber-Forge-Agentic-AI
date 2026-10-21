/**
 * Findings (DET-02): one record per thing found, not per time it was found,
 * and a workflow a person can follow.
 *
 * - A finding has a stable fingerprint: the account, the category and the
 *   normalised target (host without "www.", path without the query string).
 *   A detection that matches an open finding with the same fingerprint seen in
 *   the last DEDUP_WINDOW_MS raises its count and last-seen time instead of
 *   adding a record. One that matches only a closed finding becomes a new
 *   finding that names the earlier one (`recurrenceOf`), so the closed one's
 *   history is kept as it was.
 * - Workflow states change only by the transitions in TRANSITIONS, each kept in
 *   the finding's timeline and recorded in the audit trail. Severity is the
 *   detection's and does not change with the workflow.
 * - Marking a finding a false positive changes that finding only. It does not
 *   change any model, threshold or other account's detection.
 * - An exception (models/FindingException.js) covers one category and target
 *   for one workspace, with an owner, a reason and an expiry. A detection it
 *   covers is still recorded, as `excepted`. A detection more severe than the
 *   exception was made for is not covered: it opens as a normal finding whose
 *   timeline says the exception did not apply.
 */
const crypto = require('crypto');
const Threat = require('../models/Threat');
const FindingException = require('../models/FindingException');
const { workspaceIdFor } = require('./workspaceService');
const { workspaceRepository } = require('../repositories/workspaceRepository');
const { ownedThreatFilter } = require('./threatOwnership');
const audit = require('./auditLogService');

const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;
const OPEN = ['detected', 'acknowledged', 'investigating', 'confirmed'];
const CLOSED = ['resolved', 'false_positive', 'dismissed', 'mitigated', 'excepted'];
const TIMELINE_KEPT = 100;

// action → { to, from }: the state it moves to, and the states it may start from
const TRANSITIONS = {
  acknowledge: { to: 'acknowledged', from: ['detected'] },
  investigate: { to: 'investigating', from: ['detected', 'acknowledged', 'confirmed'] },
  resolve: { to: 'resolved', from: OPEN },
  false_positive: { to: 'false_positive', from: OPEN },
  reopen: { to: 'acknowledged', from: CLOSED }
};

class FindingError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

/** The target a fingerprint is taken over: host without "www.", and path, lower case; no query or fragment. */
function normalizeTarget(value) {
  const text = String(value || '').trim();
  try {
    const url = new URL(text.includes('://') ? text : `https://${text}`);
    if (url.hostname) {
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      const path = url.pathname.replace(/\/+$/, '').toLowerCase();
      return host + path;
    }
  } catch (_) { /* not an address: a hash, an IP, a name */ }
  return text.toLowerCase();
}

const fingerprintOf = (userId, type, target) => crypto.createHash('sha256').update(`${String(userId)}|${type}|${normalizeTarget(target)}`).digest('hex');
const SEVERITY_ORDER = ['low', 'medium', 'high', 'critical'];
const higher = (a, b) => (SEVERITY_ORDER.indexOf(b) > SEVERITY_ORDER.indexOf(a) ? b : a);

/**
 * Record a detection for an account: a new finding, or one more occurrence of an
 * open one. `fields` is a Threat document's fields; `target` is what was found.
 * Returns { threat, created }.
 */
async function recordFinding(userId, fields, target, now = new Date()) {
  const owner = ownedThreatFilter(userId).user;
  const fingerprint = fingerprintOf(owner, fields.type, target);

  // an exception of this account's workspace for this category and target
  let notApplied = null;
  const workspaceId = await workspaceIdFor({ userId: owner });
  const exception = workspaceId ? await activeException(workspaceId, fields.type, target, now) : null;
  if (exception) {
    if (rank(fields.severity) <= rank(exception.maxSeverity)) return recordExcepted(owner, fields, fingerprint, exception, now);
    notApplied = `exception ${exception.exceptionId} did not apply: severity ${fields.severity} is above the ${exception.maxSeverity} it covers`;
  }

  const open = await Threat.findOneAndUpdate(
    { user: owner, fingerprint, status: { $in: OPEN }, lastSeenAt: { $gte: new Date(now.getTime() - DEDUP_WINDOW_MS) } },
    { $inc: { occurrences: 1 }, $set: { lastSeenAt: now } },
    { new: true }
  );
  if (open) {
    const severity = higher(open.severity, fields.severity);
    await Threat.updateOne({ _id: open._id }, {
      $set: { severity },
      $push: { timeline: { $each: [{ timestamp: now, event: 'Seen again', details: notApplied || `occurrence ${open.occurrences}` }], $slice: -TIMELINE_KEPT } }
    });
    return { threat: await Threat.findOne({ _id: open._id }), created: false };
  }
  const earlier = (await Threat.find({ user: owner, fingerprint }).lean())
    .sort((a, b) => new Date(b.lastSeenAt || b.createdAt || 0) - new Date(a.lastSeenAt || a.createdAt || 0))[0];
  const threat = new Threat({
    ...fields,
    threatId: fields.threatId || `threat_${now.getTime()}_${crypto.randomBytes(5).toString('hex')}`,
    user: owner,
    status: 'detected',
    fingerprint,
    occurrences: 1,
    firstSeenAt: now,
    lastSeenAt: now,
    recurrenceOf: earlier ? earlier.threatId : null,
    timeline: [{ timestamp: now, event: earlier ? `Found again after it was ${String(earlier.status).replace(/_/g, ' ')}` : 'Found', details: [earlier ? `earlier finding ${earlier.threatId}` : '', notApplied || ''].filter(Boolean).join('; ') }]
  });
  await threat.save();
  return { threat, created: true };
}

const rank = severity => SEVERITY_ORDER.indexOf(severity);

async function activeException(workspaceId, type, target, now) {
  const found = await FindingException.find({ workspaceId, type, target: normalizeTarget(target), revokedAt: null }).lean();
  return found.filter(e => new Date(e.expiresAt) > now).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
}

/** A covered detection: recorded as `excepted`, counted on the exception. */
async function recordExcepted(owner, fields, fingerprint, exception, now) {
  await FindingException.updateOne({ exceptionId: exception.exceptionId }, { $inc: { matches: 1 }, $set: { lastMatchedAt: now } });
  const repeat = await Threat.findOneAndUpdate(
    { user: owner, fingerprint, status: 'excepted', exceptionId: exception.exceptionId, lastSeenAt: { $gte: new Date(now.getTime() - DEDUP_WINDOW_MS) } },
    { $inc: { occurrences: 1 }, $set: { lastSeenAt: now } },
    { new: true }
  );
  if (repeat) return { threat: repeat, created: false, excepted: true };
  const threat = new Threat({
    ...fields,
    threatId: fields.threatId || `threat_${now.getTime()}_${crypto.randomBytes(5).toString('hex')}`,
    user: owner, status: 'excepted', exceptionId: exception.exceptionId, fingerprint, occurrences: 1, firstSeenAt: now, lastSeenAt: now,
    timeline: [{ timestamp: now, event: 'Found, and covered by an exception', details: `exception ${exception.exceptionId}: ${exception.reason}` }]
  });
  await threat.save();
  return { threat, created: true, excepted: true };
}

const exceptions = workspaceRepository(FindingException);
const DAY_MS = 24 * 60 * 60 * 1000;
const presentException = (e, now = Date.now()) => ({
  exceptionId: e.exceptionId, type: e.type, target: e.target, reason: e.reason, maxSeverity: e.maxSeverity,
  expiresAt: e.expiresAt, createdBy: e.createdBy, createdAt: e.createdAt, matches: e.matches || 0, lastMatchedAt: e.lastMatchedAt || null,
  state: e.revokedAt ? 'revoked' : new Date(e.expiresAt) <= now ? 'expired' : 'active', revokedAt: e.revokedAt || null
});

/** Make an exception: a category and target, a reason, an expiry of 1 to 90 days, and the highest severity it covers. */
async function createException(principal, body = {}, req = null) {
  const type = typeof body.type === 'string' ? body.type.trim() : '';
  const target = normalizeTarget(body.target);
  const reason = typeof body.reason === 'string' ? body.reason.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 500) : '';
  const days = Number(body.expiresInDays);
  const maxSeverity = body.maxSeverity || 'medium';
  if (!/^[a-z_]{2,64}$/.test(type)) throw new FindingError(400, 'EXCEPTION_INVALID', 'type is the finding category, such as phishing.');
  if (!target || target.length > 512) throw new FindingError(400, 'EXCEPTION_INVALID', 'target is an address, domain, hash or IP.');
  if (reason.length < 3) throw new FindingError(400, 'EXCEPTION_INVALID', 'A reason is required.');
  if (!Number.isInteger(days) || days < 1 || days > FindingException.MAX_DAYS) throw new FindingError(400, 'EXCEPTION_INVALID', `expiresInDays is 1 to ${FindingException.MAX_DAYS}.`);
  if (!FindingException.SEVERITIES.includes(maxSeverity)) throw new FindingError(400, 'EXCEPTION_INVALID', `maxSeverity is one of ${FindingException.SEVERITIES.join(', ')}.`);
  const now = new Date();
  const created = await exceptions.create(principal, {
    exceptionId: crypto.randomUUID(), type, target, reason, maxSeverity, expiresAt: new Date(now.getTime() + days * DAY_MS), matches: 0, createdAt: now
  });
  await audit.record({ principal, action: 'finding.exception_create', resource: `exception:${created.exceptionId}`, details: { type, target, reason, maxSeverity, days }, req });
  return presentException(created);
}

/** Make an exception from a finding of the account, for its category and target. */
async function exceptionFromFinding(principal, threatId, body = {}, req = null) {
  const threat = await Threat.findOne(ownedThreatFilter(principal.userId, threatId));
  if (!threat) throw new FindingError(404, 'FINDING_NOT_FOUND', 'Finding not found');
  const target = (threat.source && (threat.source.url || threat.source.domain)) || body.target;
  return createException(principal, { ...body, type: threat.type, target, maxSeverity: body.maxSeverity || threat.severity }, req);
}

async function listExceptions(principal) {
  const rows = await exceptions.find(principal, {}, { limit: 200, sort: { createdAt: -1 } });
  return { exceptions: rows.map(e => presentException(e)) };
}

/** End an exception now. It stays as the record of what was excepted. */
async function revokeException(principal, exceptionId, req = null) {
  const found = await exceptions.findOne(principal, { exceptionId: String(exceptionId) });
  if (!found) throw new FindingError(404, 'EXCEPTION_NOT_FOUND', 'Exception not found');
  if (found.revokedAt) return presentException(found);
  const now = new Date();
  await exceptions.updateById(principal, found._id, { revokedAt: now, revokedBy: String(principal.userId) });
  await audit.record({ principal, action: 'finding.exception_revoke', resource: `exception:${found.exceptionId}`, details: { type: found.type, target: found.target, matches: found.matches || 0 }, req });
  return presentException({ ...(found.toObject ? found.toObject() : found), revokedAt: now });
}

// What a finding means and what to do next, by category (shown with each finding).
const GUIDANCE = {
  phishing: { why: 'A page that imitates a sign-in or payment page to collect what is typed into it.', next: 'Do not enter anything there. If someone already did, change that password and sign out other sessions.' },
  malware: { why: 'A file or page associated with malicious software.', next: 'Do not open the file. Scan the computer that fetched it, and block the address if it recurs.' },
  suspicious_url: { why: 'An address with several traits common to attacks, not a confirmed one.', next: 'Check where the link came from before opening it; block it if it is not expected.' },
  network_intrusion: { why: 'Traffic that looks like an attempt to reach this device without permission.', next: 'Check which program made the connection and whether the device is up to date.' }
};
function guidanceOf(threat) {
  const g = GUIDANCE[threat.type] || { why: 'Something a detector rated as risky.', next: 'Review what was found and decide whether it is expected.' };
  const next = threat.status === 'excepted' ? 'Covered by an exception; it is recorded but not raised. Revoke the exception to raise it again.'
    : CLOSED.includes(threat.status) ? 'Closed. Reopen it if it happens again or the decision was wrong.' : g.next;
  return { whyItMatters: g.why, nextStep: next, occurrences: threat.occurrences || 1 };
}

/** Move a finding of the account through its workflow. */
async function transition(principal, threatId, action, note, req = null) {
  const rule = TRANSITIONS[action];
  if (!rule) throw new FindingError(400, 'ACTION_INVALID', `action must be one of: ${Object.keys(TRANSITIONS).join(', ')}`);
  const filter = ownedThreatFilter(principal.userId, threatId);
  const current = await Threat.findOne(filter);
  if (!current) throw new FindingError(404, 'FINDING_NOT_FOUND', 'Finding not found');
  const text = typeof note === 'string' ? note.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 1000) : '';
  const now = new Date();
  const set = { status: rule.to };
  if (action === 'investigate') { set['analysis.analyst_assigned'] = principal.userId; set['analysis.analysis_started'] = now; }
  if (action === 'resolve' || action === 'false_positive') set['analysis.analysis_completed'] = now;
  // the state is checked and changed in one step: two people cannot both move it from the same state
  const updated = await Threat.findOneAndUpdate(
    { ...filter, status: { $in: rule.from } },
    { $set: set, $push: { timeline: { $each: [{ timestamp: now, event: `${current.status} → ${rule.to}`, details: text, user: principal.userId }], $slice: -TIMELINE_KEPT } } },
    { new: true }
  );
  if (!updated) throw new FindingError(409, 'TRANSITION_NOT_ALLOWED', `A finding that is ${current.status} cannot be moved by "${action}".`);
  await audit.record({ principal, action: 'finding.state_change', resource: `finding:${updated.threatId}`, details: { from: current.status, to: rule.to, action, severity: updated.severity, note: text || null }, req });
  return updated;
}

module.exports = {
  recordFinding, transition, normalizeTarget, fingerprintOf, FindingError, TRANSITIONS, OPEN, CLOSED, DEDUP_WINDOW_MS,
  createException, exceptionFromFinding, listExceptions, revokeException, guidanceOf
};
