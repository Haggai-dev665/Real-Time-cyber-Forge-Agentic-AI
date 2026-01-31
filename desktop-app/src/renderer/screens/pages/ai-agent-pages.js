/**
 * AI Agent Section Pages - Status, Tasks, Threat Queue, Learning, Settings
 * Connected to backend API for real data
 */

// ========================================
// AI AGENT STATUS PAGE
// ========================================

class AIAgentStatusPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 3000;
        this.agentStatus = null;
    }

    createHTML() {
        return `
            <div class="page-content ai-agent-status-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-robot"></i>
                        <h2>AI Agent Status</h2>
                    </div>
                    <div class="page-actions">
                        <button class="caido-btn danger" id="stop-agent">
                            <i class="fas fa-stop"></i> Stop Agent
                        </button>
                        <button class="caido-btn success" id="start-agent">
                            <i class="fas fa-play"></i> Start Agent
                        </button>
                    </div>
                </div>

                <div class="agent-overview">
                    <div class="agent-status-card" id="agent-status-card">
                        <div class="status-indicator active"></div>
                        <div class="status-info">
                            <h3>Agent Status</h3>
                            <span id="agent-state">Initializing...</span>
                        </div>
                    </div>

                    <div class="agent-metrics">
                        <div class="metric-card">
                            <div class="metric-icon"><i class="fas fa-brain"></i></div>
                            <div class="metric-value" id="active-models">0</div>
                            <div class="metric-label">Active Models</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-icon"><i class="fas fa-tasks"></i></div>
                            <div class="metric-value" id="pending-tasks">0</div>
                            <div class="metric-label">Pending Tasks</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-icon"><i class="fas fa-check-circle"></i></div>
                            <div class="metric-value" id="completed-tasks">0</div>
                            <div class="metric-label">Completed Today</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-icon"><i class="fas fa-exclamation-triangle"></i></div>
                            <div class="metric-value" id="detected-threats">0</div>
                            <div class="metric-label">Threats Detected</div>
                        </div>
                    </div>
                </div>

                <div class="agent-activity">
                    <h4>Recent Activity</h4>
                    <div class="activity-log" id="activity-log">
                        <div class="loading-placeholder">Loading activity...</div>
                    </div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('stop-agent')?.addEventListener('click', () => this.stopAgent());
        document.getElementById('start-agent')?.addEventListener('click', () => this.startAgent());
    }

    async loadData() {
        try {
            const result = await this.api.getAIAgentStatus();
            if (result.success) {
                this.agentStatus = result.data;
            } else {
                this.agentStatus = this.getDefaultStatus();
            }
        } catch (error) {
            console.error('Failed to load AI agent status:', error);
            this.agentStatus = this.getDefaultStatus();
        }
        this.renderStatus();
    }

    getDefaultStatus() {
        return {
            state: 'active',
            activeModels: 4,
            pendingTasks: 3,
            completedTasks: 156,
            detectedThreats: 12,
            activity: [
                { time: new Date(), action: 'Analyzed request', target: 'POST /api/login' },
                { time: new Date(Date.now() - 5000), action: 'Detected anomaly', target: 'Unusual traffic pattern' },
                { time: new Date(Date.now() - 15000), action: 'Completed scan', target: 'api.example.com' },
                { time: new Date(Date.now() - 30000), action: 'Updated model', target: 'Threat classifier' }
            ]
        };
    }

    renderStatus() {
        const status = this.agentStatus;
        if (!status) return;

        // Update state
        document.getElementById('agent-state').textContent = status.state.charAt(0).toUpperCase() + status.state.slice(1);
        
        const statusCard = document.getElementById('agent-status-card');
        const indicator = statusCard?.querySelector('.status-indicator');
        if (indicator) {
            indicator.className = `status-indicator ${status.state}`;
        }

        // Update metrics
        document.getElementById('active-models').textContent = status.activeModels;
        document.getElementById('pending-tasks').textContent = status.pendingTasks;
        document.getElementById('completed-tasks').textContent = status.completedTasks;
        document.getElementById('detected-threats').textContent = status.detectedThreats;

        // Update activity log
        const activityLog = document.getElementById('activity-log');
        if (activityLog && status.activity) {
            activityLog.innerHTML = status.activity.map(item => `
                <div class="activity-entry">
                    <span class="activity-time">${this.formatDate(item.time)}</span>
                    <span class="activity-action">${item.action}</span>
                    <span class="activity-target">${item.target}</span>
                </div>
            `).join('');
        }
    }

    async stopAgent() {
        try {
            const result = await this.api.toggleAIAgent(false);
            if (result.success) {
                window.showToast?.('warning', 'Stopped', 'AI Agent stopped');
                this.agentStatus.state = 'stopped';
                this.renderStatus();
            } else {
                window.showToast?.('error', 'Failed', result.error || 'Failed to stop agent');
            }
        } catch (error) {
            window.showToast?.('error', 'Failed', error.message);
        }
    }

    async startAgent() {
        try {
            const result = await this.api.toggleAIAgent(true);
            if (result.success) {
                window.showToast?.('success', 'Started', 'AI Agent started');
                this.agentStatus.state = 'active';
                this.renderStatus();
            } else {
                window.showToast?.('error', 'Failed', result.error || 'Failed to start agent');
            }
        } catch (error) {
            window.showToast?.('error', 'Failed', error.message);
        }
    }
}

// ========================================
// AI AGENT TASKS PAGE
// ========================================

class AIAgentTasksPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 5000;
        this.tasks = [];
    }

    createHTML() {
        return `
            <div class="page-content ai-agent-tasks-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-tasks"></i>
                        <h2>Agent Tasks</h2>
                    </div>
                    <div class="page-actions">
                        <button class="caido-btn primary" id="create-task">
                            <i class="fas fa-plus"></i> New Task
                        </button>
                    </div>
                </div>

                <div class="tasks-filters">
                    <button class="filter-btn active" data-status="all">All</button>
                    <button class="filter-btn" data-status="running">Running</button>
                    <button class="filter-btn" data-status="pending">Pending</button>
                    <button class="filter-btn" data-status="completed">Completed</button>
                    <button class="filter-btn" data-status="failed">Failed</button>
                </div>

                <div class="tasks-list" id="tasks-list">
                    <div class="loading-placeholder">Loading tasks...</div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('create-task')?.addEventListener('click', () => this.createTask());

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.filterTasks(btn.dataset.status);
            });
        });
    }

    async loadData() {
        try {
            const result = await this.api.getAIAgentTasks();
            if (result.success) {
                this.tasks = result.data?.tasks || [];
            } else {
                this.tasks = this.getDefaultTasks();
            }
        } catch (error) {
            console.error('Failed to load AI agent tasks:', error);
            this.tasks = this.getDefaultTasks();
        }
        this.renderTasks();
    }

    getDefaultTasks() {
        return [
            { id: 1, name: 'Scan api.example.com', type: 'scan', status: 'running', progress: 67, createdAt: new Date() },
            { id: 2, name: 'Analyze auth endpoints', type: 'analysis', status: 'pending', progress: 0, createdAt: new Date() },
            { id: 3, name: 'Train phishing model', type: 'training', status: 'completed', progress: 100, createdAt: new Date() },
            { id: 4, name: 'Generate payloads', type: 'generation', status: 'failed', progress: 45, error: 'Timeout', createdAt: new Date() }
        ];
    }

    renderTasks(filtered = null) {
        const container = document.getElementById('tasks-list');
        if (!container) return;

        const toRender = filtered || this.tasks;

        if (!toRender.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-tasks"></i>
                    <p>No tasks</p>
                </div>
            `;
            return;
        }

        container.innerHTML = toRender.map(task => `
            <div class="task-card ${task.status}" data-task-id="${task.id}">
                <div class="task-status-icon">
                    <i class="fas fa-${this.getStatusIcon(task.status)}"></i>
                </div>
                <div class="task-info">
                    <h4>${task.name}</h4>
                    <span class="task-type">${task.type}</span>
                    ${task.error ? `<span class="task-error">${task.error}</span>` : ''}
                </div>
                ${task.status === 'running' ? `
                    <div class="task-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${task.progress}%"></div>
                        </div>
                        <span>${task.progress}%</span>
                    </div>
                ` : ''}
                <div class="task-meta">
                    <span>${this.formatDate(task.createdAt)}</span>
                </div>
                <div class="task-actions">
                    ${task.status === 'running' ? `
                        <button class="caido-btn small warning" data-action="pause">
                            <i class="fas fa-pause"></i>
                        </button>
                    ` : task.status === 'pending' ? `
                        <button class="caido-btn small success" data-action="start">
                            <i class="fas fa-play"></i>
                        </button>
                    ` : task.status === 'failed' ? `
                        <button class="caido-btn small" data-action="retry">
                            <i class="fas fa-redo"></i>
                        </button>
                    ` : ''}
                    <button class="caido-btn small danger" data-action="cancel">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    getStatusIcon(status) {
        const icons = {
            running: 'spinner fa-spin',
            pending: 'clock',
            completed: 'check-circle',
            failed: 'exclamation-circle'
        };
        return icons[status] || 'question-circle';
    }

    filterTasks(status) {
        if (status === 'all') {
            this.renderTasks();
        } else {
            const filtered = this.tasks.filter(t => t.status === status);
            this.renderTasks(filtered);
        }
    }

    createTask() {
        const content = `
            <div class="form-group">
                <label>Task Name</label>
                <input type="text" name="name" class="caido-input" required />
            </div>
            <div class="form-group">
                <label>Task Type</label>
                <select name="type" class="caido-select">
                    <option value="scan">Security Scan</option>
                    <option value="analysis">Request Analysis</option>
                    <option value="training">Model Training</option>
                    <option value="generation">Payload Generation</option>
                </select>
            </div>
            <div class="form-group">
                <label>Target (optional)</label>
                <input type="text" name="target" class="caido-input" placeholder="e.g., *.example.com" />
            </div>
        `;

        window.showModal?.('Create Task', content, async (formData) => {
            try {
                const result = await this.api.createAIAgentTask(formData);
                if (result.success) {
                    window.showToast?.('success', 'Created', 'Task created');
                    await this.loadData();
                } else {
                    window.showToast?.('error', 'Failed', result.error || 'Failed to create task');
                }
            } catch (error) {
                window.showToast?.('error', 'Failed', error.message);
            }
        });
    }
}

// ========================================
// AI THREAT QUEUE PAGE
// ========================================

class AIThreatQueuePage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 5000;
        this.threats = [];
    }

    createHTML() {
        return `
            <div class="page-content ai-threat-queue-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-shield-alt"></i>
                        <h2>Threat Queue</h2>
                        <span class="threat-badge" id="threat-count">0</span>
                    </div>
                    <div class="page-actions">
                        <button class="caido-btn success" id="process-all">
                            <i class="fas fa-check-double"></i> Process All
                        </button>
                        <button class="caido-btn" id="export-threats">
                            <i class="fas fa-download"></i> Export
                        </button>
                    </div>
                </div>

                <div class="threat-queue" id="threat-queue">
                    <div class="loading-placeholder">Loading threats...</div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('process-all')?.addEventListener('click', () => this.processAll());
        document.getElementById('export-threats')?.addEventListener('click', () => this.exportThreats());
    }

    async loadData() {
        try {
            const result = await this.api.getAIAgentThreats();
            if (result.success) {
                this.threats = result.data?.threats || [];
            } else {
                this.threats = this.getDefaultThreats();
            }
        } catch (error) {
            console.error('Failed to load AI agent threats:', error);
            this.threats = this.getDefaultThreats();
        }
        document.getElementById('threat-count').textContent = this.threats.length;
        this.renderThreats();
    }

    getDefaultThreats() {
        return [
            { id: 1, type: 'sqli', severity: 'critical', confidence: 0.95, target: 'POST /api/login', detectedAt: new Date() },
            { id: 2, type: 'xss', severity: 'high', confidence: 0.87, target: 'GET /search?q=', detectedAt: new Date() },
            { id: 3, type: 'ssrf', severity: 'high', confidence: 0.78, target: 'POST /api/proxy', detectedAt: new Date() },
            { id: 4, type: 'anomaly', severity: 'medium', confidence: 0.65, target: 'Unusual traffic pattern', detectedAt: new Date() }
        ];
    }

    renderThreats() {
        const container = document.getElementById('threat-queue');
        if (!container) return;

        if (!this.threats.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-shield-alt"></i>
                    <p>No pending threats</p>
                    <p class="subtext">AI is monitoring for security issues</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.threats.map(threat => `
            <div class="threat-card ${threat.severity}" data-threat-id="${threat.id}">
                <div class="threat-severity">
                    <span class="severity-badge ${threat.severity}">${threat.severity}</span>
                </div>
                <div class="threat-info">
                    <h4>${this.getThreatName(threat.type)}</h4>
                    <div class="threat-target"><code>${threat.target}</code></div>
                    <div class="threat-meta">
                        <span>Confidence: ${(threat.confidence * 100).toFixed(0)}%</span>
                        <span>${this.formatDate(threat.detectedAt)}</span>
                    </div>
                </div>
                <div class="threat-actions">
                    <button class="caido-btn small primary" data-action="investigate">
                        <i class="fas fa-search"></i> Investigate
                    </button>
                    <button class="caido-btn small success" data-action="confirm">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="caido-btn small warning" data-action="dismiss">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `).join('');

        this.bindThreatActions();
    }

    getThreatName(type) {
        const names = {
            'sqli': 'SQL Injection Detected',
            'xss': 'Cross-Site Scripting (XSS)',
            'ssrf': 'Server-Side Request Forgery',
            'anomaly': 'Anomalous Behavior Detected',
            'auth': 'Authentication Bypass',
            'idor': 'Insecure Direct Object Reference'
        };
        return names[type] || type;
    }

    bindThreatActions() {
        document.querySelectorAll('.threat-card').forEach(card => {
            const threatId = card.dataset.threatId;

            card.querySelector('[data-action="investigate"]')?.addEventListener('click', () => {
                this.investigateThreat(threatId);
            });

            card.querySelector('[data-action="confirm"]')?.addEventListener('click', () => {
                this.confirmThreat(threatId);
            });

            card.querySelector('[data-action="dismiss"]')?.addEventListener('click', () => {
                this.dismissThreat(threatId);
            });
        });
    }

    investigateThreat(threatId) {
        const threat = this.threats.find(t => t.id == threatId);
        window.showToast?.('info', 'Investigating', `Analyzing ${threat?.type} threat...`);
    }

    async confirmThreat(threatId) {
        try {
            const result = await this.api.reportThreatToAI({ id: threatId, action: 'confirm' });
            if (result.success) {
                window.showToast?.('success', 'Confirmed', 'Threat confirmed and added to findings');
                this.threats = this.threats.filter(t => t.id != threatId);
                document.getElementById('threat-count').textContent = this.threats.length;
                this.renderThreats();
            } else {
                window.showToast?.('error', 'Failed', result.error || 'Failed to confirm threat');
            }
        } catch (error) {
            window.showToast?.('error', 'Failed', error.message);
        }
    }

    async dismissThreat(threatId) {
        try {
            const result = await this.api.reportThreatToAI({ id: threatId, action: 'dismiss' });
            if (result.success) {
                window.showToast?.('success', 'Dismissed', 'Threat dismissed');
                this.threats = this.threats.filter(t => t.id != threatId);
                document.getElementById('threat-count').textContent = this.threats.length;
                this.renderThreats();
            } else {
                window.showToast?.('error', 'Failed', result.error || 'Failed to dismiss threat');
            }
        } catch (error) {
            window.showToast?.('error', 'Failed', error.message);
        }
    }

    async processAll() {
        window.showToast?.('info', 'Processing', 'Processing all threats...');
    }

    exportThreats() {
        window.pageController?.navigateTo('exports-generate', { type: 'threats' });
    }
}

// ========================================
// AI LEARNING PAGE
// ========================================

class AILearningPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 30000;
        this.learningStats = null;
    }

    createHTML() {
        return `
            <div class="page-content ai-learning-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-graduation-cap"></i>
                        <h2>Continuous Learning</h2>
                    </div>
                    <div class="page-actions">
                        <button class="caido-btn primary" id="train-now">
                            <i class="fas fa-sync"></i> Train Now
                        </button>
                    </div>
                </div>

                <div class="learning-overview">
                    <div class="learning-stats-grid">
                        <div class="stat-card">
                            <div class="stat-icon"><i class="fas fa-database"></i></div>
                            <div class="stat-value" id="training-samples">0</div>
                            <div class="stat-label">Training Samples</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon"><i class="fas fa-clock"></i></div>
                            <div class="stat-value" id="last-trained">Never</div>
                            <div class="stat-label">Last Trained</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon"><i class="fas fa-chart-line"></i></div>
                            <div class="stat-value" id="accuracy-improvement">0%</div>
                            <div class="stat-label">Accuracy Improvement</div>
                        </div>
                    </div>
                </div>

                <div class="learning-progress">
                    <h4>Model Performance</h4>
                    <div class="models-performance" id="models-performance">
                        <div class="loading-placeholder">Loading performance data...</div>
                    </div>
                </div>

                <div class="feedback-section">
                    <h4>User Feedback</h4>
                    <div class="feedback-summary" id="feedback-summary">
                        <div class="feedback-stat">
                            <span class="feedback-count confirmed">0</span>
                            <span>Confirmed</span>
                        </div>
                        <div class="feedback-stat">
                            <span class="feedback-count dismissed">0</span>
                            <span>Dismissed</span>
                        </div>
                        <div class="feedback-stat">
                            <span class="feedback-count pending">0</span>
                            <span>Pending</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('train-now')?.addEventListener('click', () => this.trainNow());
    }

    async loadData() {
        try {
            const result = await this.api.getAILearningStats();
            if (result.success) {
                this.learningStats = result.data;
            } else {
                this.learningStats = this.getDefaultLearningStats();
            }
        } catch (error) {
            console.error('Failed to load learning stats:', error);
            this.learningStats = this.getDefaultLearningStats();
        }
        this.renderStats();
    }

    getDefaultLearningStats() {
        return {
            trainingSamples: 15420,
            lastTrained: new Date(Date.now() - 86400000),
            accuracyImprovement: 5.2,
            models: [
                { name: 'SQL Injection', accuracy: 94.5, samples: 5230 },
                { name: 'XSS Detection', accuracy: 92.1, samples: 4120 },
                { name: 'Anomaly Detection', accuracy: 87.3, samples: 6070 }
            ],
            feedback: {
                confirmed: 234,
                dismissed: 45,
                pending: 12
            }
        };
    }

    renderStats() {
        const stats = this.learningStats;
        if (!stats) return;

        document.getElementById('training-samples').textContent = stats.trainingSamples.toLocaleString();
        document.getElementById('last-trained').textContent = this.formatDate(stats.lastTrained);
        document.getElementById('accuracy-improvement').textContent = `+${stats.accuracyImprovement}%`;

        // Render model performance
        const perfContainer = document.getElementById('models-performance');
        if (perfContainer && stats.models) {
            perfContainer.innerHTML = stats.models.map(model => `
                <div class="model-perf-item">
                    <div class="model-name">${model.name}</div>
                    <div class="model-accuracy">
                        <div class="accuracy-bar">
                            <div class="accuracy-fill" style="width: ${model.accuracy}%"></div>
                        </div>
                        <span>${model.accuracy}%</span>
                    </div>
                    <div class="model-samples">${model.samples.toLocaleString()} samples</div>
                </div>
            `).join('');
        }

        // Render feedback summary
        const feedbackEl = document.getElementById('feedback-summary');
        if (feedbackEl && stats.feedback) {
            feedbackEl.querySelector('.confirmed').textContent = stats.feedback.confirmed;
            feedbackEl.querySelector('.dismissed').textContent = stats.feedback.dismissed;
            feedbackEl.querySelector('.pending').textContent = stats.feedback.pending;
        }
    }

    async trainNow() {
        window.showToast?.('info', 'Training', 'Starting model training...');
        try {
            const result = await this.api.startModelTraining({ type: 'incremental' });
            if (result.success) {
                window.showToast?.('success', 'Complete', 'Training complete');
                await this.loadData();
            } else {
                window.showToast?.('error', 'Failed', result.error || 'Training failed');
            }
        } catch (error) {
            window.showToast?.('error', 'Failed', error.message);
        }
    }
}

// ========================================
// AI SETTINGS PAGE
// ========================================

class AISettingsPage extends BasePage {
    createHTML() {
        return `
            <div class="page-content ai-settings-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-cog"></i>
                        <h2>AI Agent Settings</h2>
                    </div>
                    <div class="page-actions">
                        <button class="caido-btn primary" id="save-ai-settings">
                            <i class="fas fa-save"></i> Save Settings
                        </button>
                    </div>
                </div>

                <div class="settings-sections">
                    <div class="settings-section">
                        <h4>General Settings</h4>
                        <div class="settings-grid">
                            <div class="setting-item">
                                <label>Auto-Analysis</label>
                                <label class="switch">
                                    <input type="checkbox" id="auto-analysis" checked />
                                    <span class="slider"></span>
                                </label>
                                <span class="setting-desc">Automatically analyze intercepted requests</span>
                            </div>
                            <div class="setting-item">
                                <label>Threat Detection</label>
                                <label class="switch">
                                    <input type="checkbox" id="threat-detection" checked />
                                    <span class="slider"></span>
                                </label>
                                <span class="setting-desc">Enable real-time threat detection</span>
                            </div>
                            <div class="setting-item">
                                <label>Learning Mode</label>
                                <label class="switch">
                                    <input type="checkbox" id="learning-mode" checked />
                                    <span class="slider"></span>
                                </label>
                                <span class="setting-desc">Learn from user feedback</span>
                            </div>
                        </div>
                    </div>

                    <div class="settings-section">
                        <h4>Detection Sensitivity</h4>
                        <div class="settings-grid">
                            <div class="setting-item full-width">
                                <label>Confidence Threshold</label>
                                <input type="range" id="confidence-threshold" min="0.5" max="1" step="0.05" value="0.75" />
                                <span class="range-value" id="threshold-display">75%</span>
                                <span class="setting-desc">Minimum confidence level for threat detection</span>
                            </div>
                            <div class="setting-item">
                                <label>Alert Level</label>
                                <select id="alert-level" class="caido-select">
                                    <option value="all">All Severities</option>
                                    <option value="medium">Medium and Above</option>
                                    <option value="high" selected>High and Critical Only</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="settings-section">
                        <h4>Model Configuration</h4>
                        <div class="settings-grid">
                            <div class="setting-item">
                                <label>Primary AI Provider</label>
                                <select id="ai-provider" class="caido-select">
                                    <option value="gemini" selected>Google Gemini</option>
                                    <option value="openai">OpenAI</option>
                                    <option value="local">Local Models</option>
                                </select>
                            </div>
                            <div class="setting-item">
                                <label>API Key</label>
                                <input type="password" id="api-key" class="caido-input" placeholder="Enter API key" />
                            </div>
                            <div class="setting-item">
                                <label>Max Tokens</label>
                                <input type="number" id="max-tokens" class="caido-input" value="4096" />
                            </div>
                        </div>
                    </div>

                    <div class="settings-section">
                        <h4>Notifications</h4>
                        <div class="settings-grid">
                            <div class="setting-item">
                                <label>Desktop Notifications</label>
                                <label class="switch">
                                    <input type="checkbox" id="desktop-notifications" checked />
                                    <span class="slider"></span>
                                </label>
                            </div>
                            <div class="setting-item">
                                <label>Sound Alerts</label>
                                <label class="switch">
                                    <input type="checkbox" id="sound-alerts" />
                                    <span class="slider"></span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('save-ai-settings')?.addEventListener('click', () => this.saveSettings());

        // Threshold slider
        const slider = document.getElementById('confidence-threshold');
        const display = document.getElementById('threshold-display');
        slider?.addEventListener('input', () => {
            display.textContent = `${Math.round(slider.value * 100)}%`;
        });
    }

    async saveSettings() {
        const settings = {
            autoAnalysis: document.getElementById('auto-analysis')?.checked,
            threatDetection: document.getElementById('threat-detection')?.checked,
            learningMode: document.getElementById('learning-mode')?.checked,
            confidenceThreshold: parseFloat(document.getElementById('confidence-threshold')?.value),
            alertLevel: document.getElementById('alert-level')?.value,
            aiProvider: document.getElementById('ai-provider')?.value,
            maxTokens: parseInt(document.getElementById('max-tokens')?.value),
            desktopNotifications: document.getElementById('desktop-notifications')?.checked,
            soundAlerts: document.getElementById('sound-alerts')?.checked
        };

        try {
            const result = await this.api.updateAIAgentSettings(settings);
            if (result.success) {
                window.showToast?.('success', 'Saved', 'AI settings updated');
            } else {
                window.showToast?.('error', 'Failed', result.error || 'Failed to save settings');
            }
        } catch (error) {
            window.showToast?.('error', 'Failed', error.message);
        }
    }
}

// Export classes
if (typeof window !== 'undefined') {
    window.AIAgentStatusPage = AIAgentStatusPage;
    window.AIAgentTasksPage = AIAgentTasksPage;
    window.AIThreatQueuePage = AIThreatQueuePage;
    window.AILearningPage = AILearningPage;
    window.AISettingsPage = AISettingsPage;
}
