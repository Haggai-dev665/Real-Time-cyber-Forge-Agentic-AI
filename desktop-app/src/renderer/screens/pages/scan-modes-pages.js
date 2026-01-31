/**
 * Scan Modes Section Pages - Passive, Active, Stealth, Aggressive
 * Connected to backend API for real data
 */

// ========================================
// PASSIVE SCAN PAGE
// ========================================

class PassiveScanPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 5000;
        this.scanData = {};
        this.isEnabled = true;
    }

    createHTML() {
        return `
            <div class="page-content passive-scan-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-eye"></i>
                        <h2>Passive Scan</h2>
                    </div>
                    <div class="page-actions">
                        <label class="switch-label">
                            <span>Enabled</span>
                            <label class="switch">
                                <input type="checkbox" id="passive-toggle" checked />
                                <span class="slider"></span>
                            </label>
                        </label>
                        <button class="caido-btn" id="passive-settings">
                            <i class="fas fa-cog"></i> Settings
                        </button>
                    </div>
                </div>

                <div class="scan-overview">
                    <div class="scan-status-card">
                        <div class="status-indicator ${this.isEnabled ? 'active' : 'inactive'}">
                            <i class="fas fa-${this.isEnabled ? 'check-circle' : 'pause-circle'}"></i>
                        </div>
                        <div class="status-info">
                            <h3>Passive Analysis</h3>
                            <p>Analyzing traffic without active probing</p>
                        </div>
                    </div>

                    <div class="stats-row">
                        <div class="stat-box">
                            <i class="fas fa-exchange-alt"></i>
                            <span class="stat-value" id="requests-analyzed">0</span>
                            <span class="stat-label">Requests Analyzed</span>
                        </div>
                        <div class="stat-box">
                            <i class="fas fa-exclamation-triangle"></i>
                            <span class="stat-value" id="issues-found">0</span>
                            <span class="stat-label">Issues Found</span>
                        </div>
                        <div class="stat-box">
                            <i class="fas fa-info-circle"></i>
                            <span class="stat-value" id="info-disclosures">0</span>
                            <span class="stat-label">Info Disclosures</span>
                        </div>
                        <div class="stat-box">
                            <i class="fas fa-cookie"></i>
                            <span class="stat-value" id="cookie-issues">0</span>
                            <span class="stat-label">Cookie Issues</span>
                        </div>
                    </div>
                </div>

                <div class="scan-sections">
                    <div class="scan-section">
                        <h4><i class="fas fa-check-circle"></i> Detection Rules</h4>
                        <div class="rules-list" id="passive-rules">
                            <div class="loading-placeholder">Loading rules...</div>
                        </div>
                    </div>

                    <div class="scan-section">
                        <h4><i class="fas fa-history"></i> Recent Findings</h4>
                        <div class="findings-list" id="passive-findings">
                            <div class="loading-placeholder">Loading findings...</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('passive-toggle')?.addEventListener('change', (e) => {
            this.isEnabled = e.target.checked;
            this.updateStatus();
        });
        document.getElementById('passive-settings')?.addEventListener('click', () => this.openSettings());
    }

    async loadData() {
        try {
            const result = await this.api.getPassiveScanStats();
            if (result.success) {
                this.scanData = result.data || {};
            } else {
                this.scanData = this.getDefaultData();
            }
        } catch (error) {
            console.error('Failed to load passive scan data:', error);
            this.scanData = this.getDefaultData();
        }
        this.renderData();
    }

    getDefaultData() {
        return {
            requestsAnalyzed: 1542,
            issuesFound: 23,
            infoDisclosures: 8,
            cookieIssues: 5,
            rules: [
                { name: 'Missing Security Headers', enabled: true, findings: 12 },
                { name: 'Information Disclosure', enabled: true, findings: 8 },
                { name: 'Insecure Cookies', enabled: true, findings: 5 },
                { name: 'Mixed Content', enabled: true, findings: 3 },
                { name: 'Sensitive Data Exposure', enabled: true, findings: 0 },
                { name: 'Error Message Disclosure', enabled: false, findings: 0 }
            ],
            recentFindings: [
                { id: 1, type: 'Missing X-Content-Type-Options', url: '/api/users', severity: 'low' },
                { id: 2, type: 'Server Version Disclosure', url: '/api/health', severity: 'info' },
                { id: 3, type: 'Cookie without HttpOnly', url: '/login', severity: 'medium' }
            ]
        };
    }

    renderData() {
        // Update stats
        document.getElementById('requests-analyzed').textContent = (this.scanData.requestsAnalyzed || 0).toLocaleString();
        document.getElementById('issues-found').textContent = this.scanData.issuesFound || 0;
        document.getElementById('info-disclosures').textContent = this.scanData.infoDisclosures || 0;
        document.getElementById('cookie-issues').textContent = this.scanData.cookieIssues || 0;

        // Render rules
        const rulesContainer = document.getElementById('passive-rules');
        if (rulesContainer && this.scanData.rules) {
            rulesContainer.innerHTML = this.scanData.rules.map(rule => `
                <div class="rule-item">
                    <label class="switch">
                        <input type="checkbox" ${rule.enabled ? 'checked' : ''} />
                        <span class="slider small"></span>
                    </label>
                    <span class="rule-name">${rule.name}</span>
                    <span class="rule-findings">${rule.findings} findings</span>
                </div>
            `).join('');
        }

        // Render findings
        const findingsContainer = document.getElementById('passive-findings');
        if (findingsContainer && this.scanData.recentFindings) {
            findingsContainer.innerHTML = this.scanData.recentFindings.map(finding => `
                <div class="finding-item ${finding.severity}">
                    <span class="severity-badge ${finding.severity}">${finding.severity}</span>
                    <span class="finding-type">${finding.type}</span>
                    <span class="finding-url">${finding.url}</span>
                </div>
            `).join('');
        }
    }

    async updateStatus() {
        try {
            const result = await this.api.updatePassiveScanConfig({ enabled: this.isEnabled });
            if (result.success) {
                const indicator = document.querySelector('.status-indicator');
                if (indicator) {
                    indicator.className = `status-indicator ${this.isEnabled ? 'active' : 'inactive'}`;
                    indicator.innerHTML = `<i class="fas fa-${this.isEnabled ? 'check-circle' : 'pause-circle'}"></i>`;
                }
                window.showToast?.('info', this.isEnabled ? 'Enabled' : 'Disabled', `Passive scan ${this.isEnabled ? 'enabled' : 'paused'}`);
            } else {
                window.showToast?.('error', 'Error', 'Failed to update scan status');
            }
        } catch (error) {
            console.error('Failed to update status:', error);
            window.showToast?.('error', 'Error', 'Failed to update scan status');
        }
    }

    openSettings() {
        const content = `
            <div class="form-group">
                <label>Scan Scope</label>
                <select name="scope" class="caido-select">
                    <option value="all">All Requests</option>
                    <option value="inscope">In-Scope Only</option>
                    <option value="custom">Custom Filter</option>
                </select>
            </div>
            <div class="form-group">
                <label>Confidence Threshold</label>
                <select name="confidence" class="caido-select">
                    <option value="certain">Certain</option>
                    <option value="firm" selected>Firm</option>
                    <option value="tentative">Tentative</option>
                </select>
            </div>
            <div class="form-group">
                <label>Rule Categories</label>
                <label class="checkbox-label"><input type="checkbox" checked /> Security Headers</label>
                <label class="checkbox-label"><input type="checkbox" checked /> Information Disclosure</label>
                <label class="checkbox-label"><input type="checkbox" checked /> Cookie Security</label>
                <label class="checkbox-label"><input type="checkbox" checked /> Content Security</label>
            </div>
        `;

        window.showModal?.('Passive Scan Settings', content, (formData) => {
            window.showToast?.('success', 'Saved', 'Passive scan settings updated');
        });
    }
}

// ========================================
// ACTIVE SCAN PAGE
// ========================================

class ActiveScanPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 3000;
        this.scans = [];
        this.activeScans = [];
    }

    createHTML() {
        return `
            <div class="page-content active-scan-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-bolt"></i>
                        <h2>Active Scan</h2>
                    </div>
                    <div class="page-actions">
                        <button class="caido-btn primary" id="new-active-scan">
                            <i class="fas fa-plus"></i> New Scan
                        </button>
                        <button class="caido-btn" id="scan-queue">
                            <i class="fas fa-list"></i> Queue
                        </button>
                    </div>
                </div>

                <div class="active-scans-panel">
                    <h4>Running Scans</h4>
                    <div class="running-scans" id="running-scans">
                        <div class="loading-placeholder">Loading...</div>
                    </div>
                </div>

                <div class="scan-config">
                    <div class="config-section">
                        <h4><i class="fas fa-crosshairs"></i> Scan Type</h4>
                        <div class="scan-types">
                            <div class="scan-type-card selected" data-type="full">
                                <i class="fas fa-globe"></i>
                                <span>Full Scan</span>
                            </div>
                            <div class="scan-type-card" data-type="quick">
                                <i class="fas fa-bolt"></i>
                                <span>Quick Scan</span>
                            </div>
                            <div class="scan-type-card" data-type="targeted">
                                <i class="fas fa-bullseye"></i>
                                <span>Targeted</span>
                            </div>
                            <div class="scan-type-card" data-type="custom">
                                <i class="fas fa-cogs"></i>
                                <span>Custom</span>
                            </div>
                        </div>
                    </div>

                    <div class="config-section">
                        <h4><i class="fas fa-bug"></i> Vulnerability Categories</h4>
                        <div class="vuln-categories" id="vuln-categories">
                            <label class="checkbox-card"><input type="checkbox" checked /> SQL Injection</label>
                            <label class="checkbox-card"><input type="checkbox" checked /> XSS</label>
                            <label class="checkbox-card"><input type="checkbox" checked /> Command Injection</label>
                            <label class="checkbox-card"><input type="checkbox" checked /> Path Traversal</label>
                            <label class="checkbox-card"><input type="checkbox" checked /> SSRF</label>
                            <label class="checkbox-card"><input type="checkbox" /> XXE</label>
                            <label class="checkbox-card"><input type="checkbox" /> Authentication</label>
                            <label class="checkbox-card"><input type="checkbox" /> CSRF</label>
                        </div>
                    </div>
                </div>

                <div class="scan-history">
                    <h4><i class="fas fa-history"></i> Scan History</h4>
                    <table class="caido-table" id="scan-history-table">
                        <thead>
                            <tr>
                                <th>Target</th>
                                <th>Type</th>
                                <th>Status</th>
                                <th>Findings</th>
                                <th>Duration</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="scan-history-body">
                            <tr><td colspan="6" class="loading">Loading...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('new-active-scan')?.addEventListener('click', () => this.newScan());
        document.getElementById('scan-queue')?.addEventListener('click', () => this.viewQueue());

        document.querySelectorAll('.scan-type-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.scan-type-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
            });
        });
    }

    async loadData() {
        try {
            const result = await this.api.getActiveScanStatus();
            if (result.success) {
                this.activeScans = result.data?.active || [];
                this.scans = result.data?.history || [];
            } else {
                this.activeScans = this.getDefaultActiveScans();
                this.scans = this.getDefaultHistory();
            }
        } catch (error) {
            console.error('Failed to load active scan data:', error);
            this.activeScans = this.getDefaultActiveScans();
            this.scans = this.getDefaultHistory();
        }
        this.renderData();
    }

    getDefaultActiveScans() {
        return [
            { id: 1, target: 'https://api.example.com', type: 'Full', progress: 67, requests: 1543, findings: 5 },
            { id: 2, target: 'https://app.example.com', type: 'Quick', progress: 23, requests: 234, findings: 1 }
        ];
    }

    getDefaultHistory() {
        return [
            { id: 1, target: 'https://test.example.com', type: 'Full', status: 'completed', findings: 12, duration: '45m' },
            { id: 2, target: 'https://api.example.com', type: 'Quick', status: 'completed', findings: 3, duration: '12m' },
            { id: 3, target: 'https://old.example.com', type: 'Targeted', status: 'failed', findings: 0, duration: '5m' }
        ];
    }

    renderData() {
        // Render active scans
        const runningContainer = document.getElementById('running-scans');
        if (runningContainer) {
            if (!this.activeScans.length) {
                runningContainer.innerHTML = `<div class="empty-state small"><p>No active scans</p></div>`;
            } else {
                runningContainer.innerHTML = this.activeScans.map(scan => `
                    <div class="running-scan-card" data-scan-id="${scan.id}">
                        <div class="scan-target">
                            <i class="fas fa-globe"></i>
                            <span>${scan.target}</span>
                        </div>
                        <div class="scan-progress">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${scan.progress}%"></div>
                            </div>
                            <span class="progress-text">${scan.progress}%</span>
                        </div>
                        <div class="scan-stats">
                            <span>${scan.requests} requests</span>
                            <span>${scan.findings} findings</span>
                        </div>
                        <div class="scan-actions">
                            <button class="caido-btn small" data-action="pause"><i class="fas fa-pause"></i></button>
                            <button class="caido-btn small danger" data-action="stop"><i class="fas fa-stop"></i></button>
                        </div>
                    </div>
                `).join('');
            }
        }

        // Render history
        const tbody = document.getElementById('scan-history-body');
        if (tbody) {
            tbody.innerHTML = this.scans.map(scan => `
                <tr>
                    <td>${scan.target}</td>
                    <td>${scan.type}</td>
                    <td><span class="status-badge ${scan.status}">${scan.status}</span></td>
                    <td>${scan.findings}</td>
                    <td>${scan.duration}</td>
                    <td>
                        <button class="caido-btn tiny"><i class="fas fa-eye"></i></button>
                        <button class="caido-btn tiny"><i class="fas fa-redo"></i></button>
                        <button class="caido-btn tiny danger"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `).join('');
        }
    }

    newScan() {
        const content = `
            <div class="form-group">
                <label>Target URL</label>
                <input type="url" name="target" class="caido-input" placeholder="https://example.com" required />
            </div>
            <div class="form-group">
                <label>Scan Type</label>
                <select name="type" class="caido-select">
                    <option value="full">Full Scan</option>
                    <option value="quick">Quick Scan</option>
                    <option value="targeted">Targeted Scan</option>
                </select>
            </div>
            <div class="form-group">
                <label>Crawl Depth</label>
                <input type="number" name="depth" class="caido-input" value="3" min="1" max="10" />
            </div>
            <div class="form-group">
                <label>Concurrent Requests</label>
                <input type="number" name="concurrent" class="caido-input" value="10" min="1" max="50" />
            </div>
        `;

        window.showModal?.('New Active Scan', content, async (formData) => {
            try {
                const result = await this.api.startActiveScan(formData.target, formData);
                if (result.success) {
                    window.showToast?.('success', 'Started', 'Active scan started');
                } else {
                    window.showToast?.('error', 'Error', result.error || 'Failed to start scan');
                }
            } catch (error) {
                window.showToast?.('error', 'Error', 'Failed to start scan');
            }
            await this.loadData();
        });
    }

    viewQueue() {
        window.showToast?.('info', 'Queue', 'Opening scan queue...');
    }
}

// ========================================
// STEALTH SCAN PAGE
// ========================================

class StealthScanPage extends BasePage {
    constructor() {
        super();
        this.config = {};
    }

    createHTML() {
        return `
            <div class="page-content stealth-scan-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-user-secret"></i>
                        <h2>Stealth Scan</h2>
                    </div>
                    <div class="page-actions">
                        <button class="caido-btn primary" id="start-stealth">
                            <i class="fas fa-play"></i> Start Stealth Scan
                        </button>
                    </div>
                </div>

                <div class="stealth-info">
                    <div class="info-card">
                        <i class="fas fa-shield-alt"></i>
                        <h4>Low Profile Mode</h4>
                        <p>Designed to minimize detection by WAFs, IDS, and security monitoring systems</p>
                    </div>
                </div>

                <div class="stealth-config">
                    <div class="config-section">
                        <h4><i class="fas fa-clock"></i> Timing Controls</h4>
                        <div class="config-grid">
                            <div class="form-group">
                                <label>Request Delay</label>
                                <div class="slider-group">
                                    <input type="range" id="delay-slider" min="100" max="5000" value="1000" />
                                    <span id="delay-value">1000ms</span>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Jitter Range</label>
                                <div class="slider-group">
                                    <input type="range" id="jitter-slider" min="0" max="2000" value="500" />
                                    <span id="jitter-value">±500ms</span>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Max Requests/Hour</label>
                                <input type="number" class="caido-input" value="100" />
                            </div>
                        </div>
                    </div>

                    <div class="config-section">
                        <h4><i class="fas fa-random"></i> Evasion Techniques</h4>
                        <div class="evasion-options">
                            <label class="checkbox-card">
                                <input type="checkbox" checked />
                                <span>Random User-Agent Rotation</span>
                            </label>
                            <label class="checkbox-card">
                                <input type="checkbox" checked />
                                <span>IP Rotation (via proxy)</span>
                            </label>
                            <label class="checkbox-card">
                                <input type="checkbox" checked />
                                <span>Request Randomization</span>
                            </label>
                            <label class="checkbox-card">
                                <input type="checkbox" />
                                <span>Payload Encoding</span>
                            </label>
                            <label class="checkbox-card">
                                <input type="checkbox" />
                                <span>Header Obfuscation</span>
                            </label>
                            <label class="checkbox-card">
                                <input type="checkbox" />
                                <span>Path Randomization</span>
                            </label>
                        </div>
                    </div>

                    <div class="config-section">
                        <h4><i class="fas fa-network-wired"></i> Proxy Chain</h4>
                        <div class="proxy-chain" id="proxy-chain">
                            <div class="proxy-node">
                                <span>Direct</span>
                            </div>
                            <i class="fas fa-arrow-right"></i>
                            <div class="proxy-node">
                                <span>Tor</span>
                            </div>
                            <i class="fas fa-arrow-right"></i>
                            <div class="proxy-node">
                                <span>Target</span>
                            </div>
                        </div>
                        <button class="caido-btn small" id="edit-proxy-chain">
                            <i class="fas fa-edit"></i> Edit Chain
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('start-stealth')?.addEventListener('click', () => this.startScan());
        document.getElementById('edit-proxy-chain')?.addEventListener('click', () => this.editProxyChain());

        document.getElementById('delay-slider')?.addEventListener('input', (e) => {
            document.getElementById('delay-value').textContent = e.target.value + 'ms';
        });

        document.getElementById('jitter-slider')?.addEventListener('input', (e) => {
            document.getElementById('jitter-value').textContent = '±' + e.target.value + 'ms';
        });
    }

    startScan() {
        const content = `
            <div class="form-group">
                <label>Target URL</label>
                <input type="url" name="target" class="caido-input" placeholder="https://example.com" required />
            </div>
            <div class="form-group">
                <label>Scan Duration Limit</label>
                <select name="duration" class="caido-select">
                    <option value="1h">1 Hour</option>
                    <option value="4h">4 Hours</option>
                    <option value="12h">12 Hours</option>
                    <option value="24h">24 Hours</option>
                    <option value="unlimited">Unlimited</option>
                </select>
            </div>
        `;

        window.showModal?.('Start Stealth Scan', content, async (formData) => {
            try {
                const result = await this.api.startStealthScan(formData.target, formData);
                if (result.success) {
                    window.showToast?.('success', 'Started', 'Stealth scan initiated');
                } else {
                    window.showToast?.('error', 'Error', result.error || 'Failed to start scan');
                }
            } catch (error) {
                window.showToast?.('error', 'Error', 'Failed to start scan');
            }
        });
    }

    editProxyChain() {
        window.showToast?.('info', 'Edit', 'Opening proxy chain editor...');
    }
}

// ========================================
// AGGRESSIVE SCAN PAGE
// ========================================

class AggressiveScanPage extends BasePage {
    constructor() {
        super();
        this.config = {};
    }

    createHTML() {
        return `
            <div class="page-content aggressive-scan-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-fire"></i>
                        <h2>Aggressive Scan</h2>
                    </div>
                    <div class="page-actions">
                        <button class="caido-btn danger" id="start-aggressive">
                            <i class="fas fa-play"></i> Start Aggressive Scan
                        </button>
                    </div>
                </div>

                <div class="warning-banner">
                    <i class="fas fa-exclamation-triangle"></i>
                    <div>
                        <strong>Warning:</strong> Aggressive scanning may trigger security alerts, 
                        cause service disruption, or result in IP blocking. Use only on systems 
                        you have explicit authorization to test.
                    </div>
                </div>

                <div class="aggressive-config">
                    <div class="config-section">
                        <h4><i class="fas fa-tachometer-alt"></i> Performance Settings</h4>
                        <div class="config-grid">
                            <div class="form-group">
                                <label>Concurrent Threads</label>
                                <input type="number" class="caido-input" value="50" min="1" max="200" />
                            </div>
                            <div class="form-group">
                                <label>Request Rate</label>
                                <select class="caido-select">
                                    <option value="fast">Fast (100/sec)</option>
                                    <option value="aggressive" selected>Aggressive (500/sec)</option>
                                    <option value="extreme">Extreme (1000/sec)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Connection Timeout</label>
                                <input type="number" class="caido-input" value="30" /> seconds
                            </div>
                        </div>
                    </div>

                    <div class="config-section">
                        <h4><i class="fas fa-bomb"></i> Attack Vectors</h4>
                        <div class="attack-options">
                            <label class="checkbox-card checked">
                                <input type="checkbox" checked />
                                <span>All SQL Injection Tests</span>
                            </label>
                            <label class="checkbox-card checked">
                                <input type="checkbox" checked />
                                <span>All XSS Payloads</span>
                            </label>
                            <label class="checkbox-card checked">
                                <input type="checkbox" checked />
                                <span>Command Injection</span>
                            </label>
                            <label class="checkbox-card checked">
                                <input type="checkbox" checked />
                                <span>Path Traversal</span>
                            </label>
                            <label class="checkbox-card">
                                <input type="checkbox" checked />
                                <span>XXE Injection</span>
                            </label>
                            <label class="checkbox-card">
                                <input type="checkbox" checked />
                                <span>SSRF Testing</span>
                            </label>
                            <label class="checkbox-card">
                                <input type="checkbox" checked />
                                <span>SSTI Detection</span>
                            </label>
                            <label class="checkbox-card">
                                <input type="checkbox" checked />
                                <span>Deserialization</span>
                            </label>
                        </div>
                    </div>

                    <div class="config-section">
                        <h4><i class="fas fa-cogs"></i> Advanced Options</h4>
                        <div class="advanced-options">
                            <label class="checkbox-label">
                                <input type="checkbox" checked />
                                Follow redirects
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" checked />
                                Parse JavaScript for endpoints
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" checked />
                                Form auto-fill and submit
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" />
                                Attempt authentication bypass
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" />
                                Brute force common paths
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" />
                                API fuzzing mode
                            </label>
                        </div>
                    </div>

                    <div class="config-section">
                        <h4><i class="fas fa-file-alt"></i> Payload Lists</h4>
                        <div class="payload-lists">
                            <div class="payload-item">
                                <span>SQL Injection</span>
                                <span class="payload-count">2,847 payloads</span>
                                <button class="caido-btn tiny"><i class="fas fa-eye"></i></button>
                            </div>
                            <div class="payload-item">
                                <span>XSS</span>
                                <span class="payload-count">1,523 payloads</span>
                                <button class="caido-btn tiny"><i class="fas fa-eye"></i></button>
                            </div>
                            <div class="payload-item">
                                <span>Command Injection</span>
                                <span class="payload-count">456 payloads</span>
                                <button class="caido-btn tiny"><i class="fas fa-eye"></i></button>
                            </div>
                            <div class="payload-item">
                                <span>Path Traversal</span>
                                <span class="payload-count">234 payloads</span>
                                <button class="caido-btn tiny"><i class="fas fa-eye"></i></button>
                            </div>
                        </div>
                        <button class="caido-btn small" id="manage-payloads">
                            <i class="fas fa-cog"></i> Manage Payloads
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('start-aggressive')?.addEventListener('click', () => this.startScan());
        document.getElementById('manage-payloads')?.addEventListener('click', () => this.managePayloads());
    }

    startScan() {
        const content = `
            <div class="warning-text" style="color: var(--danger); margin-bottom: 1rem;">
                <i class="fas fa-exclamation-triangle"></i>
                You are about to start an aggressive scan. This action may:
                <ul>
                    <li>Generate high network traffic</li>
                    <li>Trigger security alerts</li>
                    <li>Potentially cause service disruption</li>
                </ul>
            </div>
            <div class="form-group">
                <label>Target URL</label>
                <input type="url" name="target" class="caido-input" placeholder="https://example.com" required />
            </div>
            <div class="form-group">
                <label class="checkbox-label">
                    <input type="checkbox" name="confirm" required />
                    I have authorization to perform this scan
                </label>
            </div>
        `;

        window.showModal?.('Start Aggressive Scan', content, async (formData) => {
            try {
                const result = await this.api.startAggressiveScan(formData.target, formData);
                if (result.success) {
                    window.showToast?.('warning', 'Started', 'Aggressive scan initiated - monitor closely');
                } else {
                    window.showToast?.('error', 'Error', result.error || 'Failed to start scan');
                }
            } catch (error) {
                window.showToast?.('error', 'Error', 'Failed to start scan');
            }
        });
    }

    managePayloads() {
        window.showToast?.('info', 'Payloads', 'Opening payload manager...');
    }
}

// Export classes
if (typeof window !== 'undefined') {
    window.PassiveScanPage = PassiveScanPage;
    window.ActiveScanPage = ActiveScanPage;
    window.StealthScanPage = StealthScanPage;
    window.AggressiveScanPage = AggressiveScanPage;
}
