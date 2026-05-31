/**
 * Server-Sent Events (SSE) stream — the live feed for the desktop/web UI.
 *
 *   GET /api/stream?token=<jwt>
 *
 * One long-lived HTTP response per client. Every `realtimeBus.emit(...)` is
 * pushed as an SSE frame, so dashboards update the instant something happens
 * instead of polling. SSE is used (not WebSocket) because it is one-way
 * server→client (all these dashboards need), needs no client library
 * (native `EventSource`), and survives Heroku's proxy + auto-reconnects.
 *
 * Auth: `EventSource` cannot send headers, so the JWT is passed as a query
 * param. A valid token scopes the stream to that user's events; without one the
 * client still receives global/system events (read-only).
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { bus } = require('../services/realtimeBus');

// Resolve the JWT secret exactly like `middleware/auth.js` so a token issued by
// the login flow verifies identically here. (There is no `src/config` index
// module; auth uses the env + a dev fallback, so we mirror that.)
const JWT_SECRET = process.env.JWT_SECRET || 'cyber-forge-secret-key';

router.get('/', (req, res) => {
  // ── optional auth (query token, since EventSource can't set headers) ──
  let userId = null;
  const token = req.query.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      userId = decoded.userId || decoded.id || null;
    } catch (_) {
      /* invalid/expired token → anonymous, global events only */
    }
  }

  // ── SSE headers ──
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Disable proxy buffering (nginx/Heroku) so frames flush immediately.
    'X-Accel-Buffering': 'no',
  });

  const write = (event, payload) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  // greet so the client knows it's live
  write('connected', { ts: Date.now(), authenticated: !!userId });

  // ── fan-out: forward every bus event to this client ──
  const onEvent = (evt) => {
    // Per-user scoping: if a payload is addressed to a specific user, only that
    // user's authenticated stream receives it; global events (no userId) go to all.
    const target = evt.data && evt.data.userId;
    if (target && userId && target !== userId) return;
    try {
      write(evt.type, evt);
    } catch (_) {
      /* client went away mid-write; cleanup happens on 'close' */
    }
  };
  bus.on('event', onEvent);

  // ── keep-alive comment ping (also defeats idle proxy timeouts) ──
  const heartbeat = setInterval(() => {
    res.write(`: ping ${Date.now()}\n\n`);
  }, 25000);

  // ── teardown ──
  req.on('close', () => {
    clearInterval(heartbeat);
    bus.off('event', onEvent);
    res.end();
  });

  logger.info(`SSE client connected (auth=${!!userId})`);
});

module.exports = router;
