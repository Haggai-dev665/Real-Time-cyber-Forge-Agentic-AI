/**
 * Network Capture Routes
 *
 * Receives full-payload network flows captured by the mobile VPN engine
 * (Android VpnService + on-device TLS MITM) for the signed-in user, fans them
 * out to that user's other connected clients (desktop + mobile) over WebSocket,
 * and persists them best-effort to Appwrite so they are readable across devices.
 *
 * A small per-user in-memory ring buffer is the always-available source for GET,
 * so the desktop and mobile apps share captures even before/independent of the
 * Appwrite collection being provisioned. NO mock data — an empty buffer returns
 * an honest empty list.
 */

const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const { appwriteService } = require('../services/appwriteService');
const { APPWRITE_CONFIG } = require('../config/appwrite.config');
const { wsManager } = require('../services/websocket');
const logger = require('../utils/logger');

// Per-user ring buffer: userId -> array of capture records (newest first).
const RING = new Map();
const RING_MAX = 1000;

function pushRing(userId, records) {
  const cur = RING.get(userId) || [];
  const next = records.concat(cur);
  if (next.length > RING_MAX) next.length = RING_MAX;
  RING.set(userId, next);
}

function requireUser(req, res) {
  const userId = req.user && req.user.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Sign in to sync network captures.' });
    return null;
  }
  return String(userId);
}

// Normalise an incoming flow into the stored record shape.
function toRecord(f, userId, deviceId) {
  return {
    id: String(f.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    host: f.host || null,
    url: f.url || null,
    method: f.method || null,
    scheme: f.scheme || null,
    ip: f.ip || null,
    port: typeof f.port === 'number' ? f.port : null,
    status: typeof f.status === 'number' ? f.status : null,
    mime: f.mime || null,
    app: f.app || null,
    decrypted: !!f.decrypted,
    flags: Array.isArray(f.flags) ? f.flags.slice(0, 12) : [],
    req_bytes: Number(f.req_bytes || f.reqBytes || 0),
    resp_bytes: Number(f.resp_bytes || f.respBytes || 0),
    duration_ms: Number(f.duration_ms || f.durationMs || 0),
    device_id: deviceId,
    user_id: userId,
    created_at:
      typeof f.created_at === 'number'
        ? new Date(f.created_at).toISOString()
        : f.created_at || new Date().toISOString()
  };
}

// ──────────────────────────────────────────────────────
// POST /api/network-capture/ingest
// Mobile VPN engine pushes a batch of captured flows.
// ──────────────────────────────────────────────────────
router.post('/ingest', optionalAuth, async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  try {
    const { flows, deviceId } = req.body || {};
    if (!Array.isArray(flows)) {
      return res.status(400).json({ success: false, error: 'flows array is required' });
    }

    const device = (deviceId || 'mobile').toString().substring(0, 64);
    const records = flows.slice(0, 500).map((f) => toRecord(f, userId, device));

    // Always-available shared store for cross-device reads.
    pushRing(userId, records.slice().reverse()); // keep newest-first ordering

    // Live fan-out to this user's connected clients (desktop dashboards + mobile).
    const summary = {
      type: 'network_capture',
      data: { userId, deviceId: device, count: records.length, flows: records.slice(0, 50) }
    };
    try { wsManager.broadcastToDesktops(summary); } catch (_) {}
    try { wsManager.broadcastToMobiles(summary); } catch (_) {}

    // Best-effort durable persistence (skipped cleanly if the collection isn't
    // provisioned — mirrors the browser-intelligence route's behaviour).
    let persisted = 0;
    if (APPWRITE_CONFIG.collections.networkCaptures) {
      for (const r of records) {
        try {
          await appwriteService.createDocumentWithPermissionFallback(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.networkCaptures,
            r.id,
            r,
            [],
            'network capture'
          );
          persisted += 1;
        } catch (e) {
          // Stop hammering Appwrite if the collection is missing/misconfigured.
          logger.warn('Network capture persistence skipped:', e.message);
          break;
        }
      }
    }

    res.json({ success: true, data: { stored: records.length, persisted } });
  } catch (error) {
    logger.error('❌ Network capture ingest error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ──────────────────────────────────────────────────────
// GET /api/network-capture
// Returns the signed-in user's captured flows (any device).
// ──────────────────────────────────────────────────────
router.get('/', optionalAuth, async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const host = (req.query.host || '').toString().toLowerCase();

    let flows = RING.get(userId) || [];
    if (host) flows = flows.filter((f) => (f.host || '').toLowerCase().includes(host));
    flows = flows.slice(0, limit);

    res.json({ success: true, data: { flows, count: flows.length } });
  } catch (error) {
    logger.error('❌ Network capture fetch error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
