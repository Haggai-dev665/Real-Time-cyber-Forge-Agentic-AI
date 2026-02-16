/**
 * CyberForge Agent UI Controller
 * Handles floating agent panel with REAL system data from Tauri & backend.
 * No mock data, no simulations, no fake entries.
 */

(function() {
    'use strict';

    let _fpStatsInterval = null;
    let _fpBrowsersInterval = null;

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
        
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                panel.classList.toggle('minimized');
                const icon = minimizeBtn.querySelector('i');
                icon.className = panel.classList.contains('minimized') ? 'fas fa-window-maximize' : 'fas fa-window-minimize';
                localStorage.setItem('agent-panel-minimized', panel.classList.contains('minimized'));
            });
        }
        
        if (hideBtn) {
            hideBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                panel.classList.add('hidden');
                localStorage.setItem('agent-panel-hidden', 'true');
            });
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
        
        // Restore saved panel state
        // Do not auto-hide on startup to avoid visible flicker (appears then disappears).
        panel.classList.remove('hidden');
        if (localStorage.getItem('agent-panel-hidden') === 'true') {
            localStorage.setItem('agent-panel-hidden', 'false');
        }
        if (localStorage.getItem('agent-panel-minimized') === 'true') {
            panel.classList.add('minimized');
            if (minimizeBtn) minimizeBtn.querySelector('i').className = 'fas fa-window-maximize';
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
                var healthRes = await fetch(backendUrl + '/health', { signal: AbortSignal.timeout(5000) });
                backendOk = healthRes.ok;
            } catch (e) { /* offline */ }
            
            if (backendEl) {
                backendEl.textContent = backendOk ? 'Connected' : 'Offline';
                backendEl.style.color = backendOk ? '#27AE60' : '#C0392B';
            }
            
            // ML service health
            var mlOk = false;
            try {
                var mlRes = await fetch(backendUrl + '/api/cyberforge-ml/health', { signal: AbortSignal.timeout(5000) });
                if (mlRes.ok) {
                    var mlData = await mlRes.json();
                    mlOk = !!(mlData && (mlData.success || mlData.status === 'healthy'));
                }
            } catch (e) { /* offline */ }
            
            if (mlEl) {
                mlEl.textContent = mlOk ? 'Healthy' : 'Degraded';
                mlEl.style.color = mlOk ? '#27AE60' : '#E67E22';
            }
            
            // Agent count
            var agentCount = 0;
            if (backendOk) {
                try {
                    var token = localStorage.getItem('authToken') || '';
                    var agentRes = await fetch(backendUrl + '/api/agent/list', {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': token ? 'Bearer ' + token : '',
                            'User-Agent': 'cyber-forge-desktop/1.0'
                        },
                        signal: AbortSignal.timeout(5000)
                    });
                    if (agentRes.ok) {
                        var agentData = await agentRes.json();
                        agentCount = (agentData && agentData.data && agentData.data.count) || (agentData && agentData.count) || 0;
                    }
                } catch (e) { /* agent list failed */ }
            }
            
            if (agentCountEl) agentCountEl.textContent = String(agentCount);
            
            // Update status indicator
            if (statusDot) statusDot.style.background = backendOk ? '#27AE60' : '#C0392B';
            if (statusText) statusText.textContent = backendOk ? 'Connected' : 'Offline';
            
            fpLog(backendOk ? 'Backend synced' : 'Backend unreachable');
            
        } catch (e) {
            if (backendEl) { backendEl.textContent = 'Error'; backendEl.style.color = '#C0392B'; }
            if (statusText) statusText.textContent = 'Error';
            console.error('[FloatingPanel] Backend status error:', e);
        }
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
        
        if (themeToggle) {
            themeToggle.addEventListener('click', function() {
                var currentTheme = document.body.dataset.theme || 'dark';
                var newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                document.body.dataset.theme = newTheme;
                localStorage.setItem('theme', newTheme);
                var icon = themeToggle.querySelector('i');
                if (icon) icon.className = newTheme === 'light' ? 'fas fa-sun' : 'fas fa-moon';
            });
            var savedTheme = localStorage.getItem('theme') || 'dark';
            var icon = themeToggle.querySelector('i');
            if (savedTheme === 'light' && icon) icon.className = 'fas fa-sun';
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
            fpLog: fpLog
        };
        
        console.log('[AgentUI] Initialization complete');
    }
    
    init();
})();
