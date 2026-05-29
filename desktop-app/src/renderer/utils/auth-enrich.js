/**
 * CyberForge Auth Page Enrichment
 * - Fetches live threat count for stat pill
 * - GSAP micro-interactions on inputs and button
 * - Handles input focus animations
 */
(function () {
    'use strict';

    var BACKEND = localStorage.getItem('cyberforge_backend_url') ||
                  'https://cyberforge-ddd97655464f.herokuapp.com';

    // ── Live threat count ──────────────────────────────────────────
    function loadThreatCount() {
        var el = document.getElementById('auth-stat-threats');
        if (!el) return;

        fetch(BACKEND + '/api/threats/stats', {
            signal: AbortSignal.timeout(8000)
        })
        .then(function (r) { return r.json(); })
        .then(function (d) {
            var val = (d && d.data && d.data.total) ||
                      (d && d.total) || null;
            if (!val) return;

            if (typeof gsap !== 'undefined') {
                var obj = { n: 0 };
                gsap.to(obj, {
                    n: val,
                    duration: 1.6,
                    ease: 'power2.out',
                    onUpdate: function () {
                        el.textContent = Math.round(obj.n).toLocaleString();
                    }
                });
            } else {
                el.textContent = Number(val).toLocaleString();
            }
        })
        .catch(function () { /* offline — keep static placeholder */ });
    }

    // ── GSAP micro-interactions ────────────────────────────────────
    function initGsapInteractions() {
        if (typeof gsap === 'undefined') return;

        // Form card entrance
        gsap.from('.auth-form-card:not(.hidden)', {
            y: 20,
            opacity: 0,
            duration: 0.45,
            ease: 'power3.out',
            delay: 0.1
        });

        // Label color on input focus/blur
        document.querySelectorAll('.form-input').forEach(function (inp) {
            inp.addEventListener('focus', function () {
                var lbl = inp.closest('.form-group') &&
                          inp.closest('.form-group').querySelector('.form-label');
                if (lbl) gsap.to(lbl, { color: 'var(--auth-accent, #F69D39)', duration: 0.15 });
            });
            inp.addEventListener('blur', function () {
                var lbl = inp.closest('.form-group') &&
                          inp.closest('.form-group').querySelector('.form-label');
                if (lbl) gsap.to(lbl, { color: 'var(--auth-text-secondary, #C9C1B2)', duration: 0.15 });
            });
        });

        // Button hover micro-scale
        document.querySelectorAll('.btn-primary').forEach(function (btn) {
            btn.addEventListener('mouseenter', function () {
                gsap.to(btn, { scale: 1.02, duration: 0.15, ease: 'power1.out' });
            });
            btn.addEventListener('mouseleave', function () {
                gsap.to(btn, { scale: 1, duration: 0.15, ease: 'power1.in' });
            });
            btn.addEventListener('mousedown', function () {
                gsap.to(btn, { scale: 0.97, duration: 0.1 });
            });
            btn.addEventListener('mouseup', function () {
                gsap.to(btn, { scale: 1.01, duration: 0.1 });
            });
        });

        // Stagger capability items
        gsap.from('.auth-cap-item', {
            x: -14,
            opacity: 0,
            duration: 0.35,
            stagger: 0.1,
            ease: 'power2.out',
            delay: 0.4
        });

        // Stat pills
        gsap.from('.auth-stat-pill', {
            y: 8,
            opacity: 0,
            duration: 0.3,
            stagger: 0.08,
            ease: 'power2.out',
            delay: 0.65
        });
    }

    // ── Boot ───────────────────────────────────────────────────────
    function init() {
        loadThreatCount();
        initGsapInteractions();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
