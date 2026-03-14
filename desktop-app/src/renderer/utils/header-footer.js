// CyberForge Header/Footer & Navigation Utilities
// Extracted from cyberforge-app.js for modularity.

(function () {
  'use strict';

  // ── Own cyberforgeAPI proxy (same pattern as main app) ─────────────
  let importedAPI = null;
  if (typeof require !== 'undefined') {
    try {
      const apiModule = require('./api-client.js');
      importedAPI = apiModule?.cyberforgeAPI || apiModule?.default?.cyberforgeAPI || null;
    } catch (error) {
      console.warn('[CyberForge:HeaderFooter] Could not require api-client.js, falling back to window API:', error?.message || error);
    }
  }

  function resolveAPIClient() {
    return importedAPI || window.cyberforgeAPI || window.apiClient || null;
  }

  const cyberforgeAPI = new Proxy({}, {
    get(_target, prop) {
      const api = resolveAPIClient();
      const value = api?.[prop];
      if (typeof value === 'function') {
        return value.bind(api);
      }
      return value;
    }
  });

  // ── showToast wrapper via CyberForgeToast ──────────────────────────
  function showToast(type, title, message) {
    if (window.CyberForgeToast?.showToast) {
      window.CyberForgeToast.showToast(type, title, message);
    }
  }

  // ── Bridge proxies for main-app shared state ───────────────────────
  function _getAppState() { return window.CyberForgeApp?.state || {}; }
  function _getAgentState() { return window.CyberForgeApp?.agentState || {}; }

  const state = new Proxy({}, {
    get(_t, prop) { return _getAppState()[prop]; },
    set(_t, prop, value) { const s = _getAppState(); s[prop] = value; return true; }
  });

  const agentState = new Proxy({}, {
    get(_t, prop) { return _getAgentState()[prop]; },
    set(_t, prop, value) { const s = _getAgentState(); s[prop] = value; return true; }
  });

  // ── Bridge functions to main app ───────────────────────────────────
  function renderScreen(screen) { if (window.CyberForgeApp?.renderScreen) window.CyberForgeApp.renderScreen(screen); }
  function updateConnectionStatus(...args) { if (window.CyberForgeApp?.updateConnectionStatus) window.CyberForgeApp.updateConnectionStatus(...args); }
  function logAgentAction(...args) { if (window.CyberForgeApp?.logAgentAction) window.CyberForgeApp.logAgentAction(...args); }
  function setAgentState(...args) { if (window.CyberForgeApp?.setAgentState) window.CyberForgeApp.setAgentState(...args); }

  // ── Local module state ─────────────────────────────────────────────
  const systemStats = {
    uptime: 0,
    cpu: 0,
    memory: 0,
    network: 0,
    requests: 0,
    threats: 0,
    events: 0,
    sessions: 1
  };

  // =========================================
  // EXTRACTED FUNCTIONS
  // =========================================

  async function syncDeviceIdentity() {
    const deviceNameEl = document.getElementById('device-name');
    const deviceChipEl = document.getElementById('header-device-id');
    if (!deviceNameEl) return;

    const fallbackName = localStorage.getItem('cyberforge_device_id') || 'Local Device';
    deviceNameEl.textContent = fallbackName;

    try {
      const result = await window.electronAPI?.getSystemStats?.();
      if (!(result?.success && result?.data)) return;

      const hostname = result.data.hostname || fallbackName;
      const osName = result.data.os_name || result.data.platform || '';
      const osVersion = result.data.os_version || '';
      const detail = [osName, osVersion].filter(Boolean).join(' ');

      deviceNameEl.textContent = hostname;
      if (deviceChipEl) {
        deviceChipEl.title = detail ? `${hostname} • ${detail}` : hostname;
      }
    } catch (_) {
      // Keep fallback values if unavailable.
    }
  }

  function startBackendStatusSync() {
    let firstRun = true;
    const refresh = async () => {
      // Only show "Checking..." on first run, not on periodic refreshes
      if (firstRun) {
        updateConnectionStatus(state.backendConnected, { pending: true });
        firstRun = false;
      }

      try {
        const health = await cyberforgeAPI.checkHealth();
        const connected = Boolean(health?.success);
        state.backendConnected = connected;
        updateConnectionStatus(connected, { checkedAt: new Date() });
      } catch (_) {
        state.backendConnected = false;
        updateConnectionStatus(false, { checkedAt: new Date() });
      }
    };

    refresh();
    setInterval(refresh, 30000);
  }

  function initHeaderFooter() {
    updateConnectionStatus(state.backendConnected, { pending: true });

    // Global search functionality
    const globalSearch = document.getElementById('global-search');
    if (globalSearch) {
      globalSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const query = globalSearch.value.trim();
          if (query) {
            performGlobalSearch(query);
          }
        }
      });
      
      // Keyboard shortcut Cmd+K / Ctrl+K
      document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault();
          globalSearch.focus();
        }
      });
    }
    
    // Notifications button — handled by bindHeaderControls() to avoid duplicate listeners
    // (bindHeaderControls wires the bell to open event feed panel)
    
    // Stop button functionality
    const stopBtn = document.getElementById('stop-btn');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        setAgentState('idle');
        logAgentAction('Recording stopped by user', 'warning');
        showToast('info', 'Recording Stopped', 'Request capture has been stopped');
      });
    }
    
    // Start uptime counter
    startUptimeCounter();
    
    // Start system stats simulation
    startSystemStatsSimulation();

    // Header device identity
    syncDeviceIdentity();
    setInterval(syncDeviceIdentity, 60000);

    // Keep backend badge and footer sync state fresh
    startBackendStatusSync();
    
    // Initialize sidebar child components
    initSidebarChildren();
  }

  function performGlobalSearch(query) {
    const lq = query.toLowerCase();
    logAgentAction(`Global search: "${query}"`, 'info');

    // Smart routing: match query to known screens/sections
    const screenMap = {
      'scan': 'quick-scan',
      'threat': 'findings-critical',
      'alert': 'findings-critical',
      'finding': 'findings-critical',
      'agent': 'agent-control',
      'browser': 'browser-registration',
      'setting': 'settings',
      'config': 'settings',
      'intel': 'browser-intel',
      'domain': 'intel-domains',
      'session': 'intel-sessions',
      'distributed': 'distributed-intelligence',
      'node': 'dist-nodes',
      'heatmap': 'dist-heatmap',
      'correlation': 'dist-correlations',
      'metric': 'dist-global-metrics',
      'weight': 'dist-weights',
      'export': 'exports-reports',
      'plugin': 'plugins-installed',
      'history': 'http-history',
      'websocket': 'ws-history',
      'sitemap': 'sitemap',
      'cve': 'intel-cves',
      'ioc': 'intel-iocs',
    };

    for (const [keyword, screen] of Object.entries(screenMap)) {
      if (lq.includes(keyword)) {
        state.activeScreen = screen;
        renderScreen(screen);
        showToast('info', 'Search Result', `Navigated to ${screen.replace(/-/g, ' ')}`);
        return;
      }
    }

    // If query looks like a URL, trigger a scan
    if (lq.startsWith('http://') || lq.startsWith('https://') || lq.includes('.com') || lq.includes('.org') || lq.includes('.net')) {
      showToast('info', 'URL Detected', `Analyzing: ${query}`);
      cyberforgeAPI.cyberforgeML?.analyzeUrl?.(query).then(result => {
        showToast('info', 'Analysis Complete', `Risk: ${result?.aggregate?.overall_risk_level || 'Unknown'}`);
      }).catch(() => {});
      return;
    }

    // Fallback: navigate to advanced search
    state.activeScreen = 'search-advanced';
    renderScreen('search-advanced');
    showToast('info', 'Searching', `Looking for: "${query}"`);
  }

  function toggleNotificationsPanel() {
    // Toggle event feed panel as notifications
    const eventPanel = document.getElementById('event-feed-panel');
    if (eventPanel) {
      eventPanel.classList.toggle('open');
    }
  }

  function startUptimeCounter() {
    setInterval(() => {
      systemStats.uptime++;
      updateUptimeDisplay();
    }, 1000);
  }

  function updateUptimeDisplay() {
    const hours = Math.floor(systemStats.uptime / 3600);
    const minutes = Math.floor((systemStats.uptime % 3600) / 60);
    const seconds = systemStats.uptime % 60;
    
    const formatted = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    const uptimeEl = document.getElementById('footer-uptime');
    if (uptimeEl) {
      uptimeEl.textContent = `Uptime: ${formatted}`;
    }
  }

  function startSystemStatsSimulation() {
    // Fetch REAL system stats from Tauri backend, not random numbers
    async function fetchRealSystemStats() {
      try {
        const result = await window.electronAPI?.getSystemStats?.();
        if (result?.success && result.data) {
          systemStats.cpu = Math.round(result.data.cpu || 0);
          systemStats.memory = Math.round(result.data.memory || 0);
          systemStats.network = 0;
          updateSystemStatsDisplay();
          updateHeaderStats();
        }
      } catch (e) {
        // Stats polling failed, leave values as-is
      }
    }
    fetchRealSystemStats();
    setInterval(fetchRealSystemStats, 5000);
  }

  function updateSystemStatsDisplay() {
    const cpuEl = document.getElementById('footer-cpu');
    const memEl = document.getElementById('footer-memory');
    const netEl = document.getElementById('footer-network');
    
    if (cpuEl) cpuEl.textContent = `CPU: ${systemStats.cpu}%`;
    if (memEl) memEl.textContent = `MEM: ${systemStats.memory}%`;
    if (netEl) netEl.textContent = `NET: ${systemStats.network} KB/s`;
    
    // Update footer agent status
    const footerAgentDot = document.getElementById('footer-agent-dot');
    const footerAgentText = document.getElementById('footer-agent-text');
    
    if (footerAgentDot) {
      footerAgentDot.className = 'footer-status-dot ' + agentState.status;
    }
    if (footerAgentText) {
      const statusLabels = {
        idle: 'AI Agent: Idle',
        monitoring: 'AI Agent: Monitoring',
        analyzing: 'AI Agent: Analyzing',
        investigating: 'AI Agent: Investigating',
        waiting: 'AI Agent: Waiting',
        blocked: 'AI Agent: Blocked'
      };
      footerAgentText.textContent = statusLabels[agentState.status] || 'AI Agent: Unknown';
    }
  }

  function updateHeaderStats() {
    const requestsEl = document.getElementById('stat-requests');
    const threatsEl = document.getElementById('stat-threats');
    const eventsEl = document.getElementById('stat-events');
    const notifCount = document.getElementById('notification-count');
    
    if (requestsEl) requestsEl.textContent = systemStats.requests;
    if (threatsEl) threatsEl.textContent = agentState.memory.threatsDetected;
    if (eventsEl) eventsEl.textContent = agentState.events.length;
    if (notifCount) {
      const unreadCount = agentState.events.filter(e => e.severity === 'warning' || e.severity === 'critical').length;
      notifCount.textContent = unreadCount;
      notifCount.style.display = unreadCount > 0 ? 'flex' : 'none';
    }
    
    // Update header agent status — use real backend connection status
    const headerAgentStatus = document.getElementById('header-agent-status');
    if (headerAgentStatus) {
      const indicator = headerAgentStatus.querySelector('.agent-status-indicator-mini');
      const label = headerAgentStatus.querySelector('.agent-status-label');
      
      // Determine effective agent status from backend connection + agent state
      let effectiveStatus = agentState.status;
      if (state.backendConnected && effectiveStatus === 'idle') {
        effectiveStatus = 'monitoring'; // If connected to backend, agent is at least monitoring
      }
      
      const colors = {
        idle: '#6b7280',
        monitoring: '#039855',
        analyzing: '#1570EF',
        investigating: '#DC6803',
        waiting: '#6941C6',
        blocked: '#D92D20'
      };
      
      if (indicator) {
        indicator.style.background = colors[effectiveStatus] || '#039855';
      }
      if (label) {
        const statusLabel = state.backendConnected
          ? `Agent ${effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1)}`
          : 'Agent Offline';
        label.textContent = statusLabel;
      }
    }
  }

  function initSidebarChildren() {
    // Find all sidebar items with children and mark them
    const navItems = document.querySelectorAll('.sidebar-nav-item');
    navItems.forEach(item => {
      const link = item.querySelector('.sidebar-nav-link');
      const children = item.querySelector('.sidebar-nav-children');
      
      if (link && children) {
        // Mark as having children for CSS styling
        item.classList.add('has-children');
        
        // Toggle expanded state on click
        link.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // Close other expanded items (accordion behavior)
          const siblingItems = item.parentElement.querySelectorAll('.sidebar-nav-item.expanded');
          siblingItems.forEach(sibling => {
            if (sibling !== item) {
              sibling.classList.remove('expanded');
            }
          });
          
          // Toggle this item
          item.classList.toggle('expanded');

          const screen = link.dataset.screen;
          if (screen) {
            state.activeScreen = screen;
            renderScreen(screen);
            logAgentAction(`Navigated to ${screen}`, 'info');
          }
        });
      }
    });
    
    // Child link click handlers - NOW ROUTES TO CHILD SCREENS
    const childLinks = document.querySelectorAll('.sidebar-child-link');
    childLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Remove active from all child links
        childLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        const screen = link.dataset.screen;
        if (screen) {
          state.activeScreen = screen;
          renderScreen(screen);
          logAgentAction(`Navigated to ${screen}`, 'info');
        }
      });
    });
  }

  function initBrowserMonitorStatus() {
    const statusDot = document.getElementById('browser-monitor-status');
    if (!statusDot) return;
    
    // Style the status dot
    statusDot.style.cssText = `
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--text-secondary);
      margin-left: auto;
    `;
    
    // Setup event listeners for browser connections
    if (window.electronAPI?.systemMonitor) {
      window.electronAPI.systemMonitor.onBrowserConnected((data) => {
        statusDot.style.background = 'var(--accent-green)';
        statusDot.style.boxShadow = '0 0 8px var(--accent-green)';
        statusDot.title = `${data.browser} connected`;
      });
      
      window.electronAPI.systemMonitor.onStatusChange((data) => {
        if (data.status === 'running') {
          statusDot.style.background = 'var(--accent-green)';
          statusDot.style.boxShadow = '0 0 8px var(--accent-green)';
        } else {
          statusDot.style.background = 'var(--text-secondary)';
          statusDot.style.boxShadow = 'none';
        }
      });
    }
    
    // Check initial status
    updateBrowserMonitorStatusDot();
  }
  
  async function updateBrowserMonitorStatusDot() {
    const statusDot = document.getElementById('browser-monitor-status');
    if (!statusDot) return;
    
    try {
      const stats = await window.electronAPI?.systemMonitor?.getStats();
      if (stats && stats.browsersConnected > 0) {
        statusDot.style.background = 'var(--accent-green)';
        statusDot.style.boxShadow = '0 0 8px var(--accent-green)';
        statusDot.title = `${stats.browsersConnected} browser(s) connected`;
      } else {
        statusDot.style.background = 'var(--text-secondary)';
        statusDot.style.boxShadow = 'none';
        statusDot.title = 'No browsers connected';
      }
    } catch (e) {
      // Ignore errors
    }
  }
  
  async function autoStartBrowserMonitoring() {
    try {
      // Auto-start browser monitoring after a short delay
      setTimeout(async () => {
        const result = await window.electronAPI?.systemMonitor?.start();
        if (result?.success && result?.browsersConnected > 0) {
          showToast('info', 'Browser Monitoring', `Connected to ${result.browsersConnected} browser(s)`);
        }
        updateBrowserMonitorStatusDot();
      }, 2000);
    } catch (e) {
      console.log('Auto-start browser monitoring skipped:', e.message);
    }
  }

  // ── Expose public API ──────────────────────────────────────────────
  window.CyberForgeHeaderFooter = {
    systemStats,
    syncDeviceIdentity,
    startBackendStatusSync,
    initHeaderFooter,
    performGlobalSearch,
    toggleNotificationsPanel,
    startUptimeCounter,
    updateUptimeDisplay,
    startSystemStatsSimulation,
    updateSystemStatsDisplay,
    updateHeaderStats,
    initSidebarChildren,
    initBrowserMonitorStatus,
    updateBrowserMonitorStatusDot,
    autoStartBrowserMonitoring
  };
})();
