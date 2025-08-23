/**
 * Advanced ML Dashboard Screen
 * Real-time machine learning analytics and model management
 */

class MLDashboardScreen {
    constructor(uiInstance) {
        this.ui = uiInstance;
        this.charts = {};
        this.models = {};
        this.isInitialized = false;
        this.updateInterval = null;
    }

    async initialize() {
        if (this.isInitialized) return;
        
        console.log('🤖 Initializing ML Dashboard...');
        
        // Create ML dashboard HTML
        this.createMLDashboardHTML();
        
        // Initialize charts
        await this.initializeCharts();
        
        // Load models
        await this.loadAvailableModels();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Start real-time updates
        this.startRealTimeUpdates();
        
        this.isInitialized = true;
        console.log('✅ ML Dashboard initialized');
    }

    createMLDashboardHTML() {
        const container = document.getElementById('ml-dashboard');
        if (!container) return;

        container.innerHTML = `
            <div class="ml-dashboard-container">
                <!-- ML Header -->
                <div class="ml-header animated fadeInDown">
                    <div class="ml-title">
                        <h2><i class="fas fa-brain"></i> Machine Learning Dashboard</h2>
                        <p>Real-time AI model performance and insights</p>
                    </div>
                    <div class="ml-actions">
                        <button class="btn btn-primary" id="train-new-model">
                            <i class="fas fa-plus"></i> Train New Model
                        </button>
                        <button class="btn btn-secondary" id="refresh-models">
                            <i class="fas fa-sync-alt"></i> Refresh
                        </button>
                    </div>
                </div>

                <!-- ML Stats Grid -->
                <div class="ml-stats-grid animated fadeInUp">
                    <div class="ml-stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-robot"></i>
                        </div>
                        <div class="stat-content">
                            <h3 id="active-models-count">0</h3>
                            <p>Active Models</p>
                        </div>
                        <div class="stat-trend">
                            <span class="trend-up">+12%</span>
                        </div>
                    </div>

                    <div class="ml-stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-chart-line"></i>
                        </div>
                        <div class="stat-content">
                            <h3 id="avg-accuracy">0%</h3>
                            <p>Avg Accuracy</p>
                        </div>
                        <div class="stat-trend">
                            <span class="trend-up">+5.2%</span>
                        </div>
                    </div>

                    <div class="ml-stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-clock"></i>
                        </div>
                        <div class="stat-content">
                            <h3 id="inference-time">0ms</h3>
                            <p>Avg Inference</p>
                        </div>
                        <div class="stat-trend">
                            <span class="trend-down">-15%</span>
                        </div>
                    </div>

                    <div class="ml-stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-shield-alt"></i>
                        </div>
                        <div class="stat-content">
                            <h3 id="threats-detected">0</h3>
                            <p>Threats Detected</p>
                        </div>
                        <div class="stat-trend">
                            <span class="trend-up">+8</span>
                        </div>
                    </div>
                </div>

                <!-- Main Content Grid -->
                <div class="ml-content-grid animated fadeInUp delay-1">
                    <!-- Model Performance Chart -->
                    <div class="ml-card">
                        <div class="card-header">
                            <h3><i class="fas fa-chart-area"></i> Model Performance</h3>
                            <div class="card-actions">
                                <select id="performance-timeframe">
                                    <option value="1h">Last Hour</option>
                                    <option value="24h">Last 24 Hours</option>
                                    <option value="7d">Last 7 Days</option>
                                    <option value="30d">Last 30 Days</option>
                                </select>
                            </div>
                        </div>
                        <div class="card-content">
                            <canvas id="performance-chart"></canvas>
                        </div>
                    </div>

                    <!-- Real-time Predictions -->
                    <div class="ml-card">
                        <div class="card-header">
                            <h3><i class="fas fa-eye"></i> Real-time Predictions</h3>
                            <div class="status-indicator active">Live</div>
                        </div>
                        <div class="card-content">
                            <div id="realtime-predictions" class="predictions-container">
                                <!-- Real-time predictions will be populated here -->
                            </div>
                        </div>
                    </div>

                    <!-- Model Training Queue -->
                    <div class="ml-card">
                        <div class="card-header">
                            <h3><i class="fas fa-tasks"></i> Training Queue</h3>
                        </div>
                        <div class="card-content">
                            <div id="training-queue" class="queue-container">
                                <div class="queue-item">
                                    <div class="queue-info">
                                        <span class="queue-name">Malware Detection v2.1</span>
                                        <span class="queue-status training">Training</span>
                                    </div>
                                    <div class="queue-progress">
                                        <div class="progress-bar">
                                            <div class="progress-fill" style="width: 65%"></div>
                                        </div>
                                        <span class="progress-text">65%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Dataset Analytics -->
                    <div class="ml-card wide">
                        <div class="card-header">
                            <h3><i class="fas fa-database"></i> Dataset Analytics</h3>
                            <div class="card-actions">
                                <button class="btn btn-sm" id="download-datasets">
                                    <i class="fas fa-download"></i> Download New
                                </button>
                            </div>
                        </div>
                        <div class="card-content">
                            <div id="dataset-analytics" class="dataset-grid">
                                <!-- Dataset cards will be populated here -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async initializeCharts() {
        // Initialize Chart.js if available
        if (typeof Chart !== 'undefined') {
            const performanceCtx = document.getElementById('performance-chart');
            if (performanceCtx) {
                this.charts.performance = new Chart(performanceCtx, {
                    type: 'line',
                    data: {
                        labels: [],
                        datasets: [{
                            label: 'Accuracy',
                            data: [],
                            borderColor: '#00f5ff',
                            backgroundColor: 'rgba(0, 245, 255, 0.1)',
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                labels: { color: '#ffffff' }
                            }
                        },
                        scales: {
                            x: { ticks: { color: '#ffffff' } },
                            y: { ticks: { color: '#ffffff' } }
                        }
                    }
                });
            }
        }
    }

    async loadAvailableModels() {
        try {
            // Simulate model data
            this.models = {
                'malware_detection': { accuracy: 0.95, type: 'ensemble' },
                'phishing_classifier': { accuracy: 0.92, type: 'neural_network' },
                'network_anomaly': { accuracy: 0.88, type: 'random_forest' }
            };
            
            this.updateModelStats();
            
        } catch (error) {
            console.error('Failed to load models:', error);
        }
    }

    updateModelStats() {
        const activeModels = Object.keys(this.models).length;
        const avgAccuracy = Object.values(this.models).reduce((sum, model) => 
            sum + (model.accuracy || 0), 0) / activeModels || 0;
        
        // Update UI
        const activeModelsElement = document.getElementById('active-models-count');
        const avgAccuracyElement = document.getElementById('avg-accuracy');
        
        if (activeModelsElement) {
            this.animateNumber(activeModelsElement, activeModels);
        }
        
        if (avgAccuracyElement) {
            this.animateNumber(avgAccuracyElement, Math.round(avgAccuracy * 100), '%');
        }
    }

    setupEventListeners() {
        // Train new model button
        const trainBtn = document.getElementById('train-new-model');
        if (trainBtn) {
            trainBtn.addEventListener('click', () => this.showTrainingModal());
        }

        // Refresh models button
        const refreshBtn = document.getElementById('refresh-models');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadAvailableModels());
        }

        // Download datasets
        const downloadBtn = document.getElementById('download-datasets');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadDatasets());
        }
    }

    showTrainingModal() {
        this.ui.showNotification('Info', 'Model training interface coming soon!', 'info');
    }

    async downloadDatasets() {
        try {
            this.ui.showNotification('Info', 'Starting dataset download...', 'info');
            
            // Simulate dataset download
            setTimeout(() => {
                this.ui.showNotification('Success', 'Downloaded 5 cybersecurity datasets', 'success');
                this.updateDatasetAnalytics();
            }, 2000);
            
        } catch (error) {
            console.error('Dataset download error:', error);
            this.ui.showNotification('Error', 'Failed to download datasets', 'error');
        }
    }

    updateDatasetAnalytics() {
        const container = document.getElementById('dataset-analytics');
        if (!container) return;

        const datasets = [
            { name: 'Malware Samples', samples: 50000, features: 25, size_mb: 150, status: 'ready' },
            { name: 'Network Traffic', samples: 100000, features: 15, size_mb: 200, status: 'ready' },
            { name: 'Phishing URLs', samples: 25000, features: 12, size_mb: 75, status: 'processing' }
        ];

        container.innerHTML = '';
        
        datasets.forEach(info => {
            const card = document.createElement('div');
            card.className = 'dataset-card animated fadeInUp';
            card.innerHTML = `
                <div class="dataset-icon">
                    <i class="fas fa-database"></i>
                </div>
                <div class="dataset-info">
                    <h4>${info.name}</h4>
                    <p>${info.samples.toLocaleString()} samples</p>
                    <div class="dataset-stats">
                        <span class="stat">
                            <i class="fas fa-chart-bar"></i>
                            ${info.features} features
                        </span>
                        <span class="stat">
                            <i class="fas fa-weight"></i>
                            ${info.size_mb}MB
                        </span>
                    </div>
                </div>
                <div class="dataset-status">
                    <span class="status-badge ${info.status}">${info.status}</span>
                </div>
            `;
            container.appendChild(card);
        });
    }

    startRealTimeUpdates() {
        // Update real-time predictions
        this.updateInterval = setInterval(() => {
            this.updateRealTimePredictions();
            this.updatePerformanceChart();
        }, 5000);
    }

    updateRealTimePredictions() {
        const container = document.getElementById('realtime-predictions');
        if (!container) return;

        // Simulate real-time predictions
        const predictions = [
            {
                timestamp: new Date(),
                type: 'Malware Detection',
                result: 'Threat Detected',
                confidence: 0.95,
                status: 'danger'
            },
            {
                timestamp: new Date(),
                type: 'Phishing Analysis',
                result: 'Safe',
                confidence: 0.89,
                status: 'success'
            },
            {
                timestamp: new Date(),
                type: 'Network Anomaly',
                result: 'Suspicious',
                confidence: 0.67,
                status: 'warning'
            }
        ];

        // Add new prediction
        const prediction = predictions[Math.floor(Math.random() * predictions.length)];
        const predictionElement = document.createElement('div');
        predictionElement.className = `prediction-item ${prediction.status} animated slideInRight`;
        predictionElement.innerHTML = `
            <div class="prediction-time">${prediction.timestamp.toLocaleTimeString()}</div>
            <div class="prediction-content">
                <span class="prediction-type">${prediction.type}</span>
                <span class="prediction-result">${prediction.result}</span>
            </div>
            <div class="prediction-confidence">
                <div class="confidence-bar">
                    <div class="confidence-fill" style="width: ${prediction.confidence * 100}%"></div>
                </div>
                <span class="confidence-text">${Math.round(prediction.confidence * 100)}%</span>
            </div>
        `;

        container.insertBefore(predictionElement, container.firstChild);

        // Keep only last 10 predictions
        while (container.children.length > 10) {
            container.removeChild(container.lastChild);
        }
    }

    updatePerformanceChart() {
        const chart = this.charts.performance;
        if (!chart) return;

        const now = new Date();
        const timeLabel = now.toLocaleTimeString();

        // Add new data point
        chart.data.labels.push(timeLabel);
        chart.data.datasets[0].data.push(85 + Math.random() * 10); // Accuracy

        // Keep only last 20 data points
        if (chart.data.labels.length > 20) {
            chart.data.labels.shift();
            chart.data.datasets.forEach(dataset => dataset.data.shift());
        }

        chart.update('none');
    }

    animateNumber(element, target, suffix = '') {
        const start = parseInt(element.textContent) || 0;
        const increment = (target - start) / 20;
        let current = start;

        const timer = setInterval(() => {
            current += increment;
            if ((increment > 0 && current >= target) || (increment < 0 && current <= target)) {
                current = target;
                clearInterval(timer);
            }
            element.textContent = Math.round(current) + suffix;
        }, 50);
    }

    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        
        this.isInitialized = false;
    }
}

// Export for global access
window.MLDashboardScreen = MLDashboardScreen;