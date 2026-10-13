/**
 * Server-Sent Events (SSE) stream — the live feed for the desktop/web UI.
 *
 *   GET  /api/stream           Authorization: Bearer <session>   (native clients)
 *   GET  /api/stream?ticket=…  a one-time ticket                 (browser EventSource)
 *   POST /api/stream/ticket    Authorization: Bearer <session>   → { ticket }
 *
 * One long-lived HTTP response per client. Every `realtimeBus.emit(...)` is
 * pushed as an SSE frame, so dashboards update the instant something happens
 * instead of polling. SSE is used (not WebSocket) because it is one-way
 * server→client (all these dashboards need), needs no client library
 * (native `EventSource`), and survives Heroku's proxy + auto-reconnects.
 *
 * Auth: a session token never goes in the URL, where proxies and access logs
 * would record it. Clients that can set headers send it there. A browser
 * `EventSource` cannot, so it first exchanges its session for a ticket that
 * works once, for one minute, and only opens a stream. With no credentials the
 * stream is a guest's and carries public events only; credentials that are
 * presented and do not verify are refused, never downgraded to a guest.
 */

const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { verifySessionToken } = require('../services/sessionTokens');
const logger = require('../utils/logger');
const { bus, canReceive, eventsAfter } = require('../services/realtimeBus');

const TICKET_TTL_MS = 60 * 1000;
const MAX_TICKETS = 5000;
const RETRY_MS = 5000;
const HEARTBEAT_MS = 25000;
const REVALIDATE_MS = 5 * 60 * 1000;
// A subscriber that stops reading is dropped once this much is queued for it.
const MAX_BUFFERED_BYTES = 1024 * 1024;

const tickets = new Map(); // ticket -> { userId, sessionExpiresAt, ticketExpiresAt }
const streams = new Set(); // open signed-in streams: { userId, end(reason) }

function sessionFrom(header) {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  const decoded = verifySessionToken(header.slice(7));
  return { userId: decoded.userId, expiresAt: decoded.exp * 1000 };
}

function redeemTicket(ticket, now = Date.now()) {
  const entry = typeof ticket === 'string' ? tickets.get(ticket) : null;
  if (!entry) return null;
  tickets.delete(ticket); // one use, whether or not it is still in date
  if (now >= entry.ticketExpiresAt || now >= entry.sessionExpiresAt) return null;
  return { userId: entry.userId, expiresAt: entry.sessionExpiresAt };
}

/**
 * Who is subscribing. Returns `{ subscriber }` (null for a guest) or
 * `{ refused: reason }` when credentials were presented and did not verify.
 */
function identify(req) {
  if (req.query.token !== undefined) {
    return { refused: 'Send the session in the Authorization header, or use a stream ticket' };
  }
  if (req.headers.authorization) {
    try {
      const subscriber = sessionFrom(req.headers.authorization);
      return subscriber ? { subscriber } : { refused: 'Unsupported authorization scheme' };
    } catch (_) {
      return { refused: 'The session is not valid' };
    }
  }
  if (req.query.ticket !== undefined) {
    const subscriber = redeemTicket(req.query.ticket);
    return subscriber ? { subscriber } : { refused: 'The stream ticket is not valid' };
  }
  return { subscriber: null };
}

/** End every open stream of one account, for example when it signs out. */
function closeStreamsFor(userId, reason = 'revoked') {
  for (const stream of [...streams]) {
    if (stream.userId === String(userId)) stream.end(reason);
  }
}

/** End the streams of accounts that no longer exist or may no longer sign in. */
async function revalidateStreams() {
  const owners = [...new Set([...streams].map(stream => stream.userId))];
  for (const userId of owners) {
    let user;
    try {
      user = await User.findById(userId);
    } catch (_) {
      continue; // a database error is not evidence that the account was revoked
    }
    const locked = user && typeof user.isLocked === 'function' ? user.isLocked() : Boolean(user && user.isLocked);
    if (!user || user.isActive === false || locked) closeStreamsFor(userId, 'revoked');
  }
}

const revalidation = setInterval(() => { revalidateStreams().catch(() => {}); }, REVALIDATE_MS);
if (revalidation.unref) revalidation.unref();

// Exchange a session for a one-time ticket that opens a single stream.
router.post('/ticket', auth, (req, res) => {
  const session = sessionFrom(req.headers.authorization);
  const now = Date.now();
  for (const [ticket, entry] of tickets) {
    if (now >= entry.ticketExpiresAt) tickets.delete(ticket);
  }
  if (tickets.size >= MAX_TICKETS) {
    return res.status(503).json({ success: false, message: 'Too many pending stream tickets; try again shortly' });
  }
  const ticket = crypto.randomBytes(32).toString('base64url');
  tickets.set(ticket, { userId: session.userId, sessionExpiresAt: session.expiresAt, ticketExpiresAt: now + TICKET_TTL_MS });
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, ticket, expiresIn: TICKET_TTL_MS / 1000 });
});

router.get('/', (req, res) => {
  const { subscriber, refused } = identify(req);
  if (refused) {
    return res.status(401).json({ success: false, message: refused });
  }

  // ── SSE headers ──
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Disable proxy buffering (nginx/Heroku) so frames flush immediately.
    'X-Accel-Buffering': 'no',
  });

  let open = true;
  let heartbeat = null;
  let expiry = null;
  let stream = null;

  const end = (reason) => {
    if (!open) return;
    open = false;
    clearInterval(heartbeat);
    clearTimeout(expiry);
    bus.off('event', onEvent);
    if (stream) streams.delete(stream);
    try {
      if (reason) res.write(`event: closed\ndata: ${JSON.stringify({ reason })}\n\n`);
    } catch (_) { /* already gone */ }
    res.end();
  };

  const write = (frame) => {
    if (!open) return;
    if (res.writableLength > MAX_BUFFERED_BYTES) return end(null); // not reading; drop it
    try {
      res.write(frame);
      // The compression middleware holds output back until it is flushed.
      if (typeof res.flush === 'function') res.flush();
    } catch (_) {
      /* client went away mid-write; cleanup happens on 'close' */
    }
  };

  const send = (evt) => write(`id: ${evt.id}\nevent: ${evt.type}\ndata: ${JSON.stringify(evt)}\n\n`);

  // ── fan-out: forward the events this subscriber may see ──
  function onEvent(evt) {
    if (canReceive(evt, subscriber)) send(evt);
  }

  // tell the client how long to wait before reconnecting, then greet it
  write(`retry: ${RETRY_MS}\n\n`);
  write(`event: connected\ndata: ${JSON.stringify({ ts: Date.now(), authenticated: Boolean(subscriber) })}\n\n`);

  // ── a reconnecting client is sent what it missed, once, and only its own ──
  // (EventSource sends the header itself; a client that reconnects by hand
  // passes the same ID as `lastEventId`.)
  const lastSeen = req.headers['last-event-id'] || req.query.lastEventId;
  for (const evt of eventsAfter(lastSeen)) {
    if (canReceive(evt, subscriber)) send(evt);
  }

  bus.on('event', onEvent);

  // ── keep-alive comment ping (also defeats idle proxy timeouts) ──
  heartbeat = setInterval(() => write(`: ping ${Date.now()}\n\n`), HEARTBEAT_MS);

  if (subscriber) {
    stream = { userId: String(subscriber.userId), end };
    streams.add(stream);
    // A session that runs out ends the stream; the client signs in again.
    expiry = setTimeout(() => end('expired'), Math.max(0, subscriber.expiresAt - Date.now()));
    if (expiry.unref) expiry.unref();
  }

  // ── teardown ──
  req.on('close', () => end(null));

  logger.info(`SSE client connected (auth=${Boolean(subscriber)})`);
});

module.exports = router;
module.exports.closeStreamsFor = closeStreamsFor;
module.exports.revalidateStreams = revalidateStreams;
