/**
 * Threat Globe Screen
 * Real-time global threat intelligence visualization using OTX data
 */

class ThreatGlobeScreen {
    constructor() {
        this.container = null;
        this.globe = null;
        this.isActive = false;
        this.isPaused = false;
        this.threatData = [];
        this.updateInterval = null;
    }

    async show(container, options = {}) {
        this.container = container;
        this.isActive = true;
        
        // Create threat globe HTML
        this.container.innerHTML = this.createHTML();
        
        // Initialize globe
        await this.initializeGlobe();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load initial threat data
        await this.loadThreatData();
        
        // Start real-time updates
        this.startRealTimeUpdates();
        
        // Add entrance animation
        this.container.classList.add('screen-enter');
    }

    hide() {
        this.isActive = false;
        this.stopRealTimeUpdates();
        
        // Destroy globe
        if (this.globe) {
            this.globe.destroy?.();
            this.globe = null;
        }
    }

    createHTML() {
        return `
            <div class="threat-globe-screen">
                <!-- Header Section -->
                <div class="globe-header">
                    <div class="header-content">
                        <div class="globe-title-section">
                            <h1 class="globe-title">
                                <i class="fas fa-globe-americas"></i>
                                Global Threat Intelligence
                            </h1>
                            <p class="globe-subtitle">Real-time cyber threats powered by AlienVault OTX</p>
                        </div>
                        <div class="globe-controls">
                            <button class="btn btn-secondary" id="pause-globe-btn">
                                <i class="fas fa-pause"></i> Pause
                            </button>
                            <button class="btn btn-secondary" id="resume-globe-btn" style="display: none;">
                                <i class="fas fa-play"></i> Resume
                            </button>
                            <button class="btn btn-secondary" id="filter-threats-btn">
                                <i class="fas fa-filter"></i> Filter
                            </button>
                            <button class="btn btn-primary" id="refresh-threats-btn">
                                <i class="fas fa-sync"></i> Refresh
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Main Globe Container -->
                <div class="globe-main-container">
                    <!-- Globe Visualization -->
                    <div class="globe-visualization-wrapper">
                        <div id="threat-globe-container" class="threat-globe-container"></div>
                        
                        <!-- Globe Overlay Info -->
                        <div class="globe-overlay-info">
                            <div class="threat-counter">
                                <div class="counter-value" id="threat-count">0</div>
                                <div class="counter-label">Active Threats</div>
                            </div>
                        </div>
                        
                        <!-- Legend -->
                        <div class="globe-legend">
                            <div class="legend-title">Threat Severity</div>
                            <div class="legend-items">
                                <div class="legend-item">
                                    <span class="legend-color" style="background: #ef4444;"></span>
                                    <span class="legend-label">Critical</span>
                                </div>
                                <div class="legend-item">
                                    <span class="legend-color" style="background: #f59e0b;"></span>
                                    <span class="legend-label">Medium</span>
                                </div>
                                <div class="legend-item">
                                    <span class="legend-color" style="background: #3b82f6;"></span>
                                    <span class="legend-label">Low</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Threat Feed Sidebar -->
                    <div class="threat-feed-sidebar">
                        <div class="sidebar-header">
                            <h3><i class="fas fa-stream"></i> Live Threat Feed</h3>
                            <span class="live-indicator">
                                <span class="live-dot"></span>
                                LIVE
                            </span>
                        </div>
                        
                        <div class="threat-feed-list" id="threat-feed-list">
                            <!-- Threat items will be added here dynamically -->
                        </div>
                    </div>
                </div>

                <!-- Threat Details Panel -->
                <div class="threat-details-panel" id="threat-details-panel" style="display: none;">
                    <div class="panel-header">
                        <h3><i class="fas fa-info-circle"></i> Threat Details</h3>
                        <button class="btn-close" id="close-details-btn">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="panel-body" id="threat-details-body">
                        <!-- Details will be populated here -->
                    </div>
                </div>

                <!-- Filter Modal -->
                <div class="filter-modal" id="filter-modal" style="display: none;">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>Filter Threats</h3>
                            <button class="btn-close" id="close-filter-btn">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="modal-body">
                            <div class="filter-group">
                                <label>Severity</label>
                                <div class="checkbox-group">
                                    <label>
                                        <input type="checkbox" checked data-filter="severity" value="high"> Critical
                                    </label>
                                    <label>
                                        <input type="checkbox" checked data-filter="severity" value="medium"> Medium
                                    </label>
                                    <label>
                                        <input type="checkbox" checked data-filter="severity" value="low"> Low
                                    </label>
                                </div>
                            </div>
                            
                            <div class="filter-group">
                                <label>Region</label>
                                <select id="region-filter">
                                    <option value="all">All Regions</option>
                                    <option value="us">United States</option>
                                    <option value="eu">Europe</option>
                                    <option value="asia">Asia</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-secondary" id="reset-filter-btn">Reset</button>
                            <button class="btn btn-primary" id="apply-filter-btn">Apply</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async initializeGlobe() {
        const globeContainer = this.container.querySelector('#threat-globe-container');
        
        if (!globeContainer) {
            console.error('Globe container not found');
            return;
        }

        // Check if HybridEarthGlobe is available
        if (typeof HybridEarthGlobe !== 'undefined') {
            try {
                this.globe = new HybridEarthGlobe('threat-globe-container', {
                    isDarkTheme: document.body.dataset.theme === 'dark',
                    showTraffic: false,
                    showSampleTraffic: false
                });
                
                console.log('Threat globe initialized');
            } catch (error) {
                console.error('Failed to initialize globe:', error);
                this.showGlobeError(globeContainer);
            }
        } else {
            console.error('HybridEarthGlobe not available');
            this.showGlobeError(globeContainer);
        }
    }

    showGlobeError(container) {
        container.innerHTML = `
            <div class="globe-error">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Globe visualization unavailable</p>
                <p class="error-detail">The 3D globe component failed to load</p>
            </div>
        `;
    }

    setupEventListeners() {
        // Pause/Resume buttons
        const pauseBtn = this.container.querySelector('#pause-globe-btn');
        const resumeBtn = this.container.querySelector('#resume-globe-btn');
        
        pauseBtn?.addEventListener('click', () => {
            this.isPaused = true;
            pauseBtn.style.display = 'none';
            resumeBtn.style.display = 'inline-flex';
            this.dimGlobe();
            
            // Update agent UI if available
            if (window.CyberForgeAgentUI) {
                window.CyberForgeAgentUI.addReasoningEntry(
                    this.getCurrentTime(),
                    'Threat globe paused by user'
                );
            }
        });
        
        resumeBtn?.addEventListener('click', () => {
            this.isPaused = false;
            resumeBtn.style.display = 'none';
            pauseBtn.style.display = 'inline-flex';
            this.brightenGlobe();
            
            if (window.CyberForgeAgentUI) {
                window.CyberForgeAgentUI.addReasoningEntry(
                    this.getCurrentTime(),
                    'Threat globe resumed'
                );
            }
        });

        // Refresh button
        const refreshBtn = this.container.querySelector('#refresh-threats-btn');
        refreshBtn?.addEventListener('click', async () => {
            const icon = refreshBtn.querySelector('i');
            icon.classList.add('fa-spin');
            
            await this.loadThreatData();
            
            setTimeout(() => {
                icon.classList.remove('fa-spin');
            }, 1000);
        });

        // Filter button
        const filterBtn = this.container.querySelector('#filter-threats-btn');
        const filterModal = this.container.querySelector('#filter-modal');
        const closeFilterBtn = this.container.querySelector('#close-filter-btn');
        const applyFilterBtn = this.container.querySelector('#apply-filter-btn');
        
        filterBtn?.addEventListener('click', () => {
            filterModal.style.display = 'flex';
        });
        
        closeFilterBtn?.addEventListener('click', () => {
            filterModal.style.display = 'none';
        });
        
        applyFilterBtn?.addEventListener('click', () => {
            this.applyFilters();
            filterModal.style.display = 'none';
        });

        // Close details panel
        const closeDetailsBtn = this.container.querySelector('#close-details-btn');
        closeDetailsBtn?.addEventListener('click', () => {
            const detailsPanel = this.container.querySelector('#threat-details-panel');
            detailsPanel.style.display = 'none';
        });
    }

    async loadThreatData() {
        try {
            // Get backend URL from config or use default
            const backendUrl = window.API_ENDPOINTS?.BACKEND_URL || 'http://localhost:8000';
            
            // Try to fetch from backend OTX API
            const response = await fetch(`${backendUrl}/api/otx/threats/recent?limit=20`);
            
            if (response.ok) {
                const data = await response.json();
                this.threatData = data.data || [];
                this.visualizeThreats();
                this.updateThreatFeed();
                this.updateThreatCount();
            } else {
                console.warn('Failed to fetch OTX threats, using mock data');
                this.loadMockThreats();
            }
        } catch (error) {
            console.error('Error loading threat data:', error);
            this.loadMockThreats();
        }
    }

    loadMockThreats() {
        // Mock threat data for development/fallback
        this.threatData = [
            {
                id: 'mock-1',
                timestamp: Date.now(),
                origin: { lat: 51.5074, lon: -0.1278, country: 'UK' },
                destination: { lat: 37.7749, lon: -122.4194, country: 'US' },
                threat: 'Phishing Campaign',
                severity: 'high',
                adversary: 'APT29',
                description: 'Sophisticated phishing targeting financial institutions'
            },
            {
                id: 'mock-2',
                timestamp: Date.now() - 120000,
                origin: { lat: 39.9042, lon: 116.4074, country: 'CN' },
                destination: { lat: 40.7128, lon: -74.0060, country: 'US' },
                threat: 'Malware Distribution',
                severity: 'medium',
                adversary: 'Unknown',
                description: 'Trojan distribution via compromised websites'
            }
        ];
        
        this.visualizeThreats();
        this.updateThreatFeed();
        this.updateThreatCount();
    }

    visualizeThreats() {
        if (!this.globe || this.isPaused) return;

        // Clear existing arcs
        if (this.globe.clearArcs) {
            this.globe.clearArcs();
        }

        // Visualize each threat
        this.threatData.forEach(threat => {
            if (this.globe.addArc) {
                const color = this.getSeverityColor(threat.severity);
                this.globe.addArc(
                    threat.origin.lat,
                    threat.origin.lon,
                    threat.destination.lat,
                    threat.destination.lon,
                    color,
                    { duration: 2000, altitude: 0.5 }
                );
            }
        });
    }

    updateThreatFeed() {
        const feedList = this.container.querySelector('#threat-feed-list');
        if (!feedList) return;

        feedList.innerHTML = '';

        if (this.threatData.length === 0) {
            feedList.innerHTML = `
                <div class="feed-empty">
                    <i class="fas fa-satellite-dish"></i>
                    <p>Listening for threats...</p>
                </div>
            `;
            return;
        }

        this.threatData.slice(0, 10).forEach(threat => {
            const item = document.createElement('div');
            item.className = `threat-feed-item severity-${threat.severity}`;
            item.innerHTML = `
                <div class="threat-indicator">
                    <span class="severity-badge ${threat.severity}">${threat.severity.toUpperCase()}</span>
                    <span class="threat-time">${this.formatTime(threat.timestamp)}</span>
                </div>
                <div class="threat-info">
                    <div class="threat-name">${threat.threat}</div>
                    <div class="threat-location">
                        <i class="fas fa-map-marker-alt"></i>
                        ${threat.origin.country} → ${threat.destination.country}
                    </div>
                </div>
            `;
            
            item.addEventListener('click', () => this.showThreatDetails(threat));
            feedList.appendChild(item);
        });
    }

    updateThreatCount() {
        const countEl = this.container.querySelector('#threat-count');
        if (countEl) {
            countEl.textContent = this.threatData.length;
        }
    }

    showThreatDetails(threat) {
        const detailsPanel = this.container.querySelector('#threat-details-panel');
        const detailsBody = this.container.querySelector('#threat-details-body');
        
        if (!detailsPanel || !detailsBody) return;

        detailsBody.innerHTML = `
            <div class="detail-section">
                <h4>Threat Information</h4>
                <div class="detail-row">
                    <span class="detail-label">Name:</span>
                    <span class="detail-value">${threat.threat}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Severity:</span>
                    <span class="detail-value">
                        <span class="severity-badge ${threat.severity}">${threat.severity.toUpperCase()}</span>
                    </span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Adversary:</span>
                    <span class="detail-value">${threat.adversary || 'Unknown'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Time:</span>
                    <span class="detail-value">${new Date(threat.timestamp).toLocaleString()}</span>
                </div>
            </div>
            
            <div class="detail-section">
                <h4>Location</h4>
                <div class="detail-row">
                    <span class="detail-label">Origin:</span>
                    <span class="detail-value">${threat.origin.country} (${threat.origin.lat}, ${threat.origin.lon})</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Destination:</span>
                    <span class="detail-value">${threat.destination.country} (${threat.destination.lat}, ${threat.destination.lon})</span>
                </div>
            </div>
            
            <div class="detail-section">
                <h4>Description</h4>
                <p>${threat.description || 'No description available'}</p>
            </div>
        `;
        
        detailsPanel.style.display = 'block';
    }

    dimGlobe() {
        const globeContainer = this.container.querySelector('#threat-globe-container');
        if (globeContainer) {
            globeContainer.style.opacity = '0.5';
            globeContainer.style.filter = 'grayscale(50%)';
        }
    }

    brightenGlobe() {
        const globeContainer = this.container.querySelector('#threat-globe-container');
        if (globeContainer) {
            globeContainer.style.opacity = '1';
            globeContainer.style.filter = 'none';
        }
    }

    applyFilters() {
        // Implement filter logic
        console.log('Applying filters...');
    }

    startRealTimeUpdates() {
        this.updateInterval = setInterval(() => {
            if (this.isActive && !this.isPaused) {
                this.loadThreatData();
            }
        }, 30000); // Update every 30 seconds
    }

    stopRealTimeUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    // Helper methods
    getSeverityColor(severity) {
        const colors = {
            high: '#ef4444',
            critical: '#ef4444',
            medium: '#f59e0b',
            low: '#3b82f6'
        };
        return colors[severity] || colors.low;
    }

    formatTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    getCurrentTime() {
        const now = new Date();
        return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    }
}

// Export for use in screen controller
if (typeof window !== 'undefined') {
    window.ThreatGlobeScreen = ThreatGlobeScreen;
}
