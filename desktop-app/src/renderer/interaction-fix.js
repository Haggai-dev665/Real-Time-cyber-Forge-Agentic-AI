(() => {
  function ensureClickableSurface() {
    try {
      // 1. Restore pointer-events on root elements
      const html = document.documentElement;
      const body = document.body;
      if (html && getComputedStyle(html).pointerEvents === 'none') {
        html.style.pointerEvents = 'auto';
      }
      if (body) {
        const bodyStyle = getComputedStyle(body);
        if (bodyStyle.pointerEvents === 'none') {
          body.style.pointerEvents = 'auto';
        }
        // Fix body stuck at opacity 0 (auth-page-v2 sets this on load)
        if (bodyStyle.opacity === '0') {
          body.style.opacity = '1';
        }
      }

      // 2. Remove any full-screen blocking overlay that is still visible.
      //    Use broad selectors — both known IDs and generic patterns.
      const overlaySelectors = [
        '#cyber-loading-screen',
        '#loading-screen',
        '.loading-screen',
        '.loading-overlay',
        '.modal-overlay',
        '.modal-container'
      ];

      for (const selector of overlaySelectors) {
        const nodes = document.querySelectorAll(selector);
        nodes.forEach((node) => {
          const style = getComputedStyle(node);

          // Skip elements that are already hidden
          if (style.display === 'none' || style.visibility === 'hidden') return;

          // Detect "covers the viewport" regardless of how CSS expresses it.
          const pos = style.position;
          if (pos !== 'fixed' && pos !== 'absolute') return;

          const rect = node.getBoundingClientRect();
          const coversViewport =
            rect.width >= window.innerWidth * 0.9 &&
            rect.height >= window.innerHeight * 0.9 &&
            rect.top <= 5 &&
            rect.left <= 5;

          const highZ = parseInt(style.zIndex, 10) >= 500;

          if (coversViewport || highZ) {
            // For modals with explicit display:none toggling, honor that pattern.
            // For dynamically injected overlays, remove outright.
            node.style.display = 'none';
            node.style.pointerEvents = 'none';
            console.info('[interaction-fix] hid blocking overlay:', selector, node.id || node.className);
          }
        });
      }

      // 3. Nuclear safety net: any position:fixed element covering the viewport
      //    with a z-index ≥ 500 that isn't a known app shell part gets killed.
      const safeIds = new Set([
        'app', 'sidebar', 'toast-container', 'agent-control-panel',
        'event-feed-panel', 'mobile-overlay'
      ]);
      const safeClasses = [
        'cf-header', 'cf-sidebar', 'cf-app', 'toast-container',
        'agent-control-panel', 'floating-agent-panel', 'ai-assistant-panel'
      ];

      document.querySelectorAll('*').forEach((el) => {
        const s = getComputedStyle(el);
        if (s.position !== 'fixed') return;
        if (s.display === 'none' || s.visibility === 'hidden') return;

        const z = parseInt(s.zIndex, 10);
        if (isNaN(z) || z < 500) return;

        // Don't kill known safe UI
        if (safeIds.has(el.id)) return;
        if (safeClasses.some(c => el.classList.contains(c))) return;

        const r = el.getBoundingClientRect();
        if (r.width >= window.innerWidth * 0.85 && r.height >= window.innerHeight * 0.85) {
          el.style.display = 'none';
          el.style.pointerEvents = 'none';
          console.info('[interaction-fix] removed rogue overlay:', el.id || el.className, 'z-index:', z);
        }
      });
    } catch (e) {
      console.warn('[interaction-fix] failed:', e);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    ensureClickableSurface();

    // Overlays may appear during init() / async bootstrap — re-check aggressively.
    setTimeout(ensureClickableSurface, 250);
    setTimeout(ensureClickableSurface, 1000);
    setTimeout(ensureClickableSurface, 2500);
    setTimeout(ensureClickableSurface, 5000);

    // Keep watching for late-injected overlays (e.g., from connectToBackend error paths)
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (
            node.classList?.contains('modal-overlay') ||
            node.classList?.contains('loading-screen') ||
            node.id === 'cyber-loading-screen'
          ) {
            // Delay slightly to let intentional modals animate in, then check
            setTimeout(ensureClickableSurface, 600);
            return;
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
