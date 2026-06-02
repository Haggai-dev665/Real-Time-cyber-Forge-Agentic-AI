/* ============================================================
   CyberForge — floating Agent panel controller (shared across all screens)

   • Injects the isolated panel iframe (components/agent-panel.html) into the
     window, so the rich Threat-Overview agent is available on every page.
   • Reuses the page's existing .agent-fab as the restore icon (creates a
     .cf-fab if the page doesn't have one).
   • Minimize / close inside the panel  ->  hide panel, show the floating icon.
   • Click the floating icon            ->  reopen the panel.

   On the Threat Overview page (which already renders a native #agent panel)
   it wires that panel to the same behavior instead of injecting a second one.

   Usage: just include this script + cf-agent.css on a page.
   ============================================================ */
(function () {
  // Guard against being loaded twice on the same page.
  if (window.__cfAgentInit) return;
  window.__cfAgentInit = true;

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  // Ensure the component's stylesheet is present (so pages don't each need to
  // link it). Idempotent — skips if already linked.
  if (!document.querySelector('link[href*="cf-agent.css"]')) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '../styles/cf-agent.css';
    document.head.appendChild(link);
  }

  var AGENT_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 3v4M8 12h.01M16 12h.01M9 16h6"/></svg>';

  ready(function () {
    // Anchor inside the content area (.body) — the same positioning context the
    // native panel and the existing .agent-fab use — so the panel sits in the
    // exact spot it does on Threat Overview.
    var host = document.querySelector('.body') || document.querySelector('.window') || document.body;

    // Restore icon: reuse an existing .agent-fab, otherwise create our own.
    var fab = document.querySelector('.agent-fab');
    if (!fab) {
      fab = document.createElement('div');
      fab.className = 'cf-fab';
      fab.title = 'CyberForge Agent';
      fab.innerHTML = '<span class="fab-ping"></span>' + AGENT_ICON;
      host.appendChild(fab);
    }

    // A page may already have the native panel (Threat Overview).
    var native = document.getElementById('agent');
    var frame = null;

    function open() {
      if (native) {
        native.style.display = '';
      } else {
        if (!frame.getAttribute('src')) frame.setAttribute('src', '../components/agent-panel.html');
        frame.classList.remove('cf-hidden');
      }
      fab.classList.add('cf-hidden');
    }

    function minimize() {
      if (native) native.style.display = 'none';
      else if (frame) frame.classList.add('cf-hidden');
      fab.classList.remove('cf-hidden');
    }

    if (native) {
      // Wire the native panel's window buttons ( −  and  × ) to minimize.
      var btns = native.querySelectorAll('.win-btns i');
      btns.forEach(function (b, idx) {
        if (idx !== 1) b.addEventListener('click', minimize);
      });
      // Native panel is shown by default -> keep the icon hidden.
      fab.classList.add('cf-hidden');
    } else {
      // Inject the isolated panel iframe (loaded lazily on first open).
      frame = document.createElement('iframe');
      frame.className = 'cf-agent-frame cf-hidden';
      frame.title = 'CyberForge Agent';
      frame.setAttribute('frameborder', '0');
      frame.setAttribute('scrolling', 'no');
      frame.setAttribute('allowtransparency', 'true');
      host.appendChild(frame);
      // Panel asks to collapse via postMessage.
      window.addEventListener('message', function (e) {
        if (e.data && e.data.cf === 'agent-min') minimize();
      });
      // Start minimized: the floating icon is visible, click to open.
      fab.classList.remove('cf-hidden');
    }

    fab.addEventListener('click', open);
  });
})();
