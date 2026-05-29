/**
 * CyberForge — Polished Toast + Notification Panel + Quick Scan Modal
 * Uses cf-animations.css tokens. Zero hardcoded colors.
 *
 * Public API (all on window.CF):
 *   CF.toast(type, title, message, duration)
 *   CF.notify(type, title, desc)   — also adds to notification panel
 *   CF.modal.scan.open()           — opens the quick-scan modal
 *   CF.modal.scan.close()
 */

(function () {
    'use strict';

    // ── icon map ────────────────────────────────────────────────
    var ICONS = {
        info:    'fas fa-circle-info',
        success: 'fas fa-circle-check',
        warning: 'fas fa-triangle-exclamation',
        error:   'fas fa-circle-xmark',
        scan:    'fas fa-shield-halved',
        threat:  'fas fa-skull-crossbones'
    };

    // ── Notification panel state ─────────────────────────────────
    var _notifs = [];
    var _unread = 0;

    // ── Toast ─────────────────────────────────────────────────────
    function toast(type, title, message, duration) {
        var container = document.getElementById('cf-toast-container');
        if (!container) return;

        duration = (duration === undefined) ? 5000 : duration;
        type = type || 'info';
        var icon = ICONS[type] || ICONS.info;

        var t = document.createElement('div');
        t.className = 'cf-toast cf-toast--' + type;
        t.innerHTML =
            '<div class="cf-toast-icon"><i class="' + icon + '"></i></div>' +
            '<div class="cf-toast-body">' +
                '<div class="cf-toast-title">' + _esc(title) + '</div>' +
                (message ? '<div class="cf-toast-msg">' + _esc(message) + '</div>' : '') +
            '</div>' +
            '<button class="cf-toast-close" aria-label="Dismiss"><i class="fas fa-xmark"></i></button>' +
            (duration > 0 ? '<div class="cf-toast-progress" style="animation-duration:' + duration + 'ms;color:currentColor"></div>' : '');

        container.appendChild(t);

        // Close button
        t.querySelector('.cf-toast-close').addEventListener('click', function () {
            _dismissToast(t);
        });

        // Ripple on click anywhere
        t.addEventListener('click', function (e) {
            if (!e.target.closest('.cf-toast-close')) _dismissToast(t);
        });

        // Auto-dismiss
        var _tid;
        if (duration > 0) {
            _tid = setTimeout(function () { _dismissToast(t); }, duration);
        }

        // GSAP entrance if available
        if (typeof gsap !== 'undefined') {
            gsap.from(t, { x: 80, opacity: 0, duration: 0.28, ease: 'power2.out' });
        }

        return t;
    }

    function _dismissToast(t) {
        if (!t || t.dataset.exiting) return;
        t.dataset.exiting = '1';
        t.classList.add('cf-toast--exit');
        setTimeout(function () {
            if (t.parentNode) t.parentNode.removeChild(t);
        }, 250);
    }

    // ── HTML escape helper ──────────────────────────────────────
    function _esc(s) {
        if (!s) return '';
        return String(s)
            .replace(/&/g,'&amp;')
            .replace(/</g,'&lt;')
            .replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;');
    }

    // ── Notification Panel ────────────────────────────────────────
    function notify(type, title, desc, url) {
        // Show as toast too
        toast(type, title, desc, 5000);

        // Add to panel
        var now = new Date();
        var timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        var item = { type: type, title: title, desc: desc, time: timeStr, url: url, unread: true };
        _notifs.unshift(item);
        if (_notifs.length > 50) _notifs.pop();

        _unread++;
        _renderNotifPanel();
        _updateBadge();
    }

    function _renderNotifPanel() {
        var list = document.getElementById('cf-notif-list');
        if (!list) return;

        if (_notifs.length === 0) {
            list.innerHTML =
                '<div class="cf-notif-empty">' +
                    '<i class="fas fa-shield-halved"></i>' +
                    '<span>No new alerts</span>' +
                '</div>';
            return;
        }

        var html = '';
        for (var i = 0; i < _notifs.length && i < 20; i++) {
            var n = _notifs[i];
            var icon = ICONS[n.type] || ICONS.info;
            html +=
                '<div class="cf-notif-item notif-' + (n.type||'info') + (n.unread ? ' unread' : '') + '">' +
                    '<div class="cf-notif-item-icon"><i class="' + icon + '"></i></div>' +
                    '<div class="cf-notif-item-body">' +
                        '<div class="cf-notif-item-title">' + _esc(n.title) + '</div>' +
                        (n.desc ? '<div class="cf-notif-item-desc">' + _esc(n.desc) + '</div>' : '') +
                        '<div class="cf-notif-item-time">' + _esc(n.time) + '</div>' +
                    '</div>' +
                '</div>';
        }
        list.innerHTML = html;
    }

    function _updateBadge() {
        var badge = document.getElementById('notification-count');
        if (!badge) return;
        var count = _unread;
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.style.display = count > 0 ? '' : 'none';
        if (count > 0) {
            badge.classList.add('has-notif');
            // Pop animation
            badge.classList.remove('cf-badge-pop-anim');
            void badge.offsetWidth; // reflow
            badge.classList.add('cf-badge-pop-anim');
        }
    }

    function _markAllRead() {
        _notifs.forEach(function (n) { n.unread = false; });
        _unread = 0;
        _renderNotifPanel();
        _updateBadge();
    }

    function _initNotifPanel() {
        var btn = document.getElementById('notifications-btn');
        var panel = document.getElementById('cf-notif-panel');
        var clearBtn = document.getElementById('cf-notif-clear-btn');
        if (!btn || !panel) return;

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var open = panel.classList.toggle('open');
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            if (open) {
                _markAllRead();
                // GSAP entrance
                if (typeof gsap !== 'undefined') {
                    gsap.from(panel, { y: -8, opacity: 0, duration: 0.18, ease: 'power2.out' });
                }
            }
        });

        document.addEventListener('click', function (e) {
            if (!panel.contains(e.target) && e.target !== btn) {
                panel.classList.remove('open');
                btn.setAttribute('aria-expanded', 'false');
            }
        });

        if (clearBtn) {
            clearBtn.addEventListener('click', function () {
                _notifs = [];
                _unread = 0;
                _renderNotifPanel();
                _updateBadge();
            });
        }

        // Initial render
        _renderNotifPanel();
        _updateBadge();
    }

    // ── Quick Scan Modal ─────────────────────────────────────────
    var _scanModal = {
        open: function () {
            var m = document.getElementById('cf-quick-scan-modal');
            if (!m) return;
            m.removeAttribute('hidden');
            var input = document.getElementById('cf-scan-url-input');
            if (input) setTimeout(function () { input.focus(); }, 50);
            if (typeof gsap !== 'undefined') {
                gsap.from(m.querySelector('.cf-modal'), { y: 30, opacity: 0, duration: 0.3, ease: 'power3.out' });
            }
        },
        close: function () {
            var m = document.getElementById('cf-quick-scan-modal');
            if (m) m.setAttribute('hidden', '');
            var res = document.getElementById('cf-scan-result');
            if (res) res.setAttribute('hidden', '');
        }
    };

    function _initScanModal() {
        var overlay  = document.getElementById('cf-quick-scan-modal');
        var closeBtn = document.getElementById('cf-scan-modal-close');
        var submitBtn = document.getElementById('cf-scan-submit-btn');
        var input    = document.getElementById('cf-scan-url-input');
        var runScanBtn = document.getElementById('run-scan-btn');
        var result   = document.getElementById('cf-scan-result');

        if (!overlay) return;

        if (closeBtn) closeBtn.addEventListener('click', _scanModal.close);

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) _scanModal.close();
        });

        if (runScanBtn) runScanBtn.addEventListener('click', function () { _scanModal.open(); });

        if (input) {
            input.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') _runScan();
                if (e.key === 'Escape') _scanModal.close();
            });
        }

        if (submitBtn) submitBtn.addEventListener('click', _runScan);
    }

    function _runScan() {
        var input    = document.getElementById('cf-scan-url-input');
        var result   = document.getElementById('cf-scan-result');
        var submitBtn = document.getElementById('cf-scan-submit-btn');
        if (!input || !result) return;

        var url = input.value.trim();
        if (!url) {
            toast('warning', 'No URL entered', 'Please paste a URL to scan.', 3500);
            return;
        }
        // Add protocol if missing
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

        // Loading state
        result.removeAttribute('hidden');
        result.innerHTML =
            '<div style="display:flex;align-items:center;gap:8px;color:var(--cf-text-muted,#756E66)">' +
            '<i class="fas fa-circle-notch fa-spin"></i> Dispatching to 8-agent orchestrator…' +
            '</div>';

        if (submitBtn) { submitBtn.disabled = true; }

        var backendUrl = localStorage.getItem('cyberforge_backend_url') ||
                         'https://cyberforge-ddd97655464f.herokuapp.com';
        var token = localStorage.getItem('authToken') || '';

        fetch(backendUrl + '/api/agent/scan-url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? 'Bearer ' + token : '',
                'User-Agent': 'cyber-forge-desktop/1.0'
            },
            body: JSON.stringify({ url: url }),
            signal: AbortSignal.timeout(30000)
        })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            var d = (data && data.data) || data || {};
            var risk    = d.riskScore || d.risk_score || 0;
            var verdict = (d.category || d.verdict || 'unknown').toUpperCase();
            var safe    = risk < 30;
            var warn    = risk >= 30 && risk < 65;
            var bad     = risk >= 65;
            var vcls    = bad ? 'cf-scan-verdict--threat' : (warn ? 'cf-scan-verdict--warning' : 'cf-scan-verdict--safe');
            var summary = d.summary || d.geminiAnalysis || '';

            result.innerHTML =
                '<div class="cf-scan-verdict ' + vcls + '">' +
                    verdict + ' · Risk ' + risk + '/100' +
                '</div>' +
                (summary ? '<div style="margin-top:6px;font-size:11px;line-height:1.5;color:var(--cf-text-secondary)">' + _esc(summary).slice(0,300) + '</div>' : '') +
                '<div style="margin-top:6px;font-size:10px;color:var(--cf-text-muted)">' +
                    (d.iocs?.length || 0) + ' IOCs · ' +
                    (d.mitre?.length || 0) + ' MITRE ATT&amp;CK · ' +
                    'LLM: ' + _esc(d.llmSource || 'Gemini 2.5') +
                '</div>';

            // Also fire notify
            notify(bad ? 'error' : (warn ? 'warning' : 'success'),
                'Scan Complete: ' + verdict,
                url.slice(0, 60) + ' · Risk ' + risk + '/100');

            // Wire to orchestrator panel if visible
            if (window._cfOrchestratorNotify) {
                window._cfOrchestratorNotify('complete', data);
            }
        })
        .catch(function (err) {
            result.innerHTML =
                '<div style="color:var(--cf-status-error)">' +
                '<i class="fas fa-triangle-exclamation"></i> ' +
                _esc(err.message || 'Scan failed') +
                '</div>';
            toast('error', 'Scan failed', err.message, 4000);
        })
        .finally(function () {
            if (submitBtn) { submitBtn.disabled = false; }
        });
    }

    // ── Ripple effect for .cf-btn-ripple buttons ──────────────────
    function _initRipple() {
        document.addEventListener('click', function (e) {
            var btn = e.target.closest('.cf-btn-ripple');
            if (!btn) return;
            var rect = btn.getBoundingClientRect();
            var size = Math.max(rect.width, rect.height);
            var wave = document.createElement('span');
            wave.className = 'ripple-wave';
            wave.style.cssText =
                'width:' + size + 'px;height:' + size + 'px;' +
                'left:' + (e.clientX - rect.left - size / 2) + 'px;' +
                'top:'  + (e.clientY - rect.top  - size / 2) + 'px;';
            btn.appendChild(wave);
            setTimeout(function () { if (wave.parentNode) wave.parentNode.removeChild(wave); }, 600);
        });
    }

    // ── Control button wiring ─────────────────────────────────────
    function _initControlButtons() {
        // AI chat btn → navigate to ai-assistant screen
        var aiChatBtn = document.getElementById('ai-chat-btn');
        if (aiChatBtn) {
            aiChatBtn.addEventListener('click', function () {
                var link = document.querySelector('[data-screen="ai-assistant"]');
                if (link) link.click();
                else if (window.navigateTo) window.navigateTo('ai-assistant');
            });
        }

        // Settings btn → navigate to settings screen
        var settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', function () {
                var link = document.querySelector('[data-screen="settings"]');
                if (link) link.click();
                else if (window.navigateTo) window.navigateTo('settings');
            });
        }

        // Full screen btn
        var fsBtn = document.getElementById('full-screen-btn');
        if (fsBtn) {
            fsBtn.addEventListener('click', function () {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(function () {});
                    fsBtn.querySelector('i').className = 'fas fa-compress';
                } else {
                    document.exitFullscreen().catch(function () {});
                    fsBtn.querySelector('i').className = 'fas fa-expand';
                }
            });
        }

        // Keyboard shortcut ⌘K / Ctrl+K for search
        document.addEventListener('keydown', function (e) {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                var search = document.getElementById('global-search');
                if (search) { search.focus(); search.select(); }
            }
        });
    }

    // ── Footer ticker animation ───────────────────────────────────
    var _tickerMessages = [
        'AI agents actively monitoring…',
        '8-agent orchestrator on standby',
        'Gemini 2.5 Flash connected',
        'Real-time URL threat feed active',
        'Phishing classifier loaded',
        'MITRE ATT&CK mapper ready'
    ];
    var _tickerIdx = 0;

    function _initTicker() {
        var el = document.getElementById('ai-activity-text');
        if (!el) return;
        setInterval(function () {
            _tickerIdx = (_tickerIdx + 1) % _tickerMessages.length;
            if (typeof gsap !== 'undefined') {
                gsap.to(el, { opacity: 0, y: -5, duration: 0.18, ease: 'power1.in',
                    onComplete: function () {
                        el.textContent = _tickerMessages[_tickerIdx];
                        gsap.to(el, { opacity: 1, y: 0, duration: 0.2, ease: 'power1.out' });
                    }
                });
            } else {
                el.textContent = _tickerMessages[_tickerIdx];
            }
        }, 6000);
    }

    // ── Expose public API ─────────────────────────────────────────
    window.CF = window.CF || {};
    window.CF.toast   = toast;
    window.CF.notify  = notify;
    window.CF.modal   = { scan: _scanModal };

    // Legacy compatibility — forward to new system
    window.cfToast = toast;

    // ── Boot ──────────────────────────────────────────────────────
    function _init() {
        _initNotifPanel();
        _initScanModal();
        _initRipple();
        _initControlButtons();
        _initTicker();

        // Welcome toast after brief delay
        setTimeout(function () {
            toast('info', 'CyberForge Ready', 'AI agents initialized. Real-time monitoring active.', 4500);
        }, 1800);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _init);
    } else {
        _init();
    }

})();
