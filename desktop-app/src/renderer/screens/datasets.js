/**
 * Datasets Screen
 * Dataset management for ML model training
 */

class DatasetsScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.datasets = [];
        this.selectedDataset = null;
    }

    async show(container, options = {}) {
        this.container = container;
        this.isActive = true;
        
        this.container.innerHTML = this.createHTML();
        this.initializeComponents();
        
        // Load datasets from backend
        await this.loadDatasets();
        
        this.container.classList.add('screen-enter');
    }

    hide() {
        this.isActive = false;
    }

    createHTML() {
        return `
            <div class="datasets-screen">
                <div class="datasets-header">
                    <div class="header-info">
                        <h2><i class="fas fa-database"></i> Datasets</h2>
                        <p>Manage training datasets for ML model training</p>
                    </div>
                    <div class="header-actions">
                        <button class="btn btn-secondary" id="refresh-datasets-btn">
                            <i class="fas fa-sync-alt"></i> Refresh
                        </button>
                        <button class="btn btn-primary" id="upload-dataset-btn">
                            <i class="fas fa-upload"></i> Upload Custom
                        </button>
                    </div>
                </div>
                
                <!-- Dataset Stats -->
                <div class="dataset-stats">
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-database"></i></div>
                        <div class="stat-value" id="total-datasets">0</div>
                        <div class="stat-label">Total Datasets</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-check-circle"></i></div>
                        <div class="stat-value" id="available-datasets">0</div>
                        <div class="stat-label">Available</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-file-alt"></i></div>
                        <div class="stat-value" id="total-samples">0</div>
                        <div class="stat-label">Total Samples</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-brain"></i></div>
                        <div class="stat-value" id="trained-models">0</div>
                        <div class="stat-label">Trained Models</div>
                    </div>
                </div>
                
                <!-- Main Content -->
                <div class="datasets-content">
                    <!-- Dataset List -->
                    <div class="dataset-list-section">
                        <h3>Available Datasets</h3>
                        <div class="dataset-grid" id="dataset-grid">
                            <div class="loading-state">
                                <i class="fas fa-spinner fa-spin"></i>
                                <p>Loading datasets...</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Dataset Details Panel -->
                    <div class="dataset-details-section" id="dataset-details">
                        <div class="no-selection">
                            <i class="fas fa-database"></i>
                            <p>Select a dataset to view details</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    initializeComponents() {
        // Refresh button
        const refreshBtn = document.getElementById('refresh-datasets-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadDatasets());
        }
        
        // Upload button
        const uploadBtn = document.getElementById('upload-dataset-btn');
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => this.showUploadDialog());
        }
    }

    async loadDatasets() {
        const grid = document.getElementById('dataset-grid');
        if (!grid) return;
        
        grid.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading datasets...</p>
            </div>
        `;
        
        // Try to load from backend
        if (window.apiClient) {
            try {
                const response = await window.apiClient.getDatasets();
                if (response.success && response.data && response.data.datasets) {
                    this.datasets = response.data.datasets;
                    this.renderDatasets();
                    this.updateStats();
                    return;
                }
            } catch (error) {
                console.error('Failed to load datasets from backend:', error);
            }
        }
        
        // Fallback with mock data
        this.datasets = [
            {
                id: 'malware_detection',
                name: 'Malware Detection Dataset',
                type: 'malware',
                samples: 50000,
                features: 78,
                status: 'available',
                description: 'Comprehensive malware detection dataset with PE file features',
                size: '2.4 GB'
            },
            {
                id: 'network_intrusion',
                name: 'Network Intrusion Detection (NSL-KDD)',
                type: 'network',
                samples: 125973,
                features: 41,
                status: 'available',
                description: 'Network intrusion detection dataset with various attack types',
                size: '850 MB'
            },
            {
                id: 'phishing_detection',
                name: 'Phishing Website Detection',
                type: 'phishing',
                samples: 11055,
                features: 30,
                status: 'available',
                description: 'Phishing website classification dataset',
                size: '125 MB'
            },
            {
                id: 'spam_detection',
                name: 'Spam Email Detection',
                type: 'spam',
                samples: 5572,
                features: 57,
                status: 'available',
                description: 'Email spam classification dataset',
                size: '45 MB'
            },
            {
                id: 'botnet_detection',
                name: 'Botnet Traffic Detection',
                type: 'botnet',
                samples: 72000,
                features: 14,
                status: 'available',
                description: 'Botnet traffic patterns detection',
                size: '320 MB'
            },
            {
                id: 'vulnerability_assessment',
                name: 'Vulnerability Assessment',
                type: 'vulnerability',
                samples: 20000,
                features: 25,
                status: 'available',
                description: 'CVE vulnerability severity prediction',
                size: '180 MB'
            }
        ];
        
        this.renderDatasets();
        this.updateStats();
    }

    renderDatasets() {
        const grid = document.getElementById('dataset-grid');
        if (!grid) return;
        
        if (this.datasets.length === 0) {
            grid.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-database"></i>
                    <p>No datasets available</p>
                </div>
            `;
            return;
        }
        
        grid.innerHTML = this.datasets.map(dataset => `
            <div class="dataset-card ${dataset.status}" data-dataset-id="${dataset.id}">
                <div class="dataset-icon">
                    <i class="fas ${this.getDatasetIcon(dataset.type)}"></i>
                </div>
                <div class="dataset-info">
                    <h4>${dataset.name}</h4>
                    <p>${dataset.description}</p>
                </div>
                <div class="dataset-meta">
                    <div class="meta-item">
                        <span class="meta-label">Samples</span>
                        <span class="meta-value">${this.formatNumber(dataset.samples)}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Features</span>
                        <span class="meta-value">${dataset.features}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Size</span>
                        <span class="meta-value">${dataset.size || 'N/A'}</span>
                    </div>
                </div>
                <div class="dataset-status">
                    <span class="status-badge ${dataset.status}">${dataset.status}</span>
                </div>
                <div class="dataset-actions">
                    <button class="btn btn-sm btn-primary" onclick="datasetsScreen.viewDataset('${dataset.id}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="datasetsScreen.downloadDataset('${dataset.id}')">
                        <i class="fas fa-download"></i> Download
                    </button>
                    <button class="btn btn-sm btn-success" onclick="datasetsScreen.trainWithDataset('${dataset.id}')">
                        <i class="fas fa-play"></i> Train
                    </button>
                </div>
            </div>
        `).join('');
        
        // Add click listeners for selection
        document.querySelectorAll('.dataset-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.dataset-actions')) {
                    this.selectDataset(card.dataset.datasetId);
                }
            });
        });
    }

    updateStats() {
        const totalEl = document.getElementById('total-datasets');
        const availableEl = document.getElementById('available-datasets');
        const samplesEl = document.getElementById('total-samples');
        
        if (totalEl) totalEl.textContent = this.datasets.length;
        if (availableEl) availableEl.textContent = this.datasets.filter(d => d.status === 'available').length;
        if (samplesEl) samplesEl.textContent = this.formatNumber(
            this.datasets.reduce((sum, d) => sum + (d.samples || 0), 0)
        );
    }

    getDatasetIcon(type) {
        const icons = {
            'malware': 'fa-bug',
            'network': 'fa-network-wired',
            'phishing': 'fa-fish',
            'spam': 'fa-envelope',
            'botnet': 'fa-robot',
            'vulnerability': 'fa-shield-alt',
            'anomaly': 'fa-chart-line',
            'dns': 'fa-globe',
            'cryptomining': 'fa-coins'
        };
        return icons[type] || 'fa-database';
    }

    formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    async selectDataset(datasetId) {
        this.selectedDataset = this.datasets.find(d => d.id === datasetId);
        if (!this.selectedDataset) return;
        
        // Highlight selected card
        document.querySelectorAll('.dataset-card').forEach(card => {
            card.classList.toggle('selected', card.dataset.datasetId === datasetId);
        });
        
        // Update details panel
        await this.showDatasetDetails();
    }

    async showDatasetDetails() {
        const panel = document.getElementById('dataset-details');
        if (!panel || !this.selectedDataset) return;
        
        panel.innerHTML = `
            <div class="details-content">
                <div class="details-header">
                    <h3>${this.selectedDataset.name}</h3>
                    <span class="status-badge ${this.selectedDataset.status}">${this.selectedDataset.status}</span>
                </div>
                
                <div class="details-description">
                    <p>${this.selectedDataset.description}</p>
                </div>
                
                <div class="details-specs">
                    <h4>Specifications</h4>
                    <table class="specs-table">
                        <tr><td>Type</td><td>${this.selectedDataset.type}</td></tr>
                        <tr><td>Samples</td><td>${this.formatNumber(this.selectedDataset.samples)}</td></tr>
                        <tr><td>Features</td><td>${this.selectedDataset.features}</td></tr>
                        <tr><td>Size</td><td>${this.selectedDataset.size || 'N/A'}</td></tr>
                    </table>
                </div>
                
                <div class="details-preview">
                    <h4>Sample Data Preview</h4>
                    <div class="preview-loading">
                        <i class="fas fa-spinner fa-spin"></i> Loading preview...
                    </div>
                </div>
                
                <div class="details-actions">
                    <button class="btn btn-primary" onclick="datasetsScreen.trainWithDataset('${this.selectedDataset.id}')">
                        <i class="fas fa-play"></i> Train Model
                    </button>
                    <button class="btn btn-secondary" onclick="datasetsScreen.downloadDataset('${this.selectedDataset.id}')">
                        <i class="fas fa-download"></i> Download
                    </button>
                    <button class="btn btn-secondary" onclick="datasetsScreen.exploreDataset('${this.selectedDataset.id}')">
                        <i class="fas fa-chart-bar"></i> Explore
                    </button>
                </div>
            </div>
        `;
        
        // Load preview data
        await this.loadPreviewData();
    }

    async loadPreviewData() {
        const previewEl = this.container.querySelector('.details-preview');
        if (!previewEl) return;
        
        try {
            let previewData = [];
            
            if (window.apiClient && this.selectedDataset) {
                const response = await window.apiClient.previewDataset(this.selectedDataset.id, 5);
                if (response.success && response.data && response.data.samples) {
                    previewData = response.data.samples;
                }
            }
            
            // Generate mock preview if no data
            if (previewData.length === 0) {
                previewData = this.generateMockPreview();
            }
            
            previewEl.innerHTML = `
                <h4>Sample Data Preview</h4>
                <div class="preview-table-wrapper">
                    <table class="preview-table">
                        <thead>
                            <tr>${Object.keys(previewData[0] || {}).map(k => `<th>${k}</th>`).join('')}</tr>
                        </thead>
                        <tbody>
                            ${previewData.map(row => `
                                <tr>${Object.values(row).map(v => `<td>${v}</td>`).join('')}</tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (error) {
            console.error('Failed to load preview:', error);
            previewEl.innerHTML = `
                <h4>Sample Data Preview</h4>
                <p class="error">Failed to load preview data</p>
            `;
        }
    }

    generateMockPreview() {
        return [
            { id: 1, feature_1: 0.45, feature_2: 0.82, feature_3: 0.31, label: 1 },
            { id: 2, feature_1: 0.23, feature_2: 0.56, feature_3: 0.78, label: 0 },
            { id: 3, feature_1: 0.67, feature_2: 0.34, feature_3: 0.92, label: 1 },
            { id: 4, feature_1: 0.89, feature_2: 0.12, feature_3: 0.45, label: 0 },
            { id: 5, feature_1: 0.34, feature_2: 0.78, feature_3: 0.56, label: 1 }
        ];
    }

    async viewDataset(datasetId) {
        await this.selectDataset(datasetId);
    }

    async downloadDataset(datasetId) {
        if (window.apiClient) {
            try {
                const response = await window.apiClient.downloadDataset(datasetId);
                if (response.success) {
                    window.notificationSystem?.success('Download', `Dataset ${datasetId} download started`);
                    return;
                }
            } catch (error) {
                console.error('Failed to download dataset:', error);
            }
        }
        window.notificationSystem?.info('Download', `Download for ${datasetId} will be available soon`);
    }

    trainWithDataset(datasetId) {
        // Navigate to ML Models screen with dataset pre-selected
        if (window.navigationManager) {
            window.navigationManager.showScreen('ml-models', { datasetId });
        } else {
            window.notificationSystem?.info('Training', `Training with ${datasetId} - Navigate to ML Models screen`);
        }
    }

    exploreDataset(datasetId) {
        window.notificationSystem?.info('Dataset Explorer', 'Dataset exploration feature coming soon!');
    }

    showUploadDialog() {
        window.notificationSystem?.info('Upload', 'Custom dataset upload feature coming soon!');
    }
}

// Create global instance
const datasetsScreen = new DatasetsScreen();
window.DatasetsScreen = DatasetsScreen;
window.datasetsScreen = datasetsScreen;