/**
 * Threat Hunting Screen Component
 * Advanced threat hunting and analysis capabilities
 */

class ThreatHuntingScreen {
    constructor() {
        this.isInitialized = false;
        this.activeHunts = new Map();
        this.threatIndicators = [];
        this.huntingQueries = [];
    }

    async init() {
        if (this.isInitialized) return;
        
        console.log('Initializing Threat Hunting Screen...');
        await this.loadHuntingData();
        this.setupEventListeners();
        this.startRealTimeUpdates();
        this.isInitialized = true;
    }

    render() {
        return `
            <div class="screen threat-hunting-screen">
                <div class="screen-header">
                    <div class="header-content">
                        <div class="header-title">
                            <i class="fas fa-crosshairs"></i>
                            <h1>Threat Hunting Operations</h1>
                            <span class="status-badge hunting">Hunting</span>
                        </div>
                        <div class="header-actions">
                            <button class="btn btn-primary" id="new-hunt-btn">
                                <i class="fas fa-plus"></i>
                                New Hunt
                            </button>
                            <button class="btn btn-secondary" id="import-iocs-btn">
                                <i class="fas fa-upload"></i>
                                Import IOCs
                            </button>
                            <button class="btn btn-accent" id="auto-hunt-btn">
                                <i class="fas fa-robot"></i>
                                AI Hunt
                            </button>
                        </div>
                    </div>
                </div>

                <div class="screen-content">
                    <!-- Threat Hunting Dashboard -->
                    <div class="hunting-dashboard">
                        <div class="metric-cards">
                            <div class="metric-card threat-level">
                                <div class="metric-header">
                                    <i class="fas fa-exclamation-triangle"></i>
                                    <span>Threat Level</span>
                                </div>
                                <div class="metric-value" id="threat-level-value">MEDIUM</div>
                                <div class="threat-indicator">
                                    <div class="threat-meter">
                                        <div class="threat-fill" data-level="60"></div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="metric-card">
                                <div class="metric-header">
                                    <i class="fas fa-search"></i>
                                    <span>Active Hunts</span>
                                </div>
                                <div class="metric-value" id="active-hunts-count">0</div>
                                <div class="metric-change">
                                    <i class="fas fa-arrow-up"></i>
                                    <span>+3 this hour</span>
                                </div>
                            </div>
                            
                            <div class="metric-card">
                                <div class="metric-header">
                                    <i class="fas fa-fingerprint"></i>
                                    <span>IOCs Detected</span>
                                </div>
                                <div class="metric-value" id="iocs-detected-count">0</div>
                                <div class="metric-change negative">
                                    <i class="fas fa-arrow-down"></i>
                                    <span>-15% vs yesterday</span>
                                </div>
                            </div>
                            
                            <div class="metric-card">
                                <div class="metric-header">
                                    <i class="fas fa-shield-virus"></i>
                                    <span>MITRE Techniques</span>
                                </div>
                                <div class="metric-value" id="mitre-techniques-count">0</div>
                                <div class="metric-change">
                                    <i class="fas fa-clock"></i>
                                    <span>Real-time</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Quick Hunt Actions -->
                    <div class="content-section">
                        <div class="section-header">
                            <h2>Quick Hunt Actions</h2>
                        </div>
                        <div class="quick-hunt-grid">
                            <div class="hunt-card" data-hunt-type="suspicious-processes">
                                <div class="hunt-icon">
                                    <i class="fas fa-cogs"></i>
                                </div>
                                <div class="hunt-content">
                                    <h3>Suspicious Processes</h3>
                                    <p>Hunt for unusual process execution patterns</p>
                                    <div class="hunt-stats">
                                        <span class="stat">Last: 2m ago</span>
                                        <span class="stat confidence high">Confidence: High</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="hunt-card" data-hunt-type="network-anomalies">
                                <div class="hunt-icon">
                                    <i class="fas fa-network-wired"></i>
                                </div>
                                <div class="hunt-content">
                                    <h3>Network Anomalies</h3>
                                    <p>Detect unusual network communication patterns</p>
                                    <div class="hunt-stats">
                                        <span class="stat">Last: 5m ago</span>
                                        <span class="stat confidence medium">Confidence: Medium</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="hunt-card" data-hunt-type="lateral-movement">
                                <div class="hunt-icon">
                                    <i class="fas fa-route"></i>
                                </div>
                                <div class="hunt-content">
                                    <h3>Lateral Movement</h3>
                                    <p>Hunt for signs of lateral movement in the network</p>
                                    <div class="hunt-stats">
                                        <span class="stat">Last: 8m ago</span>
                                        <span class="stat confidence high">Confidence: High</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="hunt-card" data-hunt-type="persistence-mechanisms">
                                <div class="hunt-icon">
                                    <i class="fas fa-anchor"></i>
                                </div>
                                <div class="hunt-content">
                                    <h3>Persistence Mechanisms</h3>
                                    <p>Identify persistence techniques and backdoors</p>
                                    <div class="hunt-stats">
                                        <span class="stat">Last: 12m ago</span>
                                        <span class="stat confidence medium">Confidence: Medium</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Active Hunts -->
                    <div class="content-section">
                        <div class="section-header">
                            <h2>Active Hunting Operations</h2>
                            <div class="header-controls">
                                <select id="hunt-status-filter">
                                    <option value="all">All Hunts</option>
                                    <option value="active">Active</option>
                                    <option value="completed">Completed</option>
                                    <option value="suspicious">Suspicious Found</option>
                                </select>
                                <button class="btn btn-sm" id="refresh-hunts-btn">
                                    <i class="fas fa-sync-alt"></i>
                                    Refresh
                                </button>
                            </div>
                        </div>
                        <div class="hunts-container" id="active-hunts-container">
                            <!-- Hunt cards will be rendered here -->
                        </div>
                    </div>

                    <!-- Threat Intelligence Feed -->
                    <div class="content-section">
                        <div class="section-header">
                            <h2>Threat Intelligence Feed</h2>
                            <div class="feed-controls">
                                <select id="intelligence-source">
                                    <option value="all">All Sources</option>
                                    <option value="internal">Internal</option>
                                    <option value="osint">OSINT</option>
                                    <option value="commercial">Commercial</option>
                                    <option value="government">Government</option>
                                </select>
                            </div>
                        </div>
                        <div class="intelligence-feed" id="threat-intelligence-feed">
                            <!-- Intelligence items will be rendered here -->
                        </div>
                    </div>

                    <!-- IOC Analysis -->
                    <div class="content-section">
                        <div class="section-header">
                            <h2>Indicators of Compromise (IOCs)</h2>
                            <div class="header-controls">
                                <button class="btn btn-sm" id="add-ioc-btn">
                                    <i class="fas fa-plus"></i>
                                    Add IOC
                                </button>
                                <button class="btn btn-sm" id="bulk-ioc-check-btn">
                                    <i class="fas fa-search"></i>
                                    Bulk Check
                                </button>
                            </div>
                        </div>
                        <div class="ioc-analysis-container">
                            <div class="ioc-input-section">
                                <div class="input-group">
                                    <input type="text" id="ioc-input" placeholder="Enter IOC (IP, Hash, Domain, etc.)" />
                                    <select id="ioc-type">
                                        <option value="auto">Auto-detect</option>
                                        <option value="ip">IP Address</option>
                                        <option value="domain">Domain</option>
                                        <option value="url">URL</option>
                                        <option value="hash">File Hash</option>
                                        <option value="email">Email</option>
                                    </select>
                                    <button class="btn btn-primary" id="analyze-ioc-btn">
                                        <i class="fas fa-search"></i>
                                        Analyze
                                    </button>
                                </div>
                            </div>
                            <div class="ioc-results" id="ioc-results">
                                <!-- IOC analysis results will be displayed here -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async loadHuntingData() {
        try {
            // Load active hunts
            const huntsResponse = await fetch('/api/threat-hunting/hunts');
            const huntsData = await huntsResponse.json();
            
            if (huntsData.success) {
                this.activeHunts = new Map(huntsData.hunts.map(hunt => [hunt.id, hunt]));
                this.updateHuntsDisplay();
            }

            // Load threat indicators
            const iocsResponse = await fetch('/api/threat-hunting/iocs');
            const iocsData = await iocsResponse.json();
            
            if (iocsData.success) {
                this.threatIndicators = iocsData.iocs;
                this.updateThreatIndicators();
            }

            // Load threat intelligence feed
            await this.loadThreatIntelligence();
            
        } catch (error) {
            console.error('Error loading hunting data:', error);
            this.showNotification('Failed to load hunting data', 'error');
        }
    }

    setupEventListeners() {
        // New hunt button
        document.getElementById('new-hunt-btn')?.addEventListener('click', () => {
            this.showNewHuntModal();
        });

        // AI hunt button
        document.getElementById('auto-hunt-btn')?.addEventListener('click', () => {
            this.startAIHunt();
        });

        // Quick hunt cards
        document.querySelectorAll('.hunt-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const huntType = card.dataset.huntType;
                this.startQuickHunt(huntType);
            });
        });

        // IOC analysis
        document.getElementById('analyze-ioc-btn')?.addEventListener('click', () => {
            this.analyzeIOC();
        });

        // Hunt status filter
        document.getElementById('hunt-status-filter')?.addEventListener('change', (e) => {
            this.filterHunts(e.target.value);
        });

        // Intelligence source filter
        document.getElementById('intelligence-source')?.addEventListener('change', (e) => {
            this.filterIntelligence(e.target.value);
        });
    }

    async startQuickHunt(huntType) {
        try {
            const response = await fetch('/api/threat-hunting/quick-hunt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    type: huntType,
                    priority: 'medium',
                    automated: true
                })
            });

            const result = await response.json();
            if (result.success) {
                this.addActiveHunt(result.hunt);
                this.showNotification(`${huntType.replace('-', ' ')} hunt started`, 'success');
            }
        } catch (error) {
            console.error('Error starting quick hunt:', error);
            this.showNotification('Failed to start hunt', 'error');
        }
    }

    async startAIHunt() {
        try {
            const response = await fetch('/api/threat-hunting/ai-hunt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    useML: true,
                    analyzePatterns: true,
                    checkBehaviors: true,
                    correlateEvents: true
                })
            });

            const result = await response.json();
            if (result.success) {
                this.addActiveHunt(result.hunt);
                this.showNotification('AI-powered threat hunt initiated', 'success');
            }
        } catch (error) {
            console.error('Error starting AI hunt:', error);
            this.showNotification('Failed to start AI hunt', 'error');
        }
    }

    async analyzeIOC() {
        const iocInput = document.getElementById('ioc-input').value.trim();
        const iocType = document.getElementById('ioc-type').value;
        
        if (!iocInput) {
            this.showNotification('Please enter an IOC to analyze', 'warning');
            return;
        }

        try {
            const response = await fetch('/api/threat-hunting/analyze-ioc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    ioc: iocInput,
                    type: iocType,
                    sources: ['virustotal', 'alienvault', 'threatcrowd', 'hybrid-analysis']
                })
            });

            const result = await response.json();
            if (result.success) {
                this.displayIOCResults(result.analysis);
            }
        } catch (error) {
            console.error('Error analyzing IOC:', error);
            this.showNotification('Failed to analyze IOC', 'error');
        }
    }

    displayIOCResults(analysis) {
        const resultsContainer = document.getElementById('ioc-results');
        if (!resultsContainer) return;

        resultsContainer.innerHTML = `
            <div class="ioc-analysis-result">
                <div class="analysis-header">
                    <h3>IOC Analysis: ${analysis.ioc}</h3>
                    <div class="threat-score ${analysis.threatLevel.toLowerCase()}">
                        Threat Level: ${analysis.threatLevel}
                    </div>
                </div>
                <div class="analysis-details">
                    <div class="detail-section">
                        <h4>Source Intelligence</h4>
                        <div class="source-results">
                            ${analysis.sources.map(source => `
                                <div class="source-result">
                                    <div class="source-name">${source.name}</div>
                                    <div class="source-status ${source.malicious ? 'malicious' : 'clean'}">
                                        ${source.malicious ? 'Malicious' : 'Clean'}
                                    </div>
                                    <div class="source-details">${source.details}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="detail-section">
                        <h4>Recommendations</h4>
                        <ul class="recommendations">
                            ${analysis.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }

    addActiveHunt(hunt) {
        this.activeHunts.set(hunt.id, hunt);
        this.updateHuntsDisplay();
        this.updateMetrics();
    }

    updateHuntsDisplay() {
        const container = document.getElementById('active-hunts-container');
        if (!container) return;

        container.innerHTML = Array.from(this.activeHunts.values())
            .map(hunt => this.renderHuntCard(hunt))
            .join('');
    }

    renderHuntCard(hunt) {
        const statusClass = hunt.status === 'completed' ? 'success' : 
                           hunt.status === 'suspicious' ? 'warning' : 'info';

        return `
            <div class="hunt-operation-card" data-hunt-id="${hunt.id}">
                <div class="hunt-header">
                    <div class="hunt-info">
                        <h3>${hunt.name}</h3>
                        <div class="hunt-meta">
                            <span class="hunt-type">${hunt.type}</span>
                            <span class="hunt-priority ${hunt.priority}">${hunt.priority}</span>
                        </div>
                    </div>
                    <div class="hunt-status ${statusClass}">
                        ${hunt.status}
                    </div>
                </div>
                <div class="hunt-progress">
                    <div class="progress-info">
                        <span>Progress: ${hunt.progress || 0}%</span>
                        <span>Runtime: ${this.formatDuration(hunt.runtime || 0)}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${hunt.progress || 0}%"></div>
                    </div>
                </div>
                <div class="hunt-findings">
                    <div class="finding-stat">
                        <span class="stat-value">${hunt.suspiciousEvents || 0}</span>
                        <span class="stat-label">Suspicious Events</span>
                    </div>
                    <div class="finding-stat">
                        <span class="stat-value">${hunt.iocsFound || 0}</span>
                        <span class="stat-label">IOCs Found</span>
                    </div>
                    <div class="finding-stat">
                        <span class="stat-value">${hunt.mitreMatches || 0}</span>
                        <span class="stat-label">MITRE Matches</span>
                    </div>
                </div>
                <div class="hunt-actions">
                    <button class="btn btn-sm" onclick="threatHuntingScreen.viewHuntDetails('${hunt.id}')">
                        <i class="fas fa-eye"></i>
                        Details
                    </button>
                    <button class="btn btn-sm" onclick="threatHuntingScreen.pauseHunt('${hunt.id}')">
                        <i class="fas fa-pause"></i>
                        Pause
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="threatHuntingScreen.stopHunt('${hunt.id}')">
                        <i class="fas fa-stop"></i>
                        Stop
                    </button>
                </div>
            </div>
        `;
    }

    async loadThreatIntelligence() {
        try {
            const response = await fetch('/api/threat-hunting/intelligence-feed');
            const data = await response.json();
            
            if (data.success) {
                this.updateIntelligenceFeed(data.intelligence);
            }
        } catch (error) {
            console.error('Error loading threat intelligence:', error);
        }
    }

    updateIntelligenceFeed(intelligence) {
        const feedContainer = document.getElementById('threat-intelligence-feed');
        if (!feedContainer) return;

        feedContainer.innerHTML = intelligence.map(item => `
            <div class="intelligence-item ${item.severity.toLowerCase()}">
                <div class="item-header">
                    <div class="item-title">${item.title}</div>
                    <div class="item-severity ${item.severity.toLowerCase()}">${item.severity}</div>
                </div>
                <div class="item-content">
                    <p>${item.description}</p>
                    <div class="item-meta">
                        <span class="source">Source: ${item.source}</span>
                        <span class="timestamp">${new Date(item.timestamp).toLocaleString()}</span>
                    </div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-xs" onclick="threatHuntingScreen.createHuntFromIntel('${item.id}')">
                        <i class="fas fa-search"></i>
                        Hunt
                    </button>
                    <button class="btn btn-xs" onclick="threatHuntingScreen.shareIntel('${item.id}')">
                        <i class="fas fa-share"></i>
                        Share
                    </button>
                </div>
            </div>
        `).join('');
    }

    updateMetrics() {
        const activeHuntsCount = Array.from(this.activeHunts.values()).filter(hunt => hunt.status === 'active').length;
        const iocsDetected = this.threatIndicators.filter(ioc => ioc.detected).length;
        const mitreCount = Array.from(this.activeHunts.values()).reduce((acc, hunt) => acc + (hunt.mitreMatches || 0), 0);

        document.getElementById('active-hunts-count').textContent = activeHuntsCount;
        document.getElementById('iocs-detected-count').textContent = iocsDetected;
        document.getElementById('mitre-techniques-count').textContent = mitreCount;
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

    startRealTimeUpdates() {
        // Update hunting data every 30 seconds
        setInterval(() => {
            this.loadHuntingData();
        }, 30000);
    }

    showNotification(message, type = 'info') {
        if (window.notificationSystem) {
            window.notificationSystem.show(message, type);
        }
    }

    // Hunt management methods
    async viewHuntDetails(huntId) {
        console.log('Viewing hunt details for:', huntId);
    }

    async pauseHunt(huntId) {
        console.log('Pausing hunt:', huntId);
    }

    async stopHunt(huntId) {
        console.log('Stopping hunt:', huntId);
    }

    async createHuntFromIntel(intelId) {
        console.log('Creating hunt from intelligence:', intelId);
    }

    async shareIntel(intelId) {
        console.log('Sharing intelligence:', intelId);
    }

    filterHunts(status) {
        console.log('Filtering hunts by status:', status);
    }

    filterIntelligence(source) {
        console.log('Filtering intelligence by source:', source);
    }

    showNewHuntModal() {
        console.log('Showing new hunt modal');
    }
}

// Initialize and export
const threatHuntingScreen = new ThreatHuntingScreen();

// Auto-initialize when screen is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.threat-hunting-screen')) {
        threatHuntingScreen.init();
    }
});