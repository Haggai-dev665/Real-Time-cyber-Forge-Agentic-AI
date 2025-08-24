/**
 * Enhanced Dashboard JavaScript
 * Real-time analytics, charts, animations, and browser monitoring
 */

class EnhancedDashboard {
    constructor() {
        this.electronAPI = window.electronAPI;
        this.charts = {};
        this.realTimeIntervals = [];
        this.browserConnections = new Map();
        this.webActivityBuffer = [];
        this.threatMap = null;
        this.feedPaused = false;
        this.lastUpdateTime = Date.now();
        
        // Data storage
        this.metrics = {
            threatsBlocked: 0,
            websitesAnalyzed: 0,
            networkEvents: 0,
            aiPredictions: 0
        };
        
        this.trends = {
            threats: [],
            websites: [],
            network: [],
            ai: []
        };
        
        this.init();
    }

    async init() {
        try {
            this.showLoading();
            await this.setupEventListeners();
            await this.initializeCharts();
            await this.initializeMap();
            await this.checkServices();
            await this.loadBrowsers();
            await this.startRealTimeUpdates();
            this.hideLoading();
            
            console.log('✅ Enhanced Dashboard initialized successfully');
        } catch (error) {
            console.error('❌ Dashboard initialization failed:', error);
            this.hideLoading();
        }
    }

    showLoading() {
        document.getElementById('loadingOverlay').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loadingOverlay').style.display = 'none';
    }

    setupEventListeners() {
        // Browser management
        document.getElementById('addBrowserBtn').addEventListener('click', () => {
            this.showBrowserModal();
        });

        document.getElementById('closeBrowserModal').addEventListener('click', () => {
            this.hideBrowserModal();
        });

        document.getElementById('confirmBrowserBtn').addEventListener('click', () => {
            this.startBrowserMonitoring();
        });

        document.getElementById('cancelBrowserBtn').addEventListener('click', () => {
            this.hideBrowserModal();
        });

        // Feed controls
        document.getElementById('pauseFeedBtn').addEventListener('click', () => {
            this.toggleFeed();
        });

        document.getElementById('clearFeedBtn').addEventListener('click', () => {
            this.clearThreatFeed();
        });

        // Time range selector
        document.getElementById('timeRange').addEventListener('change', (e) => {
            this.updateChartsTimeRange(e.target.value);
        });

        // Window controls
        document.getElementById('minimizeBtn').addEventListener('click', () => {
            this.electronAPI?.minimizeWindow();
        });

        document.getElementById('maximizeBtn').addEventListener('click', () => {
            this.electronAPI?.maximizeWindow();
        });

        document.getElementById('closeBtn').addEventListener('click', () => {
            this.electronAPI?.closeWindow();
        });
    }

    async initializeCharts() {
        // Initialize mini trend charts
        this.initializeMiniCharts();
        
        // Initialize main security chart
        this.initializeMainSecurityChart();
        
        // Initialize threat distribution chart
        this.initializeThreatDistributionChart();
        
        // Initialize browser activity heatmap
        this.initializeBrowserActivityChart();
    }

    initializeMiniCharts() {
        const chartConfigs = [
            { id: 'threatsTrendChart', color: '#ff4757', data: this.trends.threats },
            { id: 'websitesTrendChart', color: '#00f5ff', data: this.trends.websites },
            { id: 'networkTrendChart', color: '#ffa502', data: this.trends.network },
            { id: 'aiTrendChart', color: '#00ff88', data: this.trends.ai }
        ];

        chartConfigs.forEach(config => {
            const ctx = document.getElementById(config.id).getContext('2d');
            this.charts[config.id] = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: Array.from({length: 20}, (_, i) => ''),
                    datasets: [{
                        data: config.data.length ? config.data.slice(-20) : Array(20).fill(0),
                        borderColor: config.color,
                        backgroundColor: config.color + '20',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { display: false },
                        y: { display: false }
                    },
                    animation: {
                        duration: 750,
                        easing: 'easeInOutQuart'
                    }
                }
            });
        });
    }

    initializeMainSecurityChart() {
        const ctx = document.getElementById('mainSecurityChart').getContext('2d');
        
        this.charts.mainSecurity = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.generateTimeLabels(24),
                datasets: [
                    {
                        label: 'Threats Detected',
                        data: this.generateMockData(24, 0, 50),
                        borderColor: '#ff4757',
                        backgroundColor: 'rgba(255, 71, 87, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Websites Analyzed',
                        data: this.generateMockData(24, 20, 100),
                        borderColor: '#00f5ff',
                        backgroundColor: 'rgba(0, 245, 255, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Network Events',
                        data: this.generateMockData(24, 5, 80),
                        borderColor: '#ffa502',
                        backgroundColor: 'rgba(255, 165, 2, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#ffffff',
                            usePointStyle: true,
                            padding: 20
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        },
                        ticks: { color: '#ffffff' }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        },
                        ticks: { color: '#ffffff' }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeInOutQuart'
                }
            }
        });
    }

    initializeThreatDistributionChart() {
        const ctx = document.getElementById('threatDistributionChart').getContext('2d');
        
        this.charts.threatDistribution = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Malware', 'Phishing', 'Suspicious Scripts', 'Data Leaks', 'Network Intrusions'],
                datasets: [{
                    data: [30, 25, 20, 15, 10],
                    backgroundColor: [
                        '#ff4757',
                        '#ff6b7a',
                        '#ffa502',
                        '#ff7675',
                        '#fdcb6e'
                    ],
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#ffffff',
                            padding: 15,
                            usePointStyle: true
                        }
                    }
                },
                animation: {
                    animateRotate: true,
                    duration: 1500
                }
            }
        });
    }

    initializeBrowserActivityChart() {
        const ctx = document.getElementById('browserActivityChart').getContext('2d');
        
        // Generate heatmap-like data
        const hours = Array.from({length: 24}, (_, i) => i);
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const heatmapData = [];
        
        days.forEach((day, dayIndex) => {
            hours.forEach((hour, hourIndex) => {
                heatmapData.push({
                    x: hour,
                    y: dayIndex,
                    v: Math.random() * 100
                });
            });
        });
        
        this.charts.browserActivity = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Activity Level',
                    data: heatmapData,
                    backgroundColor: function(context) {
                        const value = context.parsed.v;
                        const alpha = value / 100;
                        return `rgba(0, 245, 255, ${alpha})`;
                    },
                    pointRadius: function(context) {
                        return (context.parsed.v / 100) * 8 + 2;
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        min: 0,
                        max: 23,
                        ticks: {
                            stepSize: 1,
                            color: '#ffffff',
                            callback: function(value) {
                                return value + ':00';
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        },
                        title: {
                            display: true,
                            text: 'Hour of Day',
                            color: '#ffffff'
                        }
                    },
                    y: {
                        type: 'linear',
                        min: 0,
                        max: 6,
                        ticks: {
                            stepSize: 1,
                            color: '#ffffff',
                            callback: function(value) {
                                return days[value] || '';
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        },
                        title: {
                            display: true,
                            text: 'Day of Week',
                            color: '#ffffff'
                        }
                    }
                }
            }
        });
    }

    async initializeMap() {
        const mapContainer = document.getElementById('threatMap');
        
        this.threatMap = L.map(mapContainer, {
            center: [39.8283, -98.5795], // Center of US
            zoom: 4,
            zoomControl: false,
            attributionControl: false
        });

        // Dark theme tile layer
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(this.threatMap);

        // Add some sample threat markers
        this.addThreatMarkers();

        // Add zoom control in bottom right
        L.control.zoom({
            position: 'bottomright'
        }).addTo(this.threatMap);
    }

    addThreatMarkers() {
        const threatLocations = [
            { lat: 40.7128, lng: -74.0060, severity: 'high', type: 'Malware Attack' },
            { lat: 34.0522, lng: -118.2437, severity: 'medium', type: 'Phishing Attempt' },
            { lat: 41.8781, lng: -87.6298, severity: 'low', type: 'Suspicious Activity' },
            { lat: 29.7604, lng: -95.3698, severity: 'high', type: 'Data Breach' },
            { lat: 47.6062, lng: -122.3321, severity: 'medium', type: 'Network Intrusion' }
        ];

        threatLocations.forEach(threat => {
            const color = threat.severity === 'high' ? '#ff4757' : 
                         threat.severity === 'medium' ? '#ffa502' : '#00ff88';
            
            const marker = L.circleMarker([threat.lat, threat.lng], {
                radius: threat.severity === 'high' ? 12 : threat.severity === 'medium' ? 8 : 6,
                fillColor: color,
                color: color,
                weight: 2,
                opacity: 0.8,
                fillOpacity: 0.6
            }).addTo(this.threatMap);

            marker.bindPopup(`
                <div style="color: #333; font-size: 12px;">
                    <strong>${threat.type}</strong><br>
                    Severity: ${threat.severity.toUpperCase()}<br>
                    Location: ${threat.lat.toFixed(4)}, ${threat.lng.toFixed(4)}
                </div>
            `);

            // Add pulsing animation for high severity
            if (threat.severity === 'high') {
                marker.setStyle({
                    className: 'pulse-marker'
                });
            }
        });
    }

    async checkServices() {
        try {
            // Check backend
            const backendStatus = await this.electronAPI.healthCheck();
            this.updateServiceStatus('backendStatus', backendStatus.success);

            // Check ML services
            const mlStatus = await this.electronAPI.mlService.healthCheck();
            this.updateServiceStatus('mlStatus', mlStatus.success);

            // Check browser monitoring (placeholder)
            this.updateServiceStatus('browserStatus', this.browserConnections.size > 0);
        } catch (error) {
            console.error('Service check failed:', error);
        }
    }

    updateServiceStatus(elementId, isOnline) {
        const element = document.getElementById(elementId);
        const dot = element.querySelector('.status-dot');
        
        if (isOnline) {
            dot.className = 'status-dot online';
        } else {
            dot.className = 'status-dot offline';
        }
    }

    async loadBrowsers() {
        try {
            const browsers = await this.electronAPI.getBrowserList();
            this.populateAvailableBrowsers(browsers);
        } catch (error) {
            console.error('Failed to load browsers:', error);
        }
    }

    populateAvailableBrowsers(browsers) {
        const container = document.getElementById('availableBrowsers');
        container.innerHTML = '';

        browsers.forEach(browser => {
            const browserOption = document.createElement('div');
            browserOption.className = 'browser-option';
            browserOption.innerHTML = `
                <input type="checkbox" id="browser-${browser.name}" value="${browser.name}">
                <div class="browser-option-icon">
                    <i class="fab fa-${browser.name.toLowerCase()}"></i>
                </div>
                <div class="browser-option-info">
                    <h4>${browser.displayName}</h4>
                    <p>${browser.path}</p>
                </div>
            `;

            browserOption.addEventListener('click', () => {
                const checkbox = browserOption.querySelector('input');
                checkbox.checked = !checkbox.checked;
                browserOption.classList.toggle('selected', checkbox.checked);
            });

            container.appendChild(browserOption);
        });
    }

    showBrowserModal() {
        document.getElementById('browserModal').classList.add('active');
    }

    hideBrowserModal() {
        document.getElementById('browserModal').classList.remove('active');
    }

    async startBrowserMonitoring() {
        const selectedBrowsers = Array.from(document.querySelectorAll('#availableBrowsers input:checked'))
            .map(input => input.value);

        if (selectedBrowsers.length === 0) {
            alert('Please select at least one browser to monitor.');
            return;
        }

        try {
            const result = await this.electronAPI.selectBrowsers(selectedBrowsers);
            
            if (result.success) {
                this.hideBrowserModal();
                this.updateBrowserGrid(result.browsers);
                this.updateServiceStatus('browserStatus', true);
                this.startWebActivityMonitoring();
                
                // Show success notification
                this.showNotification('Browser monitoring started successfully!', 'success');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Failed to start browser monitoring:', error);
            this.showNotification('Failed to start browser monitoring', 'error');
        }
    }

    updateBrowserGrid(browsers) {
        const grid = document.getElementById('browserGrid');
        grid.innerHTML = '';

        browsers.forEach(browser => {
            const browserCard = document.createElement('div');
            browserCard.className = 'browser-card active';
            browserCard.innerHTML = `
                <div class="browser-info">
                    <div class="browser-icon">
                        <i class="fab fa-${browser.name?.toLowerCase() || 'globe'}"></i>
                    </div>
                    <div class="browser-details">
                        <h3>${browser.displayName || browser.name}</h3>
                        <p>Monitoring Active</p>
                    </div>
                </div>
                <div class="browser-stats">
                    <div class="stat-item">
                        <span class="stat-value" id="pages-${browser.name}">0</span>
                        <span class="stat-label">Pages</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value" id="threats-${browser.name}">0</span>
                        <span class="stat-label">Threats</span>
                    </div>
                </div>
            `;

            grid.appendChild(browserCard);
            
            // Store browser connection
            this.browserConnections.set(browser.name, {
                ...browser,
                pagesAnalyzed: 0,
                threatsDetected: 0
            });
        });
    }

    startWebActivityMonitoring() {
        // Simulate real-time web activity
        const activityInterval = setInterval(() => {
            this.simulateWebActivity();
        }, 2000 + Math.random() * 3000); // Random interval 2-5 seconds

        this.realTimeIntervals.push(activityInterval);
    }

    simulateWebActivity() {
        const activities = [
            { type: 'visit', title: 'Page Visit', details: 'https://example.com', icon: 'fas fa-globe' },
            { type: 'analysis', title: 'Content Analysis', details: 'Scanning for threats...', icon: 'fas fa-search' },
            { type: 'threat', title: 'Threat Detected', details: 'Suspicious script blocked', icon: 'fas fa-shield-alt' }
        ];

        const activity = activities[Math.floor(Math.random() * activities.length)];
        activity.timestamp = Date.now();
        
        this.webActivityBuffer.push(activity);
        this.displayWebActivity(activity);

        // Update metrics
        if (activity.type === 'visit') {
            this.metrics.websitesAnalyzed++;
        } else if (activity.type === 'threat') {
            this.metrics.threatsBlocked++;
        }

        // Simulate analysis results
        if (Math.random() < 0.3) { // 30% chance
            setTimeout(() => {
                this.displayAnalysisResult();
            }, 1000 + Math.random() * 3000);
        }
    }

    displayWebActivity(activity) {
        const feed = document.getElementById('webActivityFeed');
        const activityElement = document.createElement('div');
        activityElement.className = 'activity-item';
        activityElement.innerHTML = `
            <div class="activity-icon ${activity.type}">
                <i class="${activity.icon}"></i>
            </div>
            <div class="activity-content">
                <h4 class="activity-title">${activity.title}</h4>
                <p class="activity-details">${activity.details}</p>
            </div>
            <div class="activity-time">
                ${this.formatTime(activity.timestamp)}
            </div>
        `;

        feed.insertBefore(activityElement, feed.firstChild);

        // Remove old activities (keep last 20)
        while (feed.children.length > 20) {
            feed.removeChild(feed.lastChild);
        }
    }

    displayAnalysisResult() {
        const results = [
            { type: 'safe', title: 'Clean Website', description: 'No threats detected', score: 'SAFE' },
            { type: 'warning', title: 'Suspicious Content', description: 'Potential tracking scripts found', score: 'WARNING' },
            { type: 'danger', title: 'Malicious Code', description: 'Harmful script blocked', score: 'DANGER' }
        ];

        const result = results[Math.floor(Math.random() * results.length)];
        const container = document.getElementById('analysisResults');
        
        const resultElement = document.createElement('div');
        resultElement.className = `analysis-item ${result.type}`;
        resultElement.innerHTML = `
            <div class="analysis-header">
                <h4 class="analysis-title">${result.title}</h4>
                <span class="analysis-score ${result.type}">${result.score}</span>
            </div>
            <p class="analysis-description">${result.description}</p>
        `;

        container.insertBefore(resultElement, container.firstChild);

        // Remove old results (keep last 10)
        while (container.children.length > 10) {
            container.removeChild(container.lastChild);
        }
    }

    startRealTimeUpdates() {
        // Update metrics every 5 seconds
        const metricsInterval = setInterval(() => {
            this.updateMetrics();
        }, 5000);

        // Update charts every 10 seconds
        const chartsInterval = setInterval(() => {
            this.updateCharts();
        }, 10000);

        // Generate threat alerts every 15-30 seconds
        const threatInterval = setInterval(() => {
            if (!this.feedPaused && Math.random() < 0.7) {
                this.generateThreatAlert();
            }
        }, 15000 + Math.random() * 15000);

        this.realTimeIntervals.push(metricsInterval, chartsInterval, threatInterval);
    }

    updateMetrics() {
        // Simulate metric changes
        this.metrics.networkEvents += Math.floor(Math.random() * 5);
        this.metrics.aiPredictions += Math.floor(Math.random() * 3);

        // Update metric displays
        this.animateMetricUpdate('threatsBlocked', this.metrics.threatsBlocked);
        this.animateMetricUpdate('websitesAnalyzed', this.metrics.websitesAnalyzed);
        this.animateMetricUpdate('networkEvents', this.metrics.networkEvents);
        this.animateMetricUpdate('aiPredictions', this.metrics.aiPredictions);

        // Update trend data
        this.trends.threats.push(this.metrics.threatsBlocked);
        this.trends.websites.push(this.metrics.websitesAnalyzed);
        this.trends.network.push(this.metrics.networkEvents);
        this.trends.ai.push(this.metrics.aiPredictions);

        // Keep only last 50 data points
        Object.keys(this.trends).forEach(key => {
            if (this.trends[key].length > 50) {
                this.trends[key] = this.trends[key].slice(-50);
            }
        });
    }

    animateMetricUpdate(elementId, newValue) {
        const element = document.getElementById(elementId);
        const currentValue = parseInt(element.textContent) || 0;
        
        if (newValue > currentValue) {
            const change = document.getElementById(elementId.replace(/([A-Z])/g, s => s.toLowerCase()) + 'Change');
            if (change) {
                const percentage = ((newValue - currentValue) / Math.max(currentValue, 1) * 100).toFixed(1);
                change.textContent = `+${percentage}%`;
                change.className = 'metric-change positive';
            }
        }

        // Animate counter
        this.animateCounter(element, currentValue, newValue, 1000);
    }

    animateCounter(element, start, end, duration) {
        const range = end - start;
        const increment = range / (duration / 16);
        let current = start;

        const timer = setInterval(() => {
            current += increment;
            element.textContent = Math.floor(current);
            
            if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
                element.textContent = end;
                clearInterval(timer);
            }
        }, 16);
    }

    updateCharts() {
        // Update mini charts
        Object.keys(this.trends).forEach((key, index) => {
            const chartIds = ['threatsTrendChart', 'websitesTrendChart', 'networkTrendChart', 'aiTrendChart'];
            const chartId = chartIds[index];
            
            if (this.charts[chartId] && this.trends[key].length > 0) {
                this.charts[chartId].data.datasets[0].data = this.trends[key].slice(-20);
                this.charts[chartId].update('none');
            }
        });

        // Update main security chart with new data
        if (this.charts.mainSecurity) {
            const datasets = this.charts.mainSecurity.data.datasets;
            datasets[0].data = this.generateRecentData('threats');
            datasets[1].data = this.generateRecentData('websites');
            datasets[2].data = this.generateRecentData('network');
            this.charts.mainSecurity.update('none');
        }
    }

    generateRecentData(type) {
        const trendKey = type === 'threats' ? 'threats' : 
                        type === 'websites' ? 'websites' : 'network';
        const data = this.trends[trendKey];
        
        if (data.length < 24) {
            // Fill with simulated historical data
            return this.generateMockData(24, 0, 100);
        }
        
        return data.slice(-24);
    }

    generateThreatAlert() {
        const threats = [
            {
                type: 'Malware Detection',
                description: 'Suspicious executable blocked from download',
                severity: 'high',
                source: 'Web Filter'
            },
            {
                type: 'Phishing Attempt',
                description: 'Fake login page detected and blocked',
                severity: 'medium',
                source: 'Browser Monitor'
            },
            {
                type: 'Network Intrusion',
                description: 'Unusual network traffic pattern detected',
                severity: 'medium',
                source: 'Network Monitor'
            },
            {
                type: 'Data Exfiltration',
                description: 'Potential data leak attempt blocked',
                severity: 'low',
                source: 'AI Engine'
            },
            {
                type: 'Suspicious Script',
                description: 'Obfuscated JavaScript detected',
                severity: 'medium',
                source: 'Content Analysis'
            }
        ];

        const threat = threats[Math.floor(Math.random() * threats.length)];
        threat.timestamp = Date.now();
        
        this.displayThreatAlert(threat);
        
        if (threat.severity === 'high') {
            this.metrics.threatsBlocked++;
        }
    }

    displayThreatAlert(threat) {
        const feed = document.getElementById('threatFeed');
        const threatElement = document.createElement('div');
        threatElement.className = `threat-item ${threat.severity}`;
        threatElement.innerHTML = `
            <div class="threat-icon">
                <i class="fas fa-shield-alt"></i>
            </div>
            <div class="threat-content">
                <h4 class="threat-title">${threat.type}</h4>
                <p class="threat-description">${threat.description}</p>
                <div class="threat-meta">
                    <span class="threat-time">${this.formatTime(threat.timestamp)}</span>
                    <span class="threat-source">${threat.source}</span>
                </div>
            </div>
        `;

        feed.insertBefore(threatElement, feed.firstChild);

        // Remove old threats (keep last 15)
        while (feed.children.length > 15) {
            feed.removeChild(feed.lastChild);
        }

        // Show notification for high severity threats
        if (threat.severity === 'high') {
            this.showNotification(`High Priority: ${threat.type}`, 'warning');
        }
    }

    toggleFeed() {
        this.feedPaused = !this.feedPaused;
        const button = document.getElementById('pauseFeedBtn');
        const icon = button.querySelector('i');
        
        if (this.feedPaused) {
            button.innerHTML = '<i class="fas fa-play"></i> Resume Feed';
            icon.className = 'fas fa-play';
        } else {
            button.innerHTML = '<i class="fas fa-pause"></i> Pause Feed';
            icon.className = 'fas fa-pause';
        }
    }

    clearThreatFeed() {
        document.getElementById('threatFeed').innerHTML = '';
        this.showNotification('Threat feed cleared', 'info');
    }

    updateChartsTimeRange(range) {
        const hours = range === '1h' ? 1 : range === '6h' ? 6 : range === '24h' ? 24 : 168;
        
        if (this.charts.mainSecurity) {
            this.charts.mainSecurity.data.labels = this.generateTimeLabels(hours);
            this.charts.mainSecurity.data.datasets.forEach(dataset => {
                dataset.data = this.generateMockData(hours, 0, 100);
            });
            this.charts.mainSecurity.update();
        }
    }

    generateTimeLabels(hours) {
        const labels = [];
        const now = new Date();
        
        for (let i = hours; i >= 0; i--) {
            const time = new Date(now.getTime() - i * 60 * 60 * 1000);
            labels.push(time.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit' 
            }));
        }
        
        return labels;
    }

    generateMockData(length, min, max) {
        return Array.from({length}, () => 
            Math.floor(Math.random() * (max - min + 1)) + min
        );
    }

    formatTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : 
                                   type === 'warning' ? 'exclamation-triangle' : 
                                   type === 'error' ? 'times-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;

        // Add to page
        document.body.appendChild(notification);

        // Show notification
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        // Hide and remove notification
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    destroy() {
        // Clear all intervals
        this.realTimeIntervals.forEach(interval => {
            clearInterval(interval);
        });
        
        // Destroy charts
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        
        // Clear browser connections
        this.browserConnections.clear();
        
        console.log('✅ Enhanced Dashboard destroyed');
    }
}

// Notification styles
const notificationStyles = `
.notification {
    position: fixed;
    top: 80px;
    right: 20px;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 1rem 1.5rem;
    backdrop-filter: blur(10px);
    color: #ffffff;
    font-size: 0.9rem;
    font-weight: 500;
    opacity: 0;
    transform: translateX(100%);
    transition: all 0.3s ease;
    z-index: 10000;
    min-width: 300px;
    max-width: 400px;
}

.notification.show {
    opacity: 1;
    transform: translateX(0);
}

.notification.success {
    border-left: 4px solid #00ff88;
}

.notification.warning {
    border-left: 4px solid #ffa502;
}

.notification.error {
    border-left: 4px solid #ff4757;
}

.notification.info {
    border-left: 4px solid #00f5ff;
}

.notification-content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.notification-content i {
    font-size: 1.1rem;
}

.notification.success .notification-content i {
    color: #00ff88;
}

.notification.warning .notification-content i {
    color: #ffa502;
}

.notification.error .notification-content i {
    color: #ff4757;
}

.notification.info .notification-content i {
    color: #00f5ff;
}
`;

// Add notification styles to head
const style = document.createElement('style');
style.textContent = notificationStyles;
document.head.appendChild(style);

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.enhancedDashboard = new EnhancedDashboard();
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.enhancedDashboard) {
        window.enhancedDashboard.destroy();
    }
});
