/* ============================================================
   CyberForge — keyboard and motion basics for every page (UX-02, UX-04).
   Loaded first on each page, before any script adds a click handler.

   - Many controls are <div>s or <span>s with a click handler. Any such element
     becomes focusable, is announced as a button, and answers Enter and Space,
     unless it is already a native control, has its own role, or is an overlay
     or a large container (a click handler there is a backdrop or delegation,
     not a control).
   - Keyboard focus is always visible.
   - With "reduce motion" set in the system, animations and transitions stop.
   ============================================================ */
(function () {
  if (window.__cfA11y) return;
  window.__cfA11y = true;

  var NATIVE = /^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY|OPTION|LABEL|IFRAME|CANVAS|SVG|PATH)$/;
  var NOT_A_CONTROL = /(^|\s)(cf-mov|stage|window|main|body|sidebar|topbar|statusbar|overlay|backdrop|modal|cf-dd)(\s|$)/;

  function makeControl(el) {
    if (!el || el.nodeType !== 1 || el.__cfControl) return;
    if (el === document.body || el === document.documentElement) return;
    if (NATIVE.test(el.tagName.toUpperCase()) || el.isContentEditable) return;
    if (NOT_A_CONTROL.test(el.className && el.className.baseVal === undefined ? el.className : '')) return;
    if (el.children && el.children.length > 12) return;
    el.__cfControl = true;
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
    el.addEventListener('keydown', function (e) {
      if (e.target !== el) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
    });
  }

  var add = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (type === 'click' && this instanceof Element) {
      try { makeControl(this); } catch (_) {}
    }
    return add.call(this, type, listener, options);
  };

  var css =
    ':focus-visible{outline:2px solid #2bd4ee !important;outline-offset:2px !important;border-radius:4px}' +
    '[role="button"]:focus:not(:focus-visible){outline:none}' +
    '@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:.001ms !important;' +
    'animation-iteration-count:1 !important;transition-duration:.001ms !important;scroll-behavior:auto !important}}';
  function style() {
    if (document.getElementById('cf-a11y-style')) return;
    var s = document.createElement('style');
    s.id = 'cf-a11y-style';
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }
  if (document.head) style(); else document.addEventListener('DOMContentLoaded', style);

  window.CF = window.CF || {};
  window.CF.makeControl = makeControl;
  window.CF.prefersReducedMotion = function () {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  };
})();
