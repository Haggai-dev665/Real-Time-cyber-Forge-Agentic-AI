/**
 * CyberForge Realtime — the live feed, for every page.
 *
 * The connection to the backend's `/api/stream` is held by the native layer
 * (src-tauri/src/stream.rs), once for the whole app. This script only listens:
 * it receives each event from the native layer and re-broadcasts it as a DOM
 * CustomEvent on `window`, so any page can react live instead of polling:
 *
 *   window.addEventListener('cf:threat',  e => …)   // e.detail = threat
 *   window.addEventListener('cf:scan',    e => …)   // e.detail = scan result
 *   window.addEventListener('cf:scan-explanation', e => …) // the explanation for a scan, when it arrives after the result
 *   window.addEventListener('cf:alert',   e => …)   // e.detail = alert
 *   window.addEventListener('cf:agent',   e => …)   // e.detail = activity item
 *   window.addEventListener('cf:metrics', e => …)   // e.detail = metrics
 *   window.addEventListener('cf:event',   e => …)   // e.detail = {type,data,ts}
 *   window.addEventListener('cf:stream-status', e => …) // {connected:boolean, reason:string}
 *
 * A page makes no network request and holds no session token. It used to open
 * the stream itself, which the app's content security policy refuses in a
 * built app, and which needed the token inside the page. Reconnection, the
 * replay of missed events and sign-out are all handled natively.
 *
 * Outside the desktop app there is no feed, and the status says so.
 */
(function () {
  // backend event type -> CustomEvent name
  const EVENT_MAP = {
    'threat:new': 'cf:threat',
    'threat:update': 'cf:threat',
    'scan:update': 'cf:scan',
    'scan:explanation': 'cf:scan-explanation',
    'alert:new': 'cf:alert',
    'agent:activity': 'cf:agent',
    'metrics:update': 'cf:metrics',
    'console:changed': 'cf:console-changed',
  };

  let started = false;
  let connected = false;
  let reason = 'not started';
  let unlisten = [];

  function setStatus(isUp, why) {
    const text = why || (isUp ? 'connected' : 'not connected');
    if (connected === isUp && reason === text) return;
    connected = isUp;
    reason = text;
    window.dispatchEvent(new CustomEvent('cf:stream-status', { detail: { connected: isUp, reason: text } }));
  }

  function dispatch(evt) {
    if (!evt || !evt.type) return;
    // generic firehose
    window.dispatchEvent(new CustomEvent('cf:event', { detail: evt }));
    // typed, ergonomic event carrying just the payload
    const name = EVENT_MAP[evt.type];
    if (name) window.dispatchEvent(new CustomEvent(name, { detail: evt.data }));
  }

  // Panels shown in a frame reach the desktop runtime through their parent.
  function runtime() {
    try {
      return window.__TAURI__ || (window.parent && window.parent.__TAURI__) || null;
    } catch (_) {
      return null;
    }
  }

  function keep(promise) {
    Promise.resolve(promise).then((off) => {
      if (typeof off !== 'function') return;
      if (started) unlisten.push(off);
      else off(); // stopped before the listener was registered
    }).catch(() => {});
  }

  const realtime = {
    start() {
      if (started) return;
      const T = runtime();
      if (!T || !T.event || typeof T.event.listen !== 'function') {
        setStatus(false, 'no live feed outside the desktop app');
        return;
      }
      started = true;
      keep(T.event.listen('cf-stream', (e) => dispatch(e && e.payload)));
      keep(T.event.listen('cf-stream-status', (e) => {
        const s = (e && e.payload) || {};
        setStatus(!!s.connected, s.reason);
      }));
      // The feed may have connected before this page loaded.
      if (T.core && typeof T.core.invoke === 'function') {
        T.core.invoke('stream_status')
          .then((s) => setStatus(!!(s && s.connected), s && s.reason))
          .catch(() => setStatus(false, 'the live feed is not available in this build'));
      }
    },
    /** Stop listening on this page. The native connection stays open for the other pages. */
    stop() {
      started = false;
      unlisten.forEach((off) => { try { off(); } catch (_) {} });
      unlisten = [];
      setStatus(false, 'stopped on this page');
    },
    /** convenience: realtime.on('cf:threat', handler) -> returns an unsubscribe */
    on(name, handler) {
      window.addEventListener(name, handler);
      return () => window.removeEventListener(name, handler);
    },
    get connected() { return connected; },
    get reason() { return reason; },
  };

  // expose
  window.CF = window.CF || {};
  window.CF.realtime = realtime;
  window.CFRealtime = realtime;

  // auto-start once the DOM is ready
  if (document.readyState !== 'loading') realtime.start();
  else document.addEventListener('DOMContentLoaded', () => realtime.start());
})();
