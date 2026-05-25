/**
 * CyberForge Agent UI Controller
 * Handles floating agent panel with REAL system data from Tauri & backend.
 * No mock data, no simulations, no fake entries.
 */

(function() {
    'use strict';

    let _fpStatsInterval = null;
    let _fpBrowsersInterval = null;
    const FP_STYLE_KEY = 'cyberforge-agent-panel-style';
    const FP_STYLE_MODE_KEY = 'cyberforge-agent-panel-style-mode';
    const FP_STYLES = ['tactical', 'ai-lab', 'enterprise'];

    // =========================================
    // HIERARCHICAL SIDEBAR CONTROLLER
    // =========================================
    
    function initHierarchicalSidebar() {
        const parentSections = document.querySelectorAll('.sidebar-parent-section');
        parentSections.forEach(section => {
            const title = section.querySelector('.sidebar-parent-title');
            if (title) {
                title.addEventListener('click', () => {
                    section.classList.toggle('collapsed');
                    const sectionId = section.dataset.section;
                    localStorage.setItem(`sidebar-${sectionId}-collapsed`, section.classList.contains('collapsed'));
                });
                const sectionId = section.dataset.section;
                if (localStorage.getItem(`sidebar-${sectionId}-collapsed`) === 'true') {
                    section.classList.add('collapsed');
                }
            }
        });
    }

    // =========================================
    // FLOATING AGENT PANEL — REAL DATA
    // =========================================
    
    function initFloatingAgentPanel() {
        const panel = document.getElementById('agent-control-panel');
        if (!panel) return;
        
        const minimizeBtn = document.getElementById('agent-panel-minimize');
        const hideBtn = document.getElementById('agent-panel-hide');
        const toggleBtn = document.getElementById('agent-panel-toggle');
        const resyncBtn = document.getElementById('agent-resync-btn');
        const refreshBrowsersBtn = document.getElementById('fp-refresh-browsers');
        const openCenterBtn = document.getElementById('fp-open-agent-center');
        
        makePanelDraggable(panel);
        initFloatingPanelVisualMode(panel);
        
        const fab = document.getElementById('agent-minimized-btn');

        function _showFAB() {
            if (!fab) return;
            fab.style.display = 'flex';
            // Force reflow so animation replays from start
            fab.classList.remove('visible');
            fab.offsetWidth;
            fab.classList.add('visible');
        }
        function _hideFAB() {
            if (!fab) return;
            fab.classList.remove('visible');
            // After transition ends, actually hide so it doesn't intercept clicks
            setTimeout(() => {
                if (!fab.classList.contains('visible')) fab.style.display = 'none';
            }, 300);
        }

        // Collapse = entire panel off-screen + FAB appears
        function _collapse() {
            panel.classList.add('minimized');
            panel.classList.remove('hidden');
            _showFAB();
            localStorage.setItem('agent-panel-minimized', 'true');
        }
        // Expand = FAB gone + panel slides back in
        function _expand() {
            panel.classList.remove('minimized');
            panel.classList.remove('hidden');
            _hideFAB();
            localStorage.setItem('agent-panel-minimized', 'false');
        }

        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                panel.classList.contains('minimized') ? _expand() : _collapse();
            });
        }

        // × also collapses to FAB (same as minimize)
        if (hideBtn) {
            hideBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                _collapse();
            });
        }

        // FAB click restores full panel
        if (fab) {
            fab.addEventListener('click', () => _expand());
        }
        
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const body = document.getElementById('agent-panel-body');
                if (body) {
                    const isCollapsed = body.style.display === 'none';
                    body.style.display = isCollapsed ? 'block' : 'none';
                    toggleBtn.querySelector('i').className = isCollapsed ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
                }
            });
        }
        
        // Resync — REAL backend calls
        if (resyncBtn) {
            resyncBtn.addEventListener('click', async () => {
                const icon = resyncBtn.querySelector('i');
                const origClass = icon.className;
                icon.className = 'fas fa-spinner fa-spin';
                resyncBtn.disabled = true;
                try {
                    await loadFloatingPanelData();
                    fpLog('Full resync completed');
                } catch (e) {
                    fpLog('Resync failed: ' + e.message);
                } finally {
                    icon.className = origClass;
                    resyncBtn.disabled = false;
                }
            });
        }
        
        if (refreshBrowsersBtn) {
            refreshBrowsersBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await loadFloatingPanelBrowsers();
            });
        }
        
        // Open Agent Center screen
        if (openCenterBtn) {
            openCenterBtn.addEventListener('click', () => {
                const agentLink = document.querySelector('[data-screen="agent-control"]');
                if (agentLink) agentLink.click();
            });
        }
        
        // Restore saved state
        _hideFAB();
        if (localStorage.getItem('agent-panel-minimized') === 'true') {
            // Start minimized — panel hidden, FAB visible
            panel.classList.add('minimized');
            _showFAB();
        } else {
            panel.classList.remove('minimized');
            panel.classList.remove('hidden');
        }
        
        // Load REAL data immediately
        console.log('[FloatingPanel] Loading real system data...');
        loadFloatingPanelData();
        
        // Auto-refresh: system stats every 5s, browsers every 30s
        _fpStatsInterval = setInterval(loadFloatingPanelSystemStats, 5000);
        _fpBrowsersInterval = setInterval(loadFloatingPanelBrowsers, 30000);
    }

    // =========================================
    // REAL DATA LOADERS
    // =========================================
    
    async function loadFloatingPanelData() {
        await Promise.all([
            loadFloatingPanelSystemStats(),
            loadFloatingPanelBrowsers(),
            loadFloatingPanelBackendStatus()
        ]);
    }
    
    // System stats from Tauri Rust (sysinfo crate) — CPU, Memory, Uptime
    async function loadFloatingPanelSystemStats() {
        try {
            const result = await window.electronAPI?.getSystemStats?.();
            if (!result?.success || !result?.data) return;
            
            const cpu = Math.round(result.data.cpu || 0);
            const mem = Math.round(result.data.memory || 0);
            const uptime = result.data.uptime || 0;
            
            const cpuEl = document.getElementById('fp-cpu-pct');
            const memEl = document.getElementById('fp-mem-pct');
            const uptimeEl = document.getElementById('fp-uptime');
            
            if (cpuEl) cpuEl.textContent = cpu + '%';
            if (memEl) memEl.textContent = mem + '%';
            if (uptimeEl) {
                const d = Math.floor(uptime / 86400);
                const h = Math.floor((uptime % 86400) / 3600);
                const m = Math.floor((uptime % 3600) / 60);
                uptimeEl.textContent = d > 0 ? d + 'd ' + h + 'h' : h + 'h ' + m + 'm';
            }
        } catch (e) {
            console.warn('[FloatingPanel] System stats error:', e);
        }
    }
    
    // Browser detection from Tauri Rust — REAL installed/running browsers
    async function loadFloatingPanelBrowsers() {
        const list = document.getElementById('fp-browsers-list');
        const countEl = document.getElementById('fp-browser-count');
        if (!list) return;
        
        if (!window.electronAPI?.detectSystemBrowsers) {
            list.innerHTML = '<div class="fp-error"><i class="fas fa-exclamation-triangle"></i> Browser detection unavailable</div>';
            if (countEl) countEl.textContent = '?';
            return;
        }
        
        try {
            const detection = await window.electronAPI.detectSystemBrowsers();
            
            if (!detection?.browsers) {
                list.innerHTML = '<div class="fp-error"><i class="fas fa-exclamation-circle"></i> No data returned</div>';
                if (countEl) countEl.textContent = '0';
                return;
            }
            
            const installed = detection.browsers.filter(function(b) { return b.isInstalled; });
            const running = installed.filter(function(b) { return b.isRunning; });
            
            if (countEl) countEl.textContent = String(installed.length);
            
            if (installed.length === 0) {
                list.innerHTML = '<div class="fp-error"><i class="fas fa-exclamation-circle"></i> No browsers detected</div>';
                return;
            }
            
            // Sort: running browsers first
            var sorted = installed.slice().sort(function(a, b) {
                if (a.isRunning && !b.isRunning) return -1;
                if (!a.isRunning && b.isRunning) return 1;
                return 0;
            });
            
            var html = '';
            for (var i = 0; i < sorted.length; i++) {
                var b = sorted[i];
                var icon = b.iconClass || getFpBrowserIcon(b.key);
                var isRunning = !!b.isRunning;
                var isDefault = !!b.isDefault;
                var version = b.version ? 'v' + b.version : '';
                var stateClass = isRunning ? 'running' : 'idle';
                var stateLabel = isRunning ? 'Running' : (isDefault ? 'Default' : 'Idle');
                
                html += '<div class="fp-browser-row ' + (isRunning ? 'is-running' : '') + '">'
                    + '<i class="' + icon + '"></i>'
                    + '<span class="fp-browser-name">' + b.name + '</span>'
                    + '<span class="fp-browser-ver">' + version + '</span>'
                    + '<span class="fp-browser-badge ' + stateClass + '">' + stateLabel + '</span>'
                    + '</div>';
            }
            html += '<div class="fp-browsers-summary">' + installed.length + ' installed &bull; ' + running.length + ' running</div>';
            list.innerHTML = html;
            
            console.log('[FloatingPanel] Browsers: ' + installed.length + ' installed, ' + running.length + ' running');
        } catch (e) {
            list.innerHTML = '<div class="fp-error"><i class="fas fa-exclamation-triangle"></i> ' + e.message + '</div>';
            console.error('[FloatingPanel] Browser detection error:', e);
        }
    }
    
    // Backend + ML service status — REAL HTTP calls
    async function loadFloatingPanelBackendStatus() {
        var backendEl = document.getElementById('fp-backend-status');
        var mlEl = document.getElementById('fp-ml-status');
        var agentCountEl = document.getElementById('fp-agent-count');
        var statusDot = document.getElementById('agent-main-status');
        var statusText = document.getElementById('agent-status-text');
        
        var backendUrl = localStorage.getItem('cyberforge_backend_url') || 'https://cyberforge-ddd97655464f.herokuapp.com';
        
        try {
            // Health check
            var backendOk = false;
            try {
                var healthRes = await fetch(backendUrl + '/health', { signal: AbortSignal.timeout(18000) });
                backendOk = healthRes.ok;
            } catch (e) { /* offline */ }

            setChip(backendEl, backendOk ? 'online' : 'offline', backendOk ? 'Connected' : 'Offline');

            // ML service health
            var mlOk = false;
            try {
                var mlRes = await fetch(backendUrl + '/api/cyberforge-ml/health', { signal: AbortSignal.timeout(18000) });
                if (mlRes.ok) {
                    var mlData = await mlRes.json();
                    mlOk = !!(mlData && (mlData.success || mlData.status === 'healthy'));
                }
            } catch (e) { /* offline */ }

            setChip(mlEl, mlOk ? 'online' : 'degraded', mlOk ? 'Healthy' : 'Degraded');

            // Agent status — check if default agent is running, count includes self
            var agentRunning = false;
            var agentCount = 0;
            if (backendOk) {
                try {
                    var token = localStorage.getItem('authToken') || '';
                    var headers = {
                        'Content-Type': 'application/json',
                        'Authorization': token ? 'Bearer ' + token : '',
                        'User-Agent': 'cyber-forge-desktop/1.0'
                    };
                    // Check agent status first (more reliable than list)
                    var statusRes = await fetch(backendUrl + '/api/agent/status/default', {
                        headers: headers,
                        signal: AbortSignal.timeout(15000)
                    });
                    if (statusRes.ok) {
                        var statusData = await statusRes.json();
                        var agentInfo = (statusData && statusData.data) || statusData || {};
                        agentRunning = !!(agentInfo.isRunning || agentInfo.running);
                    }
                    // Also check agents list for total count
                    var agentRes = await fetch(backendUrl + '/api/agent/list', {
                        headers: headers,
                        signal: AbortSignal.timeout(15000)
                    });
                    if (agentRes.ok) {
                        var agentData = await agentRes.json();
                        agentCount = (agentData && agentData.data && agentData.data.count) || (agentData && agentData.count) || 0;
                    }
                } catch (e) { /* agent check failed */ }
            }
            
            // Desktop app is always an active agent when backend is reachable.
            // Count registered agents + 1 (self); never show 0 while connected.
            if (backendOk) {
                agentCount = Math.max(agentCount + 1, 1);
            }

            if (agentCountEl) agentCountEl.textContent = String(agentCount);

            // Desktop app IS the agent — show Active whenever backend is reachable.
            var dotColor = backendOk ? 'var(--cf-status-success,#22c55e)' : 'var(--cf-status-error,#ef4444)';
            if (statusDot) statusDot.style.background = dotColor;
            if (statusText) statusText.textContent = backendOk ? 'Active' : 'Offline';

            fpLog(backendOk ? 'Agent active & synced' : 'Backend unreachable');

        } catch (e) {
            setChip(backendEl, 'offline', 'Error');
            if (statusText) statusText.textContent = 'Error';
            console.error('[FloatingPanel] Backend status error:', e);
        }
    }

    // Updates an agent-conn-chip element's class and text
    function setChip(el, state, label) {
        if (!el) return;
        el.className = 'agent-conn-chip ' + state;
        el.textContent = label;
    }
    
    // =========================================
    // FLOATING PANEL ACTIVITY LOG
    // =========================================
    
    function fpLog(message) {
        var log = document.getElementById('agent-actions-log');
        if (!log) return;
        var time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        var entry = document.createElement('div');
        entry.className = 'action-log-item';
        entry.innerHTML = '<span class="action-time">' + time + '</span><span class="action-text">' + message + '</span>';
        log.insertBefore(entry, log.firstChild);
        while (log.children.length > 15) log.removeChild(log.lastChild);
    }

    // =========================================
    // 8-AGENT ORCHESTRATOR — visualization in floating panel
    // =========================================

    var AGENT_ROSTER = [
        { name: 'url_classifier', icon: 'fa-shield-virus',     label: 'URL Classifier' },
        { name: 'dga_detector',   icon: 'fa-fingerprint',      label: 'DGA Detector' },
        { name: 'web_scraper',    icon: 'fa-spider',           label: 'Web Scraper' },
        { name: 'memory',         icon: 'fa-brain',            label: 'Memory' },
        { name: 'ioc_extractor',  icon: 'fa-magnifying-glass', label: 'IOC Extractor' },
        { name: 'behavioral',     icon: 'fa-eye',              label: 'Behavioral' },
        { name: 'mitre_mapper',   icon: 'fa-crosshairs',       label: 'MITRE Mapper' },
        { name: 'threat_intel',   icon: 'fa-globe',            label: 'Threat Intel' }
    ];

    function _ensureOrchestratorPanel() {
        var existing = document.getElementById('fp-orchestrator-panel');
        if (existing) return existing;
        var host = document.getElementById('agent-panel-body');
        if (!host) return null;
        var section = document.createElement('div');
        section.className = 'agent-section';
        section.id = 'fp-orchestrator-panel';
        section.innerHTML = '\
            <div class="agent-section-label" style="display:flex;align-items:center;justify-content:space-between">\
                <span><i class="fas fa-network-wired"></i> 8-Agent Orchestrator</span>\
                <span class="agent-status-row-value" id="fp-orch-status">Idle</span>\
            </div>\
            <div id="fp-orch-target" style="font-size:10px;color:#94a3b8;font-family:JetBrains Mono,monospace;margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></div>\
            <div id="fp-orch-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px"></div>\
            <div id="fp-orch-result" style="margin-top:8px;font-size:10.5px;color:#94a3b8;display:none">\
                <div id="fp-orch-verdict" style="font-weight:700;margin-bottom:3px"></div>\
                <div id="fp-orch-summary" style="line-height:1.45;color:#cbd5e1"></div>\
            </div>';
        // Insert at top of body
        host.insertBefore(section, host.firstChild);
        // Initial cells
        var grid = section.querySelector('#fp-orch-grid');
        AGENT_ROSTER.forEach(function (a) {
            var cell = document.createElement('div');
            cell.className = 'fp-agent-cell';
            cell.id = 'fp-agent-' + a.name;
            cell.title = a.label;
            cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px 4px;border-radius:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);transition:all 0.2s ease;font-size:9px;text-align:center;min-height:42px';
            cell.innerHTML = '<i class="fas ' + a.icon + '" style="font-size:13px;color:#64748b;margin-bottom:3px"></i><span style="color:#94a3b8;font-weight:600">' + a.label.split(' ')[0] + '</span>';
            grid.appendChild(cell);
        });
        return section;
    }

    function _setAgentCellState(agentName, state) {
        var cell = document.getElementById('fp-agent-' + agentName);
        if (!cell) return;
        var icon = cell.querySelector('i');
        var colors = {
            idle:    { border: 'rgba(255,255,255,0.06)', icon: '#64748b', bg: 'rgba(255,255,255,0.04)' },
            running: { border: 'rgba(245,158,11,0.4)',   icon: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
            ok:      { border: 'rgba(16,185,129,0.4)',   icon: '#10b981', bg: 'rgba(16,185,129,0.08)' },
            failed:  { border: 'rgba(239,68,68,0.4)',    icon: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
        };
        var c = colors[state] || colors.idle;
        cell.style.borderColor = c.border;
        cell.style.background  = c.bg;
        if (icon) icon.style.color = c.icon;
        if (state === 'running' && icon && !icon.classList.contains('fa-spin')) {
            icon.dataset.origClass = icon.className;
            icon.className = 'fas fa-circle-notch fa-spin';
            icon.style.fontSize = '13px';
        } else if (state !== 'running' && icon && icon.dataset.origClass) {
            icon.className = icon.dataset.origClass;
            delete icon.dataset.origClass;
        }
    }

    function notifyOrchestratorStart(url) {
        var panel = _ensureOrchestratorPanel();
        if (!panel) return;
        panel.querySelector('#fp-orch-status').textContent = 'Analyzing';
        panel.querySelector('#fp-orch-status').style.color = '#f59e0b';
        panel.querySelector('#fp-orch-target').textContent = (url || '').slice(0, 60);
        panel.querySelector('#fp-orch-result').style.display = 'none';
        AGENT_ROSTER.forEach(function (a) { _setAgentCellState(a.name, 'running'); });
        fpLog('🛰 8-agent dispatch: ' + (url || '').slice(0, 50));
    }

    function notifyOrchestratorComplete(scanData) {
        var panel = _ensureOrchestratorPanel();
        if (!panel) return;
        var summary = scanData.agentSummary || {};
        AGENT_ROSTER.forEach(function (a) {
            var s = summary[a.name];
            _setAgentCellState(a.name, s?.status === 'ok' ? 'ok' : (s?.status === 'failed' ? 'failed' : 'idle'));
        });
        var verdict = scanData.category || scanData.verdict || 'unknown';
        var risk    = scanData.riskScore || 0;
        var verdictColor = risk >= 65 ? '#ef4444' : risk >= 35 ? '#f59e0b' : risk >= 15 ? '#3b82f6' : '#10b981';
        panel.querySelector('#fp-orch-status').textContent = 'Done · ' + (scanData.durationMs || 0) + 'ms';
        panel.querySelector('#fp-orch-status').style.color = verdictColor;
        var resBox = panel.querySelector('#fp-orch-result');
        resBox.style.display = 'block';
        panel.querySelector('#fp-orch-verdict').innerHTML =
            '<span style="color:' + verdictColor + '">' + verdict.toUpperCase() + '</span>' +
            ' · risk ' + risk + '/100 · ' +
            (scanData.iocs?.length || 0) + ' IOCs · ' +
            (scanData.mitre?.length || 0) + ' MITRE · ' +
            'LLM: ' + (scanData.llmSource || '?');
        panel.querySelector('#fp-orch-summary').textContent =
            (scanData.summary || '').slice(0, 220) + ((scanData.summary || '').length > 220 ? '…' : '');
    }
    
    // =========================================
    // HELPERS
    // =========================================
    
    function getFpBrowserIcon(key) {
        var map = {
            chrome: 'fab fa-chrome', firefox: 'fab fa-firefox-browser',
            edge: 'fab fa-edge', safari: 'fab fa-safari',
            opera: 'fab fa-opera', brave: 'fab fa-brave',
            chromium: 'fab fa-chrome', arc: 'fas fa-globe'
        };
        return map[key] || 'fas fa-globe';
    }

    function getCurrentThemeMode() {
        return document.documentElement.getAttribute('data-theme')
            || document.body.dataset.theme
            || localStorage.getItem('cyberforge-theme')
            || localStorage.getItem('theme')
            || 'dark';
    }

    function getPreferredFloatingPanelStyle(theme) {
        return theme === 'light' ? 'enterprise' : 'ai-lab';
    }

    function applyFloatingPanelStyle(panel, style) {
        if (!panel) return;
        FP_STYLES.forEach(function(name) {
            panel.classList.remove('fp-style-' + name);
        });
        var resolved = FP_STYLES.includes(style) ? style : getPreferredFloatingPanelStyle(getCurrentThemeMode());
        panel.classList.add('fp-style-' + resolved);
        panel.setAttribute('data-fp-style', resolved);
    }

    function initFloatingPanelVisualMode(panel) {
        if (!panel) return;

        var styleMode = localStorage.getItem(FP_STYLE_MODE_KEY) || 'auto';
        var savedStyle = localStorage.getItem(FP_STYLE_KEY);
        var initialStyle = (styleMode === 'manual' && savedStyle)
            ? savedStyle
            : getPreferredFloatingPanelStyle(getCurrentThemeMode());

        applyFloatingPanelStyle(panel, initialStyle);

        var header = panel.querySelector('.agent-panel-header');
        if (header && !header.dataset.fpStyleBound) {
            header.dataset.fpStyleBound = 'true';
            header.title = 'Double-click to cycle panel style, Alt+double-click to return to theme auto mode';

            header.addEventListener('dblclick', function(e) {
                if (e.target.closest('button')) return;

                if (e.altKey) {
                    localStorage.setItem(FP_STYLE_MODE_KEY, 'auto');
                    var autoStyle = getPreferredFloatingPanelStyle(getCurrentThemeMode());
                    localStorage.setItem(FP_STYLE_KEY, autoStyle);
                    applyFloatingPanelStyle(panel, autoStyle);
                    fpLog('Panel style switched to theme auto mode');
                    return;
                }

                var current = panel.getAttribute('data-fp-style') || getPreferredFloatingPanelStyle(getCurrentThemeMode());
                var index = FP_STYLES.indexOf(current);
                var next = FP_STYLES[(index + 1) % FP_STYLES.length];
                localStorage.setItem(FP_STYLE_MODE_KEY, 'manual');
                localStorage.setItem(FP_STYLE_KEY, next);
                applyFloatingPanelStyle(panel, next);
                fpLog('Panel style: ' + next);
            });
        }

        var observer = new MutationObserver(function() {
            var mode = localStorage.getItem(FP_STYLE_MODE_KEY) || 'auto';
            if (mode === 'auto') {
                var autoStyle = getPreferredFloatingPanelStyle(getCurrentThemeMode());
                localStorage.setItem(FP_STYLE_KEY, autoStyle);
                applyFloatingPanelStyle(panel, autoStyle);
                return;
            }
            var manualStyle = localStorage.getItem(FP_STYLE_KEY) || initialStyle;
            applyFloatingPanelStyle(panel, manualStyle);
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }
    
    function makePanelDraggable(panel) {
        var header = panel.querySelector('.agent-panel-header');
        if (!header) return;
        var isDragging = false;
        var initialX, initialY;
        
        header.addEventListener('mousedown', function(e) {
            if (e.target.closest('button')) return;
            isDragging = true;
            initialX = e.clientX - panel.offsetLeft;
            initialY = e.clientY - panel.offsetTop;
            panel.style.cursor = 'grabbing';
        });
        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            e.preventDefault();
            var x = Math.max(0, Math.min(e.clientX - initialX, window.innerWidth - panel.offsetWidth));
            var y = Math.max(0, Math.min(e.clientY - initialY, window.innerHeight - panel.offsetHeight));
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
            panel.style.left = x + 'px';
            panel.style.top = y + 'px';
        });
        document.addEventListener('mouseup', function() {
            if (isDragging) {
                isDragging = false;
                panel.style.cursor = '';
                localStorage.setItem('agent-panel-x', panel.style.left);
                localStorage.setItem('agent-panel-y', panel.style.top);
            }
        });
        var savedX = localStorage.getItem('agent-panel-x');
        var savedY = localStorage.getItem('agent-panel-y');
        if (savedX && savedY) {
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
            panel.style.left = savedX;
            panel.style.top = savedY;
        }
    }

    // =========================================
    // HEADER ENHANCEMENTS
    // =========================================
    
    function initHeaderEnhancements() {
        var themeToggle = document.getElementById('theme-toggle');
        var privacyMode = document.getElementById('header-privacy-mode');
        var themeObserver = null;

        function syncThemeState() {
            var rootTheme = document.documentElement.getAttribute('data-theme')
                || localStorage.getItem('cyberforge-theme')
                || localStorage.getItem('theme')
                || 'dark';

            document.body.dataset.theme = rootTheme;
            localStorage.setItem('theme', rootTheme);

            var icon = themeToggle ? themeToggle.querySelector('i') : null;
            if (icon) icon.className = rootTheme === 'light' ? 'fas fa-sun' : 'fas fa-moon';
        }
        
        if (themeToggle) {
            var managedByMainApp = themeToggle.getAttribute('data-theme-managed') === 'true';
            if (!managedByMainApp) {
                themeToggle.addEventListener('click', function() {
                    var currentTheme = getCurrentThemeMode();
                    var newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                    document.documentElement.setAttribute('data-theme', newTheme);
                    localStorage.setItem('cyberforge-theme', newTheme);
                    syncThemeState();
                });
            }

            syncThemeState();
            themeObserver = new MutationObserver(syncThemeState);
            themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        }
        
        if (privacyMode) {
            var isPrivate = localStorage.getItem('privacy-mode') === 'true';
            if (isPrivate) privacyMode.classList.add('active');
            privacyMode.addEventListener('click', function() {
                isPrivate = !isPrivate;
                privacyMode.classList.toggle('active');
                localStorage.setItem('privacy-mode', String(isPrivate));
            });
        }
        
        var deviceName = document.getElementById('device-name');
        if (deviceName) deviceName.textContent = localStorage.getItem('device-name') || 'Device-001';

        if (themeObserver) {
            window.addEventListener('beforeunload', function() {
                themeObserver.disconnect();
            }, { once: true });
        }
    }

    // =========================================
    // INITIALIZATION
    // =========================================
    
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }
        
        console.log('[AgentUI] Initializing with real system data...');
        initHierarchicalSidebar();
        initFloatingAgentPanel();
        initHeaderEnhancements();
        
        window.CyberForgeAgentUI = {
            refreshBrowsers: loadFloatingPanelBrowsers,
            refreshStats: loadFloatingPanelSystemStats,
            refreshBackend: loadFloatingPanelBackendStatus,
            resyncAll: loadFloatingPanelData,
            fpLog: fpLog,
            // 8-agent orchestrator UI hooks
            notifyOrchestratorStart,
            notifyOrchestratorComplete,
        };

        // Expose orchestrator notify for Quick Scan modal
        window._cfOrchestratorNotify = function(event, data) {
            if (event === 'start' && data) notifyOrchestratorStart(data);
            else if (event === 'complete' && data) notifyOrchestratorComplete(data);
        };

        // Screen enter animation — apply cf-screen-enter class each time
        // a new screen is injected into #screen-container
        (function() {
            var sc = document.getElementById('screen-container');
            if (!sc || typeof MutationObserver === 'undefined') return;
            var obs = new MutationObserver(function(muts) {
                muts.forEach(function(m) {
                    m.addedNodes.forEach(function(node) {
                        if (node.nodeType === 1) {
                            node.classList.add('cf-screen-enter');
                            // Re-trigger AOS if loaded
                            if (typeof AOS !== 'undefined') {
                                setTimeout(function() { AOS.refresh(); }, 50);
                            }
                        }
                    });
                });
            });
            obs.observe(sc, { childList: true });
        })();

        console.log('[AgentUI] Initialization complete');
    }
    
    init();
})();
