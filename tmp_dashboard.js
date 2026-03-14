Note: The tool simplified the command to ` cat desktop-app/src/renderer/screens/dashboard.js`, and this is the output of running that command instead:
                                                                                                            <div class="metric-label">Threats Blocked Today</div
>                                                                                                           <div class="metric-trend positive">
                                <i class="fas fa-arrow-up"></i>
                                <span>12% from yesterday</span>
                            </div>
                        </div>
                    </div>

                    <div class="metric-card" id="analyses-card">
                        <div class="metric-header">
                            <div class="metric-icon analyses">
                                <i class="fas fa-microscope"></i>
                            </div>
                            <div class="metric-actions">
                                <button class="btn-icon" title="View Details">
                                    <i class="fas fa-external-link-alt"></i>
                                </button>
                            </div>
                        </div>
                        <div class="metric-content">
                            <div class="metric-value" id="analyses-value">0</div
>                                                                                                           <div class="metric-label">URLs Analyzed</div>
                            <div class="metric-trend positive">
                                <i class="fas fa-arrow-up"></i>
                                <span>8% increase</span>
                            </div>
                        </div>
                    </div>

                    <div class="metric-card" id="risk-card">
                        <div class="metric-header">
                            <div class="metric-icon risk">
                                <i class="fas fa-exclamation-triangle"></i>
                            </div>
                            <div class="metric-actions">
                                <button class="btn-icon" title="View Details">
                                    <i class="fas fa-external-link-alt"></i>
                                </button>
                            </div>
                        </div>
                        <div class="metric-content">
                            <div class="metric-value risk-score">
                                <span id="risk-value">0</span>
                                <span class="risk-label">LOW</span>
                            </div>
                            <div class="metric-label">Current Risk Score</div>
                            <div class="risk-progress">
                                <div class="risk-bar" id="risk-bar"></div>
                            </div>
                        </div>
                    </div>

                    <div class="metric-card" id="health-card">
                        <div class="metric-header">
                            <div class="metric-icon health">
                                <i class="fas fa-heartbeat"></i>
                            </div>
                            <div class="metric-actions">
                                <button class="btn-icon" title="View Details">
                                    <i class="fas fa-external-link-alt"></i>
                                </button>
                            </div>
                        </div>
                        <div class="metric-content">
                            <div class="metric-value" id="health-value">100%</di
v>                                                                                                          <div class="metric-label">System Health</div>
                            <div class="health-indicators">
                                <div class="health-indicator" data-service="back
end">                                                                                                               <div class="indicator-dot"></div>
                                    <span>Backend</span>
                                </div>
                                <div class="health-indicator" data-service="ml">
                                    <div class="indicator-dot"></div>
                                    <span>AI/ML</span>
                                </div>
                                <div class="health-indicator" data-service="real
time">                                                                                                              <div class="indicator-dot"></div>
                                    <span>Real-time</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Charts Section -->
                <div class="charts-section">
                    <div class="chart-row">
                        <div class="chart-card">
                            <div class="chart-header">
                                <h3>Threat Detection Timeline</h3>
                                <div class="chart-controls">
                                    <select id="threat-timeline-period">
                                        <option value="24h">Last 24 Hours</optio
n>                                                                                                                      <option value="7d">Last 7 Days</option>
                                        <option value="30d">Last 30 Days</option
>                                                                                                                   </select>
                                </div>
                            </div>
                            <div class="chart-container">
                                <canvas id="threat-timeline-chart"></canvas>
                            </div>
                        </div>

                        <div class="chart-card">
                            <div class="chart-header">
                                <h3>Security Score Breakdown</h3>
                                <div class="chart-legend" id="security-score-leg
end"></div>                                                                                                 </div>
                            <div class="chart-container">
                                <canvas id="security-score-chart"></canvas>
                            </div>
                        </div>
                    </div>

                    <div class="chart-row">
                        <div class="chart-card wide">
                            <div class="chart-header">
                                <h3>Real-time Activity Monitor</h3>
                                <div class="chart-controls">
                                    <button class="btn btn-sm btn-secondary" id=
"pause-monitor">                                                                                                        <i class="fas fa-pause"></i> Pause
                                    </button>
                                    <button class="btn btn-sm btn-secondary" id=
"clear-monitor">                                                                                                        <i class="fas fa-trash"></i> Clear
                                    </button>
                                </div>
                            </div>
                            <div class="chart-container">
                                <canvas id="activity-monitor-chart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Recent Activity Section -->
                <div class="activity-section">
                    <div class="section-header">
                        <h3>Recent Activity</h3>
                        <button class="btn btn-sm btn-secondary" id="view-all-ac
tivity">                                                                                                    View All
                        </button>
                    </div>
                    <div class="activity-grid">
                        <div class="activity-card">
                            <div class="activity-header">
                                <h4>Recent Threats</h4>
                                <span class="activity-count" id="recent-threats-
count">0</span>                                                                                             </div>
                            <div class="activity-list" id="recent-threats-list">
                                <div class="activity-item loading">
                                    <div class="skeleton skeleton-text"></div>
                                </div>
                            </div>
                        </div>

                        <div class="activity-card">
                            <div class="activity-header">
                                <h4>Recent Analyses</h4>
                                <span class="activity-count" id="recent-analyses
-count">0</span>                                                                                            </div>
                            <div class="activity-list" id="recent-analyses-list"
>                                                                                                               <div class="activity-item loading">
                                    <div class="skeleton skeleton-text"></div>
                                </div>
                            </div>
                        </div>

                        <div class="activity-card">
                            <div class="activity-header">
                                <h4>AI Insights</h4>
                                <span class="activity-count" id="ai-insights-cou
nt">0</span>                                                                                                </div>
                            <div class="activity-list" id="ai-insights-list">
                                <div class="activity-item loading">
                                    <div class="skeleton skeleton-text"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Quick Tools Section -->
                <div class="tools-section">
                    <div class="section-header">
                        <h3>Quick Tools</h3>
                    </div>
                    <div class="tools-grid">
                        <div class="tool-card" data-tool="url-scanner">
                            <div class="tool-icon">
                                <i class="fas fa-link"></i>
                            </div>
                            <div class="tool-content">
                                <h4>URL Scanner</h4>
                                <p>Quickly scan URLs for threats and malicious c
ontent</p>                                                                                                  </div>
                            <div class="tool-action">
                                <i class="fas fa-arrow-right"></i>
                            </div>
                        </div>

                        <div class="tool-card" data-tool="file-analyzer">
                            <div class="tool-icon">
                                <i class="fas fa-file-alt"></i>
                            </div>
                            <div class="tool-content">
                                <h4>File Analyzer</h4>
                                <p>Upload and analyze files for malware and secu
rity risks</p>                                                                                              </div>
                            <div class="tool-action">
                                <i class="fas fa-arrow-right"></i>
                            </div>
                        </div>

                        <div class="tool-card" data-tool="network-monitor">
                            <div class="tool-icon">
                                <i class="fas fa-network-wired"></i>
                            </div>
                            <div class="tool-content">
                                <h4>Network Monitor</h4>
                                <p>Monitor network traffic and detect anomalies<
/p>                                                                                                         </div>
                            <div class="tool-action">
                                <i class="fas fa-arrow-right"></i>
                            </div>
                        </div>

                        <div class="tool-card" data-tool="ai-chat">
                            <div class="tool-icon">
                                <i class="fas fa-robot"></i>
                            </div>
                            <div class="tool-content">
                                <h4>AI Assistant</h4>
                                <p>Get intelligent insights and cybersecurity ad
vice</p>                                                                                                    </div>
                            <div class="tool-action">
                                <i class="fas fa-arrow-right"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async initializeComponents() {
        this.setupEventListeners();
        this.initializeCharts();
        this.updateHealthIndicators();
    }

    setupEventListeners() {
        // Quick action buttons
        const quickScanBtn = this.container.querySelector('#quick-scan-btn');
        quickScanBtn?.addEventListener('click', () => this.showQuickScan());

        const newAnalysisBtn = this.container.querySelector('#new-analysis-btn')
;                                                                                       newAnalysisBtn?.addEventListener('click', () => window.app?.showScreen('
deep-analysis'));                                                               
        const aiAssistantBtn = this.container.querySelector('#ai-assistant-btn')
;                                                                                       aiAssistantBtn?.addEventListener('click', () => window.app?.showScreen('
ai-assistant'));                                                                
        // Metric card actions
        this.container.querySelectorAll('.metric-card .btn-icon').forEach(btn =>
 {                                                                                          btn.addEventListener('click', (e) => {
                const card = e.target.closest('.metric-card');
                this.showMetricDetails(card.id);
            });
        });

        // Chart controls
        const threatPeriodSelect = this.container.querySelector('#threat-timelin
e-period');                                                                             threatPeriodSelect?.addEventListener('change', (e) => {
            this.updateThreatTimeline(e.target.value);
        });

        const pauseMonitorBtn = this.container.querySelector('#pause-monitor');
        pauseMonitorBtn?.addEventListener('click', () => this.toggleActivityMoni
tor());                                                                         
        const clearMonitorBtn = this.container.querySelector('#clear-monitor');
        clearMonitorBtn?.addEventListener('click', () => this.clearActivityMonit
or());                                                                          
        // Activity view all
        const viewAllBtn = this.container.querySelector('#view-all-activity');
        viewAllBtn?.addEventListener('click', () => window.app?.showScreen('real
-time-monitor'));                                                               
        // Tool cards
        this.container.querySelectorAll('.tool-card').forEach(card => {
            card.addEventListener('click', () => {
                const tool = card.dataset.tool;
                this.openTool(tool);
            });
        });
    }

    initializeCharts() {
        // Threat timeline chart
        this.charts.threatTimeline = window.chartFactory?.createLineChart('threa
t-timeline-chart', {                                                                        labels: [],
            datasets: [{
                label: 'Threats Detected',
                data: [],
                borderColor: '#D92D20',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                fill: true
            }]
        });

        // Security score radar chart
        this.charts.securityScore = window.chartFactory?.createRadarChart('secur
ity-score-chart', {                                                                         labels: ['Malware Protection', 'Network Security', 'Data Protection'
, 'Access Control', 'Monitoring'],                                                          datasets: [{
                label: 'Security Score',
                data: [85, 90, 88, 92, 87],
                borderColor: '#00d4ff',
                backgroundColor: 'rgba(0, 212, 255, 0.2)'
            }]
        });

        // Real-time activity monitor
        this.charts.activityMonitor = window.chartFactory?.createRealTimeChart('
activity-monitor-chart', {                                                                  label: 'Activity Level',
            maxDataPoints: 30,
            updateInterval: 2000,
            autoUpdate: true,
            showLegend: false
        });
    }

    async loadData() {
        console.log('📊 Loading dashboard data...');
        
        try {
            // Load system health first
            await this.loadSystemHealth();
            
            // Load threat statistics
            await this.loadThreatStats();
            
            // Load analysis statistics
            await this.loadAnalysisStats();
            
            // Load ML/AI status
            await this.loadMLStatus();
            
            // Load recent activity
            await this.loadRecentActivity();
            
            // Update all displays
            this.updateMetrics();
            
            // Remove loading states
            this.removeLoadingStates();
            
            console.log('✅ Dashboard data loaded successfully');
            
        } catch (error) {
            console.error('❌ Failed to load dashboard data:', error);
            this.removeLoadingStates();
            // Show data with default values instead of failing
            this.updateMetrics();
        }
    }
    
    removeLoadingStates() {
        // Remove all loading indicators
        const loadingItems = this.container.querySelectorAll('.loading');
        loadingItems.forEach(item => item.classList.remove('loading'));
        
        // Remove connecting messages
        const connectingMessages = this.container.querySelectorAll('.connecting-
message');                                                                              connectingMessages.forEach(msg => msg.remove());
    }

    async loadSystemHealth() {
        if (!window.apiClient) {
            console.warn('⚠️ API client not available');
            return;
        }
        
        try {
            const health = await window.apiClient.checkHealth();
            if (health && health.success) {
                this.metrics.systemHealth = health.data?.status === 'healthy' ? 
100 : 50;                                                                                       this.updateHealthIndicators(health.data?.services || {});
            }
        } catch (error) {
            console.warn('⚠️ Failed to load system health (using defaults):', err
or.message);                                                                                this.metrics.systemHealth = 75; // Default to partial health
            this.updateHealthIndicators({ backend: true, ml: false, realtime: tr
ue });                                                                                  }
    }

    async loadMLStatus() {
        // Try CyberForge ML first
        if (window.cyberforgeAPI) {
            try {
                const mlHealth = await window.cyberforgeAPI.getCyberForgeMLHealt
h();                                                                                            if (mlHealth.success && mlHealth.data) {
                    const status = mlHealth.data.status === 'healthy';
                    const modelCount = mlHealth.data.model_count || 4;
                    console.log(`✅ CyberForge ML: ${modelCount} models availabl
e`);                                                                                                this.updateHealthIndicators({ ml: status, cyberforge: true }
);                                                                                                  return;
                }
            } catch (error) {
                console.warn('CyberForge ML check failed:', error.message);
            }
        }
        
        // Fallback to legacy
        if (window.apiClient) {
            try {
                const mlHealth = await window.apiClient.getMLHealth();
                if (mlHealth.success && mlHealth.data) {
                    this.updateHealthIndicators({ ml: mlHealth.data.status === '
healthy' || mlHealth.data.ready });                                                             }
            } catch (error) {
                console.error('Failed to load ML status:', error);
            }
        }
    }

    updateHealthIndicators(services) {
        const indicators = {
            backend: services.backend !== false,
            ml: services.ai_agent !== false || services.ml_models !== false,
            realtime: services.websocket !== false || services.realtime !== fals
e                                                                                       };
        
        Object.entries(indicators).forEach(([service, online]) => {
            const indicator = this.container.querySelector(`.health-indicator[da
ta-service="${service}"]`);                                                                 if (indicator) {
                const dot = indicator.querySelector('.indicator-dot');
                if (online) {
                    dot.classList.add('online');
                    dot.classList.remove('offline');
                } else {
                    dot.classList.add('offline');
                    dot.classList.remove('online');
                }
            }
        });
    }

    async loadThreatStats() {
        if (!window.apiClient) return;
        
        try {
            const stats = await window.apiClient.getThreatStats();
            if (stats.success && stats.data) {
                const payload = stats.data;
                this.metrics.threatsBlocked = payload.total_threats || payload.b
locked_today || 0;                                                                              this.metrics.riskScore = this.calculateRiskScore(payload);
                this.updateHealthIndicators({ backend: true });
            }
        } catch (error) {
            console.error('Failed to load threat stats:', error);
        }
    }

    async loadAnalysisStats() {
        if (!window.apiClient) return;
        
        try {
            const stats = await window.apiClient.getAnalysisStats();
            if (stats.success && stats.data) {
                const payload = stats.data;
                this.metrics.urlsAnalyzed = payload.totalAnalyses || payload.tot
al_analyses || 0;                                                                           }
        } catch (error) {
            console.error('Failed to load analysis stats:', error);
        }
    }

    async loadRecentActivity() {
        // Load recent threats
        this.loadRecentThreats();
        
        // Load recent analyses
        this.loadRecentAnalyses();
        
        // Load AI insights
        this.loadAIInsights();
    }

    async loadRecentThreats() {
        const list = this.container.querySelector('#recent-threats-list');
        const count = this.container.querySelector('#recent-threats-count');
        
        try {
            if (window.apiClient) {
                const threats = await window.apiClient.getThreats({ limit: 5 });
                const threatData = threats.success ? (threats.data?.threats || t
hreats.data || []) : [];                                                                        if (threatData.length) {
                    this.renderActivityList(list, threatData, 'threat');
                    count.textContent = threatData.length;
                    return;
                }
            }
            
            // Fallback with mock data
            const mockThreats = this.generateMockThreats(5);
            this.renderActivityList(list, mockThreats, 'threat');
            count.textContent = mockThreats.length;
            
        } catch (error) {
            console.error('Failed to load recent threats:', error);
            list.innerHTML = '<div class="activity-item error">Failed to load th
reats</div>';                                                                           }
    }

    async loadRecentAnalyses() {
        const list = this.container.querySelector('#recent-analyses-list');
        const count = this.container.querySelector('#recent-analyses-count');
        
        try {
            if (window.apiClient) {
                const analyses = await window.apiClient.getAnalysisHistory({ lim
it: 5 });                                                                                       const analysisData = analyses.success ? (analyses.data?.analyses
 || analyses.data || []) : [];                                                                  if (analysisData.length) {
                    this.renderActivityList(list, analysisData, 'analysis');
                    count.textContent = analysisData.length;
                    return;
                }
            }
            
            // Fallback with mock data
            const mockAnalyses = this.generateMockAnalyses(5);
            this.renderActivityList(list, mockAnalyses, 'analysis');
            count.textContent = mockAnalyses.length;
            
        } catch (error) {
            console.error('Failed to load recent analyses:', error);
            list.innerHTML = '<div class="activity-item error">Failed to load an
alyses</div>';                                                                          }
    }

    async loadAIInsights() {
        const list = this.container.querySelector('#ai-insights-list');
        const count = this.container.querySelector('#ai-insights-count');
        
        // Mock AI insights for now
        const mockInsights = [
            { type: 'prediction', message: 'Increased phishing activity detected
 in finance sector', severity: 'high', timestamp: new Date(Date.now() - 1800000) },                                                                                         { type: 'recommendation', message: 'Consider updating firewall rules
 for port 443', severity: 'medium', timestamp: new Date(Date.now() - 3600000) },            { type: 'anomaly', message: 'Unusual traffic pattern detected from I
P 192.168.1.100', severity: 'low', timestamp: new Date(Date.now() - 7200000) }          ];
        
        this.renderActivityList(list, mockInsights, 'insight');
        count.textContent = mockInsights.length;
    }

    renderActivityList(container, items, type) {
        // Ensure items is an array
        if (!items || !Array.isArray(items) || items.length === 0) {
            container.innerHTML = '<div class="activity-item empty">No recent ac
tivity</div>';                                                                              return;
        }
        
        container.innerHTML = items.map(item => this.createActivityItem(item, ty
pe)).join('');                                                                      }

    createActivityItem(item, type) {
        const time = this.formatRelativeTime(item.timestamp || item.created_at |
| new Date());                                                                          
        switch (type) {
            case 'threat':
                return `
                    <div class="activity-item">
                        <div class="activity-icon threat">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <div class="activity-content">
                            <div class="activity-title">${item.type || 'Security
 Threat'}</div>                                                                                             <div class="activity-description">${item.description
 || item.message || 'Threat detected'}</div>                                                                <div class="activity-meta">
                                <span class="badge badge-${this.getSeverityClass
(item.severity)}">${item.severity || 'medium'}</span>                                                           <span class="activity-time">${time}</span>
                            </div>
                        </div>
                    </div>
                `;
            
            case 'analysis':
                return `
                    <div class="activity-item">
                        <div class="activity-icon analysis">
                            <i class="fas fa-microscope"></i>
                        </div>
                        <div class="activity-content">
                            <div class="activity-title">${item.url || 'URL Analy
sis'}</div>                                                                                                 <div class="activity-description">Analysis completed
</div>                                                                                                      <div class="activity-meta">
                                <span class="badge badge-${item.status === 'comp
leted' ? 'success' : 'warning'}">${item.status || 'completed'}</span>                                           <span class="activity-time">${time}</span>
                            </div>
                        </div>
                    </div>
                `;
            
            case 'insight':
                return `
                    <div class="activity-item">
                        <div class="activity-icon insight">
                            <i class="fas fa-lightbulb"></i>
                        </div>
                        <div class="activity-content">
                            <div class="activity-title">${item.type || 'AI Insig
ht'}</div>                                                                                                  <div class="activity-description">${item.message}</d
iv>                                                                                                         <div class="activity-meta">
                                <span class="badge badge-${this.getSeverityClass
(item.severity)}">${item.severity}</span>                                                                       <span class="activity-time">${time}</span>
                            </div>
                        </div>
                    </div>
                `;
            
            default:
                return '';
        }
    }

    updateMetrics() {
        // Update metric values with animation
        this.animateMetricValue('threats-value', this.metrics.threatsBlocked);
        this.animateMetricValue('analyses-value', this.metrics.urlsAnalyzed);
        this.updateRiskScore(this.metrics.riskScore);
        this.updateSystemHealth(this.metrics.systemHealth);
    }

    animateMetricValue(elementId, targetValue) {
        const element = this.container.querySelector(`#${elementId}`);
        if (!element) return;
        
        const currentValue = parseInt(element.textContent) || 0;
        const duration = 1000;
        const stepTime = 50;
        const steps = duration / stepTime;
        const stepValue = (targetValue - currentValue) / steps;
        
        let current = currentValue;
        const interval = setInterval(() => {
            current += stepValue;
            if ((stepValue > 0 && current >= targetValue) || (stepValue < 0 && c
urrent <= targetValue)) {                                                                       current = targetValue;
                clearInterval(interval);
            }
            element.textContent = Math.round(current).toLocaleString();
        }, stepTime);
    }

    updateRiskScore(score) {
        const element = this.container.querySelector('#risk-value');
        const labelElement = this.container.querySelector('.risk-label');
        const barElement = this.container.querySelector('#risk-bar');
        
        if (element) element.textContent = score;
        
        let level, color;
        if (score < 30) {
            level = 'LOW';
            color = '#039855';
        } else if (score < 70) {
            level = 'MEDIUM';
            color = '#DC6803';
        } else {
            level = 'HIGH';
            color = '#D92D20';
        }
        
        if (labelElement) labelElement.textContent = level;
        if (barElement) {
            barElement.style.width = `${score}%`;
            barElement.style.backgroundColor = color;
        }
    }

    updateSystemHealth(health) {
        const element = this.container.querySelector('#health-value');
        if (element) element.textContent = `${health}%`;
    }

    updateHealthIndicators(services = {}) {
        const indicators = this.container.querySelectorAll('.health-indicator');
        
        indicators.forEach(indicator => {
            const service = indicator.dataset.service;
            const dot = indicator.querySelector('.indicator-dot');
            let isHealthy = false;
            
            switch (service) {
                case 'backend':
                    isHealthy = services.backend ?? window.websocketManager?.isC
onnected ?? false;                                                                                  break;
                case 'ml':
                    isHealthy = services.ml ?? false;
                    break;
                case 'realtime':
                    isHealthy = services.realtime ?? window.websocketManager?.is
Connected ?? false;                                                                                 break;
            }
            
            dot.className = `indicator-dot ${isHealthy ? 'healthy' : 'unhealthy'
}`;                                                                                     });
    }

    startRealTimeUpdates() {
        if (this.updateInterval) return;
        
        this.updateInterval = setInterval(() => {
            if (this.isActive) {
                this.updateHealthIndicators();
                this.loadThreatStats();
                this.loadAnalysisStats();
            }
        }, 30000); // Update every 30 seconds
    }

    stopRealTimeUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    destroyCharts() {
        Object.keys(this.charts).forEach(chartKey => {
            if (this.charts[chartKey]) {
                window.chartFactory?.destroyChart(this.charts[chartKey].canvas.i
d);                                                                                         }
        });
        this.charts = {};
    }

    // Helper methods
    calculateRiskScore(threatData) {
        if (!threatData) return 20;
        
        const factors = {
            activeThreats: (threatData.active_threats || 0) * 5,
            highSeverity: (threatData.high_severity || 0) * 10,
            recentActivity: Math.min((threatData.recent_activity || 0) * 2, 20)
        };
        
        return Math.min(factors.activeThreats + factors.highSeverity + factors.r
ecentActivity, 100);                                                                }

    formatRelativeTime(date) {
        const now = new Date();
        const diff = now - new Date(date);
        const minutes = Math.floor(diff / 60000);
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    getSeverityClass(severity) {
        const map = {
            low: 'secondary',
            medium: 'warning',
            high: 'error',
            critical: 'error'
        };
        return map[severity] || 'secondary';
    }

    generateMockThreats(count) {
        const threats = [];
        const types = ['Malware', 'Phishing', 'Suspicious Activity', 'Network In
trusion'];                                                                              const severities = ['low', 'medium', 'high'];
        
        for (let i = 0; i < count; i++) {
            threats.push({
                type: types[Math.floor(Math.random() * types.length)],
                description: `Threat detected and blocked`,
                severity: severities[Math.floor(Math.random() * severities.lengt
h)],                                                                                            timestamp: new Date(Date.now() - Math.random() * 86400000) // Ra
ndom time in last 24h                                                                       });
        }
        
        return threats;
    }

    generateMockAnalyses(count) {
        const analyses = [];
        const urls = ['example.com', 'test-site.org', 'sample-url.net'];
        
        for (let i = 0; i < count; i++) {
            analyses.push({
                url: urls[Math.floor(Math.random() * urls.length)],
                status: 'completed',
                timestamp: new Date(Date.now() - Math.random() * 86400000)
            });
        }
        
        return analyses;
    }

    // Event handlers
    async showQuickScan() {
        // Prompt for URL
        const url = prompt('Enter URL to scan:', 'https://example.com');
        if (!url) return;
        
        // Show scanning notification
        window.notificationSystem?.info('Scanning...', `Analyzing ${url} with Cy
berForge ML`);                                                                          
        try {
            // Use CyberForge ML for URL analysis
            if (window.cyberforgeAPI) {
                const result = await window.cyberforgeAPI.cyberforgeAnalyzeUrl(u
rl);                                                                                            
                if (result.success && result.data) {
                    const analysis = result.data;
                    const riskLevel = analysis.aggregate?.overall_risk_level || 
'unknown';                                                                                          const maxScore = analysis.aggregate?.max_threat_score || 0;
                    const action = analysis.aggregate?.recommended_action || 'al
low';                                                                                               
                    // Show result notification
                    if (riskLevel === 'high' || riskLevel === 'critical') {
                        window.notificationSystem?.error('⚠️ High Risk Detected',
                                                                                                            `${url}\nRisk: ${riskLevel.toUpperCase()}\nThreat Sc
ore: ${(maxScore * 100).toFixed(1)}%\nAction: ${action.toUpperCase()}`);                            } else if (riskLevel === 'medium') {
                        window.notificationSystem?.warning('⚡ Medium Risk', 
                            `${url}\nRisk: ${riskLevel.toUpperCase()}\nThreat Sc
ore: ${(maxScore * 100).toFixed(1)}%`);                                                             } else {
                        window.notificationSystem?.success('✅ Safe URL', 
                            `${url}\nRisk: ${riskLevel.toUpperCase()}\nThreat Sc
ore: ${(maxScore * 100).toFixed(1)}%`);                                                             }
                    
                    // Log model predictions
                    console.log('CyberForge ML Analysis:', analysis);
                    
                    // Update dashboard metrics
                    this.metrics.urlsAnalyzed++;
                    if (riskLevel === 'high' || riskLevel === 'critical') {
                        this.metrics.threatsBlocked++;
                    }
                    this.updateMetrics();
                    
                } else {
                    throw new Error(result.error || 'Analysis failed');
                }
            } else if (window.apiClient) {
                // Fallback to legacy API
                const result = await window.apiClient.analyzeUrl(url);
                if (result.success) {
                    window.notificationSystem?.success('Scan Complete', `Analysi
s of ${url} completed`);                                                                            window.app?.showScreen('deep-analysis', { url });
                }
            } else {
                window.app?.showScreen('deep-analysis', { url });
            }
        } catch (error) {
            console.error('Quick scan error:', error);
            window.notificationSystem?.error('Scan Failed', error.message);
        }
    }

    showMetricDetails(cardId) {
        const screenMap = {
            'threats-card': 'threat-center',
            'analyses-card': 'deep-analysis',
            'risk-card': 'real-time-monitor',
            'health-card': 'system-logs'
        };
        
        const screen = screenMap[cardId];
        if (screen) {
            window.app?.showScreen(screen);
        }
    }

    updateThreatTimeline(period) {
        // Update chart based on selected period
        console.log(`Updating threat timeline for period: ${period}`);
    }

    toggleActivityMonitor() {
        const btn = this.container.querySelector('#pause-monitor');
        const chart = this.charts.activityMonitor;
        
        if (chart && chart.updateInterval) {
            clearInterval(chart.updateInterval);
            chart.updateInterval = null;
            btn.innerHTML = '<i class="fas fa-play"></i> Resume';
        } else if (chart) {
            chart.updateInterval = setInterval(() => {
                window.chartFactory?.addRealTimeDataPoint('activity-monitor-char
t', {                                                                                               x: new Date(),
                    y: Math.random() * 100
                });
            }, 2000);
            btn.innerHTML = '<i class="fas fa-pause"></i> Pause';
        }
    }

    clearActivityMonitor() {
        const chart = this.charts.activityMonitor;
        if (chart) {
            chart.data.labels = [];
            chart.data.datasets[0].data = [];
            chart.update();
        }
    }

    openTool(tool) {
        const toolScreenMap = {
            'url-scanner': 'deep-analysis',
            'file-analyzer': 'malware-detection',
            'network-monitor': 'network-analysis',
            'ai-chat': 'ai-assistant'
        };
        
        const screen = toolScreenMap[tool];
        if (screen) {
            window.app?.showScreen(screen);
        }
    }

    handleRealtimeData(data) {
        // Handle real-time data updates
        if (data.type === 'threat_alert') {
            this.metrics.threatsBlocked++;
            this.updateMetrics();
        } else if (data.type === 'analysis_complete') {
            this.metrics.urlsAnalyzed++;
            this.updateMetrics();
        }
    }

    destroy() {
        this.stopRealTimeUpdates();
        this.destroyCharts();
    }
}

// Export for global access
window.DashboardScreen = DashboardScreen;%                                      
