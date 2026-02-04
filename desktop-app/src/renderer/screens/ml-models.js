/**
 * ML Models Screen
 * Machine Learning model management and training interface
 */

class MLModelsScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.models = [];
        this.selectedModel = null;
        this.trainingJobs = [];
    }

    async show(container, options = {}) {
        this.container = container;
        this.isActive = true;
        
        // Create HTML
        this.container.innerHTML = this.createHTML();
        
        // Initialize components
        this.initializeComponents();
        
        // Load models
        await this.loadModels();
        
        // Add entrance animation
        this.container.classList.add('screen-enter');
    }

    hide() {
        this.isActive = false;
    }

    createHTML() {
        return `
            <div class="ml-models-screen">
                <!-- Header -->
                <div class="models-header">
                    <div class="header-info">
                        <h2><i class="fas fa-brain"></i> ML Models</h2>
                        <p>Manage and train machine learning models for security analysis</p>
                    </div>
                    <div class="header-controls">
                        <button class="btn btn-secondary" id="import-model-btn">
                            <i class="fas fa-upload"></i> Import Model
                        </button>
                        <button class="btn btn-primary" id="train-model-btn">
                            <i class="fas fa-play"></i> Train New Model
                        </button>
                    </div>
                </div>

                <!-- Models Grid -->
                <div class="models-grid">
                    <!-- Available Models -->
                    <div class="models-section">
                        <h3>Available Models</h3>
                        <div class="models-list" id="models-list">
                            <!-- Models will be populated here -->
                        </div>
                    </div>

                    <!-- Model Details -->
                    <div class="model-details-section">
                        <h3>Model Details</h3>
                        <div class="model-details" id="model-details">
                            <div class="no-selection">
                                <i class="fas fa-robot"></i>
                                <p>Select a model to view details</p>
                            </div>
                        </div>
                    </div>

                    <!-- Training Jobs -->
                    <div class="training-section">
                        <h3>Training Jobs</h3>
                        <div class="training-jobs" id="training-jobs">
                            <!-- Training jobs will be populated here -->
                        </div>
                    </div>
                </div>

                <!-- Model Performance Charts -->
                <div class="performance-section">
                    <h3>Model Performance</h3>
                    <div class="charts-container">
                        <div class="chart-container">
                            <canvas id="accuracy-chart"></canvas>
                        </div>
                        <div class="chart-container">
                            <canvas id="loss-chart"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    initializeComponents() {
        this.setupEventListeners();
        this.initializeCharts();
    }

    setupEventListeners() {
        // Train new model button
        const trainBtn = document.getElementById('train-model-btn');
        if (trainBtn) {
            trainBtn.addEventListener('click', () => this.showTrainingDialog());
        }

        // Import model button
        const importBtn = document.getElementById('import-model-btn');
        if (importBtn) {
            importBtn.addEventListener('click', () => this.importModel());
        }
    }

    initializeCharts() {
        // Accuracy chart
        const accuracyCtx = document.getElementById('accuracy-chart');
        if (accuracyCtx) {
            new Chart(accuracyCtx, {
                type: 'line',
                data: {
                    labels: ['Epoch 1', 'Epoch 2', 'Epoch 3', 'Epoch 4', 'Epoch 5'],
                    datasets: [{
                        label: 'Training Accuracy',
                        data: [0.85, 0.87, 0.89, 0.91, 0.92],
                        borderColor: '#00f5ff',
                        backgroundColor: 'rgba(0, 245, 255, 0.1)',
                        tension: 0.4
                    }, {
                        label: 'Validation Accuracy',
                        data: [0.83, 0.85, 0.86, 0.88, 0.89],
                        borderColor: '#4ecdc4',
                        backgroundColor: 'rgba(78, 205, 196, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Model Accuracy Over Time'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 1
                        }
                    }
                }
            });
        }

        // Loss chart
        const lossCtx = document.getElementById('loss-chart');
        if (lossCtx) {
            new Chart(lossCtx, {
                type: 'line',
                data: {
                    labels: ['Epoch 1', 'Epoch 2', 'Epoch 3', 'Epoch 4', 'Epoch 5'],
                    datasets: [{
                        label: 'Training Loss',
                        data: [0.45, 0.32, 0.25, 0.18, 0.15],
                        borderColor: '#ff6b6b',
                        backgroundColor: 'rgba(255, 107, 107, 0.1)',
                        tension: 0.4
                    }, {
                        label: 'Validation Loss',
                        data: [0.48, 0.35, 0.28, 0.22, 0.19],
                        borderColor: '#feca57',
                        backgroundColor: 'rgba(254, 202, 87, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Model Loss Over Time'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
    }

    async loadModels() {
        // Try to load from CyberForge ML backend first
        if (window.cyberforgeAPI) {
            try {
                const response = await window.cyberforgeAPI.getCyberForgeModels();
                if (response.success && response.data && response.data.models) {
                    this.models = Object.entries(response.data.models).map(([id, model]) => ({
                        id: id,
                        name: id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                        type: model.type || 'Classification',
                        accuracy: model.accuracy || 0.9,
                        status: 'active',
                        lastTrained: new Date(),
                        description: model.description || `CyberForge ML model for ${id}`,
                        size: 'N/A',
                        framework: 'scikit-learn',
                        version: '1.0.0',
                        f1_score: model.f1_score || 0,
                        inference_time_ms: model.inference_time_ms || 0,
                        classes: model.classes || ['benign', 'malicious'],
                        huggingface: true
                    }));
                    console.log('✅ Loaded CyberForge ML models:', this.models.length);
                    this.renderModels();
                    await this.loadTrainingJobs();
                    return;
                }
            } catch (error) {
                console.warn('CyberForge ML not available, trying legacy:', error.message);
            }
        }
        
        // Try legacy backend
        if (window.apiClient) {
            try {
                const response = await window.apiClient.getAIModels();
                if (response.success && response.data && response.data.models) {
                    this.models = response.data.models.map(model => ({
                        id: model.id,
                        name: model.name,
                        type: model.type || 'Classification',
                        accuracy: model.accuracy || model.metrics?.accuracy || 0.9,
                        status: model.status || 'active',
                        lastTrained: new Date(model.trained_at || model.registered_at || Date.now()),
                        description: model.description || 'ML model for cybersecurity',
                        size: model.size || 'N/A',
                        framework: model.framework || 'sklearn',
                        version: model.version || '1.0.0'
                    }));
                    this.renderModels();
                    
                    // Also load training jobs
                    await this.loadTrainingJobs();
                    return;
                }
            } catch (error) {
                console.error('Failed to load models from backend:', error);
            }
        }
        
        // Fallback: Use CyberForge default models
        this.models = [
            {
                id: 'phishing_detection',
                name: 'Phishing Detection',
                type: 'Binary Classification',
                accuracy: 0.989,
                status: 'active',
                lastTrained: new Date('2024-01-15'),
                description: 'CyberForge ML model for phishing URL detection',
                size: 'N/A',
                framework: 'scikit-learn',
                version: '1.0.0',
                huggingface: true
            },
            {
                id: 'malware_detection',
                name: 'Malware Detection',
                type: 'Binary Classification',
                accuracy: 0.998,
                status: 'active',
                lastTrained: new Date('2024-01-10'),
                description: 'CyberForge ML model for malware detection',
                size: 'N/A',
                framework: 'scikit-learn',
                version: '1.0.0',
                huggingface: true
            },
            {
                id: 'anomaly_detection',
                name: 'Anomaly Detection',
                type: 'Anomaly Detection',
                accuracy: 0.999,
                status: 'active',
                lastTrained: new Date('2024-01-20'),
                description: 'CyberForge ML model for network anomaly detection',
                size: 'N/A',
                framework: 'scikit-learn',
                version: '1.0.0',
                huggingface: true
            },
            {
                id: 'web_attack_detection',
                name: 'Web Attack Detection',
                type: 'Binary Classification',
                accuracy: 1.0,
                status: 'active',
                lastTrained: new Date('2024-01-20'),
                description: 'CyberForge ML model for web attack detection (XSS, SQLi, etc.)',
                size: 'N/A',
                framework: 'scikit-learn',
                version: '1.0.0',
                huggingface: true
            }
        ];

        this.renderModels();
        await this.loadTrainingJobs();
    }

    async loadTrainingJobs() {
        const jobsList = document.getElementById('training-jobs');
        if (!jobsList) return;
        
        if (window.apiClient) {
            try {
                const response = await window.apiClient.getTrainingHistory(10);
                if (response.success && response.data && response.data.history) {
                    this.trainingJobs = response.data.history;
                    this.renderTrainingJobs();
                    return;
                }
            } catch (error) {
                console.error('Failed to load training jobs:', error);
            }
        }
        
        // Fallback with empty or mock jobs
        this.trainingJobs = [];
        this.renderTrainingJobs();
    }

    renderTrainingJobs() {
        const jobsList = document.getElementById('training-jobs');
        if (!jobsList) return;
        
        if (this.trainingJobs.length === 0) {
            jobsList.innerHTML = `
                <div class="no-jobs">
                    <i class="fas fa-robot"></i>
                    <p>No training jobs yet. Start training a model!</p>
                </div>
            `;
            return;
        }
        
        jobsList.innerHTML = this.trainingJobs.map(job => `
            <div class="training-job ${job.status}">
                <div class="job-header">
                    <span class="job-name">${job.dataset_id || job.model_type || 'Training Job'}</span>
                    <span class="job-status ${job.status}">${job.status}</span>
                </div>
                <div class="job-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${job.progress || 100}%"></div>
                    </div>
                    <span class="progress-text">${job.progress || 100}%</span>
                </div>
                <div class="job-meta">
                    <span>${job.started_at ? new Date(job.started_at).toLocaleString() : 'N/A'}</span>
                    ${job.metrics ? `<span>Accuracy: ${(job.metrics.accuracy * 100).toFixed(1)}%</span>` : ''}
                </div>
            </div>
        `).join('');
    }

    renderModels() {
        const modelsList = document.getElementById('models-list');
        if (!modelsList) return;

        modelsList.innerHTML = this.models.map(model => `
            <div class="model-card ${model.status}" data-model-id="${model.id}">
                <div class="model-header">
                    <div class="model-name">
                        <h4>${model.name}</h4>
                        <span class="model-type">${model.type}</span>
                    </div>
                    <div class="model-status">
                        <span class="status-badge ${model.status}">${model.status.toUpperCase()}</span>
                    </div>
                </div>
                
                <div class="model-metrics">
                    <div class="metric">
                        <span class="metric-label">Accuracy</span>
                        <span class="metric-value">${(model.accuracy * 100).toFixed(1)}%</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Size</span>
                        <span class="metric-value">${model.size}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Framework</span>
                        <span class="metric-value">${model.framework}</span>
                    </div>
                </div>
                
                <div class="model-actions">
                    <button class="btn btn-sm btn-primary" onclick="mlModelsScreen.selectModel('${model.id}')">
                        <i class="fas fa-info-circle"></i> Details
                    </button>
                    ${model.status === 'active' ? `
                        <button class="btn btn-sm btn-success" onclick="mlModelsScreen.deployModel('${model.id}')">
                            <i class="fas fa-rocket"></i> Deploy
                        </button>
                    ` : ''}
                    <button class="btn btn-sm btn-secondary" onclick="mlModelsScreen.downloadModel('${model.id}')">
                        <i class="fas fa-download"></i> Export
                    </button>
                </div>
                
                <div class="model-footer">
                    <span class="last-trained">Last trained: ${model.lastTrained.toLocaleDateString()}</span>
                </div>
            </div>
        `).join('');

        // Add click listeners
        document.querySelectorAll('.model-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.model-actions')) {
                    const modelId = card.dataset.modelId;
                    this.selectModel(modelId);
                }
            });
        });
    }

    selectModel(modelId) {
        this.selectedModel = this.models.find(m => m.id === modelId);
        if (!this.selectedModel) return;

        // Update model details
        const modelDetails = document.getElementById('model-details');
        modelDetails.innerHTML = `
            <div class="model-detail-content">
                <div class="detail-header">
                    <h4>${this.selectedModel.name}</h4>
                    <span class="status-badge ${this.selectedModel.status}">
                        ${this.selectedModel.status.toUpperCase()}
                    </span>
                </div>
                
                <div class="detail-description">
                    <p>${this.selectedModel.description}</p>
                </div>
                
                <div class="detail-specs">
                    <h5>Specifications</h5>
                    <table class="specs-table">
                        <tr><td>Model Type</td><td>${this.selectedModel.type}</td></tr>
                        <tr><td>Framework</td><td>${this.selectedModel.framework}</td></tr>
                        <tr><td>Version</td><td>${this.selectedModel.version}</td></tr>
                        <tr><td>Size</td><td>${this.selectedModel.size}</td></tr>
                        <tr><td>Accuracy</td><td>${(this.selectedModel.accuracy * 100).toFixed(1)}%</td></tr>
                        <tr><td>Last Trained</td><td>${this.selectedModel.lastTrained.toLocaleDateString()}</td></tr>
                    </table>
                </div>
                
                <div class="detail-actions">
                    <button class="btn btn-primary" onclick="mlModelsScreen.testModel('${this.selectedModel.id}')">
                        <i class="fas fa-play"></i> Test Model
                    </button>
                    <button class="btn btn-secondary" onclick="mlModelsScreen.retrainModel('${this.selectedModel.id}')">
                        <i class="fas fa-refresh"></i> Retrain
                    </button>
                    <button class="btn btn-danger" onclick="mlModelsScreen.deleteModel('${this.selectedModel.id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;

        // Highlight selected model
        document.querySelectorAll('.model-card').forEach(card => {
            card.classList.remove('selected');
        });
        document.querySelector(`[data-model-id="${modelId}"]`).classList.add('selected');
    }

    showTrainingDialog() {
        if (window.modal) {
            window.modal.show({
                title: 'Train New Model',
                content: `
                    <div class="training-form">
                        <div class="form-group">
                            <label>Model Name</label>
                            <input type="text" id="model-name" class="form-control" placeholder="Enter model name">
                        </div>
                        
                        <div class="form-group">
                            <label>Model Type</label>
                            <select id="model-type" class="form-control">
                                <option value="classification">Classification</option>
                                <option value="regression">Regression</option>
                                <option value="anomaly">Anomaly Detection</option>
                                <option value="clustering">Clustering</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>Dataset</label>
                            <select id="training-dataset" class="form-control">
                                <option value="malware-samples">Malware Samples (10K files)</option>
                                <option value="network-logs">Network Logs (1M entries)</option>
                                <option value="phishing-urls">Phishing URLs (50K samples)</option>
                                <option value="custom">Upload Custom Dataset</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>Training Configuration</label>
                            <div class="config-grid">
                                <div class="config-item">
                                    <label>Epochs</label>
                                    <input type="number" id="epochs" class="form-control" value="10" min="1" max="100">
                                </div>
                                <div class="config-item">
                                    <label>Batch Size</label>
                                    <input type="number" id="batch-size" class="form-control" value="32" min="1" max="512">
                                </div>
                                <div class="config-item">
                                    <label>Learning Rate</label>
                                    <input type="number" id="learning-rate" class="form-control" value="0.001" step="0.001" min="0.0001" max="1">
                                </div>
                            </div>
                        </div>
                    </div>
                `,
                actions: [
                    {
                        text: 'Cancel',
                        class: 'btn-secondary',
                        action: () => window.modal.hide()
                    },
                    {
                        text: 'Start Training',
                        class: 'btn-primary',
                        action: () => {
                            this.startTraining();
                            window.modal.hide();
                        }
                    }
                ]
            });
        }
    }

    async startTraining() {
        const modelName = document.getElementById('model-name')?.value || 'New Model';
        const modelType = document.getElementById('model-type')?.value || 'classification';
        const datasetSelect = document.getElementById('training-dataset');
        const dataset = datasetSelect?.value || 'malware_detection';
        
        const epochs = parseInt(document.getElementById('epochs')?.value) || 10;
        const batchSize = parseInt(document.getElementById('batch-size')?.value) || 32;
        const learningRate = parseFloat(document.getElementById('learning-rate')?.value) || 0.001;
        
        // Map UI dataset names to backend dataset IDs
        const datasetMapping = {
            'malware-samples': 'malware_detection',
            'network-logs': 'network_intrusion',
            'phishing-urls': 'phishing_detection',
            'custom': 'custom'
        };
        
        const datasetId = datasetMapping[dataset] || dataset;
        
        // Try to start training via backend API
        if (window.apiClient) {
            try {
                const response = await window.apiClient.trainModel(
                    datasetId,
                    modelType === 'anomaly' ? 'neural_network' : 'auto',
                    { epochs, batch_size: batchSize, learning_rate: learningRate },
                    { model_name: modelName }
                );
                
                if (response.success && response.data) {
                    // Create training job with backend job ID
                    const trainingJob = {
                        id: response.data.job_id,
                        modelName,
                        modelType,
                        dataset: datasetId,
                        dataset_id: datasetId,
                        status: response.data.status || 'running',
                        progress: 0,
                        startTime: new Date(),
                        started_at: new Date().toISOString(),
                        estimatedTime: '10-20 minutes'
                    };

                    this.trainingJobs.unshift(trainingJob);
                    this.renderTrainingJobs();
                    this.pollTrainingStatus(trainingJob.id);
                    
                    window.notificationSystem?.success('Training Started', `Started training ${modelName} on ${datasetId}`);
                    return;
                }
            } catch (error) {
                console.error('Failed to start training via API:', error);
            }
        }
        
        // Fallback: Create local training job with simulation
        const trainingJob = {
            id: Date.now().toString(),
            modelName,
            modelType,
            dataset,
            dataset_id: datasetMapping[dataset] || dataset,
            status: 'running',
            progress: 0,
            startTime: new Date(),
            started_at: new Date().toISOString(),
            estimatedTime: '45 minutes'
        };

        this.trainingJobs.unshift(trainingJob);
        this.renderTrainingJobs();
        this.simulateTraining(trainingJob.id);
    }

    async pollTrainingStatus(jobId) {
        if (!window.apiClient) return;
        
        const poll = async () => {
            try {
                const response = await window.apiClient.getTrainingStatus(jobId);
                if (response.success && response.data && response.data.job) {
                    const job = this.trainingJobs.find(j => j.id === jobId);
                    if (job) {
                        job.status = response.data.job.status;
                        job.progress = response.data.job.progress || 0;
                        
                        if (response.data.job.metrics) {
                            job.metrics = response.data.job.metrics;
                        }
                        
                        this.renderTrainingJobs();
                        
                        // Continue polling if still running
                        if (job.status === 'running' || job.status === 'queued') {
                            setTimeout(poll, 3000);
                        } else if (job.status === 'completed') {
                            // Reload models to get the new trained model
                            await this.loadModels();
                            window.notificationSystem?.success('Training Complete', `Model training completed with ${(job.metrics?.accuracy * 100 || 95).toFixed(1)}% accuracy`);
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to poll training status:', error);
            }
        };
        
        // Start polling after a short delay
        setTimeout(poll, 2000);
    }
    }

    renderTrainingJobs() {
        const trainingJobs = document.getElementById('training-jobs');
        if (!trainingJobs) return;

        trainingJobs.innerHTML = this.trainingJobs.map(job => `
            <div class="training-job ${job.status}" data-job-id="${job.id}">
                <div class="job-header">
                    <h4>${job.modelName}</h4>
                    <span class="job-status ${job.status}">${job.status.toUpperCase()}</span>
                </div>
                
                <div class="job-details">
                    <div class="job-info">
                        <span><strong>Type:</strong> ${job.modelType}</span>
                        <span><strong>Dataset:</strong> ${job.dataset}</span>
                        <span><strong>Started:</strong> ${job.startTime.toLocaleTimeString()}</span>
                    </div>
                    
                    ${job.status === 'running' ? `
                        <div class="job-progress">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${job.progress}%"></div>
                            </div>
                            <span class="progress-text">${job.progress}% - ${job.estimatedTime} remaining</span>
                        </div>
                    ` : ''}
                </div>
                
                <div class="job-actions">
                    ${job.status === 'running' ? `
                        <button class="btn btn-sm btn-warning" onclick="mlModelsScreen.stopTraining('${job.id}')">
                            <i class="fas fa-stop"></i> Stop
                        </button>
                    ` : ''}
                    <button class="btn btn-sm btn-secondary" onclick="mlModelsScreen.viewLogs('${job.id}')">
                        <i class="fas fa-file-alt"></i> Logs
                    </button>
                </div>
            </div>
        `).join('');
    }

    simulateTraining(jobId) {
        const job = this.trainingJobs.find(j => j.id === jobId);
        if (!job) return;

        const updateProgress = () => {
            if (job.status !== 'running') return;
            
            job.progress = Math.min(job.progress + Math.random() * 10, 100);
            
            if (job.progress >= 100) {
                job.status = 'completed';
                job.progress = 100;
                
                // Add completed model to models list
                const newModel = {
                    id: `model-${Date.now()}`,
                    name: job.modelName,
                    type: job.modelType,
                    accuracy: 0.85 + Math.random() * 0.1,
                    status: 'active',
                    lastTrained: new Date(),
                    description: `Trained model using ${job.dataset} dataset`,
                    size: (Math.random() * 50 + 10).toFixed(1) + ' MB',
                    framework: 'TensorFlow',
                    version: '1.0.0'
                };
                
                this.models.unshift(newModel);
                this.renderModels();
            }
            
            this.renderTrainingJobs();
            
            if (job.status === 'running') {
                setTimeout(updateProgress, 2000);
            }
        };

        updateProgress();
    }

    stopTraining(jobId) {
        const job = this.trainingJobs.find(j => j.id === jobId);
        if (job) {
            job.status = 'stopped';
            this.renderTrainingJobs();
        }
    }

    async testModel(modelId) {
        const model = this.models.find(m => m.id === modelId);
        if (!model) return;
        
        // Show test dialog
        const testUrl = prompt('Enter a URL to test with ' + model.name + ':', 'https://example.com');
        if (!testUrl) return;
        
        try {
            if (window.cyberforgeAPI) {
                const result = await window.cyberforgeAPI.cyberforgePredict(modelId, { url: testUrl });
                if (result.success) {
                    const prediction = result.data;
                    const message = `
🔍 Model: ${model.name}
📊 Prediction: ${prediction.prediction}
🎯 Confidence: ${prediction.confidence}%
⚠️ Threat Score: ${prediction.threat_score}
🏷️ Risk Level: ${prediction.risk_level}
                    `;
                    alert(message);
                    window.notificationSystem?.info('Prediction Complete', `${model.name}: ${prediction.risk_level} risk`);
                } else {
                    alert('Prediction failed: ' + (result.error || 'Unknown error'));
                }
            } else {
                alert('CyberForge ML API not available');
            }
        } catch (error) {
            console.error('Model test failed:', error);
            alert('Test failed: ' + error.message);
        }
    }

    retrainModel(modelId) {
        alert('Model retraining interface coming soon!');
    }

    deleteModel(modelId) {
        if (confirm('Are you sure you want to delete this model?')) {
            this.models = this.models.filter(m => m.id !== modelId);
            this.renderModels();
            
            // Clear details if this model was selected
            if (this.selectedModel && this.selectedModel.id === modelId) {
                document.getElementById('model-details').innerHTML = `
                    <div class="no-selection">
                        <i class="fas fa-robot"></i>
                        <p>Select a model to view details</p>
                    </div>
                `;
                this.selectedModel = null;
            }
        }
    }

    async deployModel(modelId) {
        const model = this.models.find(m => m.id === modelId);
        if (!model) return;
        
        if (model.huggingface) {
            window.open('https://huggingface.co/Che237/cyberforge-models', '_blank');
            window.notificationSystem?.info('HuggingFace', 'Models are already deployed on HuggingFace Hub');
        } else {
            alert('Model deployment interface coming soon!');
        }
    }

    downloadModel(modelId) {
        const model = this.models.find(m => m.id === modelId);
        if (model) {
            if (model.huggingface) {
                window.open('https://huggingface.co/Che237/cyberforge-models/tree/main', '_blank');
            } else {
                alert(`Downloading ${model.name}...`);
            }
        }
    }

    importModel() {
        alert('Model import interface coming soon!');
    }

    viewLogs(jobId) {
        alert('Training logs viewer coming soon!');
    }
}

// Export to global scope
window.MLModelsScreen = MLModelsScreen;
window.mlModelsScreen = new MLModelsScreen();