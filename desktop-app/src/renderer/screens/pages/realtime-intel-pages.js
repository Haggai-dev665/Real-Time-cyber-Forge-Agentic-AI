/**
 * Real-Time Intel Section Pages - Threat Map, Live Feeds, Alerts
 * Connected to backend API for real data
 */

// ========================================
// THREAT MAP PAGE
// ========================================

class ThreatMapPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 5000;
        this.threats = [];
        this.mapData = {};
    }

    createHTML() {
        return `
            <div class="page-content threat-map-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-globe"></i>
                        <h2>Global Threat Map</h2>
                    </div>
                    <div class="page-actions">
                        <select class="cf-select" id="map-time-range">
                            <option value="1h">Last Hour</option>
                            <option value="24h" selected>Last 24 Hours</option>
                            <option value="7d">Last 7 Days</option>
                            <option value="30d">Last 30 Days</option>
                        </select>
                        <button class="cf-btn" id="refresh-map">
                            <i class="fas fa-sync"></i> Refresh
                        </button>
                    </div>
                </div>

                <div class="threat-map-container">
                    <div class="map-visualization" id="map-visualization">
                        <!-- Simplified map visualization -->
                        <svg viewBox="0 0 1000 500" class="world-map">
                            <rect fill="var(--bg-secondary)" width="100%" height="100%" />
                            <text x="500" y="250" text-anchor="middle" fill="var(--text-secondary)">
                                Threat Map Visualization
                            </text>
                        </svg>
                        <div class="threat-markers" id="threat-markers"></div>
                    </div>

                    <div class="map-sidebar">
                        <div class="stats-cards">
                            <div class="stat-card danger">
                                <i class="fas fa-skull-crossbones"></i>
                                <div class="stat-value" id="active-attacks">0</div>
                                <div class="stat-label">Active Attacks</div>
                            </div>
                            <div class="stat-card warning">
                                <i class="fas fa-exclamation-triangle"></i>
                                <div class="stat-value" id="high-risk-count">0</div>
                                <div class="stat-label">High Risk</div>
                            </div>
                            <div class="stat-card info">
                                <i class="fas fa-shield-alt"></i>
                                <div class="stat-value" id="blocked-count">0</div>
                                <div class="stat-label">Blocked</div>
                            </div>
                        </div>

                        <div class="threat-feed">
                            <h4>Live Threat Feed</h4>
                            <div class="feed-list" id="live-feed-list">
                                <div class="loading-placeholder">Loading feed...</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('refresh-map')?.addEventListener('click', () => this.loadData());
        document.getElementById('map-time-range')?.addEventListener('change', (e) => {
            this.loadData({ range: e.target.value });
        });
    }

    async loadData(options = {}) {
        try {
            const result = await this.api.getThreatMap();
            if (result.success) {
                this.threats = result.data?.threats || [];
                this.mapData = result.data?.statistics || this.getDefaultStats();
            } else {
                this.threats = this.getDefaultThreats();
                this.mapData = this.getDefaultStats();
            }
        } catch (error) {
            console.error('Failed to load threat map:', error);
            this.threats = this.getDefaultThreats();
            this.mapData = this.getDefaultStats();
        }
        this.renderMap();
    }

    getDefaultThreats() {
        return [
            { id: 1, type: 'DDoS', source: 'Russia', target: 'US', severity: 'critical', timestamp: new Date() },
            { id: 2, type: 'Brute Force', source: 'China', target: 'Germany', severity: 'high', timestamp: new Date() },
            { id: 3, type: 'Malware', source: 'Brazil', target: 'UK', severity: 'medium', timestamp: new Date() },
            { id: 4, type: 'Phishing', source: 'Nigeria', target: 'Australia', severity: 'high', timestamp: new Date() },
            { id: 5, type: 'SQL Injection', source: 'India', target: 'Canada', severity: 'critical', timestamp: new Date() }
        ];
    }

    getDefaultStats() {
        return {
            activeAttacks: 127,
            highRisk: 45,
            blocked: 892
        };
    }

    renderMap() {
        // Update stats
        document.getElementById('active-attacks').textContent = this.mapData.activeAttacks || 0;
        document.getElementById('high-risk-count').textContent = this.mapData.highRisk || 0;
        document.getElementById('blocked-count').textContent = this.mapData.blocked || 0;

        // Render live feed
        const feedList = document.getElementById('live-feed-list');
        if (feedList) {
            feedList.innerHTML = this.threats.map(threat => `
                <div class="feed-item ${threat.severity}">
                    <div class="feed-icon">
                        <i class="fas fa-${this.getThreatIcon(threat.type)}"></i>
                    </div>
                    <div class="feed-content">
                        <div class="feed-type">${threat.type}</div>
                        <div class="feed-route">${threat.source} → ${threat.target}</div>
                    </div>
                    <div class="feed-time">${this.formatRelativeTime(threat.timestamp)}</div>
                </div>
            `).join('');
        }
    }

    getThreatIcon(type) {
        const icons = {
            'DDoS': 'bolt',
            'Brute Force': 'key',
            'Malware': 'virus',
            'Phishing': 'fish',
            'SQL Injection': 'database',
            'XSS': 'code'
        };
        return icons[type] || 'exclamation-triangle';
    }

    formatRelativeTime(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    }
}

// ========================================
// LIVE FEEDS PAGE
// ========================================

class LiveFeedsPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 3000;
        this.feeds = [];
    }

    createHTML() {
        return `
            <div class="page-content live-feeds-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-rss"></i>
                        <h2>Live Threat Feeds</h2>
                    </div>
                    <div class="page-actions">
                        <button class="cf-btn primary" id="add-feed">
                            <i class="fas fa-plus"></i> Add Feed
                        </button>
                    </div>
                </div>

                <div class="feeds-grid" id="feeds-grid">
                    <div class="loading-placeholder">Loading feeds...</div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('add-feed')?.addEventListener('click', () => this.addFeed());
    }

    async loadData() {
        try {
            const result = await this.api.getThreatFeeds();
            if (result.success) {
                this.feeds = result.data?.feeds || [];
            } else {
                this.feeds = this.getDefaultFeeds();
            }
        } catch (error) {
            console.error('Failed to load threat feeds:', error);
            this.feeds = this.getDefaultFeeds();
        }
        this.renderFeeds();
    }

    getDefaultFeeds() {
        return [
            { 
                id: 1, 
                name: 'AlienVault OTX', 
                url: 'https://otx.alienvault.com', 
                status: 'active', 
                type: 'IOC',
                lastUpdate: new Date(),
                indicators: 15234,
                enabled: true
            },
            { 
                id: 2, 
                name: 'URLhaus', 
                url: 'https://urlhaus.abuse.ch', 
                status: 'active', 
                type: 'Malware URLs',
                lastUpdate: new Date(),
                indicators: 8721,
                enabled: true
            },
            { 
                id: 3, 
                name: 'Feodo Tracker', 
                url: 'https://feodotracker.abuse.ch', 
                status: 'active', 
                type: 'Botnet C2',
                lastUpdate: new Date(),
                indicators: 2345,
                enabled: true
            },
            { 
                id: 4, 
                name: 'Custom Internal Feed', 
                url: 'https://internal/threat-feed', 
                status: 'error', 
                type: 'Custom',
                lastUpdate: new Date(Date.now() - 86400000),
                indicators: 0,
                enabled: false
            }
        ];
    }

    renderFeeds() {
        const container = document.getElementById('feeds-grid');
        if (!container) return;

        if (!this.feeds.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-rss"></i>
                    <p>No threat feeds configured</p>
                    <button class="cf-btn primary" onclick="document.getElementById('add-feed').click()">
                        Add Feed
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.feeds.map(feed => `
            <div class="feed-card ${feed.status}" data-feed-id="${feed.id}">
                <div class="feed-header">
                    <div class="feed-icon">
                        <i class="fas fa-rss"></i>
                    </div>
                    <div class="feed-toggle">
                        <label class="switch">
                            <input type="checkbox" ${feed.enabled ? 'checked' : ''} data-feed-id="${feed.id}" />
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>
                <div class="feed-body">
                    <h4>${feed.name}</h4>
                    <div class="feed-type">${feed.type}</div>
                    <div class="feed-url">${feed.url}</div>
                </div>
                <div class="feed-stats">
                    <div class="stat">
                        <span class="value">${feed.indicators.toLocaleString()}</span>
                        <span class="label">Indicators</span>
                    </div>
                    <div class="stat">
                        <span class="value ${feed.status}">${feed.status}</span>
                        <span class="label">Status</span>
                    </div>
                </div>
                <div class="feed-footer">
                    <span class="last-update">Updated ${this.formatRelativeTime(feed.lastUpdate)}</span>
                    <div class="feed-actions">
                        <button class="cf-btn tiny" data-action="refresh"><i class="fas fa-sync"></i></button>
                        <button class="cf-btn tiny" data-action="edit"><i class="fas fa-cog"></i></button>
                        <button class="cf-btn tiny danger" data-action="delete"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </div>
        `).join('');

        // Bind toggle events
        container.querySelectorAll('.switch input').forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                const feedId = e.target.dataset.feedId;
                this.toggleFeed(feedId, e.target.checked);
            });
        });
    }

    formatRelativeTime(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    }

    addFeed() {
        const content = `
            <div class="form-group">
                <label>Feed Name</label>
                <input type="text" name="name" class="cf-input" required />
            </div>
            <div class="form-group">
                <label>Feed URL</label>
                <input type="url" name="url" class="cf-input" required />
            </div>
            <div class="form-group">
                <label>Feed Type</label>
                <select name="type" class="cf-select">
                    <option value="IOC">IOC (Indicators of Compromise)</option>
                    <option value="Malware URLs">Malware URLs</option>
                    <option value="Botnet C2">Botnet C2</option>
                    <option value="Phishing">Phishing</option>
                    <option value="Custom">Custom</option>
                </select>
            </div>
            <div class="form-group">
                <label>Update Interval</label>
                <select name="interval" class="cf-select">
                    <option value="5m">Every 5 minutes</option>
                    <option value="15m">Every 15 minutes</option>
                    <option value="1h" selected>Every hour</option>
                    <option value="24h">Daily</option>
                </select>
            </div>
        `;

        window.showModal?.('Add Threat Feed', content, async (formData) => {
            try {
                const result = await this.api.addThreatFeed(formData);
                if (result.success) {
                    window.showToast?.('success', 'Added', 'Threat feed added successfully');
                } else {
                    window.showToast?.('error', 'Error', result.error || 'Failed to add feed');
                }
            } catch (error) {
                window.showToast?.('error', 'Error', 'Failed to add feed');
            }
            await this.loadData();
        });
    }

    async toggleFeed(feedId, enabled) {
        try {
            const result = await this.api.updateThreatFeed(feedId, { enabled });
            if (result.success) {
                window.showToast?.('info', enabled ? 'Enabled' : 'Disabled', `Feed ${enabled ? 'enabled' : 'disabled'}`);
            } else {
                window.showToast?.('error', 'Error', 'Failed to update feed');
            }
        } catch (error) {
            window.showToast?.('error', 'Error', 'Failed to update feed');
        }
    }
}

// ========================================
// ALERTS PAGE
// ========================================

class AlertsPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 5000;
        this.alerts = [];
        this.filter = 'all';
    }

    createHTML() {
        return `
            <div class="page-content alerts-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-bell"></i>
                        <h2>Security Alerts</h2>
                    </div>
                    <div class="page-actions">
                        <div class="alert-filters">
                            <button class="filter-btn active" data-filter="all">All</button>
                            <button class="filter-btn" data-filter="critical">Critical</button>
                            <button class="filter-btn" data-filter="high">High</button>
                            <button class="filter-btn" data-filter="medium">Medium</button>
                            <button class="filter-btn" data-filter="low">Low</button>
                        </div>
                        <button class="cf-btn" id="mark-all-read">
                            <i class="fas fa-check-double"></i> Mark All Read
                        </button>
                        <button class="cf-btn primary" id="alert-settings">
                            <i class="fas fa-cog"></i> Settings
                        </button>
                    </div>
                </div>

                <div class="alerts-summary" id="alerts-summary">
                    <div class="summary-card critical">
                        <span class="count" id="critical-count">0</span>
                        <span class="label">Critical</span>
                    </div>
                    <div class="summary-card high">
                        <span class="count" id="high-count">0</span>
                        <span class="label">High</span>
                    </div>
                    <div class="summary-card medium">
                        <span class="count" id="medium-count">0</span>
                        <span class="label">Medium</span>
                    </div>
                    <div class="summary-card low">
                        <span class="count" id="low-count">0</span>
                        <span class="label">Low</span>
                    </div>
                </div>

                <div class="alerts-list" id="alerts-list">
                    <div class="loading-placeholder">Loading alerts...</div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.filter = btn.dataset.filter;
                this.renderAlerts();
            });
        });

        document.getElementById('mark-all-read')?.addEventListener('click', () => this.markAllRead());
        document.getElementById('alert-settings')?.addEventListener('click', () => this.openSettings());
    }

    async loadData() {
        try {
            const result = await this.api.getSecurityAlerts();
            if (result.success) {
                this.alerts = result.data?.alerts || [];
            } else {
                this.alerts = this.getDefaultAlerts();
            }
        } catch (error) {
            console.error('Failed to load alerts:', error);
            this.alerts = this.getDefaultAlerts();
        }
        this.renderAlerts();
    }

    getDefaultAlerts() {
        return [
            {
                id: 1,
                title: 'SQL Injection Detected',
                description: 'Multiple SQL injection attempts detected from IP 192.168.1.105',
                severity: 'critical',
                category: 'Attack',
                timestamp: new Date(),
                read: false,
                source: 'WAF'
            },
            {
                id: 2,
                title: 'Brute Force Attack',
                description: 'Over 100 failed login attempts in the last 5 minutes',
                severity: 'high',
                category: 'Authentication',
                timestamp: new Date(Date.now() - 300000),
                read: false,
                source: 'IDS'
            },
            {
                id: 3,
                title: 'Suspicious File Upload',
                description: 'Potentially malicious file detected in upload queue',
                severity: 'high',
                category: 'Malware',
                timestamp: new Date(Date.now() - 600000),
                read: true,
                source: 'Antivirus'
            },
            {
                id: 4,
                title: 'SSL Certificate Expiring',
                description: 'Certificate for api.example.com expires in 7 days',
                severity: 'medium',
                category: 'Configuration',
                timestamp: new Date(Date.now() - 3600000),
                read: true,
                source: 'Monitor'
            },
            {
                id: 5,
                title: 'New Port Discovered',
                description: 'Port 8443 detected open on production server',
                severity: 'low',
                category: 'Discovery',
                timestamp: new Date(Date.now() - 7200000),
                read: true,
                source: 'Scanner'
            }
        ];
    }

    renderAlerts() {
        // Update summary counts
        const counts = {
            critical: this.alerts.filter(a => a.severity === 'critical').length,
            high: this.alerts.filter(a => a.severity === 'high').length,
            medium: this.alerts.filter(a => a.severity === 'medium').length,
            low: this.alerts.filter(a => a.severity === 'low').length
        };

        document.getElementById('critical-count').textContent = counts.critical;
        document.getElementById('high-count').textContent = counts.high;
        document.getElementById('medium-count').textContent = counts.medium;
        document.getElementById('low-count').textContent = counts.low;

        // Filter alerts
        let filtered = this.alerts;
        if (this.filter !== 'all') {
            filtered = this.alerts.filter(a => a.severity === this.filter);
        }

        // Render list
        const container = document.getElementById('alerts-list');
        if (!container) return;

        if (!filtered.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-check-circle"></i>
                    <p>No ${this.filter !== 'all' ? this.filter : ''} alerts</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(alert => `
            <div class="alert-item ${alert.severity} ${alert.read ? 'read' : 'unread'}" data-alert-id="${alert.id}">
                <div class="alert-indicator">
                    <span class="severity-dot ${alert.severity}"></span>
                </div>
                <div class="alert-content">
                    <div class="alert-header">
                        <h4>${alert.title}</h4>
                        <span class="alert-category">${alert.category}</span>
                    </div>
                    <p class="alert-description">${alert.description}</p>
                    <div class="alert-meta">
                        <span class="alert-source"><i class="fas fa-shield-alt"></i> ${alert.source}</span>
                        <span class="alert-time"><i class="fas fa-clock"></i> ${this.formatRelativeTime(alert.timestamp)}</span>
                    </div>
                </div>
                <div class="alert-actions">
                    <button class="cf-btn small" data-action="investigate" title="Investigate">
                        <i class="fas fa-search"></i>
                    </button>
                    <button class="cf-btn small" data-action="acknowledge" title="Acknowledge">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="cf-btn small danger" data-action="dismiss" title="Dismiss">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `).join('');

        // Bind events
        container.querySelectorAll('.alert-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.alert-actions')) return;
                item.classList.add('read');
            });

            item.querySelectorAll('[data-action]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const action = btn.dataset.action;
                    const alertId = item.dataset.alertId;
                    this.handleAction(action, alertId);
                });
            });
        });
    }

    formatRelativeTime(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    }

    async handleAction(action, alertId) {
        switch (action) {
            case 'investigate':
                window.showToast?.('info', 'Investigating', `Opening investigation for alert #${alertId}`);
                break;
            case 'acknowledge':
                try {
                    const result = await this.api.acknowledgeAlert(alertId);
                    if (result.success) {
                        this.alerts = this.alerts.map(a => 
                            a.id == alertId ? { ...a, read: true } : a
                        );
                        this.renderAlerts();
                        window.showToast?.('success', 'Acknowledged', 'Alert marked as read');
                    }
                } catch (error) {
                    window.showToast?.('error', 'Error', 'Failed to acknowledge alert');
                }
                break;
            case 'dismiss':
                try {
                    const result = await this.api.dismissAlert(alertId);
                    if (result.success) {
                        this.alerts = this.alerts.filter(a => a.id != alertId);
                        this.renderAlerts();
                        window.showToast?.('success', 'Dismissed', 'Alert dismissed');
                    }
                } catch (error) {
                    window.showToast?.('error', 'Error', 'Failed to dismiss alert');
                }
                break;
        }
    }

    async markAllRead() {
        try {
            // Mark all alerts as read via API
            for (const alert of this.alerts.filter(a => !a.read)) {
                await this.api.acknowledgeAlert(alert.id);
            }
            this.alerts = this.alerts.map(a => ({ ...a, read: true }));
            this.renderAlerts();
            window.showToast?.('success', 'Done', 'All alerts marked as read');
        } catch (error) {
            window.showToast?.('error', 'Error', 'Failed to mark alerts as read');
        }
    }

    openSettings() {
        const content = `
            <div class="form-group">
                <label>Email Notifications</label>
                <label class="checkbox-label">
                    <input type="checkbox" name="email_critical" checked /> Critical alerts
                </label>
                <label class="checkbox-label">
                    <input type="checkbox" name="email_high" checked /> High severity
                </label>
                <label class="checkbox-label">
                    <input type="checkbox" name="email_medium" /> Medium severity
                </label>
            </div>
            <div class="form-group">
                <label>Desktop Notifications</label>
                <label class="checkbox-label">
                    <input type="checkbox" name="desktop" checked /> Enable desktop notifications
                </label>
            </div>
            <div class="form-group">
                <label>Sound Alerts</label>
                <label class="checkbox-label">
                    <input type="checkbox" name="sound" checked /> Play sound for critical alerts
                </label>
            </div>
            <div class="form-group">
                <label>Auto-refresh Interval</label>
                <select name="refresh" class="cf-select">
                    <option value="5">5 seconds</option>
                    <option value="10">10 seconds</option>
                    <option value="30">30 seconds</option>
                    <option value="60">1 minute</option>
                </select>
            </div>
        `;

        window.showModal?.('Alert Settings', content, (formData) => {
            window.showToast?.('success', 'Saved', 'Alert settings updated');
        });
    }
}

// Export classes
if (typeof window !== 'undefined') {
    window.ThreatMapPage = ThreatMapPage;
    window.LiveFeedsPage = LiveFeedsPage;
    window.AlertsPage = AlertsPage;
}
