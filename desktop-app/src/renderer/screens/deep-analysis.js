/**
 * Deep Analysis Screen
 * Advanced security analysis and forensic investigation tools
 */

class DeepAnalysisScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.analysisType = 'file';
        this.currentAnalysis = null;
        this.analysisHistory = [];
    }

    async show(container, options = {}) {
        this.container = container;
        this.isActive = true;
        
        // Create HTML
        this.container.innerHTML = this.createHTML();
        
        // Initialize components
        this.initializeComponents();
        
        // Load analysis history
        await this.loadAnalysisHistory();
        
        // Handle pre-selected analysis type
        if (options.type) {
            this.selectAnalysisType(options.type);
        }
        
        // Add entrance animation
        this.container.classList.add('screen-enter');
    }

    hide() {
        this.isActive = false;
    }

    createHTML() {
        return `
            <div class="deep-analysis-screen">
                <!-- Header -->
                <div class="analysis-header">
                    <div class="header-info">
                        <h2><i class="fas fa-microscope"></i> Deep Analysis</h2>
                        <p>Advanced security analysis and forensic investigation</p>
                    </div>
                    <div class="header-controls">
                        <button class="btn btn-primary" id="new-analysis-btn">
                            <i class="fas fa-plus"></i> New Analysis
                        </button>
                    </div>
                </div>

                <!-- Analysis Type Selector -->
                <div class="analysis-types">
                    <button class="analysis-type-btn active" data-type="file">
                        <i class="fas fa-file-alt"></i>
                        <span>File Analysis</span>
                    </button>
                    <button class="analysis-type-btn" data-type="url">
                        <i class="fas fa-link"></i>
                        <span>URL Analysis</span>
                    </button>
                    <button class="analysis-type-btn" data-type="network">
                        <i class="fas fa-network-wired"></i>
                        <span>Network Analysis</span>
                    </button>
                    <button class="analysis-type-btn" data-type="memory">
                        <i class="fas fa-memory"></i>
                        <span>Memory Analysis</span>
                    </button>
                    <button class="analysis-type-btn" data-type="behavioral">
                        <i class="fas fa-user-secret"></i>
                        <span>Behavioral Analysis</span>
                    </button>
                </div>

                <!-- Main Content -->
                <div class="analysis-content">
                    <!-- Analysis Input Panel -->
                    <div class="analysis-input-panel" id="input-panel">
                        ${this.createInputPanelHTML('file')}
                    </div>

                    <!-- Analysis Results Panel -->
                    <div class="analysis-results-panel" id="results-panel">
                        <div class="results-header">
                            <h3>Analysis Results</h3>
                            <div class="results-controls">
                                <button class="btn btn-secondary btn-sm" id="export-results">
                                    <i class="fas fa-download"></i> Export
                                </button>
                                <button class="btn btn-secondary btn-sm" id="share-results">
                                    <i class="fas fa-share"></i> Share
                                </button>
                            </div>
                        </div>
                        <div class="results-content" id="results-content">
                            <div class="no-analysis">
                                <i class="fas fa-search"></i>
                                <p>Start an analysis to see results here</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Analysis History -->
                <div class="analysis-history">
                    <h3>Recent Analyses</h3>
                    <div class="history-list" id="history-list">
                        <!-- History items will be populated here -->
                    </div>
                </div>
            </div>
        `;
    }

    createInputPanelHTML(type) {
        switch (type) {
            case 'file':
                return `
                    <div class="input-section">
                        <h3>File Analysis</h3>
                        <div class="file-drop-zone" id="file-drop-zone">
                            <div class="drop-zone-content">
                                <i class="fas fa-cloud-upload-alt"></i>
                                <p>Drop file here or click to browse</p>
                                <input type="file" id="file-input" multiple accept="*/*" style="display: none;">
                                <button class="btn btn-primary" onclick="document.getElementById('file-input').click()">
                                    Browse Files
                                </button>
                            </div>
                        </div>
                        <div class="analysis-options">
                            <h4>Analysis Options</h4>
                            <label><input type="checkbox" checked> Static Analysis</label>
                            <label><input type="checkbox" checked> Dynamic Analysis</label>
                            <label><input type="checkbox"> Sandbox Execution</label>
                            <label><input type="checkbox"> Signature Matching</label>
                        </div>
                        <button class="btn btn-success" id="start-analysis">
                            <i class="fas fa-play"></i> Start Analysis
                        </button>
                    </div>
                `;
            case 'url':
                return `
                    <div class="input-section">
                        <h3>URL Analysis</h3>
                        <div class="url-input-group">
                            <input type="url" id="url-input" placeholder="Enter URL to analyze..." class="form-control">
                            <button class="btn btn-secondary" id="url-scan-btn">
                                <i class="fas fa-search"></i> Scan
                            </button>
                        </div>
                        <div class="analysis-options">
                            <h4>Analysis Options</h4>
                            <label><input type="checkbox" checked> Reputation Check</label>
                            <label><input type="checkbox" checked> Content Analysis</label>
                            <label><input type="checkbox"> Screenshot Capture</label>
                            <label><input type="checkbox"> SSL Certificate Check</label>
                        </div>
                        <button class="btn btn-success" id="start-analysis">
                            <i class="fas fa-play"></i> Start Analysis
                        </button>
                    </div>
                `;
            case 'network':
                return `
                    <div class="input-section">
                        <h3>Network Analysis</h3>
                        <div class="network-options">
                            <div class="input-group">
                                <label>Target IP/Range:</label>
                                <input type="text" id="network-target" placeholder="192.168.1.0/24" class="form-control">
                            </div>
                            <div class="input-group">
                                <label>Analysis Type:</label>
                                <select id="network-type" class="form-control">
                                    <option value="port-scan">Port Scan</option>
                                    <option value="traffic-analysis">Traffic Analysis</option>
                                    <option value="vulnerability-scan">Vulnerability Scan</option>
                                    <option value="packet-capture">Packet Capture</option>
                                </select>
                            </div>
                        </div>
                        <button class="btn btn-success" id="start-analysis">
                            <i class="fas fa-play"></i> Start Analysis
                        </button>
                    </div>
                `;
            case 'memory':
                return `
                    <div class="input-section">
                        <h3>Memory Analysis</h3>
                        <div class="memory-input">
                            <div class="input-group">
                                <label>Memory Dump:</label>
                                <input type="file" id="memory-file" accept=".mem,.raw,.vmem" class="form-control">
                            </div>
                            <div class="input-group">
                                <label>OS Profile:</label>
                                <select id="os-profile" class="form-control">
                                    <option value="win10">Windows 10</option>
                                    <option value="win7">Windows 7</option>
                                    <option value="linux">Linux</option>
                                    <option value="macos">macOS</option>
                                </select>
                            </div>
                        </div>
                        <div class="analysis-options">
                            <h4>Analysis Modules</h4>
                            <label><input type="checkbox" checked> Process List</label>
                            <label><input type="checkbox" checked> Network Connections</label>
                            <label><input type="checkbox"> Registry Keys</label>
                            <label><input type="checkbox"> Malware Signatures</label>
                        </div>
                        <button class="btn btn-success" id="start-analysis">
                            <i class="fas fa-play"></i> Start Analysis
                        </button>
                    </div>
                `;
            case 'behavioral':
                return `
                    <div class="input-section">
                        <h3>Behavioral Analysis</h3>
                        <div class="behavioral-input">
                            <div class="input-group">
                                <label>Sample File:</label>
                                <input type="file" id="sample-file" class="form-control">
                            </div>
                            <div class="input-group">
                                <label>Sandbox Environment:</label>
                                <select id="sandbox-env" class="form-control">
                                    <option value="windows">Windows Sandbox</option>
                                    <option value="linux">Linux Container</option>
                                    <option value="isolated">Isolated VM</option>
                                </select>
                            </div>
                            <div class="input-group">
                                <label>Analysis Duration:</label>
                                <select id="analysis-duration" class="form-control">
                                    <option value="30">30 seconds</option>
                                    <option value="60">1 minute</option>
                                    <option value="300">5 minutes</option>
                                    <option value="600">10 minutes</option>
                                </select>
                            </div>
                        </div>
                        <button class="btn btn-success" id="start-analysis">
                            <i class="fas fa-play"></i> Start Analysis
                        </button>
                    </div>
                `;
            default:
                return '<div class="input-section"><p>Select an analysis type</p></div>';
        }
    }

    initializeComponents() {
        this.setupEventListeners();
        this.setupFileDropZone();
    }

    setupEventListeners() {
        // Analysis type buttons
        document.querySelectorAll('.analysis-type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.currentTarget.dataset.type;
                this.selectAnalysisType(type);
            });
        });

        // Start analysis button
        document.addEventListener('click', (e) => {
            if (e.target.id === 'start-analysis' || e.target.closest('#start-analysis')) {
                this.startAnalysis();
            }
        });

        // Export and share buttons
        const exportBtn = document.getElementById('export-results');
        const shareBtn = document.getElementById('share-results');
        
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportResults());
        }
        
        if (shareBtn) {
            shareBtn.addEventListener('click', () => this.shareResults());
        }

        // New analysis button
        const newAnalysisBtn = document.getElementById('new-analysis-btn');
        if (newAnalysisBtn) {
            newAnalysisBtn.addEventListener('click', () => this.newAnalysis());
        }
    }

    setupFileDropZone() {
        const dropZone = document.getElementById('file-drop-zone');
        const fileInput = document.getElementById('file-input');
        
        if (dropZone && fileInput) {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('drag-over');
            });

            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('drag-over');
            });

            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('drag-over');
                const files = e.dataTransfer.files;
                this.handleFiles(files);
            });

            fileInput.addEventListener('change', (e) => {
                this.handleFiles(e.target.files);
            });
        }
    }

    selectAnalysisType(type) {
        this.analysisType = type;
        
        // Update active button
        document.querySelectorAll('.analysis-type-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-type="${type}"]`).classList.add('active');
        
        // Update input panel
        const inputPanel = document.getElementById('input-panel');
        inputPanel.innerHTML = this.createInputPanelHTML(type);
        
        // Re-setup event listeners for new content
        this.setupEventListeners();
        if (type === 'file') {
            this.setupFileDropZone();
        }
    }

    handleFiles(files) {
        const fileList = Array.from(files);
        const dropZone = document.getElementById('file-drop-zone');
        
        if (fileList.length > 0) {
            dropZone.innerHTML = `
                <div class="files-selected">
                    <i class="fas fa-check-circle"></i>
                    <p>${fileList.length} file(s) selected</p>
                    <ul>
                        ${fileList.map(file => `<li>${file.name} (${this.formatFileSize(file.size)})</li>`).join('')}
                    </ul>
                    <button class="btn btn-secondary btn-sm" onclick="location.reload()">
                        Change Files
                    </button>
                </div>
            `;
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async startAnalysis() {
        const resultsContent = document.getElementById('results-content');
        if (!window.apiClient) {
            resultsContent.innerHTML = '<p class="text-danger">API client not available. Please restart the app.</p>';
            return;
        }

        const payload = await this.buildAnalysisPayload();
        if (!payload) return;

        resultsContent.innerHTML = `
            <div class="analysis-loading">
                <div class="spinner"></div>
                <h3>Analysis in Progress</h3>
                <p>Running ${this.analysisType} analysis...</p>
                <div class="progress-bar">
                    <div class="progress-fill" id="progress-fill"></div>
                </div>
                <p class="progress-text" id="progress-text">Submitting to backend...</p>
            </div>
        `;

        try {
            const response = await window.apiClient.analyzeUrl(payload.url, payload.options);
            if (!response.success) {
                resultsContent.innerHTML = `<p class="text-danger">${response.error || 'Analysis failed. Please try again.'}</p>`;
                return;
            }

            const analysis = response.data?.analysis || response.data || {};
            this.currentAnalysis = analysis;

            this.showAnalysisResults(analysis);
            this.addToHistory(analysis);
            window.notificationSystem?.success('Analysis Submitted', 'ML service is processing your request.');
            await this.loadAnalysisHistory();
        } catch (error) {
            console.error('Analysis request failed:', error);
            resultsContent.innerHTML = `<p class="text-danger">${error.message || 'Analysis failed.'}</p>`;
        }
    }

    async buildAnalysisPayload() {
        switch (this.analysisType) {
            case 'url': {
                const urlInput = document.getElementById('url-input');
                const url = urlInput?.value?.trim();
                if (!url) {
                    window.notificationSystem?.warning('Enter URL', 'Please enter a URL to analyze.');
                    return null;
                }
                return { url, options: { analysisType: 'url', priority: 'medium' } };
            }
            case 'file':
            case 'network':
            case 'memory':
            case 'behavioral':
                window.notificationSystem?.info('URL Analysis Available', 'Backend currently accepts URL analyses. Other types are coming soon.');
                return null;
            default:
                return null;
        }
    }

    showAnalysisResults(analysis) {
        const resultsContent = document.getElementById('results-content');
        const results = analysis?.results || {};

        const threatLevel = (results.riskLevel || results.threatLevel || 'medium').toLowerCase();
        const confidence = Math.round((results.confidence || results.confidenceScore || 0.5) * 100);
        const icon = threatLevel === 'low' ? 'shield-alt' : threatLevel === 'critical' ? 'skull-crossbones' : 'exclamation-triangle';
        const findings = results.insights || results.findings || [];
        const recommendations = results.recommendations || results.actions || [];
        const technicalDetails = results.technicalDetails || {
            URL: analysis.url || 'N/A',
            Risk: results.riskLevel || 'unknown',
            SecurityScore: results.securityScore ?? 'n/a'
        };

        resultsContent.innerHTML = `
            <div class="analysis-results">
                <div class="results-summary">
                    <div class="threat-level ${threatLevel}">
                        <i class="fas fa-${icon}"></i>
                        <span>${threatLevel.toUpperCase()}</span>
                    </div>
                    <div class="confidence-score">
                        <h4>Confidence Score</h4>
                        <div class="score-circle">
                            <span>${confidence}%</span>
                        </div>
                    </div>
                </div>
                
                <div class="results-details">
                    <div class="detail-section">
                        <h4>Key Findings</h4>
                        <ul>
                            ${findings.length ? findings.map(finding => `<li>${finding}</li>`).join('') : '<li>No findings reported yet.</li>'}
                        </ul>
                    </div>
                    
                    <div class="detail-section">
                        <h4>Technical Details</h4>
                        <table class="results-table">
                            ${Object.entries(technicalDetails).map(([key, value]) => 
                                `<tr><td>${key}</td><td>${value ?? 'n/a'}</td></tr>`
                            ).join('')}
                        </table>
                    </div>
                    
                    <div class="detail-section">
                        <h4>Recommendations</h4>
                        <ul>
                            ${recommendations.length ? recommendations.map(rec => `<li>${rec}</li>`).join('') : '<li>Awaiting ML recommendations.</li>'}
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }

    addToHistory(analysis) {
        if (!analysis) return;
        const historyItem = {
            id: analysis.id || analysis._id || Date.now(),
            type: analysis.analysisType || this.analysisType,
            timestamp: analysis.createdAt ? new Date(analysis.createdAt) : new Date(),
            threatLevel: analysis.results?.riskLevel || analysis.results?.threatLevel || 'medium',
            confidence: Math.round((analysis.results?.confidence || 0.5) * 100)
        };

        this.analysisHistory.unshift(historyItem);
        this.updateHistoryDisplay();
    }

    updateHistoryDisplay() {
        const historyList = document.getElementById('history-list');
        if (!historyList) return;

        historyList.innerHTML = this.analysisHistory.slice(0, 10).map(item => {
            const ts = item.timestamp ? new Date(item.timestamp) : new Date();
            return `
                <div class="history-item" data-id="${item.id}">
                    <div class="history-icon">
                        <i class="fas fa-${this.getAnalysisIcon(item.analysisType || item.type)}"></i>
                    </div>
                    <div class="history-content">
                        <div class="history-header">
                            <span class="history-type">${(item.analysisType || item.type || 'analysis').toString().toUpperCase()}</span>
                            <span class="history-threat ${(item.threatLevel || 'medium').toLowerCase()}">${(item.threatLevel || 'medium').toString().toUpperCase()}</span>
                        </div>
                        <div class="history-details">
                            <span class="history-time">${ts.toLocaleString()}</span>
                            <span class="history-confidence">${item.confidence ?? '–'}% confidence</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    getAnalysisIcon(type) {
        const icons = {
            file: 'file-alt',
            url: 'link',
            network: 'network-wired',
            memory: 'memory',
            behavioral: 'user-secret'
        };
        return icons[type] || 'search';
    }

    async loadAnalysisHistory() {
        if (!window.apiClient) return;

        const response = await window.apiClient.getAnalysisHistory({ limit: 10 });
        if (response.success) {
            this.analysisHistory = response.data?.analyses || [];
            this.updateHistoryDisplay();
        }
    }

    newAnalysis() {
        // Reset the analysis
        const resultsContent = document.getElementById('results-content');
        resultsContent.innerHTML = `
            <div class="no-analysis">
                <i class="fas fa-search"></i>
                <p>Start an analysis to see results here</p>
            </div>
        `;
    }

    exportResults() {
        if (!this.currentAnalysis) {
            alert('No analysis results to export');
            return;
        }

        const data = {
            analysis: this.currentAnalysis,
            timestamp: new Date().toISOString(),
            type: this.analysisType
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analysis-results-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    shareResults() {
        alert('Share functionality coming soon!');
    }
}

// Export to global scope
window.DeepAnalysisScreen = DeepAnalysisScreen;