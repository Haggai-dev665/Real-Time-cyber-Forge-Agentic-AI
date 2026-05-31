/**
 * Realtime Bus — one transport-agnostic event hub for live updates.
 *
 * Anywhere in the app calls `realtimeBus.emit(type, data)` and the event fans
 * out to BOTH transports:
 *   • the in-process EventEmitter (`bus`) that the SSE endpoint (`routes/stream`)
 *     streams to every connected desktop/web client, and
 *   • the existing Socket.IO service (`services/websocket`) so any socket
 *     clients stay in sync too.
 *
 * Emit sites never need to know which transport is connected — that keeps the
 * threat/scan/agent code paths decoupled from how the UI happens to listen.
 */

const { EventEmitter } = require('events');

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

// type -> legacy WebSocket forwarder (keeps existing `ws` clients in sync where
// an equivalent broadcast exists; SSE carries every type regardless).
const SOCKET_FORWARD = {
  'threat:new': (d) => wsManager?.broadcastThreat?.(d),
  'threat:update': (d) => wsManager?.broadcastThreat?.(d),
};

/**
 * Publish a realtime event.
 * @param {string} type  e.g. 'threat:new', 'scan:update', 'alert:new'
 * @param {object} data  the payload (may carry a `userId` for per-user scoping)
 * @returns {{type:string, data:any, ts:number}} the envelope that was sent
 */
function emit(type, data) {
  const evt = { type, data, ts: Date.now() };
  // SSE subscribers
  bus.emit('event', evt);
  // Socket.IO subscribers (best-effort, never throws into the caller)
  try {
    SOCKET_FORWARD[type]?.(data);
  } catch (_) {
    /* ignore transport errors */
  }
  return evt;
}

module.exports = { bus, emit };
