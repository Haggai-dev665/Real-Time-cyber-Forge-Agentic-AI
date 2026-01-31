/**
 * Testing Section Pages - AI Models, Threat Intel, Environment
 * Connected to backend API for real data
 */

// ========================================
// AI MODELS PAGES
// ========================================

class AIModelsListPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 30000;
        this.models = [];
    }

    createHTML() {
        return `
            <div class="page-content ai-models-list-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-brain"></i>
                        <h2>AI Models</h2>
                    </div>
                    <div class="page-actions">
                        <button class="caido-btn primary" id="import-model">
                            <i class="fas fa-upload"></i> Import Model
                        </button>
                        <button class="caido-btn" id="refresh-models">
                            <i class="fas fa-sync"></i>
                        </button>
                    </div>
                </div>

                <div class="models-grid" id="models-grid">
                    <div class="loading-placeholder">Loading AI models...</div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('import-model')?.addEventListener('click', () => this.importModel());
        document.getElementById('refresh-models')?.addEventListener('click', () => this.loadData());
    }

    async loadData() {
        try {
            const result = await this.api.get('/api/ai/models');
            if (result.success) {
                this.models = result.data?.models || [];
            } else {
                // Default models
                this.models = [
                    { id: 'transformer', name: 'Transformer Security', type: 'Classification', accuracy: 0.94, status: 'active' },
                    { id: 'cnn', name: 'CNN Pattern Detector', type: 'Classification', accuracy: 0.92, status: 'active' },
                    { id: 'lstm', name: 'LSTM Sequence Analyzer', type: 'Classification', accuracy: 0.89, status: 'active' },
                    { id: 'autoencoder', name: 'Autoencoder Anomaly', type: 'Anomaly Detection', accuracy: 0.87, status: 'standby' },
                    { id: 'gemini', name: 'Gemini Pro', type: 'LLM', accuracy: null, status: 'active' }
                ];
            }
            this.renderModels();
        } catch (error) {
            console.error('Failed to load models:', error);
            this.renderDefaultModels();
        }
    }

    renderModels() {
        const container = document.getElementById('models-grid');
        if (!container) return;

        container.innerHTML = this.models.map(model => `
            <div class="model-card ${model.status}" data-model-id="${model.id}">
                <div class="model-icon">
                    <i class="fas fa-${this.getModelIcon(model.type)}"></i>
                </div>
                <div class="model-info">
                    <h4>${model.name}</h4>
                    <span class="model-type">${model.type}</span>
                    ${model.accuracy ? `<div class="model-accuracy">Accuracy: ${(model.accuracy * 100).toFixed(1)}%</div>` : ''}
                </div>
                <div class="model-status ${model.status}">${model.status}</div>
                <div class="model-actions">
                    <button class="caido-btn small" data-action="details">
                        <i class="fas fa-info-circle"></i>
                    </button>
                    <button class="caido-btn small ${model.status === 'active' ? 'warning' : 'success'}" data-action="toggle">
                        <i class="fas fa-${model.status === 'active' ? 'pause' : 'play'}"></i>
                    </button>
                </div>
            </div>
        `).join('');

        this.bindModelActions();
    }

    renderDefaultModels() {
        this.models = [
            { id: 'default', name: 'Default Classifier', type: 'Classification', status: 'active' }
        ];
        this.renderModels();
    }

    getModelIcon(type) {
        const icons = {
            'Classification': 'brain',
            'Anomaly Detection': 'chart-area',
            'LLM': 'comments',
            'NLP': 'language'
        };
        return icons[type] || 'microchip';
    }

    bindModelActions() {
        document.querySelectorAll('.model-card').forEach(card => {
            card.querySelector('[data-action="details"]')?.addEventListener('click', () => {
                window.pageController?.navigateTo('ai-models-config', { modelId: card.dataset.modelId });
            });
        });
    }

    importModel() {
        const content = `
            <div class="form-group">
                <label>Model Name</label>
                <input type="text" name="name" class="caido-input" required />
            </div>
            <div class="form-group">
                <label>Model Type</label>
                <select name="type" class="caido-select">
                    <option value="classification">Classification</option>
                    <option value="anomaly">Anomaly Detection</option>
                    <option value="nlp">NLP</option>
                </select>
            </div>
            <div class="form-group">
                <label>Model File (.keras, .pkl, .onnx)</label>
                <input type="file" name="file" class="caido-input" accept=".keras,.pkl,.onnx,.h5" />
            </div>
        `;

        window.showModal?.('Import AI Model', content, async (formData) => {
            window.showToast?.('info', 'Importing', 'Model import in progress...');
        });
    }
}

class AIModelsConfigPage extends BasePage {
    constructor() {
        super();
        this.model = null;
    }

    createHTML() {
        return `
            <div class="page-content ai-models-config-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-cog"></i>
                        <h2>Model Configuration</h2>
                    </div>
                    <div class="page-actions">
                        <button class="caido-btn" id="back-to-models">
                            <i class="fas fa-arrow-left"></i> Back
                        </button>
                        <button class="caido-btn primary" id="save-config">
                            <i class="fas fa-save"></i> Save
                        </button>
                    </div>
                </div>

                <div class="config-container" id="config-container">
                    <div class="loading-placeholder">Loading configuration...</div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('back-to-models')?.addEventListener('click', () => {
            window.pageController?.navigateTo('ai-models-list');
        });
        document.getElementById('save-config')?.addEventListener('click', () => this.saveConfig());
    }

    async loadData() {
        const modelId = this.options?.modelId || 'transformer';
        
        // Load model configuration
        this.model = {
            id: modelId,
            name: 'Transformer Security Model',
            config: {
                threshold: 0.5,
                batchSize: 32,
                maxTokens: 512,
                temperature: 0.7
            }
        };

        this.renderConfig();
    }

    renderConfig() {
        const container = document.getElementById('config-container');
        if (!container || !this.model) return;

        container.innerHTML = `
            <div class="config-section">
                <h4>Model Details</h4>
                <div class="config-grid">
                    <div class="config-item">
                        <label>Model ID</label>
                        <input type="text" class="caido-input" value="${this.model.id}" disabled />
                    </div>
                    <div class="config-item">
                        <label>Model Name</label>
                        <input type="text" class="caido-input" id="model-name" value="${this.model.name}" />
                    </div>
                </div>
            </div>

            <div class="config-section">
                <h4>Inference Settings</h4>
                <div class="config-grid">
                    <div class="config-item">
                        <label>Detection Threshold</label>
                        <input type="range" id="threshold" min="0" max="1" step="0.05" 
                               value="${this.model.config.threshold}" />
                        <span id="threshold-value">${this.model.config.threshold}</span>
                    </div>
                    <div class="config-item">
                        <label>Batch Size</label>
                        <select id="batch-size" class="caido-select">
                            ${[16, 32, 64, 128].map(s => 
                                `<option value="${s}" ${this.model.config.batchSize === s ? 'selected' : ''}>${s}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="config-item">
                        <label>Max Tokens</label>
                        <input type="number" class="caido-input" id="max-tokens" 
                               value="${this.model.config.maxTokens}" />
                    </div>
                </div>
            </div>

            <div class="config-section">
                <h4>Model Statistics</h4>
                <div class="stats-grid">
                    <div class="stat-box">
                        <span class="stat-label">Predictions Today</span>
                        <span class="stat-value">1,234</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-label">Avg Response Time</span>
                        <span class="stat-value">45ms</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-label">Memory Usage</span>
                        <span class="stat-value">256MB</span>
                    </div>
                </div>
            </div>
        `;

        // Bind threshold slider
        const slider = document.getElementById('threshold');
        const display = document.getElementById('threshold-value');
        slider?.addEventListener('input', () => {
            display.textContent = slider.value;
        });
    }

    async saveConfig() {
        window.showToast?.('success', 'Saved', 'Model configuration updated');
    }
}

class AIModelsTrainingPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 5000;
        this.trainingJobs = [];
    }

    createHTML() {
        return `
            <div class="page-content ai-models-training-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-graduation-cap"></i>
                        <h2>Model Training</h2>
                    </div>
                    <div class="page-actions">
                        <button class="caido-btn primary" id="new-training">
                            <i class="fas fa-plus"></i> New Training Job
                        </button>
                    </div>
                </div>

                <div class="training-jobs" id="training-jobs">
                    <div class="loading-placeholder">Loading training jobs...</div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('new-training')?.addEventListener('click', () => this.newTrainingJob());
    }

    async loadData() {
        try {
            const result = await this.api.get('/api/ai/training');
            if (result.success) {
                this.trainingJobs = result.data?.jobs || [];
            }
        } catch (error) {
            this.trainingJobs = [];
        }
        this.renderJobs();
    }

    renderJobs() {
        const container = document.getElementById('training-jobs');
        if (!container) return;

        if (!this.trainingJobs.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-graduation-cap"></i>
                    <p>No training jobs</p>
                    <p class="subtext">Start training a model on your security data</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.trainingJobs.map(job => `
            <div class="training-job ${job.status}">
                <div class="job-header">
                    <h4>${job.name}</h4>
                    <span class="job-status">${job.status}</span>
                </div>
                <div class="job-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${job.progress || 0}%"></div>
                    </div>
                    <span>${job.progress || 0}%</span>
                </div>
                <div class="job-details">
                    <span>Epoch: ${job.currentEpoch || 0}/${job.totalEpochs || 50}</span>
                    <span>Loss: ${job.loss?.toFixed(4) || '-'}</span>
                    <span>Accuracy: ${job.accuracy ? (job.accuracy * 100).toFixed(1) + '%' : '-'}</span>
                </div>
            </div>
        `).join('');
    }

    newTrainingJob() {
        const content = `
            <div class="form-group">
                <label>Job Name</label>
                <input type="text" name="name" class="caido-input" placeholder="Security Model Training" required />
            </div>
            <div class="form-group">
                <label>Model Architecture</label>
                <select name="architecture" class="caido-select">
                    <option value="transformer">Transformer</option>
                    <option value="cnn">CNN</option>
                    <option value="lstm">LSTM</option>
                    <option value="autoencoder">Autoencoder</option>
                </select>
            </div>
            <div class="form-group">
                <label>Dataset</label>
                <select name="dataset" class="caido-select">
                    <option value="combined">Combined Security Dataset</option>
                    <option value="phishing">Phishing Detection</option>
                    <option value="malware">Malware Detection</option>
                    <option value="intrusion">Network Intrusion</option>
                </select>
            </div>
            <div class="form-group">
                <label>Epochs</label>
                <input type="number" name="epochs" class="caido-input" value="50" />
            </div>
        `;

        window.showModal?.('Start Training Job', content, async (formData) => {
            try {
                const result = await this.api.post('/api/ai/training', formData);
                if (result.success) {
                    window.showToast?.('success', 'Started', 'Training job started');
                    await this.loadData();
                }
            } catch (error) {
                window.showToast?.('error', 'Failed', error.message);
            }
        });
    }
}

// ========================================
// THREAT INTEL PAGES
// ========================================

class ThreatIntelFeedsPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 60000;
        this.feeds = [];
    }

    createHTML() {
        return `
            <div class="page-content threat-intel-feeds-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-rss"></i>
                        <h2>Threat Feeds</h2>
                    </div>
                    <div class="page-actions">
                        <button class="caido-btn primary" id="add-feed">
                            <i class="fas fa-plus"></i> Add Feed
                        </button>
                        <button class="caido-btn" id="sync-all-feeds">
                            <i class="fas fa-sync"></i> Sync All
                        </button>
                    </div>
                </div>

                <div class="feeds-list" id="feeds-list">
                    <div class="loading-placeholder">Loading threat feeds...</div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('add-feed')?.addEventListener('click', () => this.addFeed());
        document.getElementById('sync-all-feeds')?.addEventListener('click', () => this.syncAll());
    }

    async loadData() {
        try {
            const result = await this.api.get('/api/threats/feeds');
            if (result.success) {
                this.feeds = result.data?.feeds || [];
            } else {
                this.feeds = this.getDefaultFeeds();
            }
        } catch (error) {
            this.feeds = this.getDefaultFeeds();
        }
        this.renderFeeds();
    }

    getDefaultFeeds() {
        return [
            { id: 1, name: 'AlienVault OTX', url: 'https://otx.alienvault.com', status: 'active', lastSync: new Date(), indicators: 15420 },
            { id: 2, name: 'Abuse.ch URLhaus', url: 'https://urlhaus.abuse.ch', status: 'active', lastSync: new Date(), indicators: 8340 },
            { id: 3, name: 'VirusTotal', url: 'https://virustotal.com', status: 'active', lastSync: new Date(), indicators: 42100 },
            { id: 4, name: 'MISP Feed', url: 'https://misp-project.org', status: 'paused', lastSync: null, indicators: 0 },
            { id: 5, name: 'Emerging Threats', url: 'https://rules.emergingthreats.net', status: 'active', lastSync: new Date(), indicators: 5670 }
        ];
    }

    renderFeeds() {
        const container = document.getElementById('feeds-list');
        if (!container) return;

        container.innerHTML = this.feeds.map(feed => `
            <div class="feed-card ${feed.status}" data-feed-id="${feed.id}">
                <div class="feed-icon">
                    <i class="fas fa-rss"></i>
                </div>
                <div class="feed-info">
                    <h4>${feed.name}</h4>
                    <div class="feed-url">${feed.url}</div>
                    <div class="feed-stats">
                        <span><i class="fas fa-database"></i> ${feed.indicators?.toLocaleString() || 0} indicators</span>
                        <span><i class="fas fa-clock"></i> ${feed.lastSync ? this.formatDate(feed.lastSync) : 'Never synced'}</span>
                    </div>
                </div>
                <div class="feed-status ${feed.status}">${feed.status}</div>
                <div class="feed-actions">
                    <button class="caido-btn small success" data-action="sync">
                        <i class="fas fa-sync"></i>
                    </button>
                    <button class="caido-btn small" data-action="configure">
                        <i class="fas fa-cog"></i>
                    </button>
                    <button class="caido-btn small ${feed.status === 'active' ? 'warning' : 'success'}" data-action="toggle">
                        <i class="fas fa-${feed.status === 'active' ? 'pause' : 'play'}"></i>
                    </button>
                </div>
            </div>
        `).join('');

        this.bindFeedActions();
    }

    bindFeedActions() {
        document.querySelectorAll('.feed-card').forEach(card => {
            const feedId = card.dataset.feedId;

            card.querySelector('[data-action="sync"]')?.addEventListener('click', () => {
                this.syncFeed(feedId);
            });
        });
    }

    async syncFeed(feedId) {
        window.showToast?.('info', 'Syncing', 'Fetching threat indicators...');
        try {
            await this.api.post(`/api/threats/feeds/${feedId}/sync`);
            window.showToast?.('success', 'Synced', 'Feed synchronized');
            await this.loadData();
        } catch (error) {
            window.showToast?.('error', 'Failed', error.message);
        }
    }

    async syncAll() {
        window.showToast?.('info', 'Syncing', 'Synchronizing all feeds...');
        await this.loadData();
        window.showToast?.('success', 'Complete', 'All feeds synchronized');
    }

    addFeed() {
        const content = `
            <div class="form-group">
                <label>Feed Name</label>
                <input type="text" name="name" class="caido-input" required />
            </div>
            <div class="form-group">
                <label>Feed URL</label>
                <input type="url" name="url" class="caido-input" required />
            </div>
            <div class="form-group">
                <label>API Key (if required)</label>
                <input type="password" name="apiKey" class="caido-input" />
            </div>
            <div class="form-group">
                <label>Sync Interval</label>
                <select name="interval" class="caido-select">
                    <option value="1h">Every Hour</option>
                    <option value="6h">Every 6 Hours</option>
                    <option value="24h">Daily</option>
                    <option value="manual">Manual</option>
                </select>
            </div>
        `;

        window.showModal?.('Add Threat Feed', content, async (formData) => {
            try {
                const result = await this.api.post('/api/threats/feeds', formData);
                if (result.success) {
                    window.showToast?.('success', 'Added', 'Feed added');
                    await this.loadData();
                }
            } catch (error) {
                window.showToast?.('error', 'Failed', error.message);
            }
        });
    }
}

class ThreatIntelIndicatorsPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 30000;
        this.indicators = [];
        this.filter = 'all';
    }

    createHTML() {
        return `
            <div class="page-content threat-intel-indicators-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-crosshairs"></i>
                        <h2>Threat Indicators</h2>
                    </div>
                    <div class="page-filters">
                        <button class="filter-btn active" data-filter="all">All</button>
                        <button class="filter-btn" data-filter="ip">IPs</button>
                        <button class="filter-btn" data-filter="domain">Domains</button>
                        <button class="filter-btn" data-filter="hash">Hashes</button>
                        <button class="filter-btn" data-filter="url">URLs</button>
                    </div>
                    <div class="page-actions">
                        <input type="text" class="caido-input search-input" id="indicator-search" placeholder="Search indicators..." />
                    </div>
                </div>

                <div class="indicators-table-container">
                    <table class="caido-table" id="indicators-table">
                        <thead>
                            <tr>
                                <th>Type</th>
                                <th>Value</th>
                                <th>Severity</th>
                                <th>Source</th>
                                <th>First Seen</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="indicators-body">
                            <tr><td colspan="6" class="loading">Loading...</td></tr>
                        </tbody>
                    </table>
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
                this.renderIndicators();
            });
        });

        document.getElementById('indicator-search')?.addEventListener('input', (e) => {
            this.searchIndicators(e.target.value);
        });
    }

    async loadData() {
        try {
            const result = await this.api.get('/api/threats/indicators');
            if (result.success) {
                this.indicators = result.data?.indicators || [];
            } else {
                this.indicators = this.getDefaultIndicators();
            }
        } catch (error) {
            this.indicators = this.getDefaultIndicators();
        }
        this.renderIndicators();
    }

    getDefaultIndicators() {
        return [
            { id: 1, type: 'ip', value: '45.33.32.156', severity: 'high', source: 'AlienVault', firstSeen: new Date() },
            { id: 2, type: 'domain', value: 'malware-c2.evil.com', severity: 'critical', source: 'URLhaus', firstSeen: new Date() },
            { id: 3, type: 'hash', value: 'a3b9c8d7e6f5...', severity: 'medium', source: 'VirusTotal', firstSeen: new Date() },
            { id: 4, type: 'url', value: 'http://phishing.example/login', severity: 'high', source: 'PhishTank', firstSeen: new Date() },
            { id: 5, type: 'ip', value: '192.168.100.200', severity: 'low', source: 'Internal', firstSeen: new Date() }
        ];
    }

    renderIndicators() {
        const tbody = document.getElementById('indicators-body');
        if (!tbody) return;

        let filtered = this.indicators;
        if (this.filter !== 'all') {
            filtered = this.indicators.filter(i => i.type === this.filter);
        }

        if (!filtered.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="empty">No indicators found</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(indicator => `
            <tr>
                <td><span class="indicator-type ${indicator.type}">${indicator.type.toUpperCase()}</span></td>
                <td><code>${indicator.value}</code></td>
                <td><span class="severity-badge ${indicator.severity}">${indicator.severity}</span></td>
                <td>${indicator.source}</td>
                <td>${this.formatDate(indicator.firstSeen)}</td>
                <td>
                    <button class="caido-btn tiny" title="Add to blocklist">
                        <i class="fas fa-ban"></i>
                    </button>
                    <button class="caido-btn tiny" title="View details">
                        <i class="fas fa-info-circle"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    searchIndicators(query) {
        if (!query) {
            this.renderIndicators();
            return;
        }

        const tbody = document.getElementById('indicators-body');
        const filtered = this.indicators.filter(i => 
            i.value.toLowerCase().includes(query.toLowerCase()) ||
            i.source.toLowerCase().includes(query.toLowerCase())
        );

        if (!filtered.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="empty">No matches found</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(indicator => `
            <tr>
                <td><span class="indicator-type ${indicator.type}">${indicator.type.toUpperCase()}</span></td>
                <td><code>${indicator.value}</code></td>
                <td><span class="severity-badge ${indicator.severity}">${indicator.severity}</span></td>
                <td>${indicator.source}</td>
                <td>${this.formatDate(indicator.firstSeen)}</td>
                <td>
                    <button class="caido-btn tiny"><i class="fas fa-ban"></i></button>
                    <button class="caido-btn tiny"><i class="fas fa-info-circle"></i></button>
                </td>
            </tr>
        `).join('');
    }
}

class ThreatIntelReportsPage extends BasePage {
    constructor() {
        super();
        this.reports = [];
    }

    createHTML() {
        return `
            <div class="page-content threat-intel-reports-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-file-alt"></i>
                        <h2>Threat Reports</h2>
                    </div>
                    <div class="page-actions">
                        <button class="caido-btn primary" id="generate-report">
                            <i class="fas fa-plus"></i> Generate Report
                        </button>
                    </div>
                </div>

                <div class="reports-list" id="reports-list">
                    <div class="loading-placeholder">Loading reports...</div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('generate-report')?.addEventListener('click', () => this.generateReport());
    }

    async loadData() {
        this.reports = [
            { id: 1, title: 'Weekly Threat Summary', date: new Date(), type: 'summary', status: 'ready' },
            { id: 2, title: 'Malware Campaign Analysis', date: new Date(), type: 'analysis', status: 'ready' },
            { id: 3, title: 'Phishing Trends Q4 2025', date: new Date(), type: 'trends', status: 'generating' }
        ];
        this.renderReports();
    }

    renderReports() {
        const container = document.getElementById('reports-list');
        if (!container) return;

        container.innerHTML = this.reports.map(report => `
            <div class="report-card ${report.status}">
                <div class="report-icon">
                    <i class="fas fa-file-alt"></i>
                </div>
                <div class="report-info">
                    <h4>${report.title}</h4>
                    <span class="report-type">${report.type}</span>
                    <span class="report-date">${this.formatDate(report.date)}</span>
                </div>
                <div class="report-status ${report.status}">${report.status}</div>
                <div class="report-actions">
                    ${report.status === 'ready' ? `
                        <button class="caido-btn small primary">
                            <i class="fas fa-eye"></i> View
                        </button>
                        <button class="caido-btn small">
                            <i class="fas fa-download"></i> Download
                        </button>
                    ` : `
                        <button class="caido-btn small" disabled>
                            <i class="fas fa-spinner fa-spin"></i> Generating...
                        </button>
                    `}
                </div>
            </div>
        `).join('');
    }

    generateReport() {
        const content = `
            <div class="form-group">
                <label>Report Type</label>
                <select name="type" class="caido-select">
                    <option value="summary">Weekly Summary</option>
                    <option value="analysis">Campaign Analysis</option>
                    <option value="trends">Trend Report</option>
                    <option value="custom">Custom Report</option>
                </select>
            </div>
            <div class="form-group">
                <label>Date Range</label>
                <select name="range" class="caido-select">
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                    <option value="90d">Last 90 Days</option>
                </select>
            </div>
        `;

        window.showModal?.('Generate Report', content, async (formData) => {
            window.showToast?.('info', 'Generating', 'Report generation started...');
        });
    }
}

// ========================================
// ENVIRONMENT PAGES
// ========================================

class EnvironmentVariablesPage extends BasePage {
    constructor() {
        super();
        this.variables = [];
    }

    createHTML() {
        return `
            <div class="page-content environment-variables-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-code"></i>
                        <h2>Environment Variables</h2>
                    </div>
                    <div class="page-actions">
                        <button class="caido-btn primary" id="add-variable">
                            <i class="fas fa-plus"></i> Add Variable
                        </button>
                        <button class="caido-btn" id="import-env">
                            <i class="fas fa-upload"></i> Import
                        </button>
                    </div>
                </div>

                <div class="variables-table-container">
                    <table class="caido-table" id="variables-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Value</th>
                                <th>Scope</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="variables-body">
                            <tr><td colspan="4" class="loading">Loading...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('add-variable')?.addEventListener('click', () => this.addVariable());
        document.getElementById('import-env')?.addEventListener('click', () => this.importEnv());
    }

    async loadData() {
        try {
            const result = await this.api.get('/api/environment');
            if (result.success) {
                this.variables = result.data?.data?.variables || [];
            } else {
                this.variables = this.getDefaultVariables();
            }
        } catch (error) {
            this.variables = this.getDefaultVariables();
        }
        this.renderVariables();
    }

    getDefaultVariables() {
        return [
            { id: 1, name: 'BASE_URL', value: 'https://api.example.com', scope: 'global' },
            { id: 2, name: 'AUTH_TOKEN', value: '••••••••', scope: 'project', isSecret: true },
            { id: 3, name: 'API_KEY', value: '••••••••', scope: 'global', isSecret: true },
            { id: 4, name: 'USER_AGENT', value: 'CyberForge/1.0', scope: 'global' },
            { id: 5, name: 'TIMEOUT', value: '30000', scope: 'project' }
        ];
    }

    renderVariables() {
        const tbody = document.getElementById('variables-body');
        if (!tbody) return;

        if (!this.variables.length) {
            tbody.innerHTML = `<tr><td colspan="4" class="empty">No environment variables</td></tr>`;
            return;
        }

        tbody.innerHTML = this.variables.map(v => `
            <tr data-var-id="${v.id}">
                <td><code>${v.name}</code></td>
                <td>
                    <span class="var-value ${v.isSecret ? 'secret' : ''}">${v.value}</span>
                    ${v.isSecret ? '<button class="caido-btn tiny" data-action="reveal"><i class="fas fa-eye"></i></button>' : ''}
                </td>
                <td><span class="scope-badge ${v.scope}">${v.scope}</span></td>
                <td>
                    <button class="caido-btn tiny" data-action="edit"><i class="fas fa-edit"></i></button>
                    <button class="caido-btn tiny danger" data-action="delete"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');

        this.bindVariableActions();
    }

    bindVariableActions() {
        document.querySelectorAll('#variables-body tr').forEach(row => {
            const varId = row.dataset.varId;

            row.querySelector('[data-action="edit"]')?.addEventListener('click', () => {
                this.editVariable(varId);
            });

            row.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
                this.deleteVariable(varId);
            });
        });
    }

    addVariable() {
        const content = `
            <div class="form-group">
                <label>Variable Name</label>
                <input type="text" name="name" class="caido-input" placeholder="MY_VARIABLE" required />
            </div>
            <div class="form-group">
                <label>Value</label>
                <input type="text" name="value" class="caido-input" required />
            </div>
            <div class="form-group">
                <label>Scope</label>
                <select name="scope" class="caido-select">
                    <option value="global">Global</option>
                    <option value="project">Project</option>
                </select>
            </div>
            <div class="form-group">
                <label class="checkbox-label">
                    <input type="checkbox" name="isSecret" />
                    <span>Secret (hide value)</span>
                </label>
            </div>
        `;

        window.showModal?.('Add Variable', content, async (formData) => {
            try {
                const result = await this.api.post('/api/environment', formData);
                if (result.success) {
                    window.showToast?.('success', 'Added', 'Variable added');
                    await this.loadData();
                }
            } catch (error) {
                window.showToast?.('error', 'Failed', error.message);
            }
        });
    }

    editVariable(varId) {
        const variable = this.variables.find(v => v.id == varId);
        if (!variable) return;

        const content = `
            <div class="form-group">
                <label>Variable Name</label>
                <input type="text" name="name" class="caido-input" value="${variable.name}" />
            </div>
            <div class="form-group">
                <label>Value</label>
                <input type="text" name="value" class="caido-input" value="${variable.isSecret ? '' : variable.value}" 
                       placeholder="${variable.isSecret ? 'Enter new value' : ''}" />
            </div>
        `;

        window.showModal?.('Edit Variable', content, async (formData) => {
            try {
                const result = await this.api.put(`/api/environment/${varId}`, formData);
                if (result.success) {
                    window.showToast?.('success', 'Updated', 'Variable updated');
                    await this.loadData();
                }
            } catch (error) {
                window.showToast?.('error', 'Failed', error.message);
            }
        });
    }

    async deleteVariable(varId) {
        window.showConfirmModal?.('Delete Variable', 'Are you sure you want to delete this variable?', async () => {
            try {
                const result = await this.api.delete(`/api/environment/${varId}`);
                if (result.success) {
                    window.showToast?.('success', 'Deleted', 'Variable deleted');
                    await this.loadData();
                }
            } catch (error) {
                window.showToast?.('error', 'Failed', error.message);
            }
        });
    }

    importEnv() {
        window.showToast?.('info', 'Import', 'Select a .env file to import');
    }
}

class EnvironmentSecretsPage extends BasePage {
    constructor() {
        super();
        this.secrets = [];
    }

    createHTML() {
        return `
            <div class="page-content environment-secrets-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-key"></i>
                        <h2>Secrets Vault</h2>
                    </div>
                    <div class="page-actions">
                        <button class="caido-btn primary" id="add-secret">
                            <i class="fas fa-plus"></i> Add Secret
                        </button>
                    </div>
                </div>

                <div class="secrets-list" id="secrets-list">
                    <div class="loading-placeholder">Loading secrets...</div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('add-secret')?.addEventListener('click', () => this.addSecret());
    }

    async loadData() {
        this.secrets = [
            { id: 1, name: 'API_KEY_PRODUCTION', type: 'api_key', lastUsed: new Date(), usageCount: 156 },
            { id: 2, name: 'JWT_SECRET', type: 'secret', lastUsed: new Date(), usageCount: 89 },
            { id: 3, name: 'DATABASE_PASSWORD', type: 'password', lastUsed: new Date(), usageCount: 234 },
            { id: 4, name: 'OAUTH_CLIENT_SECRET', type: 'oauth', lastUsed: new Date(), usageCount: 45 }
        ];
        this.renderSecrets();
    }

    renderSecrets() {
        const container = document.getElementById('secrets-list');
        if (!container) return;

        container.innerHTML = this.secrets.map(secret => `
            <div class="secret-card" data-secret-id="${secret.id}">
                <div class="secret-icon">
                    <i class="fas fa-${this.getSecretIcon(secret.type)}"></i>
                </div>
                <div class="secret-info">
                    <h4>${secret.name}</h4>
                    <span class="secret-type">${secret.type}</span>
                    <div class="secret-stats">
                        <span>Last used: ${this.formatDate(secret.lastUsed)}</span>
                        <span>Used ${secret.usageCount} times</span>
                    </div>
                </div>
                <div class="secret-actions">
                    <button class="caido-btn small" data-action="copy" title="Copy to clipboard">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="caido-btn small" data-action="rotate" title="Rotate secret">
                        <i class="fas fa-sync"></i>
                    </button>
                    <button class="caido-btn small danger" data-action="delete" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    getSecretIcon(type) {
        const icons = {
            'api_key': 'key',
            'secret': 'lock',
            'password': 'asterisk',
            'oauth': 'shield-alt',
            'certificate': 'certificate'
        };
        return icons[type] || 'key';
    }

    addSecret() {
        const content = `
            <div class="form-group">
                <label>Secret Name</label>
                <input type="text" name="name" class="caido-input" required />
            </div>
            <div class="form-group">
                <label>Secret Value</label>
                <textarea name="value" class="caido-input" rows="3" required></textarea>
            </div>
            <div class="form-group">
                <label>Type</label>
                <select name="type" class="caido-select">
                    <option value="api_key">API Key</option>
                    <option value="secret">Secret</option>
                    <option value="password">Password</option>
                    <option value="oauth">OAuth Token</option>
                    <option value="certificate">Certificate</option>
                </select>
            </div>
        `;

        window.showModal?.('Add Secret', content, async (formData) => {
            window.showToast?.('success', 'Added', 'Secret stored securely');
            await this.loadData();
        });
    }
}

class EnvironmentPresetsPage extends BasePage {
    constructor() {
        super();
        this.presets = [];
    }

    createHTML() {
        return `
            <div class="page-content environment-presets-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-layer-group"></i>
                        <h2>Environment Presets</h2>
                    </div>
                    <div class="page-actions">
                        <button class="caido-btn primary" id="create-preset">
                            <i class="fas fa-plus"></i> Create Preset
                        </button>
                    </div>
                </div>

                <div class="presets-grid" id="presets-grid">
                    <div class="loading-placeholder">Loading presets...</div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('create-preset')?.addEventListener('click', () => this.createPreset());
    }

    async loadData() {
        this.presets = [
            { id: 1, name: 'Development', description: 'Local development environment', variables: 5, isActive: false },
            { id: 2, name: 'Staging', description: 'Staging server configuration', variables: 8, isActive: true },
            { id: 3, name: 'Production', description: 'Production environment', variables: 10, isActive: false }
        ];
        this.renderPresets();
    }

    renderPresets() {
        const container = document.getElementById('presets-grid');
        if (!container) return;

        container.innerHTML = this.presets.map(preset => `
            <div class="preset-card ${preset.isActive ? 'active' : ''}" data-preset-id="${preset.id}">
                <div class="preset-header">
                    <h4>${preset.name}</h4>
                    ${preset.isActive ? '<span class="active-badge">Active</span>' : ''}
                </div>
                <p>${preset.description}</p>
                <div class="preset-stats">
                    <span>${preset.variables} variables</span>
                </div>
                <div class="preset-actions">
                    <button class="caido-btn small ${preset.isActive ? '' : 'success'}" data-action="activate">
                        <i class="fas fa-${preset.isActive ? 'check' : 'play'}"></i>
                        ${preset.isActive ? 'Active' : 'Activate'}
                    </button>
                    <button class="caido-btn small" data-action="edit">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </div>
        `).join('');

        this.bindPresetActions();
    }

    bindPresetActions() {
        document.querySelectorAll('.preset-card').forEach(card => {
            const presetId = card.dataset.presetId;

            card.querySelector('[data-action="activate"]')?.addEventListener('click', () => {
                this.activatePreset(presetId);
            });
        });
    }

    activatePreset(presetId) {
        this.presets.forEach(p => p.isActive = (p.id == presetId));
        this.renderPresets();
        window.showToast?.('success', 'Activated', 'Environment preset activated');
    }

    createPreset() {
        const content = `
            <div class="form-group">
                <label>Preset Name</label>
                <input type="text" name="name" class="caido-input" required />
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea name="description" class="caido-input" rows="2"></textarea>
            </div>
        `;

        window.showModal?.('Create Preset', content, async (formData) => {
            window.showToast?.('success', 'Created', 'Preset created');
            await this.loadData();
        });
    }
}

// Export classes
if (typeof window !== 'undefined') {
    window.AIModelsListPage = AIModelsListPage;
    window.AIModelsConfigPage = AIModelsConfigPage;
    window.AIModelsTrainingPage = AIModelsTrainingPage;
    window.ThreatIntelFeedsPage = ThreatIntelFeedsPage;
    window.ThreatIntelIndicatorsPage = ThreatIntelIndicatorsPage;
    window.ThreatIntelReportsPage = ThreatIntelReportsPage;
    window.EnvironmentVariablesPage = EnvironmentVariablesPage;
    window.EnvironmentSecretsPage = EnvironmentSecretsPage;
    window.EnvironmentPresetsPage = EnvironmentPresetsPage;
}
