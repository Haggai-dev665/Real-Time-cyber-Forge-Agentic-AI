/**
 * Vector Memory Routes
 * Lightweight, self-contained vector store for the desktop's local-first memory
 * sync. Uses the SAME deterministic feature-hashing embedding (FNV-1a → DIM
 * buckets, L2-normalized) as the Rust client, so memories stay comparable.
 * Stored in-process (no external vector DB / embedding model required); can be
 * upgraded to Pinecone via services/vectorDatabase.js when PINECONE_API_KEY set.
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

const DIM = 128;
const MAX = 5000;
const store = []; // [{ id, userId, text, kind, url, category, risk, ts, emb }]

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
  for (let i = 0; i < DIM; i++) s += a[i] * b[i];
  return s;
}

// Save a memory
router.post('/save', (req, res) => {
  try {
    const { userId, id, text, kind, url, category, risk, ts } = req.body;
    if (!text) return res.status(400).json({ success: false, error: 'text is required' });
    const mem = {
      id: id || 'm' + Date.now() + '-' + fnv1a(text).toString(16),
      userId: userId || null,
      text,
      kind: kind || 'episodic',
      url: url || null,
      category: category || null,
      risk: risk != null ? risk : null,
      ts: ts || Math.floor(Date.now() / 1000),
      emb: embed(text),
    };
    const ix = store.findIndex((m) => m.id === mem.id);
    if (ix >= 0) store[ix] = mem;
    else store.push(mem);
    if (store.length > MAX) store.splice(0, store.length - MAX);
    res.json({ success: true, id: mem.id, total: store.length });
  } catch (e) {
    logger.error('memory save failed:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Semantic search
router.post('/search', (req, res) => {
  try {
    const { query, userId, topK } = req.body;
    if (!query) return res.status(400).json({ success: false, error: 'query is required' });
    const q = embed(query);
    const pool = userId ? store.filter((m) => !m.userId || m.userId === userId) : store;
    const results = pool
      .map((m) => ({ m, s: cosine(q, m.emb) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, topK || 5)
      .filter((x) => x.s > 0.02)
      .map((x) => ({
        id: x.m.id, text: x.m.text, kind: x.m.kind, url: x.m.url,
        category: x.m.category, risk: x.m.risk, ts: x.m.ts,
        score: Math.round(x.s * 1000) / 1000,
      }));
    res.json({ success: true, data: { results } });
  } catch (e) {
    logger.error('memory search failed:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// List recent memories + counts
router.get('/', (req, res) => {
  try {
    const { userId, limit } = req.query;
    const pool = userId ? store.filter((m) => !m.userId || m.userId === userId) : store;
    const lim = parseInt(limit, 10) || 40;
    const recent = pool
      .slice(-lim)
      .reverse()
      .map((m) => ({ id: m.id, text: m.text, kind: m.kind, url: m.url, category: m.category, risk: m.risk, ts: m.ts }));
    const byKind = pool.reduce((acc, m) => {
      const k = m.kind || 'episodic';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    res.json({
      success: true,
      data: {
        total: pool.length, dim: DIM,
        episodic: byKind.episodic || 0, semantic: byKind.semantic || 0, procedural: byKind.procedural || 0,
        memories: recent,
      },
    });
  } catch (e) {
    logger.error('memory list failed:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
