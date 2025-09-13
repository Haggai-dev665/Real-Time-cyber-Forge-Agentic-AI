/**
 * Behavioral Analysis Screen Component
 * Advanced behavioral analysis for threat detection
 */

class BehavioralAnalysisScreen {
    constructor() {
        this.isInitialized = false;
        this.analysisResults = [];
        this.activeAnalyses = new Map();
        this.baselineData = new Map();
    }

    async init() {
        if (this.isInitialized) return;
        
        console.log('Initializing Behavioral Analysis Screen...');
        await this.loadAnalysisData();
        this.setupEventListeners();
        this.startRealTimeMonitoring();
        this.isInitialized = true;
    }

    render() {
        return `
            <div class="screen behavioral-analysis-screen">
                <div class="screen-header">
                    <div class="header-content">
                        <div class="header-title">
                            <i class="fas fa-user-check"></i>
                            <h1>Behavioral Analysis</h1>
                            <span class="status-badge analyzing">Analyzing</span>
                        </div>
                        <div class="header-actions">
                            <button class="btn btn-primary" id="new-analysis-btn">
                                <i class="fas fa-plus"></i>
                                New Analysis
                            </button>
                            <button class="btn btn-secondary" id="baseline-config-btn">
                                <i class="fas fa-cog"></i>
                                Baseline Config
                            </button>
                        </div>
                    </div>
                </div>

                <div class="screen-content">
                    <!-- Analysis Types -->
                    <div class="content-section">
                        <div class="section-header">
                            <h2>Analysis Types</h2>
                        </div>
                        <div class="analysis-types-grid">
                            <div class="analysis-type-card" data-type="user-behavior">
                                <div class="card-icon">
                                    <i class="fas fa-user"></i>
                                </div>
                                <div class="card-content">
                                    <h3>User Behavior</h3>
                                    <p>Analyze user activity patterns and detect anomalies</p>
                                    <div class="card-stats">
                                        <span class="stat-value" id="user-anomalies">0</span>
                                        <span class="stat-label">Anomalies Detected</span>
                                    </div>
                                </div>
                                <button class="card-action-btn" onclick="behavioralAnalysisScreen.startAnalysis('user-behavior')">
                                    <i class="fas fa-play"></i>
                                    Start
                                </button>
                            </div>
                            
                            <div class="analysis-type-card" data-type="process-behavior">
                                <div class="card-icon">
                                    <i class="fas fa-microchip"></i>
                                </div>
                                <div class="card-content">
                                    <h3>Process Behavior</h3>
                                    <p>Monitor process execution and resource usage patterns</p>
                                    <div class="card-stats">
                                        <span class="stat-value" id="process-anomalies">0</span>
                                        <span class="stat-label">Suspicious Processes</span>
                                    </div>
                                </div>
                                <button class="card-action-btn" onclick="behavioralAnalysisScreen.startAnalysis('process-behavior')">
                                    <i class="fas fa-play"></i>
                                    Start
                                </button>
                            </div>
                            
                            <div class="analysis-type-card" data-type="network-behavior">
                                <div class="card-icon">
                                    <i class="fas fa-network-wired"></i>
                                </div>
                                <div class="card-content">
                                    <h3>Network Behavior</h3>
                                    <p>Analyze network traffic patterns and communication flows</p>
                                    <div class="card-stats">
                                        <span class="stat-value" id="network-anomalies">0</span>
                                        <span class="stat-label">Traffic Anomalies</span>
                                    </div>
                                </div>
                                <button class="card-action-btn" onclick="behavioralAnalysisScreen.startAnalysis('network-behavior')">
                                    <i class="fas fa-play"></i>
                                    Start
                                </button>
                            </div>
                            
                            <div class="analysis-type-card" data-type="application-behavior">
                                <div class="card-icon">
                                    <i class="fas fa-window-maximize"></i>
                                </div>
                                <div class="card-content">
                                    <h3>Application Behavior</h3>
                                    <p>Monitor application usage and interaction patterns</p>
                                    <div class="card-stats">
                                        <span class="stat-value" id="app-anomalies">0</span>
                                        <span class="stat-label">App Anomalies</span>
                                    </div>
                                </div>
                                <button class="card-action-btn" onclick="behavioralAnalysisScreen.startAnalysis('application-behavior')">
                                    <i class="fas fa-play"></i>
                                    Start
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Active Analyses -->
                    <div class="content-section">
                        <div class="section-header">
                            <h2>Active Analyses</h2>
                            <div class="header-controls">
                                <select id="analysis-filter">
                                    <option value="all">All Analyses</option>
                                    <option value="running">Running</option>
                                    <option value="anomalies">Anomalies Found</option>
                                    <option value="completed">Completed</option>
                                </select>
                            </div>
                        </div>
                        <div class="active-analyses-container" id="active-analyses">
                            <!-- Active analyses will be rendered here -->
                        </div>
                    </div>

                    <!-- Anomaly Detection Results -->
                    <div class="content-section">
                        <div class="section-header">
                            <h2>Anomaly Detection Results</h2>
                            <div class="header-controls">
                                <select id="severity-filter">
                                    <option value="all">All Severities</option>
                                    <option value="critical">Critical</option>
                                    <option value="high">High</option>
                                    <option value="medium">Medium</option>
                                    <option value="low">Low</option>
                                </select>
                                <button class="btn btn-sm" id="export-anomalies-btn">
                                    <i class="fas fa-download"></i>
                                    Export
                                </button>
                            </div>
                        </div>
                        <div class="anomalies-container">
                            <table class="data-table" id="anomalies-table">
                                <thead>
                                    <tr>
                                        <th>Time</th>
                                        <th>Type</th>
                                        <th>Entity</th>
                                        <th>Anomaly</th>
                                        <th>Severity</th>
                                        <th>Confidence</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="anomalies-tbody">
                                    <!-- Anomalies will be populated here -->
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Behavioral Baselines -->
                    <div class="content-section">
                        <div class="section-header">
                            <h2>Behavioral Baselines</h2>
                            <div class="header-controls">
                                <button class="btn btn-sm" id="update-baselines-btn">
                                    <i class="fas fa-sync-alt"></i>
                                    Update Baselines
                                </button>
                            </div>
                        </div>
                        <div class="baselines-grid" id="baselines-grid">
                            <!-- Baseline cards will be rendered here -->
                        </div>
                    </div>

                    <!-- Analysis Insights -->
                    <div class="content-section">
                        <div class="section-header">
                            <h2>AI-Powered Insights</h2>
                        </div>
                        <div class="insights-container" id="analysis-insights">
                            <!-- AI insights will be rendered here -->
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async loadAnalysisData() {
        try {
            // Load active analyses
            const analysesResponse = await fetch('/api/behavioral-analysis/active');
            const analysesData = await analysesResponse.json();
            
            if (analysesData.success) {
                this.activeAnalyses = new Map(analysesData.analyses.map(analysis => [analysis.id, analysis]));
                this.updateActiveAnalysesDisplay();
            }

            // Load anomalies
            const anomaliesResponse = await fetch('/api/behavioral-analysis/anomalies');
            const anomaliesData = await anomaliesResponse.json();
            
            if (anomaliesData.success) {
                this.updateAnomaliesTable(anomaliesData.anomalies);
            }

            // Load baselines
            await this.loadBaselines();
            
            // Load statistics
            await this.loadStatistics();
            
        } catch (error) {
            console.error('Error loading behavioral analysis data:', error);
            this.showNotification('Failed to load analysis data', 'error');
        }
    }

    setupEventListeners() {
        // New analysis button
        document.getElementById('new-analysis-btn')?.addEventListener('click', () => {
            this.showNewAnalysisModal();
        });

        // Baseline configuration
        document.getElementById('baseline-config-btn')?.addEventListener('click', () => {
            this.showBaselineConfigModal();
        });

        // Filters
        document.getElementById('analysis-filter')?.addEventListener('change', (e) => {
            this.filterAnalyses(e.target.value);
        });

        document.getElementById('severity-filter')?.addEventListener('change', (e) => {
            this.filterAnomalies(e.target.value);
        });

        // Export anomalies
        document.getElementById('export-anomalies-btn')?.addEventListener('click', () => {
            this.exportAnomalies();
        });

        // Update baselines
        document.getElementById('update-baselines-btn')?.addEventListener('click', () => {
            this.updateBaselines();
        });
    }

    async startAnalysis(analysisType) {
        try {
            const response = await fetch('/api/behavioral-analysis/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: analysisType,
                    duration: '24h',
                    sensitivity: 'medium',
                    enableML: true,
                    realTime: true
                })
            });

            const result = await response.json();
            if (result.success) {
                this.addActiveAnalysis(result.analysis);
                this.showNotification(`${analysisType.replace('-', ' ')} analysis started`, 'success');
            }
        } catch (error) {
            console.error('Error starting analysis:', error);
            this.showNotification('Failed to start analysis', 'error');
        }
    }

    addActiveAnalysis(analysis) {
        this.activeAnalyses.set(analysis.id, analysis);
        this.updateActiveAnalysesDisplay();
    }

    updateActiveAnalysesDisplay() {
        const container = document.getElementById('active-analyses');
        if (!container) return;

        container.innerHTML = Array.from(this.activeAnalyses.values())
            .map(analysis => this.renderAnalysisCard(analysis))
            .join('');
    }

    renderAnalysisCard(analysis) {
        const progress = analysis.progress || 0;
        const statusClass = analysis.status === 'completed' ? 'success' : 
                           analysis.status === 'anomalies' ? 'warning' : 'info';

        return `
            <div class="analysis-card" data-analysis-id="${analysis.id}">
                <div class="card-header">
                    <div class="analysis-info">
                        <h3>${analysis.name || analysis.type}</h3>
                        <div class="analysis-meta">
                            <span class="analysis-type">${analysis.type}</span>
                            <span class="analysis-target">${analysis.target}</span>
                        </div>
                    </div>
                    <div class="analysis-status ${statusClass}">
                        ${analysis.status}
                    </div>
                </div>
                <div class="card-progress">
                    <div class="progress-info">
                        <span>Progress: ${progress}%</span>
                        <span>Runtime: ${this.formatDuration(analysis.runtime || 0)}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                </div>
                <div class="analysis-metrics">
                    <div class="metric-item">
                        <span class="metric-value">${analysis.dataPoints || 0}</span>
                        <span class="metric-label">Data Points</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-value">${analysis.anomaliesFound || 0}</span>
                        <span class="metric-label">Anomalies</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-value">${analysis.confidence || 0}%</span>
                        <span class="metric-label">Confidence</span>
                    </div>
                </div>
                <div class="card-actions">
                    <button class="btn btn-sm" onclick="behavioralAnalysisScreen.viewAnalysisDetails('${analysis.id}')">
                        <i class="fas fa-eye"></i>
                        Details
                    </button>
                    <button class="btn btn-sm" onclick="behavioralAnalysisScreen.pauseAnalysis('${analysis.id}')">
                        <i class="fas fa-pause"></i>
                        Pause
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="behavioralAnalysisScreen.stopAnalysis('${analysis.id}')">
                        <i class="fas fa-stop"></i>
                        Stop
                    </button>
                </div>
            </div>
        `;
    }

    updateAnomaliesTable(anomalies) {
        const tbody = document.getElementById('anomalies-tbody');
        if (!tbody) return;

        tbody.innerHTML = anomalies.map(anomaly => `
            <tr class="anomaly-row ${anomaly.severity.toLowerCase()}">
                <td>${new Date(anomaly.timestamp).toLocaleString()}</td>
                <td>
                    <span class="anomaly-type-badge">${anomaly.type}</span>
                </td>
                <td>${anomaly.entity}</td>
                <td>
                    <div class="anomaly-description">
                        <strong>${anomaly.title}</strong>
                        <p>${anomaly.description}</p>
                    </div>
                </td>
                <td>
                    <span class="severity-badge ${anomaly.severity.toLowerCase()}">${anomaly.severity}</span>
                </td>
                <td>
                    <div class="confidence-meter">
                        <div class="confidence-fill" style="width: ${anomaly.confidence}%"></div>
                        <span class="confidence-text">${anomaly.confidence}%</span>
                    </div>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-xs" onclick="behavioralAnalysisScreen.investigateAnomaly('${anomaly.id}')">
                            <i class="fas fa-search"></i>
                        </button>
                        <button class="btn btn-xs" onclick="behavioralAnalysisScreen.dismissAnomaly('${anomaly.id}')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    async loadBaselines() {
        try {
            const response = await fetch('/api/behavioral-analysis/baselines');
            const data = await response.json();
            
            if (data.success) {
                this.baselineData = new Map(data.baselines.map(baseline => [baseline.type, baseline]));
                this.updateBaselinesDisplay();
            }
        } catch (error) {
            console.error('Error loading baselines:', error);
        }
    }

    updateBaselinesDisplay() {
        const container = document.getElementById('baselines-grid');
        if (!container) return;

        container.innerHTML = Array.from(this.baselineData.values())
            .map(baseline => this.renderBaselineCard(baseline))
            .join('');
    }

    renderBaselineCard(baseline) {
        return `
            <div class="baseline-card">
                <div class="baseline-header">
                    <h4>${baseline.name}</h4>
                    <span class="baseline-status ${baseline.status}">${baseline.status}</span>
                </div>
                <div class="baseline-metrics">
                    <div class="baseline-metric">
                        <span class="metric-label">Data Points:</span>
                        <span class="metric-value">${baseline.dataPoints || 0}</span>
                    </div>
                    <div class="baseline-metric">
                        <span class="metric-label">Last Updated:</span>
                        <span class="metric-value">${new Date(baseline.lastUpdated).toLocaleDateString()}</span>
                    </div>
                    <div class="baseline-metric">
                        <span class="metric-label">Accuracy:</span>
                        <span class="metric-value">${baseline.accuracy || 0}%</span>
                    </div>
                </div>
                <div class="baseline-actions">
                    <button class="btn btn-xs" onclick="behavioralAnalysisScreen.viewBaseline('${baseline.type}')">
                        <i class="fas fa-eye"></i>
                        View
                    </button>
                    <button class="btn btn-xs" onclick="behavioralAnalysisScreen.updateBaseline('${baseline.type}')">
                        <i class="fas fa-sync-alt"></i>
                        Update
                    </button>
                </div>
            </div>
        `;
    }

    async loadStatistics() {
        try {
            const response = await fetch('/api/behavioral-analysis/statistics');
            const data = await response.json();
            
            if (data.success) {
                document.getElementById('user-anomalies').textContent = data.stats.userAnomalies;
                document.getElementById('process-anomalies').textContent = data.stats.processAnomalies;
                document.getElementById('network-anomalies').textContent = data.stats.networkAnomalies;
                document.getElementById('app-anomalies').textContent = data.stats.appAnomalies;
            }
        } catch (error) {
            console.error('Error loading statistics:', error);
        }
    }

    startRealTimeMonitoring() {
        // Update data every 30 seconds
        setInterval(() => {
            this.loadAnalysisData();
        }, 30000);
    }

    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }

    showNotification(message, type = 'info') {
        if (window.notificationSystem) {
            window.notificationSystem.show(message, type);
        }
    }

    // Action methods
    async viewAnalysisDetails(analysisId) {
        console.log('Viewing analysis details for:', analysisId);
    }

    async pauseAnalysis(analysisId) {
        console.log('Pausing analysis:', analysisId);
    }

    async stopAnalysis(analysisId) {
        console.log('Stopping analysis:', analysisId);
    }

    async investigateAnomaly(anomalyId) {
        console.log('Investigating anomaly:', anomalyId);
    }

    async dismissAnomaly(anomalyId) {
        console.log('Dismissing anomaly:', anomalyId);
    }

    async viewBaseline(baselineType) {
        console.log('Viewing baseline:', baselineType);
    }

    async updateBaseline(baselineType) {
        console.log('Updating baseline:', baselineType);
    }

    async updateBaselines() {
        console.log('Updating all baselines');
    }

    showNewAnalysisModal() {
        console.log('Showing new analysis modal');
    }

    showBaselineConfigModal() {
        console.log('Showing baseline configuration modal');
    }

    filterAnalyses(filter) {
        console.log('Filtering analyses by:', filter);
    }

    filterAnomalies(severity) {
        console.log('Filtering anomalies by severity:', severity);
    }

    exportAnomalies() {
        console.log('Exporting anomalies');
    }
}

// Initialize and export
const behavioralAnalysisScreen = new BehavioralAnalysisScreen();

// Auto-initialize when screen is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.behavioral-analysis-screen')) {
        behavioralAnalysisScreen.init();
    }
});