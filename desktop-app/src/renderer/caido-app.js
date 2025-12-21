// Caido-style Desktop App Controller
// Handles navigation, table rendering, context menu, and interactions

(() => {
  // Import API client
  const { cyberforgeAPI } = typeof require !== 'undefined' 
    ? require('./api-client.js') 
    : { cyberforgeAPI: window.cyberforgeAPI };

  const state = {
    activeScreen: 'http-history',
    activeTab: 'requests',
    requests: [],
    intercepts: [],
    wsHistory: [],
    matchRules: [],
    findings: [],
    files: [],
    threats: [],
    analysisStats: null,
    threatStats: null,
    selectedRequestId: null,
    sidebarCollapsed: false,
    backendConnected: false,
    conversationId: null
  };

  const sampleRequests = [
    {
      id: 1,
      host: 'www.gstatic.com',
      method: 'GET',
      path: '/generate_204',
      query: '',
      status: 204,
      scheme: 'https',
      headers: [
        'GET /generate_204 HTTP/1.1',
        'Host: www.gstatic.com',
        'Connection: keep-alive',
        'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'Accept: */*'
      ]
    },
    {
      id: 2,
      host: 'download.vsa.vw',
      method: 'GET',
      path: '/ddg/tds-v2-current.json',
      query: '',
      status: 200,
      scheme: 'https',
      headers: [
        'GET /ddg/tds-v2-current.json HTTP/1.1',
        'Host: download.vsa.vw',
        'Connection: keep-alive',
        'User-Agent: Mozilla/5.0',
        'Accept: application/json'
      ]
    },
    {
      id: 3,
      host: 'rosneft.ru',
      method: 'GET',
      path: '/443',
      query: '',
      status: 301,
      scheme: 'http',
      headers: [
        'GET /443 HTTP/1.1',
        'Host: rosneft.ru',
        'Connection: keep-alive',
        'User-Agent: Mozilla/5.0',
        'Accept: text/html,application/xhtml+xml'
      ]
    },
    {
      id: 4,
      host: 'www.google-analytics.com',
      method: 'POST',
      path: '/g/collect',
      query: 'v=2&tid=G-NQLTER54VR...',
      status: 200,
      scheme: 'https',
      headers: [
        'POST /g/collect HTTP/1.1',
        'Host: www.google-analytics.com',
        'Content-Type: application/json',
        'User-Agent: Mozilla/5.0',
        'Accept: */*'
      ]
    }
  ];

  const sampleIntercepts = [
    { id: 'I-101', host: 'login.example.com', method: 'POST', path: '/session', status: 200, action: 'Queued' },
    { id: 'I-102', host: 'api.example.com', method: 'GET', path: '/profile', status: 200, action: 'Paused' }
  ];

  const sampleWs = [
    { id: 'WS-1', host: 'chat.example.com', path: '/socket', messages: 42, status: 'Open' },
    { id: 'WS-2', host: 'events.example.com', path: '/stream', messages: 15, status: 'Closed' }
  ];

  const sampleRules = [
    { id: 1, type: 'Replace', match: 'User-Agent', replace: 'Caido-Client/1.0' },
    { id: 2, type: 'Match', match: 'Authorization', replace: '[redacted]' }
  ];

  const sampleFindings = [
    { id: 'F-21', severity: 'High', title: 'Insecure Redirect', path: '/login?next=http://evil.test', status: 'Open' },
    { id: 'F-22', severity: 'Medium', title: 'Missing CSP', path: '/dashboard', status: 'Open' }
  ];

  const sampleFiles = [
    { name: 'collections', children: [ { name: 'default.json' }, { name: 'qa.json' } ] },
    { name: 'plugins', children: [ { name: 'custom-header.js' } ] }
  ];

  // =========================================
  // Backend Integration Functions
  // =========================================

  async function connectToBackend() {
    try {
      const health = await cyberforgeAPI.checkHealth();
      if (health.success) {
        state.backendConnected = true;
        console.log('✅ Connected to CyberForge backend');
        updateConnectionStatus(true);
        
        // Connect WebSocket for real-time updates
        cyberforgeAPI.connectWebSocket();
        
        // Subscribe to real-time events
        cyberforgeAPI.subscribeToThreats(handleThreatAlert);
        cyberforgeAPI.subscribeToAnalysis(handleAnalysisResult);
        
        // Load initial data from backend
        await loadBackendData();
      } else {
        throw new Error('Backend health check failed');
      }
    } catch (error) {
      console.warn('⚠️ Backend not available, using sample data:', error.message);
      state.backendConnected = false;
      updateConnectionStatus(false);
      loadSampleData();
    }
  }

  async function loadBackendData() {
    try {
      // Load analysis stats
      const statsResult = await cyberforgeAPI.getAnalysisStats();
      if (statsResult.success) {
        state.analysisStats = statsResult.data.data;
      }

      // Load threat stats
      const threatStatsResult = await cyberforgeAPI.getThreatStats();
      if (threatStatsResult.success) {
        state.threatStats = threatStatsResult.data.data;
      }

      // Load threats
      const threatsResult = await cyberforgeAPI.getThreats({ limit: 50 });
      if (threatsResult.success && threatsResult.data.data) {
        state.threats = threatsResult.data.data.threats || [];
        // Convert threats to findings format for display
        state.findings = state.threats.map(t => ({
          id: t.id || t._id,
          severity: t.severity || 'Medium',
          title: t.type || t.description || 'Unknown Threat',
          path: t.source || t.url || '',
          status: t.status || 'active'
        }));
      }

      // Load analysis history
      const historyResult = await cyberforgeAPI.getAnalysisHistory(1, 50);
      if (historyResult.success && historyResult.data.data) {
        // Convert analysis history to request format for display
        const analyses = historyResult.data.data.analyses || [];
        state.requests = analyses.map((a, idx) => ({
          id: idx + 1,
          host: extractHost(a.target),
          method: 'GET',
          path: extractPath(a.target),
          query: '',
          status: a.results?.safe ? 200 : 403,
          scheme: 'https',
          analysisId: a._id,
          riskScore: a.results?.risk_score || 0,
          headers: [`Analysis ID: ${a._id}`, `Type: ${a.type}`, `Status: ${a.status}`]
        }));
      }

      console.log('📊 Backend data loaded:', {
        threats: state.threats.length,
        findings: state.findings.length,
        requests: state.requests.length
      });

    } catch (error) {
      console.error('Failed to load backend data:', error);
    }
  }

  function loadSampleData() {
    state.requests = sampleRequests;
    state.intercepts = sampleIntercepts;
    state.wsHistory = sampleWs;
    state.matchRules = sampleRules;
    state.findings = sampleFindings;
    state.files = sampleFiles;
  }

  function extractHost(url) {
    try {
      const u = new URL(url);
      return u.hostname;
    } catch {
      return url || 'unknown';
    }
  }

  function extractPath(url) {
    try {
      const u = new URL(url);
      return u.pathname;
    } catch {
      return '/';
    }
  }

  function updateConnectionStatus(connected) {
    const statusEl = document.getElementById('backend-status');
    if (statusEl) {
      statusEl.className = `caido-badge ${connected ? 'green' : 'red'}`;
      statusEl.textContent = connected ? 'Connected' : 'Offline';
    }
  }

  function handleThreatAlert(threat) {
    console.log('🚨 Threat Alert:', threat);
    // Add to findings and refresh if on findings screen
    state.findings.unshift({
      id: threat.id || `T-${Date.now()}`,
      severity: threat.severity || 'High',
      title: threat.type || 'New Threat Detected',
      path: threat.url || threat.source || '',
      status: 'Open'
    });
    if (state.activeScreen === 'findings') {
      renderFindings();
    }
    // Show notification
    showNotification('Threat Detected', threat.type || 'New security threat detected');
  }

  function handleAnalysisResult(result) {
    console.log('📊 Analysis Result:', result);
    // Could update UI with new analysis results
  }

  function showNotification(title, message) {
    if (Notification.permission === 'granted') {
      new Notification(title, { body: message, icon: '/icon.png' });
    }
  }

  // =========================================
  // Initialization
  // =========================================

  async function init() {
    initTheme();
    bindHeaderControls();
    bindSidebarNav();
    bindTabs();
    bindQueryInput();
    bindActionBar();
    
    // Connect to backend and load data
    await connectToBackend();
    
    renderScreen(state.activeScreen);
    
    // Request notification permission
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  function bindHeaderControls() {
    const recordBtn = document.getElementById('record-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const queueStatus = document.getElementById('queue-status');
    const themeToggle = document.getElementById('theme-toggle');

    recordBtn?.addEventListener('click', () => {
      recordBtn.classList.toggle('active');
      recordBtn.classList.toggle('recording');
    });

    pauseBtn?.addEventListener('click', () => {
      pauseBtn.classList.toggle('active');
      queueStatus.querySelector('span').textContent = pauseBtn.classList.contains('active') ? 'Queuing' : 'Live';
    });

    themeToggle?.addEventListener('click', () => toggleTheme());
  }

  function initTheme() {
    const saved = localStorage.getItem('cyberforge-theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('cyberforge-theme', next);
    updateThemeIcon(next);
  }

  function updateThemeIcon(mode) {
    const themeToggle = document.getElementById('theme-toggle');
    const icon = themeToggle?.querySelector('i');
    if (!icon) return;
    icon.className = mode === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  }

  function bindSidebarNav() {
    const links = document.querySelectorAll('.sidebar-nav-link');
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        links.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        const screen = link.getAttribute('data-screen');
        state.activeScreen = screen;
        renderScreen(screen);
      });
    });

    const collapseBtn = document.getElementById('collapse-sidebar');
    const sidebar = document.getElementById('sidebar');
    collapseBtn?.addEventListener('click', () => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      sidebar.classList.toggle('collapsed', state.sidebarCollapsed);
      collapseBtn.querySelector('span').textContent = state.sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar';
      collapseBtn.querySelector('i').className = state.sidebarCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
    });
  }

  function bindTabs() {
    const tabs = document.querySelectorAll('.caido-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.activeTab = tab.getAttribute('data-tab');
        // For now tabs are cosmetic; could switch datasets later
      });
    });
  }

  function bindQueryInput() {
    const queryInput = document.getElementById('query-input');
    queryInput?.addEventListener('input', () => {
      renderRequestsTable(queryInput.value.trim());
    });
  }

  function bindActionBar() {
    const dropBtn = document.getElementById('drop-btn');
    const forwardBtn = document.getElementById('forward-btn');
    dropBtn?.addEventListener('click', () => alert('Dropped selected request'));
    forwardBtn?.addEventListener('click', () => alert('Forwarded selected request'));
  }

  function renderScreen(screen) {
    const container = document.getElementById('screen-container');
    if (!container) return;

    if (screen === 'http-history') {
      container.innerHTML = buildHttpHistoryLayout();
      renderRequestsTable();
      bindRequestTableEvents();
      bindResizer();
      bindContextMenu();
    } else if (screen === 'intercept') {
      container.innerHTML = buildInterceptLayout();
      renderIntercepts();
    } else if (screen === 'ws-history') {
      container.innerHTML = buildWsLayout();
      renderWsHistory();
    } else if (screen === 'match-replace') {
      container.innerHTML = buildMatchReplaceLayout();
      renderMatchRules();
    } else if (screen === 'replay') {
      container.innerHTML = buildReplayLayout();
      renderRequestsTable();
      bindRequestTableEvents();
    } else if (screen === 'automate') {
      container.innerHTML = buildAutomateLayout();
    } else if (screen === 'workflows') {
      container.innerHTML = buildWorkflowsLayout();
    } else if (screen === 'assistant') {
      container.innerHTML = buildAssistantLayout();
      bindAssistant();
    } else if (screen === 'search') {
      container.innerHTML = buildSearchLayout();
    } else if (screen === 'findings') {
      container.innerHTML = buildFindingsLayout();
      renderFindings();
    } else if (screen === 'exports') {
      container.innerHTML = buildExportsLayout();
    } else if (screen === 'files') {
      container.innerHTML = buildFilesLayout();
      renderFiles();
    } else if (screen === 'plugins') {
      container.innerHTML = buildPluginsLayout();
    } else if (screen === 'workspace') {
      container.innerHTML = buildWorkspaceLayout();
    } else if (screen === 'ai-agent') {
      container.innerHTML = buildAIAgentLayout();
      bindAgentConsole();
    } else {
      container.innerHTML = buildPlaceholder(screen);
    }
  }

  function buildHttpHistoryLayout() {
    return `
      <div class="caido-split-horizontal" id="http-history-screen">
        <div class="caido-panel" style="flex: 1;">
          <div class="caido-table-container">
            <table class="caido-table" id="requests-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Host</th>
                  <th>Method</th>
                  <th>Path</th>
                  <th>Query</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody id="requests-tbody"></tbody>
            </table>
          </div>
        </div>
        <div class="caido-resizer" id="main-resizer"></div>
        <div class="caido-panel" id="detail-panel" style="width: 50%;">
          <div class="caido-panel-header">
            <div class="caido-panel-title">Request Details</div>
            <div class="caido-panel-actions">
              <button class="panel-action-btn" title="Copy"><i class="fas fa-copy"></i></button>
              <button class="panel-action-btn" title="Download"><i class="fas fa-download"></i></button>
            </div>
          </div>
          <div class="caido-panel-content" id="request-detail-content">
            <div class="empty-state">
              <i class="fas fa-mouse-pointer empty-state-icon"></i>
              <div class="empty-state-title">Select a request</div>
              <div class="empty-state-description">Click on a request in the table to view its details</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function buildInterceptLayout() {
    return `
      <div class="caido-panel" style="flex:1;">
        <div class="caido-panel-header">
          <div class="caido-panel-title">Intercept Queue</div>
          <div class="caido-panel-actions">
            <button class="panel-action-btn" title="Drop All"><i class="fas fa-trash"></i></button>
            <button class="panel-action-btn" title="Forward All"><i class="fas fa-arrow-right"></i></button>
          </div>
        </div>
        <div class="caido-table-container">
          <table class="caido-table" id="intercept-table">
            <thead><tr><th>ID</th><th>Host</th><th>Method</th><th>Path</th><th>Status</th><th>Action</th></tr></thead>
            <tbody id="intercept-tbody"></tbody>
          </table>
        </div>
      </div>
    `;
  }

  function buildWsLayout() {
    return `
      <div class="caido-panel" style="flex:1;">
        <div class="caido-panel-header">
          <div class="caido-panel-title">WebSocket History</div>
        </div>
        <div class="caido-table-container">
          <table class="caido-table" id="ws-table">
            <thead><tr><th>ID</th><th>Host</th><th>Path</th><th>Messages</th><th>Status</th></tr></thead>
            <tbody id="ws-tbody"></tbody>
          </table>
        </div>
      </div>
    `;
  }

  function buildMatchReplaceLayout() {
    return `
      <div class="caido-panel" style="flex:1;">
        <div class="caido-panel-header">
          <div class="caido-panel-title">Match & Replace Rules</div>
          <div class="caido-panel-actions">
            <button class="panel-action-btn" id="add-rule"><i class="fas fa-plus"></i></button>
          </div>
        </div>
        <div class="caido-table-container">
          <table class="caido-table" id="rules-table">
            <thead><tr><th>ID</th><th>Type</th><th>Match</th><th>Replace</th></tr></thead>
            <tbody id="rules-tbody"></tbody>
          </table>
        </div>
      </div>
    `;
  }

  function buildReplayLayout() {
    return `
      <div class="caido-split-horizontal" style="flex:1;">
        <div class="caido-panel" style="flex: 1;">
          <div class="caido-panel-header">
            <div class="caido-panel-title">Requests</div>
          </div>
          <div class="caido-table-container">
            <table class="caido-table" id="requests-table">
              <thead><tr><th>ID</th><th>Host</th><th>Method</th><th>Path</th><th>Query</th><th>Status</th></tr></thead>
              <tbody id="requests-tbody"></tbody>
            </table>
          </div>
        </div>
        <div class="caido-resizer" id="main-resizer"></div>
        <div class="caido-panel" id="detail-panel" style="width: 50%;">
          <div class="caido-panel-header">
            <div class="caido-panel-title">Replay Editor</div>
            <div class="caido-panel-actions">
              <button class="panel-action-btn" title="Send"><i class="fas fa-play"></i></button>
            </div>
          </div>
          <div class="caido-panel-content" id="request-detail-content">
            <div class="empty-state">
              <i class="fas fa-mouse-pointer empty-state-icon"></i>
              <div class="empty-state-title">Select a request</div>
              <div class="empty-state-description">Edit and resend the request from here</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function buildAutomateLayout() {
    return buildPlaceholder('Automate (configure jobs and schedules)');
  }

  function buildWorkflowsLayout() {
    return buildPlaceholder('Workflows (compose multi-step tests)');
  }

  function buildAssistantLayout() {
    return `
      <div class="caido-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="caido-panel-header">
          <div class="caido-panel-title">Assistant</div>
        </div>
        <div class="caido-panel-content" id="assistant-messages" style="padding:16px; overflow:auto;"></n+          <div class="empty-state">
            <i class="fas fa-magic empty-state-icon"></i>
            <div class="empty-state-title">Ask the assistant</div>
            <div class="empty-state-description">Type a prompt and get guidance</div>
          </div>
        </div>
        <div style="padding:12px; border-top:1px solid var(--caido-border); display:flex; gap:8px;">
          <input id="assistant-input" class="caido-input" placeholder="Ask about a request, finding, or workflow..." style="flex:1;">
          <button id="assistant-send" class="caido-btn primary">Send</button>
        </div>
      </div>
    `;
  }

  function bindAssistant() {
    const sendBtn = document.getElementById('assistant-send');
    const input = document.getElementById('assistant-input');
    const messages = document.getElementById('assistant-messages');
    const addMessage = (role, text) => {
      const div = document.createElement('div');
      div.style.marginBottom = '8px';
      div.innerHTML = `<div class="caido-badge ${role === 'user' ? 'blue' : 'orange'}">${role}</div><div style="margin-top:4px;">${text}</div>`;
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
    };
    const send = () => {
      const text = input.value.trim();
      if (!text) return;
      addMessage('user', text);
      input.value = '';
      setTimeout(() => addMessage('assistant', 'Acknowledged. I will analyze this request soon.'), 400);
    };
    sendBtn?.addEventListener('click', send);
    input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
  }

  function buildSearchLayout() {
    return `
      <div class="caido-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="caido-panel-header"><div class="caido-panel-title">Search</div></div>
        <div style="padding:12px; display:flex; gap:8px;">
          <input class="caido-input" placeholder="Search HTTP history, WS messages, findings..." style="flex:1;">
          <button class="caido-btn primary">Search</button>
        </div>
        <div class="caido-panel-content">
          <div class="empty-state">
            <i class="fas fa-search empty-state-icon"></i>
            <div class="empty-state-title">No results yet</div>
            <div class="empty-state-description">Enter a query to search captured traffic</div>
          </div>
        </div>
      </div>
    `;
  }

  function buildFindingsLayout() {
    return `
      <div class="caido-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="caido-panel-header"><div class="caido-panel-title">Findings</div></div>
        <div class="caido-table-container">
          <table class="caido-table" id="findings-table">
            <thead><tr><th>ID</th><th>Severity</th><th>Title</th><th>Path</th><th>Status</th></tr></thead>
            <tbody id="findings-tbody"></tbody>
          </table>
        </div>
      </div>
    `;
  }

  function buildExportsLayout() {
    return buildPlaceholder('Exports (generate reports and bundles)');
  }

  function buildFilesLayout() {
    return `
      <div class="caido-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="caido-panel-header"><div class="caido-panel-title">Files</div></div>
        <div class="caido-panel-content" id="files-tree" style="padding:12px;">
        </div>
      </div>
    `;
  }

  function buildPluginsLayout() {
    return buildPlaceholder('Plugins (manage extensions)');
  }

  function buildWorkspaceLayout() {
    return buildPlaceholder('Workspace settings');
  }

  function buildAIAgentLayout() {
    return `
      <div class="caido-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="caido-panel-header">
          <div class="caido-panel-title">AI Agent</div>
          <div class="caido-panel-actions">
            <span class="caido-badge green" id="agent-status">Online</span>
          </div>
        </div>
        <div style="display:flex; gap:16px; padding:16px; border-bottom:1px solid var(--caido-border); flex-wrap:wrap;">
          <div class="caido-badge orange">Context: Security</div>
          <div class="caido-badge blue">Memory: Enabled</div>
          <div class="caido-badge purple">Tasks: 0 pending</div>
        </div>
        <div class="caido-panel-content" id="agent-messages" style="padding:16px; overflow:auto; flex:1;">
          <div class="empty-state">
            <i class="fas fa-brain empty-state-icon"></i>
            <div class="empty-state-title">Agent ready</div>
            <div class="empty-state-description">Send a command or ask for a security analysis.</div>
          </div>
        </div>
        <div style="padding:12px; border-top:1px solid var(--caido-border); display:flex; gap:8px; align-items:center;">
          <input id="agent-input" class="caido-input" placeholder="Ask the agent or issue a task (e.g., analyze URL https://example.com)" style="flex:1;">
          <button id="agent-run" class="caido-btn">Run</button>
          <button id="agent-send" class="caido-btn primary">Send</button>
        </div>
      </div>
    `;
  }

  function bindAgentConsole() {
    const sendBtn = document.getElementById('agent-send');
    const runBtn = document.getElementById('agent-run');
    const input = document.getElementById('agent-input');
    const messages = document.getElementById('agent-messages');
    const addMessage = (role, text) => {
      const wrapper = document.createElement('div');
      wrapper.style.marginBottom = '10px';
      wrapper.innerHTML = `<div class="caido-badge ${role === 'user' ? 'blue' : 'orange'}">${role}</div><div style="margin-top:4px;">${text}</div>`;
      messages.appendChild(wrapper);
      messages.scrollTop = messages.scrollHeight;
    };
    const send = () => {
      const text = input.value.trim();
      if (!text) return;
      addMessage('user', text);
      input.value = '';
      
      // Show typing indicator
      const typingDiv = document.createElement('div');
      typingDiv.id = 'agent-typing';
      typingDiv.innerHTML = '<div class="caido-badge orange">agent</div><div style="margin-top:4px;"><i class="fas fa-spinner fa-spin"></i> Thinking...</div>';
      messages.appendChild(typingDiv);
      messages.scrollTop = messages.scrollHeight;
      
      // Call real backend AI
      try {
        const result = await cyberforgeAPI.chatWithAI(text, state.conversationId, { source: 'desktop' });
        typingDiv.remove();
        
        if (result.success) {
          const response = result.data.response || result.data;
          state.conversationId = result.data.conversationId || state.conversationId;
          addMessage('agent', typeof response === 'string' ? response : JSON.stringify(response, null, 2));
        } else {
          addMessage('agent', `Error: ${result.error || 'Failed to get response'}`);
        }
      } catch (error) {
        typingDiv.remove();
        addMessage('agent', `Connection error: ${error.message}. Backend may be offline.`);
      }
    };
    
    const run = async () => {
      addMessage('agent', 'Starting security scan...');
      try {
        const result = await cyberforgeAPI.scanForThreats([], 'quick');
        if (result.success) {
          addMessage('agent', `Scan complete: ${JSON.stringify(result.data.data || result.data, null, 2)}`);
        } else {
          addMessage('agent', `Scan failed: ${result.error}`);
        }
      } catch (error) {
        addMessage('agent', `Scan error: ${error.message}`);
      }
    };
    sendBtn?.addEventListener('click', send);
    runBtn?.addEventListener('click', run);
    input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
  }

  function buildPlaceholder(screen) {
    const title = screen.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return `
      <div class="empty-state" style="flex:1;">
        <i class="fas fa-layer-group empty-state-icon"></i>
        <div class="empty-state-title">${title}</div>
        <div class="empty-state-description">This section is available. Integrate backend logic here.</div>
      </div>
    `;
  }

  function renderRequestsTable(filterText = '') {
    const tbody = document.getElementById('requests-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const text = filterText.toLowerCase();
    const filtered = state.requests.filter(r =>
      !text ||
      r.host.toLowerCase().includes(text) ||
      r.path.toLowerCase().includes(text) ||
      r.method.toLowerCase().includes(text) ||
      (r.query && r.query.toLowerCase().includes(text))
    );

    filtered.forEach(req => {
      const tr = document.createElement('tr');
      tr.dataset.id = req.id;
      tr.innerHTML = `
        <td>${req.id}</td>
        <td>${req.host}</td>
        <td><span class="method-badge ${req.method.toLowerCase()}">${req.method}</span></td>
        <td>${req.path}</td>
        <td>${req.query || ''}</td>
        <td>${req.status}</td>
      `;
      if (req.id === state.selectedRequestId) {
        tr.classList.add('selected');
      }
      tbody.appendChild(tr);
    });
  }

  function bindRequestTableEvents() {
    const tbody = document.getElementById('requests-tbody');
    const detail = document.getElementById('request-detail-content');

    tbody?.addEventListener('click', (e) => {
      const tr = e.target.closest('tr');
      if (!tr) return;
      const id = Number(tr.dataset.id);
      state.selectedRequestId = id;
      tbody.querySelectorAll('tr').forEach(row => row.classList.remove('selected'));
      tr.classList.add('selected');
      const req = state.requests.find(r => r.id === id);
      if (req) renderRequestDetail(req, detail);
    });
  }

  function renderRequestDetail(req, detailContainer) {
    if (!detailContainer) return;
    const headersHtml = req.headers.map((line, idx) => {
      const first = idx === 0 ? 'first-line' : '';
      const [name, ...rest] = line.split(':');
      if (rest.length === 0) {
        return `<div class="header-line ${first}">${line}</div>`;
      }
      return `<div class="header-line ${first}"><span class="header-name">${name}:</span><span class="header-value">${rest.join(':').trim()}</span></div>`;
    }).join('');

    detailContainer.innerHTML = `
      <div class="request-viewer">
        <div class="request-info">
          <div class="request-url">
            <span class="method-badge ${req.method.toLowerCase()}">${req.method}</span>
            <span class="request-url-text">${req.scheme}://${req.host}${req.path}${req.query ? '?' + req.query : ''}</span>
          </div>
          <div class="request-meta">
            <span>ID: ${req.id}</span>
            <span>Status: ${req.status}</span>
          </div>
        </div>
        <div class="request-headers">
          ${headersHtml}
        </div>
      </div>
    `;
  }

  function renderIntercepts() {
    const tbody = document.getElementById('intercept-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    state.intercepts.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${item.id}</td>
        <td>${item.host}</td>
        <td><span class="method-badge ${item.method.toLowerCase()}">${item.method}</span></td>
        <td>${item.path}</td>
        <td>${item.status}</td>
        <td>${item.action}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderWsHistory() {
    const tbody = document.getElementById('ws-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    state.wsHistory.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${item.id}</td>
        <td>${item.host}</td>
        <td>${item.path}</td>
        <td>${item.messages}</td>
        <td>${item.status}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderMatchRules() {
    const tbody = document.getElementById('rules-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    state.matchRules.forEach(rule => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${rule.id}</td>
        <td>${rule.type}</td>
        <td>${rule.match}</td>
        <td>${rule.replace}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderFindings() {
    const tbody = document.getElementById('findings-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    state.findings.forEach(f => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${f.id}</td>
        <td><span class="caido-badge ${severityColor(f.severity)}">${f.severity}</span></td>
        <td>${f.title}</td>
        <td>${f.path}</td>
        <td>${f.status}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function severityColor(sev) {
    const s = sev.toLowerCase();
    if (s === 'high' || s === 'critical') return 'red';
    if (s === 'medium') return 'orange';
    return 'green';
  }

  function renderFiles() {
    const container = document.getElementById('files-tree');
    if (!container) return;
    const buildNode = (node, depth = 0) => {
      const div = document.createElement('div');
      div.style.marginLeft = depth * 12 + 'px';
      const isDir = !!node.children;
      div.innerHTML = `<span class="text-secondary">${isDir ? '<i class="fas fa-folder"></i>' : '<i class="fas fa-file"></i>'}</span> <span>${node.name}</span>`;
      container.appendChild(div);
      if (isDir) {
        node.children.forEach(child => buildNode(child, depth + 1));
      }
    };
    container.innerHTML = '';
    state.files.forEach(n => buildNode(n));
  }

  function bindResizer() {
    const resizer = document.getElementById('main-resizer');
    const detailPanel = document.getElementById('detail-panel');
    const leftPanel = resizer?.previousElementSibling;
    if (!resizer || !detailPanel || !leftPanel) return;

    let isDragging = false;

    resizer.addEventListener('mousedown', (e) => {
      isDragging = true;
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const containerWidth = resizer.parentElement.getBoundingClientRect().width;
      let leftWidth = e.clientX - leftPanel.getBoundingClientRect().left;
      const min = 300;
      const max = containerWidth - 300;
      if (leftWidth < min) leftWidth = min;
      if (leftWidth > max) leftWidth = max;
      leftPanel.style.flex = '0 0 ' + leftWidth + 'px';
      detailPanel.style.flex = '1 1 0';
    });

    window.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    });
  }

  function bindContextMenu() {
    const menu = document.getElementById('context-menu');
    const table = document.getElementById('requests-table');
    if (!menu || !table) return;

    const hideMenu = () => { menu.style.display = 'none'; };

    table.addEventListener('contextmenu', (e) => {
      const tr = e.target.closest('tr');
      if (!tr) return;
      e.preventDefault();
      const { clientX: x, clientY: y } = e;
      menu.style.left = `${x}px`;
      menu.style.top = `${y}px`;
      menu.style.display = 'block';
      state.selectedRequestId = Number(tr.dataset.id);
      table.querySelectorAll('tr').forEach(row => row.classList.remove('selected'));
      tr.classList.add('selected');
    });

    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target)) hideMenu();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
