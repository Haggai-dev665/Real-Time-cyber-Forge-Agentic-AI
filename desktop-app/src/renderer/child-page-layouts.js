/**
 * Child Page Layouts Module
 * Contains all build functions for sidebar child pages
 * This file provides functional layouts for pages that previously showed placeholder content
 */

// Make functions available globally for cyberforge-app.js
window.ChildPageLayouts = (() => {
  
  // =========================================
  // DASHBOARD CHILD PAGES
  // =========================================

  function buildDashboardSecurityLayout() {
    return `
      <div class="child-page-container" id="dashboard-security-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-shield-alt"></i> Security Score</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="refresh-security-score"><i class="fas fa-sync"></i> Refresh</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="security-score-container" id="security-score-display">
            <div class="score-circle">
              <svg viewBox="0 0 100 100" class="score-svg">
                <circle cx="50" cy="50" r="45" fill="none" stroke="var(--cf-bg-light)" stroke-width="8"/>
                <circle cx="50" cy="50" r="45" fill="none" stroke="var(--cf-primary)" stroke-width="8" 
                  stroke-dasharray="283" stroke-dashoffset="70" stroke-linecap="round" class="score-progress"/>
              </svg>
              <div class="score-value" id="security-score-value">--</div>
              <div class="score-label">Security Score</div>
            </div>
          </div>
          <div class="score-breakdown" id="score-breakdown">
            <div class="breakdown-item">
              <span class="breakdown-label">Vulnerability Assessment</span>
              <div class="breakdown-bar"><div class="breakdown-fill green" style="width: 0%"></div></div>
              <span class="breakdown-value" id="vuln-score">--</span>
            </div>
            <div class="breakdown-item">
              <span class="breakdown-label">Configuration Security</span>
              <div class="breakdown-bar"><div class="breakdown-fill blue" style="width: 0%"></div></div>
              <span class="breakdown-value" id="config-score">--</span>
            </div>
            <div class="breakdown-item">
              <span class="breakdown-label">Network Security</span>
              <div class="breakdown-bar"><div class="breakdown-fill orange" style="width: 0%"></div></div>
              <span class="breakdown-value" id="network-score">--</span>
            </div>
            <div class="breakdown-item">
              <span class="breakdown-label">Threat Detection</span>
              <div class="breakdown-bar"><div class="breakdown-fill red" style="width: 0%"></div></div>
              <span class="breakdown-value" id="threat-score">--</span>
            </div>
          </div>
          <div class="recommendations-section" id="security-recommendations">
            <h3><i class="fas fa-lightbulb"></i> Recommendations</h3>
            <div class="recommendations-list" id="recommendations-list">
              <div class="loading-spinner"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function buildDashboardActivityLayout() {
    return `
      <div class="child-page-container" id="dashboard-activity-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-stream"></i> Activity Feed</div>
          <div class="cf-panel-actions">
            <select id="activity-filter" class="cf-select">
              <option value="all">All Activity</option>
              <option value="threats">Threats Only</option>
              <option value="scans">Scans</option>
              <option value="alerts">Alerts</option>
            </select>
            <button class="cf-btn" id="clear-activity"><i class="fas fa-trash"></i> Clear</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="activity-timeline" id="activity-timeline">
            <div class="loading-spinner"></div>
          </div>
        </div>
      </div>
    `;
  }

  function buildDashboardMetricsLayout() {
    return `
      <div class="child-page-container" id="dashboard-metrics-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-chart-line"></i> Live Metrics</div>
          <div class="cf-panel-actions">
            <select id="metrics-timerange" class="cf-select">
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="metrics-grid" id="live-metrics-grid">
            <div class="metric-card">
              <div class="metric-icon"><i class="fas fa-network-wired"></i></div>
              <div class="metric-info">
                <div class="metric-value" id="metric-requests">0</div>
                <div class="metric-label">Requests/min</div>
              </div>
            </div>
            <div class="metric-card">
              <div class="metric-icon"><i class="fas fa-exclamation-triangle"></i></div>
              <div class="metric-info">
                <div class="metric-value" id="metric-threats">0</div>
                <div class="metric-label">Active Threats</div>
              </div>
            </div>
            <div class="metric-card">
              <div class="metric-icon"><i class="fas fa-clock"></i></div>
              <div class="metric-info">
                <div class="metric-value" id="metric-response">0ms</div>
                <div class="metric-label">Avg Response</div>
              </div>
            </div>
            <div class="metric-card">
              <div class="metric-icon"><i class="fas fa-server"></i></div>
              <div class="metric-info">
                <div class="metric-value" id="metric-uptime">100%</div>
                <div class="metric-label">Uptime</div>
              </div>
            </div>
          </div>
          <div class="charts-container" id="metrics-charts">
            <div class="chart-placeholder">
              <i class="fas fa-chart-area"></i>
              <p>Real-time traffic chart</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================
  // SITEMAP CHILD PAGES
  // =========================================

  function buildSitemapTreeLayout() {
    return `
      <div class="child-page-container" id="sitemap-tree-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-sitemap"></i> Sitemap Tree View</div>
          <div class="cf-panel-actions">
            <button class="cf-btn" id="expand-all-sitemap"><i class="fas fa-expand"></i> Expand All</button>
            <button class="cf-btn" id="collapse-all-sitemap"><i class="fas fa-compress"></i> Collapse All</button>
            <button class="cf-btn primary" id="refresh-sitemap"><i class="fas fa-sync"></i> Refresh</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="sitemap-tree" id="sitemap-tree-container">
            <div class="loading-spinner"></div>
          </div>
        </div>
      </div>
    `;
  }

  function buildSitemapGraphLayout() {
    return `
      <div class="child-page-container" id="sitemap-graph-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-project-diagram"></i> Sitemap Graph View</div>
          <div class="cf-panel-actions">
            <button class="cf-btn" id="zoom-in-graph"><i class="fas fa-search-plus"></i></button>
            <button class="cf-btn" id="zoom-out-graph"><i class="fas fa-search-minus"></i></button>
            <button class="cf-btn" id="reset-graph"><i class="fas fa-undo"></i> Reset</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="graph-container" id="sitemap-graph-container">
            <svg id="sitemap-graph-svg" width="100%" height="100%"></svg>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================
  // SCOPES CHILD PAGES
  // =========================================

  function buildScopesActiveLayout() {
    return `
      <div class="child-page-container" id="scopes-active-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-bullseye"></i> Active Scopes</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="add-scope"><i class="fas fa-plus"></i> Add Scope</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="cf-table-container">
            <table class="cf-table" id="active-scopes-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Pattern</th>
                  <th>Type</th>
                  <th>Requests</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="active-scopes-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function buildScopesExcludedLayout() {
    return `
      <div class="child-page-container" id="scopes-excluded-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-ban"></i> Excluded Scopes</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="add-exclusion"><i class="fas fa-plus"></i> Add Exclusion</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="cf-table-container">
            <table class="cf-table" id="excluded-scopes-table">
              <thead>
                <tr>
                  <th>Pattern</th>
                  <th>Reason</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="excluded-scopes-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================
  // FILTERS CHILD PAGES
  // =========================================

  function buildFiltersSavedLayout() {
    return `
      <div class="child-page-container" id="filters-saved-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-bookmark"></i> Saved Filters</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="create-filter"><i class="fas fa-plus"></i> Create Filter</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="filters-list" id="saved-filters-list">
            <div class="loading-spinner"></div>
          </div>
        </div>
      </div>
    `;
  }

  function buildFiltersRecentLayout() {
    return `
      <div class="child-page-container" id="filters-recent-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-history"></i> Recent Filters</div>
          <div class="cf-panel-actions">
            <button class="cf-btn" id="clear-recent-filters"><i class="fas fa-trash"></i> Clear All</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="filters-list" id="recent-filters-list">
            <div class="loading-spinner"></div>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================
  // INTERCEPT CHILD PAGES
  // =========================================

  function buildInterceptRulesLayout() {
    return `
      <div class="child-page-container" id="intercept-rules-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-list-alt"></i> Intercept Rules</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="add-intercept-rule"><i class="fas fa-plus"></i> Add Rule</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="cf-table-container">
            <table class="cf-table" id="intercept-rules-table">
              <thead>
                <tr>
                  <th>Enabled</th>
                  <th>Name</th>
                  <th>Condition</th>
                  <th>Action</th>
                  <th>Priority</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="intercept-rules-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function buildInterceptBreakpointsLayout() {
    return `
      <div class="child-page-container" id="intercept-breakpoints-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-pause-circle"></i> Breakpoints</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="add-breakpoint"><i class="fas fa-plus"></i> Add Breakpoint</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="cf-table-container">
            <table class="cf-table" id="breakpoints-table">
              <thead>
                <tr>
                  <th>Enabled</th>
                  <th>URL Pattern</th>
                  <th>Method</th>
                  <th>Condition</th>
                  <th>Hit Count</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="breakpoints-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================
  // HTTP HISTORY CHILD PAGES
  // =========================================

  function buildHttpFlaggedLayout() {
    return `
      <div class="child-page-container" id="http-flagged-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-flag"></i> Flagged Requests</div>
          <div class="cf-panel-actions">
            <button class="cf-btn" id="unflag-all"><i class="fas fa-flag"></i> Unflag All</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="cf-table-container">
            <table class="cf-table" id="flagged-requests-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Host</th>
                  <th>Method</th>
                  <th>Path</th>
                  <th>Flag Reason</th>
                  <th>Flagged At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="flagged-requests-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function buildHttpErrorsLayout() {
    return `
      <div class="child-page-container" id="http-errors-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-exclamation-circle"></i> Error Responses</div>
          <div class="cf-panel-actions">
            <select id="error-filter" class="cf-select">
              <option value="all">All Errors</option>
              <option value="4xx">4xx Client Errors</option>
              <option value="5xx">5xx Server Errors</option>
            </select>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="cf-table-container">
            <table class="cf-table" id="error-requests-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Host</th>
                  <th>Method</th>
                  <th>Path</th>
                  <th>Status</th>
                  <th>Error Type</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody id="error-requests-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================
  // WEBSOCKET CHILD PAGES
  // =========================================

  function buildWsMessagesLayout() {
    return `
      <div class="child-page-container" id="ws-messages-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-comments"></i> WebSocket Messages</div>
          <div class="cf-panel-actions">
            <select id="ws-connection-filter" class="cf-select">
              <option value="all">All Connections</option>
            </select>
            <button class="cf-btn" id="clear-ws-messages"><i class="fas fa-trash"></i> Clear</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="ws-messages-container" id="ws-messages-container">
            <div class="loading-spinner"></div>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================
  // MATCH & REPLACE CHILD PAGES
  // =========================================

  function buildMatchResponseLayout() {
    return `
      <div class="child-page-container" id="match-response-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-exchange-alt"></i> Response Rules</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="add-response-rule"><i class="fas fa-plus"></i> Add Rule</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="cf-table-container">
            <table class="cf-table" id="response-rules-table">
              <thead>
                <tr>
                  <th>Enabled</th>
                  <th>Name</th>
                  <th>Match Pattern</th>
                  <th>Replace With</th>
                  <th>Scope</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="response-rules-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================
  // REPLAY CHILD PAGES
  // =========================================

  function buildReplayBatchLayout() {
    return `
      <div class="child-page-container" id="replay-batch-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-layer-group"></i> Batch Replay</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="start-batch-replay"><i class="fas fa-play"></i> Start Batch</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="batch-config" id="batch-replay-config">
            <div class="form-group">
              <label>Concurrency</label>
              <input type="number" id="batch-concurrency" value="5" min="1" max="50" class="cf-input">
            </div>
            <div class="form-group">
              <label>Delay (ms)</label>
              <input type="number" id="batch-delay" value="100" min="0" class="cf-input">
            </div>
            <div class="form-group">
              <label>Requests to Replay</label>
              <div class="request-selector" id="batch-request-list">
                <p class="text-secondary">Select requests from HTTP History</p>
              </div>
            </div>
          </div>
          <div class="batch-results" id="batch-results">
            <h4>Results</h4>
            <div class="batch-progress">
              <div class="progress-bar"><div class="progress-fill" id="batch-progress-fill"></div></div>
              <span id="batch-progress-text">0/0</span>
            </div>
            <div class="cf-table-container">
              <table class="cf-table" id="batch-results-table">
                <thead>
                  <tr>
                    <th>Request ID</th>
                    <th>Status</th>
                    <th>Response Time</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody id="batch-results-tbody"></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function buildReplayDiffLayout() {
    return `
      <div class="child-page-container" id="replay-diff-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-columns"></i> Compare Responses</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="compare-responses"><i class="fas fa-balance-scale"></i> Compare</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="diff-selector">
            <div class="diff-select-panel">
              <h4>Original Response</h4>
              <select id="diff-original" class="cf-select">
                <option value="">Select a request...</option>
              </select>
              <div class="response-preview" id="diff-original-preview"></div>
            </div>
            <div class="diff-select-panel">
              <h4>Compare With</h4>
              <select id="diff-compare" class="cf-select">
                <option value="">Select a request...</option>
              </select>
              <div class="response-preview" id="diff-compare-preview"></div>
            </div>
          </div>
          <div class="diff-result" id="diff-result">
            <h4>Differences</h4>
            <div class="diff-view" id="diff-view"></div>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================
  // AUTOMATE CHILD PAGES
  // =========================================

  function buildAutomateIntruderLayout() {
    return `
      <div class="child-page-container" id="automate-intruder-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-crosshairs"></i> Intruder</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="start-intruder"><i class="fas fa-play"></i> Start Attack</button>
          </div>
        </div>
        <div class="cf-split-horizontal">
          <div class="cf-panel" style="flex: 1;">
            <div class="form-group">
              <label>Target URL</label>
              <input type="text" id="intruder-target" class="cf-input" placeholder="https://target.com/api/endpoint">
            </div>
            <div class="form-group">
              <label>Attack Type</label>
              <select id="intruder-attack-type" class="cf-select">
                <option value="sniper">Sniper</option>
                <option value="battering-ram">Battering Ram</option>
                <option value="pitchfork">Pitchfork</option>
                <option value="cluster-bomb">Cluster Bomb</option>
              </select>
            </div>
            <div class="form-group">
              <label>Request Template</label>
              <textarea id="intruder-template" class="cf-textarea" rows="10" placeholder="GET /api/user/§id§ HTTP/1.1"></textarea>
            </div>
            <div class="form-group">
              <label>Payloads</label>
              <textarea id="intruder-payloads" class="cf-textarea" rows="5" placeholder="Enter payloads, one per line..."></textarea>
            </div>
          </div>
          <div class="cf-panel" style="flex: 1;">
            <h4>Results</h4>
            <div class="cf-table-container">
              <table class="cf-table" id="intruder-results-table">
                <thead>
                  <tr>
                    <th>Payload</th>
                    <th>Status</th>
                    <th>Length</th>
                    <th>Time</th>
                    <th>Errors</th>
                  </tr>
                </thead>
                <tbody id="intruder-results-tbody"></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function buildAutomateFuzzerLayout() {
    return `
      <div class="child-page-container" id="automate-fuzzer-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-random"></i> Fuzzer</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="start-fuzzer"><i class="fas fa-play"></i> Start Fuzzing</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="fuzzer-config">
            <div class="form-group">
              <label>Fuzzing Target</label>
              <input type="text" id="fuzzer-target" class="cf-input" placeholder="https://target.com">
            </div>
            <div class="form-group">
              <label>Fuzzing Mode</label>
              <select id="fuzzer-mode" class="cf-select">
                <option value="parameter">Parameter Fuzzing</option>
                <option value="header">Header Fuzzing</option>
                <option value="path">Path Fuzzing</option>
                <option value="body">Body Fuzzing</option>
              </select>
            </div>
            <div class="form-group">
              <label>Wordlist</label>
              <select id="fuzzer-wordlist" class="cf-select">
                <option value="common">Common Payloads</option>
                <option value="sqli">SQL Injection</option>
                <option value="xss">XSS Payloads</option>
                <option value="lfi">LFI/Path Traversal</option>
                <option value="custom">Custom Wordlist</option>
              </select>
            </div>
          </div>
          <div class="fuzzer-results" id="fuzzer-results">
            <h4>Fuzzing Results</h4>
            <div class="cf-table-container">
              <table class="cf-table" id="fuzzer-results-table">
                <thead>
                  <tr>
                    <th>Payload</th>
                    <th>Response</th>
                    <th>Anomaly</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody id="fuzzer-results-tbody"></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function buildAutomatePayloadsLayout() {
    return `
      <div class="child-page-container" id="automate-payloads-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-database"></i> Payload Manager</div>
          <div class="cf-panel-actions">
            <button class="cf-btn" id="import-payloads"><i class="fas fa-upload"></i> Import</button>
            <button class="cf-btn primary" id="create-payload-list"><i class="fas fa-plus"></i> New List</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="payload-lists" id="payload-lists">
            <div class="payload-list-item">
              <div class="payload-list-info">
                <i class="fas fa-list"></i>
                <span class="payload-list-name">Common Passwords</span>
                <span class="payload-list-count">10,000 payloads</span>
              </div>
              <div class="payload-list-actions">
                <button class="cf-btn small"><i class="fas fa-eye"></i></button>
                <button class="cf-btn small"><i class="fas fa-edit"></i></button>
                <button class="cf-btn small danger"><i class="fas fa-trash"></i></button>
              </div>
            </div>
            <div class="payload-list-item">
              <div class="payload-list-info">
                <i class="fas fa-list"></i>
                <span class="payload-list-name">SQL Injection</span>
                <span class="payload-list-count">500 payloads</span>
              </div>
              <div class="payload-list-actions">
                <button class="cf-btn small"><i class="fas fa-eye"></i></button>
                <button class="cf-btn small"><i class="fas fa-edit"></i></button>
                <button class="cf-btn small danger"><i class="fas fa-trash"></i></button>
              </div>
            </div>
            <div class="payload-list-item">
              <div class="payload-list-info">
                <i class="fas fa-list"></i>
                <span class="payload-list-name">XSS Payloads</span>
                <span class="payload-list-count">300 payloads</span>
              </div>
              <div class="payload-list-actions">
                <button class="cf-btn small"><i class="fas fa-eye"></i></button>
                <button class="cf-btn small"><i class="fas fa-edit"></i></button>
                <button class="cf-btn small danger"><i class="fas fa-trash"></i></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================
  // WORKFLOWS CHILD PAGES
  // =========================================

  function buildWorkflowsActiveLayout() {
    return `
      <div class="child-page-container" id="workflows-active-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-play-circle"></i> Active Workflows</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="create-workflow"><i class="fas fa-plus"></i> New Workflow</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="cf-table-container">
            <table class="cf-table" id="active-workflows-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Started</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="active-workflows-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function buildWorkflowsTemplatesLayout() {
    return `
      <div class="child-page-container" id="workflows-templates-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-copy"></i> Workflow Templates</div>
          <div class="cf-panel-actions">
            <button class="cf-btn" id="import-template"><i class="fas fa-upload"></i> Import</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="templates-grid" id="workflow-templates-grid">
            <div class="template-card">
              <div class="template-icon"><i class="fas fa-search"></i></div>
              <div class="template-name">Vulnerability Scan</div>
              <div class="template-desc">Full vulnerability assessment workflow</div>
              <button class="cf-btn primary small">Use Template</button>
            </div>
            <div class="template-card">
              <div class="template-icon"><i class="fas fa-user-secret"></i></div>
              <div class="template-name">Penetration Test</div>
              <div class="template-desc">Complete pentest workflow</div>
              <button class="cf-btn primary small">Use Template</button>
            </div>
            <div class="template-card">
              <div class="template-icon"><i class="fas fa-shield-alt"></i></div>
              <div class="template-name">Security Audit</div>
              <div class="template-desc">Comprehensive security review</div>
              <button class="cf-btn primary small">Use Template</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function buildWorkflowsHistoryLayout() {
    return `
      <div class="child-page-container" id="workflows-history-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-history"></i> Workflow History</div>
          <div class="cf-panel-actions">
            <button class="cf-btn" id="clear-workflow-history"><i class="fas fa-trash"></i> Clear History</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="cf-table-container">
            <table class="cf-table" id="workflows-history-table">
              <thead>
                <tr>
                  <th>Workflow</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Results</th>
                  <th>Completed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="workflows-history-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================
  // ASSISTANT CHILD PAGES
  // =========================================

  function buildAssistantChatLayout() {
    return `
      <div class="child-page-container" id="assistant-chat-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-robot"></i> AI Assistant Chat</div>
          <div class="cf-panel-actions">
            <button class="cf-btn" id="clear-chat"><i class="fas fa-trash"></i> Clear Chat</button>
            <button class="cf-btn" id="export-chat"><i class="fas fa-download"></i> Export</button>
          </div>
        </div>
        <div class="cf-panel-content chat-container">
          <div class="chat-messages" id="assistant-chat-messages">
            <div class="chat-message ai">
              <div class="message-avatar"><i class="fas fa-robot"></i></div>
              <div class="message-content">
                <p>Hello! I'm your CyberForge AI Assistant. I can help you with:</p>
                <ul>
                  <li>Security analysis and vulnerability assessment</li>
                  <li>Threat detection and investigation</li>
                  <li>Best practices and recommendations</li>
                  <li>Explaining security concepts</li>
                </ul>
                <p>How can I assist you today?</p>
              </div>
            </div>
          </div>
          <div class="chat-input-container">
            <textarea id="assistant-chat-input" class="cf-textarea" placeholder="Ask me anything about security..." rows="2"></textarea>
            <button class="cf-btn primary" id="send-assistant-message"><i class="fas fa-paper-plane"></i></button>
          </div>
        </div>
      </div>
    `;
  }

  function buildAssistantSuggestionsLayout() {
    return `
      <div class="child-page-container" id="assistant-suggestions-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-lightbulb"></i> AI Suggestions</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="refresh-suggestions"><i class="fas fa-sync"></i> Refresh</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="suggestions-list" id="ai-suggestions-list">
            <div class="suggestion-card high">
              <div class="suggestion-priority"><i class="fas fa-exclamation-circle"></i> High Priority</div>
              <div class="suggestion-title">Update SSL/TLS Configuration</div>
              <div class="suggestion-desc">Detected weak cipher suites in use. Consider upgrading to TLS 1.3.</div>
              <button class="cf-btn small">Apply Fix</button>
            </div>
            <div class="suggestion-card medium">
              <div class="suggestion-priority"><i class="fas fa-info-circle"></i> Medium Priority</div>
              <div class="suggestion-title">Enable Rate Limiting</div>
              <div class="suggestion-desc">API endpoints lack rate limiting, making them vulnerable to brute force.</div>
              <button class="cf-btn small">View Details</button>
            </div>
            <div class="suggestion-card low">
              <div class="suggestion-priority"><i class="fas fa-check-circle"></i> Low Priority</div>
              <div class="suggestion-title">Add Security Headers</div>
              <div class="suggestion-desc">Missing CSP and X-Frame-Options headers detected.</div>
              <button class="cf-btn small">View Details</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================
  // AI MODELS CHILD PAGES
  // =========================================

  function buildModelsTrainedLayout() {
    return `
      <div class="child-page-container" id="models-trained-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-brain"></i> Trained Models</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="deploy-model"><i class="fas fa-rocket"></i> Deploy Model</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="cf-table-container">
            <table class="cf-table" id="trained-models-table">
              <thead>
                <tr>
                  <th>Model Name</th>
                  <th>Type</th>
                  <th>Accuracy</th>
                  <th>Status</th>
                  <th>Last Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="trained-models-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function buildModelsTrainingLayout() {
    return `
      <div class="child-page-container" id="models-training-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-cogs"></i> Models In Training</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="start-training"><i class="fas fa-play"></i> Start New Training</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="training-jobs" id="training-jobs-list">
            <div class="training-job">
              <div class="training-job-header">
                <span class="training-job-name">Malware Detection v2</span>
                <span class="cf-badge blue">Training</span>
              </div>
              <div class="training-progress">
                <div class="progress-bar"><div class="progress-fill" style="width: 45%"></div></div>
                <span>45% - Epoch 23/50</span>
              </div>
              <div class="training-metrics">
                <span>Loss: 0.0234</span>
                <span>Accuracy: 94.2%</span>
                <span>ETA: 2h 15m</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function buildModelsDatasetsLayout() {
    return `
      <div class="child-page-container" id="models-datasets-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-database"></i> Training Datasets</div>
          <div class="cf-panel-actions">
            <button class="cf-btn" id="import-dataset"><i class="fas fa-upload"></i> Import</button>
            <button class="cf-btn primary" id="create-dataset"><i class="fas fa-plus"></i> Create Dataset</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="cf-table-container">
            <table class="cf-table" id="datasets-table">
              <thead>
                <tr>
                  <th>Dataset Name</th>
                  <th>Type</th>
                  <th>Samples</th>
                  <th>Size</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="datasets-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================
  // THREAT INTEL CHILD PAGES
  // =========================================

  function buildIntelFeedsLayout() {
    return `
      <div class="child-page-container" id="intel-feeds-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-rss"></i> Threat Feeds</div>
          <div class="cf-panel-actions">
            <button class="cf-btn" id="sync-feeds"><i class="fas fa-sync"></i> Sync All</button>
            <button class="cf-btn primary" id="add-feed"><i class="fas fa-plus"></i> Add Feed</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="cf-table-container">
            <table class="cf-table" id="intel-feeds-table">
              <thead>
                <tr>
                  <th>Feed Name</th>
                  <th>Provider</th>
                  <th>Type</th>
                  <th>Entries</th>
                  <th>Last Sync</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="intel-feeds-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function buildIntelIocsLayout() {
    return `
      <div class="child-page-container" id="intel-iocs-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-fingerprint"></i> Indicators of Compromise</div>
          <div class="cf-panel-actions">
            <input type="text" id="ioc-search" class="cf-input" placeholder="Search IOCs...">
            <button class="cf-btn primary" id="add-ioc"><i class="fas fa-plus"></i> Add IOC</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="ioc-filters">
            <button class="cf-btn filter-btn active" data-filter="all">All</button>
            <button class="cf-btn filter-btn" data-filter="ip">IP Addresses</button>
            <button class="cf-btn filter-btn" data-filter="domain">Domains</button>
            <button class="cf-btn filter-btn" data-filter="hash">File Hashes</button>
            <button class="cf-btn filter-btn" data-filter="url">URLs</button>
          </div>
          <div class="cf-table-container">
            <table class="cf-table" id="iocs-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Value</th>
                  <th>Threat</th>
                  <th>Confidence</th>
                  <th>Source</th>
                  <th>Added</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="iocs-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function buildIntelCvesLayout() {
    return `
      <div class="child-page-container" id="intel-cves-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-bug"></i> CVE Database</div>
          <div class="cf-panel-actions">
            <input type="text" id="cve-search" class="cf-input" placeholder="Search CVEs...">
            <button class="cf-btn" id="sync-cves"><i class="fas fa-sync"></i> Sync</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="cve-stats" id="cve-stats">
            <div class="stat-card">
              <div class="stat-value" id="cve-critical-count">0</div>
              <div class="stat-label">Critical</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" id="cve-high-count">0</div>
              <div class="stat-label">High</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" id="cve-medium-count">0</div>
              <div class="stat-label">Medium</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" id="cve-low-count">0</div>
              <div class="stat-label">Low</div>
            </div>
          </div>
          <div class="cf-table-container">
            <table class="cf-table" id="cves-table">
              <thead>
                <tr>
                  <th>CVE ID</th>
                  <th>Severity</th>
                  <th>CVSS</th>
                  <th>Description</th>
                  <th>Published</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="cves-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================
  // ENVIRONMENT CHILD PAGES
  // =========================================

  function buildEnvVariablesLayout() {
    return `
      <div class="child-page-container" id="env-variables-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-code"></i> Environment Variables</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="add-env-var"><i class="fas fa-plus"></i> Add Variable</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="cf-table-container">
            <table class="cf-table" id="env-vars-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Value</th>
                  <th>Scope</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="env-vars-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function buildEnvSecretsLayout() {
    return `
      <div class="child-page-container" id="env-secrets-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-key"></i> Secrets Manager</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="add-secret"><i class="fas fa-plus"></i> Add Secret</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="cf-table-container">
            <table class="cf-table" id="secrets-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Last Rotated</th>
                  <th>Expires</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="secrets-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================
  // SEARCH CHILD PAGES
  // =========================================

  function buildSearchSavedLayout() {
    return `
      <div class="child-page-container" id="search-saved-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-bookmark"></i> Saved Queries</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="save-current-query"><i class="fas fa-save"></i> Save Current</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="saved-queries-list" id="saved-queries-list">
            <div class="saved-query-item">
              <div class="query-info">
                <i class="fas fa-search"></i>
                <span class="query-name">SQL Injection Patterns</span>
                <span class="query-text text-secondary">status:200 AND body:*error*</span>
              </div>
              <div class="query-actions">
                <button class="cf-btn small"><i class="fas fa-play"></i> Run</button>
                <button class="cf-btn small danger"><i class="fas fa-trash"></i></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================
  // FINDINGS CHILD PAGES
  // =========================================

  function buildFindingsBySeverityLayout(severity) {
    const icon = severity === 'critical' ? 'skull-crossbones' : 
                 severity === 'high' ? 'exclamation-triangle' :
                 severity === 'medium' ? 'exclamation-circle' : 'info-circle';
    const color = severity === 'critical' || severity === 'high' ? 'red' :
                  severity === 'medium' ? 'orange' : 'green';
    
    return `
      <div class="child-page-container" id="findings-${severity}-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title">
            <i class="fas fa-${icon}"></i> ${severity.charAt(0).toUpperCase() + severity.slice(1)} Severity Findings
          </div>
          <div class="cf-panel-actions">
            <button class="cf-btn" id="export-${severity}-findings"><i class="fas fa-download"></i> Export</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="cf-table-container">
            <table class="cf-table" id="${severity}-findings-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Path</th>
                  <th>Status</th>
                  <th>Found</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="${severity}-findings-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================
  // EXPORTS CHILD PAGES
  // =========================================

  function buildExportsDataLayout() {
    return `
      <div class="child-page-container" id="exports-data-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-file-export"></i> Data Export</div>
        </div>
        <div class="cf-panel-content">
          <div class="export-options">
            <h4>Select Data to Export</h4>
            <div class="export-checkboxes">
              <label><input type="checkbox" name="export-requests" checked> HTTP Requests</label>
              <label><input type="checkbox" name="export-findings" checked> Findings</label>
              <label><input type="checkbox" name="export-scans" checked> Scan Results</label>
              <label><input type="checkbox" name="export-configs"> Configuration</label>
            </div>
            <div class="form-group">
              <label>Export Format</label>
              <select id="export-format" class="cf-select">
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
                <option value="xml">XML</option>
                <option value="har">HAR (HTTP Archive)</option>
              </select>
            </div>
            <button class="cf-btn primary" id="start-export"><i class="fas fa-download"></i> Export Data</button>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================
  // FILES CHILD PAGES
  // =========================================

  function buildFilesNotesLayout() {
    return `
      <div class="child-page-container" id="files-notes-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-sticky-note"></i> Notes</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="create-note"><i class="fas fa-plus"></i> New Note</button>
          </div>
        </div>
        <div class="cf-split-horizontal">
          <div class="cf-panel notes-list-panel" style="width: 250px;">
            <div class="notes-list" id="notes-list">
              <div class="note-item active">
                <i class="fas fa-sticky-note"></i>
                <span>Pentest Notes - Target A</span>
              </div>
              <div class="note-item">
                <i class="fas fa-sticky-note"></i>
                <span>Vulnerability Research</span>
              </div>
            </div>
          </div>
          <div class="cf-panel note-editor-panel" style="flex: 1;">
            <textarea id="note-content" class="cf-textarea note-editor" placeholder="Start writing..."></textarea>
          </div>
        </div>
      </div>
    `;
  }

  function buildFilesScriptsLayout() {
    return `
      <div class="child-page-container" id="files-scripts-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-code"></i> Scripts</div>
          <div class="cf-panel-actions">
            <button class="cf-btn" id="import-script"><i class="fas fa-upload"></i> Import</button>
            <button class="cf-btn primary" id="create-script"><i class="fas fa-plus"></i> New Script</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="cf-table-container">
            <table class="cf-table" id="scripts-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Language</th>
                  <th>Last Modified</th>
                  <th>Size</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="scripts-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================
  // PLUGINS CHILD PAGES
  // =========================================

  function buildPluginsMarketplaceLayout() {
    return `
      <div class="child-page-container" id="plugins-marketplace-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-store"></i> Plugin Marketplace</div>
          <div class="cf-panel-actions">
            <input type="text" id="plugin-search" class="cf-input" placeholder="Search plugins...">
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="plugin-categories">
            <button class="cf-btn filter-btn active" data-filter="all">All</button>
            <button class="cf-btn filter-btn" data-filter="security">Security</button>
            <button class="cf-btn filter-btn" data-filter="analysis">Analysis</button>
            <button class="cf-btn filter-btn" data-filter="integration">Integration</button>
          </div>
          <div class="plugins-grid" id="marketplace-plugins-grid">
            <div class="plugin-card">
              <div class="plugin-icon"><i class="fas fa-shield-alt"></i></div>
              <div class="plugin-info">
                <div class="plugin-name">Advanced SQLi Scanner</div>
                <div class="plugin-author">by CyberForge</div>
                <div class="plugin-rating"><i class="fas fa-star"></i> 4.8 (245 reviews)</div>
              </div>
              <button class="cf-btn primary small">Install</button>
            </div>
            <div class="plugin-card">
              <div class="plugin-icon"><i class="fas fa-code"></i></div>
              <div class="plugin-info">
                <div class="plugin-name">JWT Analyzer</div>
                <div class="plugin-author">by SecurityLabs</div>
                <div class="plugin-rating"><i class="fas fa-star"></i> 4.6 (189 reviews)</div>
              </div>
              <button class="cf-btn primary small">Install</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================
  // WORKSPACE CHILD PAGES
  // =========================================

  function buildWorkspaceTeamLayout() {
    return `
      <div class="child-page-container" id="workspace-team-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-users"></i> Team Members</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="invite-member"><i class="fas fa-user-plus"></i> Invite Member</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="cf-table-container">
            <table class="cf-table" id="team-members-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="team-members-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================
  // SYNC STATUS CHILD PAGES
  // =========================================

  function buildSyncHistoryLayout() {
    return `
      <div class="child-page-container" id="sync-history-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-history"></i> Sync History</div>
          <div class="cf-panel-actions">
            <button class="cf-btn" id="clear-sync-history"><i class="fas fa-trash"></i> Clear</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="cf-table-container">
            <table class="cf-table" id="sync-history-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody id="sync-history-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================
  // BROWSER EXTENSION CHILD PAGES
  // =========================================

  function buildExtSettingsLayout() {
    return `
      <div class="child-page-container" id="ext-settings-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-cog"></i> Extension Settings</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="save-ext-settings"><i class="fas fa-save"></i> Save</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="settings-form">
            <div class="form-group">
              <label>Auto-capture Requests</label>
              <input type="checkbox" id="ext-auto-capture" checked>
            </div>
            <div class="form-group">
              <label>Capture Scope</label>
              <select id="ext-capture-scope" class="cf-select">
                <option value="all">All Requests</option>
                <option value="scope">In-scope Only</option>
                <option value="manual">Manual Only</option>
              </select>
            </div>
            <div class="form-group">
              <label>Exclude Patterns</label>
              <textarea id="ext-exclude-patterns" class="cf-textarea" rows="4" placeholder="Enter patterns to exclude..."></textarea>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================
  // MOBILE COMPANION CHILD PAGES
  // =========================================

  function buildMobileDevicesLayout() {
    return `
      <div class="child-page-container" id="mobile-devices-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-mobile-alt"></i> Connected Devices</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="scan-devices"><i class="fas fa-sync"></i> Scan</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="devices-list" id="connected-devices-list">
            <div class="device-card">
              <div class="device-icon"><i class="fas fa-mobile-alt"></i></div>
              <div class="device-info">
                <div class="device-name">iPhone 14 Pro</div>
                <div class="device-id text-secondary">ID: CF-A1B2C3</div>
                <div class="device-status"><span class="cf-badge green">Connected</span></div>
              </div>
              <div class="device-actions">
                <button class="cf-btn small"><i class="fas fa-cog"></i></button>
                <button class="cf-btn small danger"><i class="fas fa-unlink"></i></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================
  // BROWSER MONITOR CHILD PAGES
  // =========================================

  function buildBrowserRegistrationLayout() {
    return `
      <div class="child-page-container browser-registration-container" id="browser-registration-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-globe"></i> Browser Monitoring</div>
          <div class="cf-panel-actions">
            <button class="cf-btn" id="refresh-browsers"><i class="fas fa-sync"></i> Refresh</button>
            <button class="cf-btn primary" id="start-monitoring"><i class="fas fa-play"></i> Start Monitoring</button>
          </div>
        </div>
        
        <!-- Monitor Status Banner -->
        <div class="monitor-status-banner" id="monitor-status-banner">
          <div class="monitor-status-icon">
            <i class="fas fa-circle-notch fa-spin"></i>
          </div>
          <div class="monitor-status-text">
            <div class="monitor-status-title">Browser Monitoring Status</div>
            <div class="monitor-status-desc" id="monitor-status-desc">Checking...</div>
          </div>
          <div class="monitor-stats" id="monitor-stats">
            <div class="stat-item">
              <span class="stat-value" id="stat-browsers">0</span>
              <span class="stat-label">Browsers</span>
            </div>
            <div class="stat-item">
              <span class="stat-value" id="stat-requests">0</span>
              <span class="stat-label">Requests</span>
            </div>
            <div class="stat-item">
              <span class="stat-value" id="stat-threats">0</span>
              <span class="stat-label">Threats</span>
            </div>
          </div>
        </div>
        
        <div class="cf-panel-content">
          <!-- Available Browsers Section -->
          <div class="browser-section">
            <h3 class="section-title"><i class="fas fa-desktop"></i> Available Browsers</h3>
            <p class="section-desc">Click a browser to launch it with monitoring enabled. Browsers must be launched through CyberForge for full traffic capture.</p>
            <div class="available-browsers" id="available-browsers-list">
              <div class="loading-state">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Detecting browsers...</span>
              </div>
            </div>
          </div>
          
          <!-- Connected Browsers Section -->
          <div class="browser-section">
            <h3 class="section-title"><i class="fas fa-link"></i> Connected Browsers</h3>
            <p class="section-desc">These browsers are currently being monitored. All HTTP/HTTPS requests are captured.</p>
            <div class="connected-browsers" id="connected-browsers-list">
              <div class="empty-state">
                <i class="fas fa-unlink"></i>
                <span>No browsers connected</span>
              </div>
            </div>
          </div>
          
          <!-- How It Works Section -->
          <div class="browser-section how-it-works">
            <h3 class="section-title"><i class="fas fa-question-circle"></i> How Browser Monitoring Works</h3>
            <div class="steps-grid">
              <div class="step-card">
                <div class="step-number">1</div>
                <div class="step-content">
                  <h4>Launch Browser</h4>
                  <p>Click on any detected browser above to launch it with remote debugging enabled.</p>
                </div>
              </div>
              <div class="step-card">
                <div class="step-number">2</div>
                <div class="step-content">
                  <h4>Auto-Connect</h4>
                  <p>CyberForge automatically connects via Chrome DevTools Protocol for traffic capture.</p>
                </div>
              </div>
              <div class="step-card">
                <div class="step-number">3</div>
                <div class="step-content">
                  <h4>Real-Time Monitoring</h4>
                  <p>All HTTP/HTTPS requests are captured and analyzed for threats in real-time.</p>
                </div>
              </div>
              <div class="step-card">
                <div class="step-number">4</div>
                <div class="step-content">
                  <h4>View in HTTP History</h4>
                  <p>Check HTTP History to see all captured requests with full details.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <style>
        .browser-registration-container {
          padding: 0;
        }
        
        .monitor-status-banner {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 20px;
          background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
          border-bottom: 1px solid var(--border-color);
          margin-bottom: 20px;
        }
        
        .monitor-status-banner.active {
          background: linear-gradient(135deg, rgba(0, 255, 0, 0.1) 0%, var(--bg-tertiary) 100%);
        }
        
        .monitor-status-icon {
          font-size: 32px;
          color: var(--accent-blue);
          width: 50px;
          text-align: center;
        }
        
        .monitor-status-banner.active .monitor-status-icon {
          color: var(--accent-green);
        }
        
        .monitor-status-text {
          flex: 1;
        }
        
        .monitor-status-title {
          font-weight: 600;
          font-size: 16px;
          margin-bottom: 4px;
        }
        
        .monitor-status-desc {
          color: var(--text-secondary);
          font-size: 13px;
        }
        
        .monitor-stats {
          display: flex;
          gap: 30px;
        }
        
        .stat-item {
          text-align: center;
        }
        
        .stat-value {
          display: block;
          font-size: 24px;
          font-weight: 700;
          color: var(--accent-blue);
        }
        
        .stat-label {
          font-size: 11px;
          text-transform: uppercase;
          color: var(--text-secondary);
        }
        
        .browser-section {
          padding: 0 20px 20px;
        }
        
        .section-title {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 8px;
          color: var(--text-primary);
        }
        
        .section-title i {
          margin-right: 8px;
          color: var(--accent-blue);
        }
        
        .section-desc {
          font-size: 13px;
          color: var(--text-secondary);
          margin-bottom: 16px;
        }
        
        .available-browsers, .connected-browsers {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 12px;
        }
        
        .browser-card {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 16px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .browser-card:hover {
          background: var(--bg-tertiary);
          border-color: var(--accent-blue);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }
        
        .browser-card.connected {
          border-color: var(--accent-green);
          background: linear-gradient(135deg, rgba(0, 255, 0, 0.05) 0%, var(--bg-secondary) 100%);
        }
        
        .browser-card.launching {
          opacity: 0.7;
          pointer-events: none;
        }
        
        .browser-card .browser-icon {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          border-radius: 10px;
          background: var(--bg-tertiary);
        }
        
        .browser-card .browser-icon.chrome { color: #4285f4; }
        .browser-card .browser-icon.brave { color: #fb542b; }
        .browser-card .browser-icon.edge { color: #0078d7; }
        .browser-card .browser-icon.arc { color: #fc8e00; }
        .browser-card .browser-icon.opera { color: #ff1b2d; }
        .browser-card .browser-icon.chromium { color: #4587f4; }
        
        .browser-card .browser-info {
          flex: 1;
        }
        
        .browser-card .browser-name {
          font-weight: 600;
          font-size: 15px;
          margin-bottom: 4px;
        }
        
        .browser-card .browser-port {
          font-size: 12px;
          color: var(--text-secondary);
        }
        
        .browser-card .browser-status {
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }
        
        .browser-card .browser-status.available {
          background: rgba(0, 150, 255, 0.15);
          color: var(--accent-blue);
        }
        
        .browser-card .browser-status.connected {
          background: rgba(0, 255, 0, 0.15);
          color: var(--accent-green);
        }
        
        .browser-card .browser-status.launching {
          background: rgba(255, 200, 0, 0.15);
          color: var(--accent-yellow);
        }
        
        .browser-card .launch-btn {
          padding: 8px 16px;
          background: var(--accent-blue);
          border: none;
          border-radius: 6px;
          color: white;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .browser-card .launch-btn:hover {
          background: var(--accent-purple);
          transform: scale(1.05);
        }
        
        .how-it-works {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid var(--border-color);
        }
        
        .steps-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
        }
        
        .step-card {
          display: flex;
          gap: 12px;
          padding: 16px;
          background: var(--bg-secondary);
          border-radius: 8px;
          border: 1px solid var(--border-color);
        }
        
        .step-number {
          width: 28px;
          height: 28px;
          background: var(--accent-blue);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 14px;
          flex-shrink: 0;
        }
        
        .step-content h4 {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 6px;
        }
        
        .step-content p {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.5;
        }
        
        .loading-state, .empty-state {
          grid-column: 1 / -1;
          padding: 40px;
          text-align: center;
          color: var(--text-secondary);
        }
        
        .loading-state i, .empty-state i {
          font-size: 24px;
          margin-bottom: 10px;
          display: block;
        }
      </style>
    `;
  }

  function buildBrowserHistoryScanLayout() {
    return `
      <div class="child-page-container" id="browser-history-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-history"></i> Browser History Scan</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="start-history-scan"><i class="fas fa-search"></i> Start Scan</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="scan-config">
            <div class="form-group">
              <label>Scan Range</label>
              <select id="history-scan-range" class="cf-select">
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="all">All History</option>
              </select>
            </div>
            <div class="form-group">
              <label>Check Against</label>
              <div class="check-options">
                <label><input type="checkbox" checked> Malware Domains</label>
                <label><input type="checkbox" checked> Phishing Sites</label>
                <label><input type="checkbox" checked> Suspicious Downloads</label>
                <label><input type="checkbox"> Adult Content</label>
              </div>
            </div>
          </div>
          <div class="scan-results" id="history-scan-results">
            <h4>Scan Results</h4>
            <div class="results-summary" id="history-results-summary">
              <p class="text-secondary">Run a scan to see results</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function buildSuspiciousDomainsLayout() {
    return `
      <div class="child-page-container" id="suspicious-domains-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-exclamation-triangle"></i> Suspicious Domains</div>
          <div class="cf-panel-actions">
            <button class="cf-btn" id="refresh-suspicious"><i class="fas fa-sync"></i> Refresh</button>
            <button class="cf-btn primary" id="block-all-suspicious"><i class="fas fa-ban"></i> Block All</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="cf-table-container">
            <table class="cf-table" id="suspicious-domains-table">
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>Risk Level</th>
                  <th>Category</th>
                  <th>First Seen</th>
                  <th>Visits</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="suspicious-domains-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function buildCredentialExposureLayout() {
    return `
      <div class="child-page-container" id="credential-exposure-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-key"></i> Credential Exposure Check</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="check-credentials"><i class="fas fa-search"></i> Check Now</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="exposure-summary" id="credential-exposure-summary">
            <div class="summary-card">
              <div class="summary-icon red"><i class="fas fa-exclamation-circle"></i></div>
              <div class="summary-value" id="exposed-count">0</div>
              <div class="summary-label">Exposed Credentials</div>
            </div>
            <div class="summary-card">
              <div class="summary-icon orange"><i class="fas fa-user-shield"></i></div>
              <div class="summary-value" id="at-risk-count">0</div>
              <div class="summary-label">At Risk Accounts</div>
            </div>
            <div class="summary-card">
              <div class="summary-icon green"><i class="fas fa-check-circle"></i></div>
              <div class="summary-value" id="secure-count">0</div>
              <div class="summary-label">Secure</div>
            </div>
          </div>
          <div class="cf-table-container">
            <table class="cf-table" id="credential-exposure-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Service</th>
                  <th>Status</th>
                  <th>Breach Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="credential-exposure-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function buildTrackingDetectionLayout() {
    return `
      <div class="child-page-container" id="tracking-detection-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-eye-slash"></i> Tracking Detection</div>
          <div class="cf-panel-actions">
            <button class="cf-btn" id="refresh-trackers"><i class="fas fa-sync"></i> Refresh</button>
            <button class="cf-btn primary" id="block-all-trackers"><i class="fas fa-ban"></i> Block All</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="tracker-stats" id="tracker-stats">
            <div class="stat-card">
              <div class="stat-value" id="trackers-blocked">0</div>
              <div class="stat-label">Trackers Blocked</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" id="trackers-detected">0</div>
              <div class="stat-label">Trackers Detected</div>
            </div>
          </div>
          <div class="cf-table-container">
            <table class="cf-table" id="trackers-table">
              <thead>
                <tr>
                  <th>Tracker</th>
                  <th>Company</th>
                  <th>Type</th>
                  <th>Frequency</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="trackers-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function buildDownloadAnalysisLayout() {
    return `
      <div class="child-page-container" id="download-analysis-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-download"></i> Download Analysis</div>
          <div class="cf-panel-actions">
            <button class="cf-btn" id="scan-downloads"><i class="fas fa-search"></i> Scan Downloads</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="cf-table-container">
            <table class="cf-table" id="downloads-table">
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Source</th>
                  <th>Scan Result</th>
                  <th>Downloaded</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="downloads-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================
  // REAL-TIME INTEL CHILD PAGES
  // =========================================

  function buildEventFeedLayout() {
    return `
      <div class="child-page-container" id="event-feed-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-stream"></i> Real-Time Event Feed</div>
          <div class="cf-panel-actions">
            <div class="event-filters">
              <button class="cf-btn filter-btn active" data-filter="all">All</button>
              <button class="cf-btn filter-btn" data-filter="threat">Threats</button>
              <button class="cf-btn filter-btn" data-filter="alert">Alerts</button>
              <button class="cf-btn filter-btn" data-filter="info">Info</button>
            </div>
            <button class="cf-btn" id="pause-feed"><i class="fas fa-pause"></i></button>
            <button class="cf-btn" id="clear-feed"><i class="fas fa-trash"></i></button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="event-feed-list" id="realtime-event-feed">
            <div class="event-item threat">
              <div class="event-time">14:32:05</div>
              <div class="event-icon"><i class="fas fa-skull"></i></div>
              <div class="event-content">
                <div class="event-title">Malware Connection Detected</div>
                <div class="event-details">Connection to known C2 server blocked: 192.168.1.100</div>
              </div>
            </div>
            <div class="event-item alert">
              <div class="event-time">14:31:42</div>
              <div class="event-icon"><i class="fas fa-exclamation-triangle"></i></div>
              <div class="event-content">
                <div class="event-title">Suspicious Login Attempt</div>
                <div class="event-details">Failed login from unusual location: IP 203.0.113.50</div>
              </div>
            </div>
            <div class="event-item info">
              <div class="event-time">14:30:15</div>
              <div class="event-icon"><i class="fas fa-info-circle"></i></div>
              <div class="event-content">
                <div class="event-title">Scan Completed</div>
                <div class="event-details">Quick scan finished: 0 threats found</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function buildRiskAnalysisLayout() {
    return `
      <div class="child-page-container" id="risk-analysis-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-chart-pie"></i> Risk Analysis</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="run-risk-analysis"><i class="fas fa-play"></i> Run Analysis</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="risk-overview" id="risk-overview">
            <div class="risk-score-card">
              <div class="risk-score-circle">
                <svg viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="var(--cf-bg-light)" stroke-width="8"/>
                  <circle cx="50" cy="50" r="45" fill="none" stroke="var(--cf-warning)" stroke-width="8"
                    stroke-dasharray="283" stroke-dashoffset="85" stroke-linecap="round"/>
                </svg>
                <div class="risk-value">72</div>
              </div>
              <div class="risk-label">Overall Risk Score</div>
            </div>
          </div>
          <div class="risk-breakdown" id="risk-breakdown">
            <h4>Risk Categories</h4>
            <div class="risk-category">
              <span class="category-name">Network Security</span>
              <div class="category-bar"><div class="bar-fill" style="width: 65%; background: var(--cf-warning);"></div></div>
              <span class="category-score">65</span>
            </div>
            <div class="risk-category">
              <span class="category-name">Application Security</span>
              <div class="category-bar"><div class="bar-fill" style="width: 78%; background: var(--cf-warning);"></div></div>
              <span class="category-score">78</span>
            </div>
            <div class="risk-category">
              <span class="category-name">Data Security</span>
              <div class="category-bar"><div class="bar-fill" style="width: 45%; background: var(--cf-success);"></div></div>
              <span class="category-score">45</span>
            </div>
            <div class="risk-category">
              <span class="category-name">Compliance</span>
              <div class="category-bar"><div class="bar-fill" style="width: 82%; background: var(--cf-error);"></div></div>
              <span class="category-score">82</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function buildThreatMapLayout() {
    return `
      <div class="child-page-container" id="threat-map-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-globe-americas"></i> Global Threat Map</div>
          <div class="cf-panel-actions">
            <select id="threat-map-filter" class="cf-select">
              <option value="all">All Threats</option>
              <option value="malware">Malware</option>
              <option value="ddos">DDoS</option>
              <option value="phishing">Phishing</option>
            </select>
            <button class="cf-btn" id="refresh-threat-map"><i class="fas fa-sync"></i></button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="threat-map-container" id="threat-map-container">
            <div class="map-placeholder">
              <i class="fas fa-globe-americas" style="font-size: 64px; color: var(--cf-primary);"></i>
              <p>Global Threat Map Visualization</p>
              <p class="text-secondary">Real-time threat activity from around the world</p>
            </div>
          </div>
          <div class="threat-map-legend">
            <div class="legend-item"><span class="legend-dot red"></span> Active Attacks</div>
            <div class="legend-item"><span class="legend-dot orange"></span> Potential Threats</div>
            <div class="legend-item"><span class="legend-dot blue"></span> Monitored Regions</div>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================
  // SCAN MODES CHILD PAGES
  // =========================================

  function buildScanModeLayout(mode) {
    const modeConfig = {
      'quick': { icon: 'bolt', title: 'Quick Scan', desc: 'Fast scan of common vulnerabilities', duration: '~5 minutes' },
      'deep': { icon: 'microscope', title: 'Deep Scan', desc: 'Comprehensive security analysis', duration: '~30 minutes' },
      'stealth': { icon: 'user-ninja', title: 'Stealth Scan', desc: 'Low-profile scanning to avoid detection', duration: '~45 minutes' },
      'forensic': { icon: 'search', title: 'Forensic Scan', desc: 'Detailed forensic analysis', duration: '~60 minutes' }
    };
    
    const config = modeConfig[mode] || modeConfig.quick;
    
    return `
      <div class="child-page-container" id="${mode}-scan-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-${config.icon}"></i> ${config.title}</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="start-${mode}-scan"><i class="fas fa-play"></i> Start Scan</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="scan-info">
            <p>${config.desc}</p>
            <p class="text-secondary">Estimated duration: ${config.duration}</p>
          </div>
          <div class="scan-config" id="${mode}-scan-config">
            <h4>Scan Configuration</h4>
            <div class="form-group">
              <label>Target</label>
              <input type="text" id="${mode}-scan-target" class="cf-input" placeholder="Enter target URL or IP...">
            </div>
            <div class="form-group">
              <label>Scan Options</label>
              <div class="scan-options">
                <label><input type="checkbox" checked> Vulnerability Detection</label>
                <label><input type="checkbox" checked> Port Scanning</label>
                <label><input type="checkbox"> SSL/TLS Analysis</label>
                <label><input type="checkbox"> Directory Bruteforce</label>
              </div>
            </div>
          </div>
          <div class="scan-progress" id="${mode}-scan-progress" style="display: none;">
            <h4>Scan Progress</h4>
            <div class="progress-bar"><div class="progress-fill" id="${mode}-progress-fill"></div></div>
            <div class="progress-status" id="${mode}-progress-status">Initializing...</div>
          </div>
          <div class="scan-results" id="${mode}-scan-results" style="display: none;">
            <h4>Results</h4>
            <div class="results-container" id="${mode}-results-container"></div>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================
  // AGENT CHILD PAGES
  // =========================================

  function buildAgentTasksLayout() {
    return `
      <div class="child-page-container" id="agent-tasks-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-tasks"></i> Active Agent Tasks</div>
          <div class="cf-panel-actions">
            <button class="cf-btn" id="pause-all-tasks"><i class="fas fa-pause"></i> Pause All</button>
            <button class="cf-btn primary" id="create-task"><i class="fas fa-plus"></i> New Task</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="cf-table-container">
            <table class="cf-table" id="agent-tasks-table">
              <thead>
                <tr>
                  <th>Task ID</th>
                  <th>Type</th>
                  <th>Target</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Started</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="agent-tasks-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function buildAgentScheduleLayout() {
    return `
      <div class="child-page-container" id="agent-schedule-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-calendar-alt"></i> Scheduled Tasks</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="schedule-task"><i class="fas fa-plus"></i> Schedule Task</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="cf-table-container">
            <table class="cf-table" id="scheduled-tasks-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Schedule</th>
                  <th>Next Run</th>
                  <th>Last Run</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="scheduled-tasks-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function buildAgentDecisionsLayout() {
    return `
      <div class="child-page-container" id="agent-decisions-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-brain"></i> Agent Decisions & Alerts</div>
          <div class="cf-panel-actions">
            <button class="cf-btn" id="clear-decisions"><i class="fas fa-trash"></i> Clear</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="decisions-timeline" id="decisions-timeline">
            <div class="decision-item">
              <div class="decision-time">2 minutes ago</div>
              <div class="decision-content">
                <div class="decision-type"><span class="cf-badge blue">Auto-Block</span></div>
                <div class="decision-title">Blocked Suspicious IP</div>
                <div class="decision-desc">IP 192.168.1.100 blocked due to repeated failed login attempts</div>
              </div>
            </div>
            <div class="decision-item">
              <div class="decision-time">15 minutes ago</div>
              <div class="decision-content">
                <div class="decision-type"><span class="cf-badge orange">Alert</span></div>
                <div class="decision-title">Unusual Traffic Pattern</div>
                <div class="decision-desc">Detected anomalous outbound traffic to unknown endpoint</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function buildAgentMemoryLayout() {
    return `
      <div class="child-page-container" id="agent-memory-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-memory"></i> Agent Memory</div>
          <div class="cf-panel-actions">
            <button class="cf-btn" id="export-memory"><i class="fas fa-download"></i> Export</button>
            <button class="cf-btn danger" id="clear-memory"><i class="fas fa-trash"></i> Clear Memory</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="memory-stats" id="memory-stats">
            <div class="stat-card">
              <div class="stat-value" id="memory-threats">0</div>
              <div class="stat-label">Threats Recorded</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" id="memory-patterns">0</div>
              <div class="stat-label">Patterns Learned</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" id="memory-decisions">0</div>
              <div class="stat-label">Decisions Made</div>
            </div>
          </div>
          <div class="memory-entries" id="memory-entries">
            <h4>Recent Memory Entries</h4>
            <div class="memory-list" id="memory-list"></div>
          </div>
        </div>
      </div>
    `;
  }

  // Additional layout functions for full compatibility
  
  function buildSearchAdvancedLayout() {
    return `
      <div class="child-page-container" id="search-advanced-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-search-plus"></i> Advanced Search</div>
        </div>
        <div class="cf-panel-content">
          <form id="advanced-search-form" class="search-form">
            <div class="form-group">
              <label>Search Query</label>
              <input type="text" id="search-query" class="cf-input" placeholder="Enter search terms...">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Method</label>
                <select id="search-method" class="cf-select">
                  <option value="">Any</option>
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>
              <div class="form-group">
                <label>Status</label>
                <select id="search-status" class="cf-select">
                  <option value="">Any</option>
                  <option value="2xx">2xx Success</option>
                  <option value="3xx">3xx Redirect</option>
                  <option value="4xx">4xx Client Error</option>
                  <option value="5xx">5xx Server Error</option>
                </select>
              </div>
            </div>
            <button type="submit" class="cf-btn primary">Search</button>
          </form>
          <div class="search-results" id="advanced-search-results"></div>
        </div>
      </div>
    `;
  }

  function buildFindingsCriticalLayout() {
    return buildFindingsBySeverityLayout('critical');
  }

  function buildFindingsHighLayout() {
    return buildFindingsBySeverityLayout('high');
  }

  function buildFindingsMediumLayout() {
    return buildFindingsBySeverityLayout('medium');
  }

  function buildFindingsLowLayout() {
    return buildFindingsBySeverityLayout('low');
  }

  function buildExportsReportsLayout() {
    return `
      <div class="child-page-container" id="exports-reports-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-file-export"></i> Exported Reports</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="generate-report"><i class="fas fa-plus"></i> Generate Report</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="reports-list" id="exports-reports-list"></div>
        </div>
      </div>
    `;
  }

  function buildFilesProjectLayout() {
    return `
      <div class="child-page-container" id="files-project-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-folder-open"></i> Project Files</div>
          <div class="cf-panel-actions">
            <button class="cf-btn" id="upload-file"><i class="fas fa-upload"></i> Upload</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="files-tree" id="project-files-tree"></div>
        </div>
      </div>
    `;
  }

  function buildPluginsInstalledLayout() {
    return `
      <div class="child-page-container" id="plugins-installed-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-puzzle-piece"></i> Installed Plugins</div>
        </div>
        <div class="cf-panel-content">
          <div class="plugins-list" id="plugins-installed-list"></div>
        </div>
      </div>
    `;
  }

  function buildWorkspaceSettingsLayout() {
    return `
      <div class="child-page-container" id="workspace-settings-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-cog"></i> Workspace Settings</div>
        </div>
        <div class="cf-panel-content">
          <form id="workspace-settings-form">
            <div class="form-group">
              <label>Workspace Name</label>
              <input type="text" class="cf-input" id="workspace-name" placeholder="My Workspace">
            </div>
            <div class="form-group">
              <label>Description</label>
              <textarea class="cf-textarea" id="workspace-desc" rows="3"></textarea>
            </div>
            <button type="submit" class="cf-btn primary">Save Settings</button>
          </form>
        </div>
      </div>
    `;
  }

  function buildSyncPendingLayout() {
    return `
      <div class="child-page-container" id="sync-pending-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-clock"></i> Pending Sync</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="sync-now"><i class="fas fa-sync"></i> Sync Now</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="pending-list" id="sync-pending-list"></div>
        </div>
      </div>
    `;
  }

  function buildExtInstallLayout() {
    return `
      <div class="child-page-container" id="ext-install-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-download"></i> Install Browser Extension</div>
        </div>
        <div class="cf-panel-content">
          <div class="ext-install-options">
            <div class="ext-option">
              <img src="assets/chrome-icon.svg" alt="Chrome" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2240%22 fill=%22%234285f4%22/></svg>'">
              <h4>Chrome</h4>
              <button class="cf-btn primary">Install</button>
            </div>
            <div class="ext-option">
              <img src="assets/firefox-icon.svg" alt="Firefox" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2240%22 fill=%22%23ff9400%22/></svg>'">
              <h4>Firefox</h4>
              <button class="cf-btn primary">Install</button>
            </div>
          </div>
          <div class="install-status" id="ext-install-status"></div>
        </div>
      </div>
    `;
  }

  function buildMobilePairLayout() {
    return `
      <div class="child-page-container" id="mobile-pair-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-mobile-alt"></i> Pair Mobile Device</div>
        </div>
        <div class="cf-panel-content">
          <div class="pair-instructions">
            <p>Scan the QR code with the CyberForge mobile app to pair your device.</p>
            <div class="qr-container" id="mobile-qr-code"></div>
            <p class="pair-code">Pairing Code: <strong>XXXXX</strong></p>
          </div>
        </div>
      </div>
    `;
  }

  function buildQuickScanLayout() {
    return buildScanModeLayout('Quick Scan', 'fast-forward', 'Fast scan for common vulnerabilities');
  }

  function buildDeepScanLayout() {
    return buildScanModeLayout('Deep Scan', 'microscope', 'Comprehensive vulnerability assessment');
  }

  function buildStealthScanLayout() {
    return buildScanModeLayout('Stealth Scan', 'user-secret', 'Low-profile scanning to avoid detection');
  }

  function buildForensicScanLayout() {
    return buildScanModeLayout('Forensic Scan', 'search', 'Detailed forensic analysis');
  }

  function buildAgentControlLayout() {
    return `
      <div class="child-page-container" id="agent-control-page">
        <div class="cf-panel-header">
          <div class="cf-panel-title"><i class="fas fa-robot"></i> AI Agent Control</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="start-agent"><i class="fas fa-play"></i> Start Agent</button>
            <button class="cf-btn" id="stop-agent"><i class="fas fa-stop"></i> Stop</button>
          </div>
        </div>
        <div class="cf-panel-content">
          <div class="agent-status">
            <div class="status-indicator" id="agent-status-indicator">
              <span class="status-dot offline"></span>
              <span class="status-text">Agent Offline</span>
            </div>
          </div>
          <div class="agent-console" id="agent-control-panel">
            <div class="console-output" id="agent-console-output"></div>
            <div class="console-input">
              <input type="text" id="agent-command" class="cf-input" placeholder="Enter command...">
              <button class="cf-btn primary" id="send-agent-command"><i class="fas fa-paper-plane"></i></button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Alias functions for case sensitivity compatibility
  const buildIntelIOCsLayout = buildIntelIocsLayout;
  const buildIntelCVEsLayout = buildIntelCvesLayout;

  // Export all functions
  return {
    // Dashboard
    buildDashboardSecurityLayout,
    buildDashboardActivityLayout,
    buildDashboardMetricsLayout,
    // Sitemap
    buildSitemapTreeLayout,
    buildSitemapGraphLayout,
    // Scopes
    buildScopesActiveLayout,
    buildScopesExcludedLayout,
    // Filters
    buildFiltersSavedLayout,
    buildFiltersRecentLayout,
    // Intercept
    buildInterceptRulesLayout,
    buildInterceptBreakpointsLayout,
    // HTTP
    buildHttpFlaggedLayout,
    buildHttpErrorsLayout,
    // WebSocket
    buildWsMessagesLayout,
    // Match & Replace
    buildMatchResponseLayout,
    // Replay
    buildReplayBatchLayout,
    buildReplayDiffLayout,
    // Automate
    buildAutomateIntruderLayout,
    buildAutomateFuzzerLayout,
    buildAutomatePayloadsLayout,
    // Workflows
    buildWorkflowsActiveLayout,
    buildWorkflowsTemplatesLayout,
    buildWorkflowsHistoryLayout,
    // Assistant
    buildAssistantChatLayout,
    buildAssistantSuggestionsLayout,
    // AI Models
    buildModelsTrainedLayout,
    buildModelsTrainingLayout,
    buildModelsDatasetsLayout,
    // Threat Intel
    buildIntelFeedsLayout,
    buildIntelIocsLayout,
    buildIntelIOCsLayout,
    buildIntelCvesLayout,
    buildIntelCVEsLayout,
    // Environment
    buildEnvVariablesLayout,
    buildEnvSecretsLayout,
    // Search
    buildSearchAdvancedLayout,
    buildSearchSavedLayout,
    // Findings
    buildFindingsBySeverityLayout,
    buildFindingsCriticalLayout,
    buildFindingsHighLayout,
    buildFindingsMediumLayout,
    buildFindingsLowLayout,
    // Exports
    buildExportsReportsLayout,
    buildExportsDataLayout,
    // Files
    buildFilesProjectLayout,
    buildFilesNotesLayout,
    buildFilesScriptsLayout,
    // Plugins
    buildPluginsInstalledLayout,
    buildPluginsMarketplaceLayout,
    // Workspace
    buildWorkspaceSettingsLayout,
    buildWorkspaceTeamLayout,
    // Sync
    buildSyncPendingLayout,
    buildSyncHistoryLayout,
    // Browser Extension
    buildExtInstallLayout,
    buildExtSettingsLayout,
    // Mobile
    buildMobilePairLayout,
    buildMobileDevicesLayout,
    // Browser Monitor
    buildBrowserRegistrationLayout,
    buildBrowserHistoryScanLayout,
    buildSuspiciousDomainsLayout,
    buildCredentialExposureLayout,
    buildTrackingDetectionLayout,
    buildDownloadAnalysisLayout,
    // Real-Time Intel
    buildEventFeedLayout,
    buildRiskAnalysisLayout,
    buildThreatMapLayout,
    // Scan Modes
    buildScanModeLayout,
    buildQuickScanLayout,
    buildDeepScanLayout,
    buildStealthScanLayout,
    buildForensicScanLayout,
    // Agent
    buildAgentControlLayout,
    buildAgentTasksLayout,
    buildAgentScheduleLayout,
    buildAgentDecisionsLayout,
    buildAgentMemoryLayout
  };
})();
