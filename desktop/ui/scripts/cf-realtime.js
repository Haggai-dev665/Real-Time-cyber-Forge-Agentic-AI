/**
 * CyberForge Realtime — one live SSE connection shared by every page.
 *
 * Connects to the backend `/api/stream` (Server-Sent Events) and re-broadcasts
 * each event as a DOM CustomEvent on `window`, so any page can react live
 * instead of polling:
 *
 *   window.addEventListener('cf:threat',  e => …)   // e.detail = threat
 *   window.addEventListener('cf:scan',    e => …)   // e.detail = scan result
 *   window.addEventListener('cf:alert',   e => …)   // e.detail = alert
 *   window.addEventListener('cf:agent',   e => …)   // e.detail = activity item
 *   window.addEventListener('cf:metrics', e => …)   // e.detail = metrics
 *   window.addEventListener('cf:event',   e => …)   // e.detail = {type,data,ts}
 *   window.addEventListener('cf:stream-status', e => …) // {connected:boolean}
 *
 * Depends on `window.CF` (cyberforge-shared.js) for API_BASE + getToken().
 * Auto-reconnects with capped exponential backoff; re-reads the auth token on
 * every (re)connect so a fresh login is picked up without a page reload.
 */
(function () {
  const CF = window.CF || {};
  const API_BASE = CF.API_BASE || 'https://cyberforge-ddd97655464f.herokuapp.com';

  // backend event type -> CustomEvent name
  const EVENT_MAP = {
    'threat:new': 'cf:threat',
    'threat:update': 'cf:threat',
    'scan:update': 'cf:scan',
    'alert:new': 'cf:alert',
    'agent:activity': 'cf:agent',
    'metrics:update': 'cf:metrics',
  };

  let es = null;
  let stopped = false;
  let retry = 0;
  let reconnectTimer = null;
  let connected = false;

  function setStatus(isUp) {
    if (connected === isUp) return;
    connected = isUp;
    window.dispatchEvent(new CustomEvent('cf:stream-status', { detail: { connected: isUp } }));
  }

  function dispatch(evt) {
    if (!evt || !evt.type) return;
    // generic firehose
    window.dispatchEvent(new CustomEvent('cf:event', { detail: evt }));
    // typed, ergonomic event carrying just the payload
    const name = EVENT_MAP[evt.type];
    if (name) window.dispatchEvent(new CustomEvent(name, { detail: evt.data }));
  }

  function handleFrame(e) {
    try {
      dispatch(JSON.parse(e.data));
    } catch (_) {
      /* ignore malformed frame */
    }
  }

  async function getToken() {
    try {
      if (typeof CF.getToken === 'function') return await CF.getToken();
    } catch (_) {}
    try {
      return localStorage.getItem('cf_token') || null;
    } catch (_) {
      return null;
    }
  }

  async function connect() {
    if (stopped || typeof EventSource === 'undefined') return;
    clearTimeout(reconnectTimer);

    const token = await getToken();
    const url = `${API_BASE}/api/stream` + (token ? `?token=${encodeURIComponent(token)}` : '');

    try {
      es = new EventSource(url);
    } catch (_) {
      scheduleReconnect();
      return;
    }

    es.onopen = () => {
      retry = 0;
      setStatus(true);
    };

    // The server tags each frame with `event: <type>`, so register named
    // listeners; also keep onmessage for any untyped frames.
    es.onmessage = handleFrame;
    es.addEventListener('connected', () => setStatus(true));
    Object.keys(EVENT_MAP).forEach((type) => es.addEventListener(type, handleFrame));

    es.onerror = () => {
      setStatus(false);
      // Manage reconnection ourselves (so we re-read the token + use backoff)
      // instead of EventSource's built-in retry with a stale URL.
      try { es.close(); } catch (_) {}
      es = null;
      scheduleReconnect();
    };
  }

  function scheduleReconnect() {
    if (stopped) return;
    retry = Math.min(retry + 1, 6);
    const delay = Math.min(1000 * Math.pow(2, retry), 30000); // cap 30s
    reconnectTimer = setTimeout(connect, delay);
  }

  const realtime = {
    start() {
      stopped = false;
      if (!es) connect();
    },
    stop() {
      stopped = true;
      clearTimeout(reconnectTimer);
      if (es) { try { es.close(); } catch (_) {} es = null; }
      setStatus(false);
    },
    /** convenience: realtime.on('cf:threat', handler) -> returns an unsubscribe */
    on(name, handler) {
      window.addEventListener(name, handler);
      return () => window.removeEventListener(name, handler);
    },
    get connected() { return connected; },
  };

  // expose
  window.CF = window.CF || {};
  window.CF.realtime = realtime;
  window.CFRealtime = realtime;

  // auto-start once the DOM is ready
  if (document.readyState !== 'loading') realtime.start();
  else document.addEventListener('DOMContentLoaded', () => realtime.start());
})();
