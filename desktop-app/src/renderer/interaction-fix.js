(() => {
  function ensureClickableSurface() {
    try {
      // If some script accidentally disabled pointer events, restore them.
      const html = document.documentElement;
      const body = document.body;
      if (html && getComputedStyle(html).pointerEvents === 'none') {
        html.style.pointerEvents = 'auto';
      }
      if (body && getComputedStyle(body).pointerEvents === 'none') {
        body.style.pointerEvents = 'auto';
      }

      // If a known full-screen overlay exists (from other UI variants), hide it.
      const overlaySelectors = [
        '#cyber-loading-screen',
        '#loading-screen',
        '.loading-screen',
        '.modal-overlay',
        '.modal-container'
      ];

      for (const selector of overlaySelectors) {
        const nodes = document.querySelectorAll(selector);
        nodes.forEach((node) => {
          // Only force-hide overlays that look like they could cover the app.
          const style = getComputedStyle(node);
          const isFixedCover =
            style.position === 'fixed' &&
            (style.top === '0px' || style.inset === '0px') &&
            (style.left === '0px' || style.inset === '0px') &&
            (style.width === '100%' || style.width === `${window.innerWidth}px`) &&
            (style.height === '100%' || style.height === `${window.innerHeight}px`);

          // If it's visible and could plausibly be blocking input, make it click-through.
          if (style.display !== 'none' && style.visibility !== 'hidden') {
            if (isFixedCover || Number(style.zIndex) >= 999) {
              node.style.pointerEvents = 'none';
              node.style.display = 'none';
            }
          }
        });
      }
    } catch (e) {
      console.warn('[interaction-fix] failed:', e);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    ensureClickableSurface();

    // Some overlays get inserted after load; re-check shortly.
    setTimeout(ensureClickableSurface, 250);
    setTimeout(ensureClickableSurface, 1500);
  });
})();
