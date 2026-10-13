/**
 * Realtime Bus — one transport-agnostic event hub for live updates.
 *
 * Anywhere in the app calls `realtimeBus.emit(type, data)` and the event fans
 * out to BOTH transports:
 *   • the in-process EventEmitter (`bus`) that the SSE endpoint (`routes/stream`)
 *     streams to connected desktop/web clients, and
 *   • the legacy WebSocket service (`services/websocket`) so any socket
 *     clients stay in sync too.
 *
 * Emit sites never need to know which transport is connected. They do decide
 * who may see an event, through its type and its owner (see VISIBILITY).
 */

const crypto = require('crypto');
const { EventEmitter } = require('events');
const logger = require('../utils/logger');

// The legacy WebSocket manager is optional — wrap in try/catch so the bus still
// works if it ever fails to load (the SSE path is fully independent). It exposes
// `wsManager.broadcastThreat`, which lets existing `ws` clients see threats too.
let wsManager = null;
try {
  ({ wsManager } = require('./websocket'));
} catch (_) {
  wsManager = null;
}

const bus = new EventEmitter();
// Each SSE client adds one listener; there can be many. 0 = unlimited.
bus.setMaxListeners(0);

/**
 * Who may receive an event:
 *   public_intelligence  anyone connected, signed in or not
 *   authenticated        any signed-in subscriber; carries no account's data
 *   workspace            only the account named in `data.userId`
 *
 * A type that is not listed here is `workspace`. That is deliberate: an event
 * nobody classified is private, and a private event with no owner is delivered
 * to nobody rather than to everybody.
 */
const VISIBILITY = {
  'metrics:update': 'authenticated',
};

// Recent events are kept briefly so a client that reconnects can be sent what it
// missed, once, instead of losing alerts or receiving them twice.
const REPLAY_WINDOW_MS = 2 * 60 * 1000;
const REPLAY_LIMIT = 200;
const recent = [];

// IDs are only comparable within one run of the process, so each carries the run.
const run = crypto.randomBytes(4).toString('hex');
let sequence = 0;
const warned = new Set();

// type -> legacy WebSocket forwarder (keeps existing `ws` clients in sync where
// an equivalent broadcast exists; SSE carries every type regardless).
const SOCKET_FORWARD = {
  'threat:new': (d) => wsManager?.broadcastThreat?.(d),
  'threat:update': (d) => wsManager?.broadcastThreat?.(d),
};

/**
 * Publish a realtime event.
 * @param {string} type  e.g. 'threat:new', 'scan:update', 'alert:new'
 * @param {object} data  the payload; `userId` names the owning account
 * @returns {{id:string, type:string, data:any, ts:number, visibility:string, owner:string|null}|null}
 *          the envelope that was sent, or null when the event had no audience
 */
function emit(type, data) {
  const visibility = VISIBILITY[type] || 'workspace';
  const owner = data && data.userId != null ? String(data.userId) : null;

  if (visibility === 'workspace' && !owner) {
    if (!warned.has(type)) {
      warned.add(type);
      logger.warn(`Realtime event '${type}' has no owner and was not delivered`);
    }
    return null;
  }

  const evt = { id: `${run}-${++sequence}`, type, data, ts: Date.now(), visibility, owner: visibility === 'workspace' ? owner : null };
  recent.push(evt);
  while (recent.length > REPLAY_LIMIT || (recent.length && evt.ts - recent[0].ts > REPLAY_WINDOW_MS)) recent.shift();

  // SSE subscribers
  bus.emit('event', evt);
  // WebSocket subscribers (best-effort, never throws into the caller)
  try {
    SOCKET_FORWARD[type]?.(data);
  } catch (_) {
    /* ignore transport errors */
  }
  return evt;
}

/**
 * The one delivery rule, used by every transport.
 * @param {object} evt         an envelope from `emit`
 * @param {object|null} subscriber  `{ userId, expiresAt }`, or null for a guest
 */
function canReceive(evt, subscriber, now = Date.now()) {
  if (!evt || !evt.visibility) return false;
  if (evt.visibility === 'public_intelligence') return true;
  const signedIn = Boolean(subscriber && subscriber.userId) && now < subscriber.expiresAt;
  if (!signedIn) return false;
  if (evt.visibility === 'authenticated') return true;
  return evt.visibility === 'workspace' && evt.owner === String(subscriber.userId);
}

/** Events published after `lastEventId` that are still inside the replay window. */
function eventsAfter(lastEventId, now = Date.now()) {
  if (typeof lastEventId !== 'string') return [];
  const [seenRun, seenSequence] = lastEventId.split('-');
  const after = Number(seenSequence);
  if (seenRun !== run || !Number.isInteger(after)) return [];
  return recent.filter(evt => Number(evt.id.split('-')[1]) > after && now - evt.ts <= REPLAY_WINDOW_MS);
}

module.exports = { bus, emit, canReceive, eventsAfter, VISIBILITY, REPLAY_WINDOW_MS };
