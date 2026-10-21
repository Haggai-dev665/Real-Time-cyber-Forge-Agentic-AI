/**
 * Synced memory (SEC-07, F12): what a desktop copies to the account when the
 * user turned Sync on. Uses the same deterministic feature-hashing embedding
 * (FNV-1a → DIM buckets, L2-normalized) as the Rust client, so memories stay
 * comparable.
 *
 * Kept in the database in the account's workspace (models/SyncedMemory.js),
 * through the workspace repository: a search or list covers this workspace's
 * memories only. (Before, the store was an array in the web process, lost at
 * every restart, and entries saved without an account were shown to every
 * account.)
 */

const express = require('express');
const { verifiedUser } = require('../middleware/verifiedUser');
const { requireWorkspace } = require('../middleware/workspace');
const SyncedMemory = require('../models/SyncedMemory');
const { workspaceRepository } = require('../repositories/workspaceRepository');
const logger = require('../utils/logger');

const router = express.Router();

// Every route below requires a signed-in user and takes the user's identity
// and workspace from the session rather than from the request.
router.use(verifiedUser, requireWorkspace);

const memories = workspaceRepository(SyncedMemory);
const DIM = 128;
const KINDS = ['episodic', 'semantic', 'procedural'];

function fnv1a(s) {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
function tokenize(t) {
  return String(t || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((x) => x.length >= 2);
}
function embed(text) {
  const v = new Array(DIM).fill(0);
  for (const tok of tokenize(text)) v[fnv1a(tok) % DIM] += 1;
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  if (n > 0) for (let i = 0; i < DIM; i++) v[i] /= n;
  return v;
}
function cosine(a, b) {
  let s = 0;
  for (let i = 0; i < DIM; i++) s += (a[i] || 0) * (b[i] || 0);
  return s;
}
const present = m => ({ id: m.memoryId, text: m.text, kind: m.kind, url: m.url, category: m.category, risk: m.risk, ts: m.ts });

// Save a memory (an ID names a memory only within its own workspace)
router.post('/save', async (req, res) => {
  try {
    const { id, text, kind, url, category, risk, ts } = req.body || {};
    if (!text || typeof text !== 'string') return res.status(400).json({ success: false, error: 'text is required' });
    const memoryId = String(id || `m${Date.now()}-${fnv1a(text).toString(16)}`).slice(0, 128);
    const fields = {
      text: text.slice(0, 4000),
      kind: KINDS.includes(kind) ? kind : 'episodic',
      url: typeof url === 'string' ? url.slice(0, 2048) : null,
      category: typeof category === 'string' ? category.slice(0, 64) : null,
      risk: Number.isFinite(risk) ? Math.max(0, Math.min(100, risk)) : null,
      ts: Number.isFinite(ts) ? ts : Math.floor(Date.now() / 1000),
      emb: embed(text),
      savedAt: new Date()
    };
    const upsert = () => SyncedMemory.updateOne(
      { workspaceId: req.user.workspaceId, memoryId },
      { $set: fields, $setOnInsert: { createdBy: String(req.user.userId) } },
      { upsert: true }
    );
    // two first saves of one ID at once: one inserts, the other's insert hits
    // the unique index; trying again updates the entry the first one made
    await upsert().catch(error => { if (error && error.code === 11000) return upsert(); throw error; });
    const total = await memories.count(req.user, {});
    if (total > SyncedMemory.MAX_PER_WORKSPACE) {
      const oldest = await memories.find(req.user, {}, { limit: total - SyncedMemory.MAX_PER_WORKSPACE, sort: { ts: 1 } });
      for (const m of oldest) await memories.deleteById(req.user, m._id);
    }
    res.json({ success: true, id: memoryId, total: Math.min(total, SyncedMemory.MAX_PER_WORKSPACE) });
  } catch (e) {
    logger.error('memory save failed:', e);
    res.status(500).json({ success: false, error: 'memory save failed' });
  }
});

// Semantic search over this workspace's memories
router.post('/search', async (req, res) => {
  try {
    const { query, topK } = req.body || {};
    if (!query) return res.status(400).json({ success: false, error: 'query is required' });
    const q = embed(String(query).slice(0, 1000));
    const pool = await memories.find(req.user, {}, { limit: 200, sort: { ts: -1 } });
    const results = pool
      .map((m) => ({ m, s: cosine(q, m.emb) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, Math.min(Math.max(parseInt(topK, 10) || 5, 1), 50))
      .filter((x) => x.s > 0.02)
      .map((x) => ({ ...present(x.m), score: Math.round(x.s * 1000) / 1000 }));
    res.json({ success: true, data: { results } });
  } catch (e) {
    logger.error('memory search failed:', e);
    res.status(500).json({ success: false, error: 'memory search failed' });
  }
});

// Recent memories + counts, for this workspace
router.get('/', async (req, res) => {
  try {
    const lim = Math.min(Math.max(parseInt(req.query.limit, 10) || 40, 1), 200);
    const [recent, total, episodic, semantic, procedural] = await Promise.all([
      memories.find(req.user, {}, { limit: lim, sort: { ts: -1 } }),
      memories.count(req.user, {}),
      ...KINDS.map(kind => memories.count(req.user, { kind }))
    ]);
    res.json({
      success: true,
      data: { total, dim: DIM, episodic, semantic, procedural, memories: recent.map(present), retentionDays: SyncedMemory.RETENTION_DAYS }
    });
  } catch (e) {
    logger.error('memory list failed:', e);
    res.status(500).json({ success: false, error: 'memory list failed' });
  }
});

module.exports = router;
