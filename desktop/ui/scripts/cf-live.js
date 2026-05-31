/**
 * CyberForge Live — generic real-time UX layer shared by every page.
 *
 * Sits on top of cf-realtime.js (the SSE transport) and turns the raw event
 * stream into visible, page-agnostic behaviour so EVERY screen is live without
 * needing to know that screen's internals:
 *
 *   • a connection status pill ("● LIVE" / "○ reconnecting")
 *   • toasts for incoming alerts / threats / risky scans
 *   • a floating, collapsible "Live Activity" rail (recent events)
 *   • `window.CF.live` (recent events + status) for any page to read
 *   • an opt-in deep hook: define `window.onCFLive(evt)` on a page to update
 *     that page's own widgets (tables, counters, globe…) from the same stream.
 *
 * Requires cyberforge-shared.js (window.CF) and cf-realtime.js.
 */
(function () {
  const CF = (window.CF = window.CF || {});
  const MAX_EVENTS = 60;
  const state = { events: [], connected: false };
  CF.live = state;

  // ── styles (scoped, injected once) ────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('cf-live-styles')) return;
    const css = `
    #cf-live-pill{position:fixed;top:14px;right:16px;z-index:10000;display:flex;align-items:center;
      gap:7px;font:600 11px/1 system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase;
      padding:6px 11px;border-radius:999px;background:#0b1622;border:1px solid #1f3a4d;color:#9fb4c2;
      box-shadow:0 4px 16px rgba(0,0,0,.35);cursor:pointer;user-select:none;transition:.2s}
    #cf-live-pill .dot{width:8px;height:8px;border-radius:50%;background:#5b6b78;
      box-shadow:0 0 0 0 rgba(45,212,191,.6);transition:.2s}
    #cf-live-pill.on{color:#bdeee4;border-color:#1c5c52}
    #cf-live-pill.on .dot{background:#2dd4bf;animation:cfpulse 1.8s infinite}
    @keyframes cfpulse{0%{box-shadow:0 0 0 0 rgba(45,212,191,.5)}70%{box-shadow:0 0 0 7px rgba(45,212,191,0)}100%{box-shadow:0 0 0 0 rgba(45,212,191,0)}}
    #cf-live-rail{position:fixed;right:16px;bottom:16px;z-index:9998;width:300px;max-height:46vh;
      display:flex;flex-direction:column;background:rgba(8,17,26,.96);border:1px solid #1f3a4d;
      border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.5);overflow:hidden;font:13px/1.4 system-ui,sans-serif;
      backdrop-filter:blur(8px);transform:translateY(0);transition:transform .25s}
    #cf-live-rail.collapsed{transform:translateY(calc(100% - 40px))}
    #cf-live-rail .hd{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;
      cursor:pointer;border-bottom:1px solid #162c3a;color:#cfe3ec;font-weight:600;font-size:12px;
      letter-spacing:.03em;text-transform:uppercase}
    #cf-live-rail .hd .cnt{background:#12303a;color:#7fd9c8;border-radius:999px;padding:1px 8px;font-size:11px}
    #cf-live-rail .body{overflow-y:auto;padding:6px}
    #cf-live-rail .row{display:flex;gap:8px;align-items:flex-start;padding:7px 8px;border-radius:8px}
    #cf-live-rail .row+.row{margin-top:2px}
    #cf-live-rail .row:hover{background:#0f2230}
    #cf-live-rail .tag{flex:0 0 auto;width:7px;height:7px;border-radius:50%;margin-top:5px;background:#5b6b78}
    #cf-live-rail .tag.threat,#cf-live-rail .tag.alert{background:#f87171}
    #cf-live-rail .tag.scan{background:#38bdf8}
    #cf-live-rail .tag.agent{background:#a78bfa}
    #cf-live-rail .tx{flex:1;min-width:0;color:#c4d6df}
    #cf-live-rail .tx .t{color:#eef6f9;font-weight:600;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #cf-live-rail .tx .s{color:#7e93a0;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #cf-live-rail .empty{color:#5f7480;text-align:center;padding:18px 8px;font-size:12px}`;
    const el = document.createElement('style');
    el.id = 'cf-live-styles';
    el.textContent = css;
    document.head.appendChild(el);
  }

  // ── DOM scaffold ──────────────────────────────────────────────────────────
  let railBody, pill, cntEl;
  function mount() {
    if (document.getElementById('cf-live-pill')) return;
    injectStyles();

    pill = document.createElement('div');
    pill.id = 'cf-live-pill';
    pill.innerHTML = '<span class="dot"></span><span class="lbl">connecting</span>';
    pill.title = 'Real-time feed — click to toggle the activity rail';
    pill.onclick = () => rail.classList.toggle('collapsed');
    document.body.appendChild(pill);

    const rail = document.createElement('div');
    rail.id = 'cf-live-rail';
    rail.className = 'collapsed';
    rail.innerHTML =
      '<div class="hd"><span>Live Activity</span><span class="cnt">0</span></div><div class="body"></div>';
    rail.querySelector('.hd').onclick = () => rail.classList.toggle('collapsed');
    document.body.appendChild(rail);
    railBody = rail.querySelector('.body');
    cntEl = rail.querySelector('.cnt');
    renderRail();
  }

  function setPill(on) {
    if (!pill) return;
    pill.classList.toggle('on', on);
    pill.querySelector('.lbl').textContent = on ? 'live' : 'reconnecting';
  }

  // ── event → human row ─────────────────────────────────────────────────────
  function describe(evt) {
    const d = evt.data || {};
    switch (evt.type) {
      case 'threat:new':
      case 'threat:update':
        return { kind: 'threat', title: (d.indicator || d.url || 'Threat') , sub: `${(d.severity || 'threat')} · risk ${d.riskScore ?? '—'}` };
      case 'alert:new':
        return { kind: 'alert', title: d.message || 'Alert', sub: d.url || d.severity || '' };
      case 'scan:update':
        return { kind: 'scan', title: d.url || 'Scan', sub: `${d.verdict || 'scanned'} · risk ${d.riskScore ?? 0}` };
      case 'agent:activity':
        return { kind: 'agent', title: `${d.type || 'activity'}${d.url ? ': ' + d.url : ''}`, sub: d.verdict ? `${d.verdict}` : 'agent' };
      default:
        return null; // metrics & others don't clutter the rail
    }
  }

  function timeAgo(ts) {
    const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return s + 's';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    return Math.floor(s / 3600) + 'h';
  }

  function renderRail() {
    if (!railBody) return;
    cntEl.textContent = String(state.events.length);
    if (!state.events.length) {
      railBody.innerHTML = '<div class="empty">Waiting for live events…</div>';
      return;
    }
    railBody.innerHTML = state.events
      .map((e) => {
        const r = e._row;
        return `<div class="row"><span class="tag ${r.kind}"></span><div class="tx">
          <div class="t">${escapeHtml(r.title)}</div>
          <div class="s">${escapeHtml(r.sub)} · ${timeAgo(e.ts)} ago</div></div></div>`;
      })
      .join('');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ── react to the stream ───────────────────────────────────────────────────
  function record(evt) {
    const row = describe(evt);
    if (row) {
      state.events.unshift({ ...evt, _row: row });
      if (state.events.length > MAX_EVENTS) state.events.pop();
      renderRail();
    }
    // toasts for the things an analyst must notice
    if (CF.toast) {
      if (evt.type === 'alert:new') CF.toast(`⚠ ${row.title}`, 'warn');
      else if (evt.type === 'threat:new') CF.toast(`🛑 Threat: ${row.title}`, 'error');
      else if (evt.type === 'scan:update' && (evt.data?.riskScore ?? 0) >= 70) CF.toast(`🛑 Malicious: ${evt.data.url}`, 'error');
    }
    // opt-in deep per-page hook
    if (typeof window.onCFLive === 'function') {
      try { window.onCFLive(evt); } catch (_) {}
    }
  }

  function init() {
    mount();
    window.addEventListener('cf:event', (e) => record(e.detail));
    window.addEventListener('cf:stream-status', (e) => {
      state.connected = !!(e.detail && e.detail.connected);
      setPill(state.connected);
    });
    // reflect current status if the stream connected before we mounted
    if (CF.realtime && CF.realtime.connected) setPill(true);
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
