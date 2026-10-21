/**
 * Audit integrity (SEC-08): signed checkpoints over the audit trail, and a check
 * of the trail against them.
 *
 * A checkpoint covers the events of one workspace (or the platform) recorded
 * since the previous checkpoint: their count and a root hash over each event's
 * ID and content hash, in order. It names the previous checkpoint and its root
 * hash, and is signed with AUDIT_SIGNING_KEY (services/integrityKey.js).
 *
 * The check recomputes every event's content hash and every checkpoint's root
 * hash and signature. It finds an event that was changed, removed or added
 * after a checkpoint covered it, made by anyone without the server's key. It
 * does not prevent such a change, it cannot say which event a removal took,
 * and events newer than the last checkpoint are not covered yet (it says how
 * many). Events recorded before content hashes existed are checked by ID only.
 */
const crypto = require('crypto');
const AuditEvent = require('../models/AuditEvent');
const AuditCheckpoint = require('../models/AuditCheckpoint');
const { contentHashOf } = require('./auditLogService');
const { integritySigner, verifySignature } = require('./integrityKey');
const { sha256 } = require('../utils/canonical');
const logger = require('../utils/logger');

const MAX_PER_CHECKPOINT = 5000;
const SETTLE_MS = 60 * 1000;          // events younger than this wait for the next checkpoint
const DAY_MS = 24 * 60 * 60 * 1000;
const CHECKPOINT_EVERY_MS = 60 * 60 * 1000;

const iso = d => (d ? new Date(d).toISOString() : '-');
const scopeFilter = (scope, workspaceId) => (scope === 'platform' ? { scope: 'platform' } : { scope: 'workspace', workspaceId });
const byTime = (a, b) => (new Date(a.createdAt) - new Date(b.createdAt)) || String(a._id).localeCompare(String(b._id));
const rootOf = events => sha256(events.map(e => `${e._id}:${e.contentHash || 'none'}`).join('\n'));

function message(c) {
  return ['cyberforge-audit-checkpoint-v1', c.checkpointId, c.scope, c.workspaceId ? String(c.workspaceId) : '-', iso(c.from), iso(c.firstAt), iso(c.to),
    String(c.count), c.rootHash, c.previousCheckpointId || '-', c.previousRootHash || '-'].join('\n');
}

async function checkpointsOf(scope, workspaceId) {
  return (await AuditCheckpoint.find(scopeFilter(scope, workspaceId)).lean()).sort((a, b) => new Date(a.to) - new Date(b.to));
}

/**
 * Write the next checkpoint for a workspace (scope 'workspace') or the platform,
 * covering the events recorded since the last one. Null when there is nothing
 * new, or no signing key.
 */
async function checkpoint(scope, workspaceId = null, now = Date.now()) {
  const signer = integritySigner();
  if (!signer) return null;
  const chain = await checkpointsOf(scope, workspaceId);
  const last = chain[chain.length - 1] || null;
  const range = { $lte: new Date(now - SETTLE_MS) };
  if (last) range.$gt = new Date(last.to);
  let events = (await AuditEvent.find({ ...scopeFilter(scope, workspaceId), createdAt: range }).lean()).sort(byTime);
  if (!events.length) return null;
  if (events.length > MAX_PER_CHECKPOINT) {
    // end on a whole timestamp, so no event is split across two checkpoints
    const cut = new Date(events[MAX_PER_CHECKPOINT - 1].createdAt).getTime();
    const whole = events.filter(e => new Date(e.createdAt).getTime() < cut);
    events = whole.length ? whole : events.filter(e => new Date(e.createdAt).getTime() === cut);
  }
  const fields = {
    checkpointId: crypto.randomUUID(),
    scope,
    workspaceId: scope === 'platform' ? null : workspaceId,
    from: last ? last.to : null,
    firstAt: events[0].createdAt,
    to: events[events.length - 1].createdAt,
    count: events.length,
    rootHash: rootOf(events),
    previousCheckpointId: last ? last.checkpointId : null,
    previousRootHash: last ? last.rootHash : null,
    keyId: signer.keyId,
    createdAt: new Date(now)
  };
  return AuditCheckpoint.create({ ...fields, signature: signer.sign(message(fields)) });
}

/** Checkpoint the platform and every workspace with events since the last day and a bit. */
async function checkpointAll(now = Date.now()) {
  const recent = await AuditEvent.find({ createdAt: { $gt: new Date(now - 26 * 60 * 60 * 1000) } }).lean();
  const workspaces = [...new Set(recent.filter(e => e.scope === 'workspace' && e.workspaceId).map(e => String(e.workspaceId)))];
  let written = 0;
  if (await checkpoint('platform', null, now)) written += 1;
  for (const workspaceId of workspaces) if (await checkpoint('workspace', workspaceId, now)) written += 1;
  return written;
}

/**
 * Check the trail of a workspace (or the platform) against its checkpoints.
 * A fresh checkpoint is written first, so the answer covers everything up to a
 * minute ago.
 */
async function verify(scope, workspaceId = null, now = Date.now()) {
  const signer = integritySigner();
  if (!signer) {
    return { available: false, reason: 'No signing key is configured (AUDIT_SIGNING_KEY), so no checkpoint is written or checked.' };
  }
  try { await checkpoint(scope, workspaceId, now); } catch (error) { logger.warn(`[audit-integrity] checkpoint failed: ${error.message}`); }

  const chain = await checkpointsOf(scope, workspaceId);
  const events = (await AuditEvent.find(scopeFilter(scope, workspaceId)).lean()).sort(byTime);
  const retentionStart = now - (AuditEvent.RETENTION_DAYS || 90) * DAY_MS;
  const results = [];
  let previous = null;
  for (const c of chain) {
    const from = c.from ? new Date(c.from).getTime() : -Infinity;
    const to = new Date(c.to).getTime();
    const inRange = events.filter(e => { const t = new Date(e.createdAt).getTime(); return t > from && t <= to; });
    const signed = c.keyId === signer.keyId ? verifySignature(signer.publicKey, message(c), c.signature) : null;
    const chained = !previous ? true : c.previousCheckpointId === previous.checkpointId && c.previousRootHash === previous.rootHash;
    const changed = inRange.filter(e => e.contentHash && contentHashOf(e) !== e.contentHash).map(e => String(e._id));
    // events older than the retention period are removed by the database, as intended
    const expired = new Date(c.firstAt).getTime() < retentionStart;
    const rootMatches = rootOf(inRange) === c.rootHash;
    let state = 'intact';
    if (signed === false) state = 'signature_invalid';
    else if (signed === null) state = 'other_key';
    else if (!chained) state = 'chain_broken';
    else if (expired && to < retentionStart) state = 'expired';
    else if (expired) state = 'partly_expired';
    else if (changed.length || !rootMatches || inRange.length !== c.count) state = 'altered';
    results.push({
      checkpointId: c.checkpointId, from: c.from || null, to: c.to, state,
      eventsAtCheckpoint: c.count, eventsNow: inRange.length, changedEventIds: changed.slice(0, 50)
    });
    previous = c;
  }
  const last = chain[chain.length - 1];
  const uncovered = last ? events.filter(e => new Date(e.createdAt) > new Date(last.to)).length : events.length;
  const problems = results.filter(r => !['intact', 'expired', 'partly_expired'].includes(r.state));
  return {
    available: true,
    scope,
    keyId: signer.keyId,
    publicKey: signer.publicKey,
    checkpoints: results.length,
    intact: problems.length === 0,
    problems,
    results: results.slice(-50),
    eventsCovered: results.reduce((n, r) => n + (['intact', 'altered'].includes(r.state) ? r.eventsNow : 0), 0),
    eventsNotYetCovered: uncovered,
    eventsWithoutContentHash: events.filter(e => !e.contentHash).length,
    note: 'A change made after a checkpoint, by anyone without the server\'s signing key, shows here. Removals are counted, not named. Events from the last minute are not covered yet. This detects changes; it does not prevent them.'
  };
}

let timer = null;
function start() {
  if (timer) return;
  timer = setInterval(() => { checkpointAll().catch(error => logger.warn(`[audit-integrity] ${error.message}`)); }, CHECKPOINT_EVERY_MS);
  if (timer.unref) timer.unref();
}
function stop() { if (timer) clearInterval(timer); timer = null; }

module.exports = { checkpoint, checkpointAll, verify, message, rootOf, start, stop, SETTLE_MS, MAX_PER_CHECKPOINT };
