/**
 * ML Service Integration
 * Handles communication with the ML/AI services
 */
const axios = require('axios');

class MLService {
    constructor() {
        this.baseURL = process.env.AI_SERVICE_URL || 'http://localhost:8001';
        this.timeout = 30000; // 30 seconds
        this.axiosInstance = axios.create({
            baseURL: this.baseURL,
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        this.setupInterceptors();
    }

    setupInterceptors() {
        // Request interceptor
        this.axiosInstance.interceptors.request.use(
            (config) => {
                console.log(`🤖 ML API Request: ${config.method?.toUpperCase()} ${config.url}`);
                return config;
            },
            (error) => {
                console.error('ML API Request Error:', error.message);
                return Promise.reject(error);
            }
        );

        // Response interceptor
        this.axiosInstance.interceptors.response.use(
            (response) => {
                console.log(`✅ ML API Response: ${response.status} ${response.config.url}`);
                return response;
            },
            (error) => {
                console.error(`❌ ML API Error: ${error.response?.status || 'Network Error'} ${error.config?.url}`);
                return Promise.reject(error);
            }
        );
    }

    /**
     * Check if ML services are available
     */
    async checkHealth() {
        try {
            const response = await this.axiosInstance.get('/health');
            return {
                available: true,
                status: response.data
            };
        } catch (error) {
            return {
                available: false,
                error: error.message
            };
        }
    }

    /**
     * Analyze website content for security threats
     */
    async analyzeWebsite(url, content = null) {
        try {
            const response = await this.axiosInstance.post('/analyze-url', {
                url,
                content,
                context: 'website_analysis',
                timestamp: new Date().toISOString()
            });
            
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('Website analysis error:', error);
            return {
                success: false,
                error: error.response?.data?.detail || error.message
            };
        }
    }

    /**
     * Scan for threats using AI models
     */
    async scanForThreats(data) {
        try {
            const response = await this.axiosInstance.post('/scan-threats', {
                ...data,
                context: 'threat_scan',
                timestamp: new Date().toISOString()
            });
            
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('Threat scan error:', error);
            return {
                success: false,
                error: error.response?.data?.detail || error.message
            };
        }
    }

    /**
     * Get AI insights using Gemini
     */
    async getAIInsights(query, context = {}) {
        try {
            const response = await this.axiosInstance.post('/api/insights/generate', {
                query,
                context,
                timestamp: new Date().toISOString()
            });
            
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('AI insights error:', error);
            return {
                success: false,
                error: error.response?.data?.detail || error.message
            };
        }
    }

    /**
     * Chat with AI assistant
     */
    async chatWithAI(message, conversationHistory = [], context = {}) {
        try {
            // conversation_history should be array of {role, content} objects
            // If it's a string (old conversationId), convert to empty array
            let formattedHistory = [];
            if (Array.isArray(conversationHistory)) {
                formattedHistory = conversationHistory;
            }
            
            const response = await this.axiosInstance.post('/analyze', {
                query: message,
                conversation_history: formattedHistory,
                context: typeof context === 'string' ? { type: context } : context
            });
            
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('AI chat error:', error);
            return {
                success: false,
                error: error.response?.data?.detail || error.message,
                fallback_response: this.getFallbackResponse(message)
            };
        }
    }

    /**
     * Analyze network traffic patterns
     */
    async analyzeNetworkTraffic(trafficData) {
        try {
            const response = await this.axiosInstance.post('/api/analysis/network', {
                traffic_data: trafficData,
                timestamp: new Date().toISOString()
            });
            
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('Network analysis error:', error);
            return {
                success: false,
                error: error.response?.data?.detail || error.message
            };
        }
    }

    /**
     * Process datasets for training
     */
    async processDataset(datasetName, options = {}) {
        try {
            const response = await this.axiosInstance.post('/api/datasets/process', {
                dataset_name: datasetName,
                options,
                timestamp: new Date().toISOString()
            });
            
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('Dataset processing error:', error);
            return {
                success: false,
                error: error.response?.data?.detail || error.message
            };
        }
    }

    /**
     * Get model predictions
     */
    async getModelPrediction(modelType, inputData) {
        try {
            const response = await this.axiosInstance.post('/api/models/predict', {
                model_type: modelType,
                input_data: inputData,
                timestamp: new Date().toISOString()
            });
            
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('Model prediction error:', error);
            return {
                success: false,
                error: error.response?.data?.detail || error.message
            };
        }
    }

    /**
     * Enhanced AI agent task execution
     */
    async executeAITask(taskType, taskData) {
        try {
            const response = await this.axiosInstance.post('/api/ai/execute-task', {
                task_type: taskType,
                task_data: taskData,
                timestamp: new Date().toISOString()
            });
            
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('AI task execution error:', error);
            return {
                success: false,
                error: error.response?.data?.detail || error.message
            };
        }
    }

    /**
     * Get fallback response when AI is unavailable
     */
    getFallbackResponse(message) {
        const fallbacks = [
            "I'm currently experiencing technical difficulties. Please try again in a moment.",
            "AI services are temporarily unavailable. I'm working to resolve this.",
            "I'm having trouble connecting to my AI brain right now. Please check back soon.",
            "My AI capabilities are offline at the moment. Please try your request again later."
        ];
        
        return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }

    /**
     * Batch process multiple requests
     */
    async batchProcess(requests) {
        try {
            const response = await this.axiosInstance.post('/api/batch/process', {
                requests,
                timestamp: new Date().toISOString()
            });
            
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('Batch processing error:', error);
            return {
                success: false,
                error: error.response?.data?.detail || error.message
            };
        }
    }

    // =========================================
    // Dataset Management Methods
    // =========================================

    /**
     * Get all available datasets
     */
    async getDatasets() {
        try {
            const response = await this.axiosInstance.get('/api/training/datasets');
            return { success: true, data: response.data };
        } catch (error) {
            console.error('Get datasets error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get specific dataset details
     */
    async getDatasetDetails(datasetId) {
        try {
            const response = await this.axiosInstance.get(`/api/training/datasets/${datasetId}`);
            return { success: true, data: response.data };
        } catch (error) {
            console.error('Get dataset details error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Download and prepare a dataset
     */
    async downloadDataset(datasetId, forceRefresh = false) {
        try {
            const response = await this.axiosInstance.post('/api/training/datasets/download', {
                dataset_id: datasetId,
                force_refresh: forceRefresh
            });
            return { success: true, data: response.data };
        } catch (error) {
            console.error('Download dataset error:', error);
            return { success: false, error: error.message };
        }
    }

    // =========================================
    // Model Management Methods
    // =========================================

    /**
     * Get all available ML models
     */
    async getModels() {
        try {
            const response = await this.axiosInstance.get('/api/training/models');
            return { success: true, data: response.data };
        } catch (error) {
            console.error('Get models error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get specific model details
     */
    async getModelDetails(modelId) {
        try {
            const response = await this.axiosInstance.get(`/api/training/models/${modelId}`);
            return { success: true, data: response.data };
        } catch (error) {
            console.error('Get model details error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get model performance metrics
     */
    async getModelMetrics(modelId) {
        try {
            const response = await this.axiosInstance.get(`/api/training/models/${modelId}/metrics`);
            return { success: true, data: response.data };
        } catch (error) {
            console.error('Get model metrics error:', error);
            return { success: false, error: error.message };
        }
    }

    // =========================================
    // Training Methods
    // =========================================

    /**
     * Start model training
     */
    async trainModel(options) {
        try {
            const response = await this.axiosInstance.post('/api/training/train', {
                dataset_id: options.datasetId,
                model_type: options.modelType,
                hyperparameters: options.hyperparameters,
                train_all: options.trainAll,
                user_id: options.userId,
                timestamp: new Date().toISOString()
            });
            return { success: true, data: response.data };
        } catch (error) {
            console.error('Train model error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get training job status
     */
    async getTrainingStatus(jobId) {
        try {
            const response = await this.axiosInstance.get(`/api/training/status/${jobId}`);
            return { success: true, data: response.data };
        } catch (error) {
            console.error('Get training status error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get training history
     */
    async getTrainingHistory(limit = 20, offset = 0) {
        try {
            const response = await this.axiosInstance.get('/api/training/history', {
                params: { limit, offset }
            });
            return { success: true, data: response.data };
        } catch (error) {
            console.error('Get training history error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Evaluate model on test data
     */
    async evaluateModel(options) {
        try {
            const response = await this.axiosInstance.post('/api/training/evaluate', {
                model_id: options.modelId,
                test_data: options.testData,
                user_id: options.userId
            });
            return { success: true, data: response.data };
        } catch (error) {
            console.error('Evaluate model error:', error);
            return { success: false, error: error.message };
        }
    }

    // =========================================
    // Prediction Methods
    // =========================================

    /**
     * Make single prediction
     */
    async predict(options) {
        try {
            const response = await this.axiosInstance.post('/api/training/predict', {
                model_id: options.modelId,
                data: options.data,
                context: options.context
            });
            return { success: true, data: response.data };
        } catch (error) {
            console.error('Prediction error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Make batch predictions
     */
    async batchPredict(options) {
        try {
            const response = await this.axiosInstance.post('/api/training/predict/batch', {
                model_id: options.modelId,
                data_array: options.dataArray,
                context: options.context
            });
            return { success: true, data: response.data };
        } catch (error) {
            console.error('Batch prediction error:', error);
            return { success: false, error: error.message };
        }
    }

    // =========================================
    // Threat Detection Methods
    // =========================================

    /**
     * Detect malware
     */
    async detectMalware(options) {
        try {
            const response = await this.axiosInstance.post('/api/training/detect/malware', {
                file_data: options.fileData,
                filename: options.filename,
                hash: options.hash
            });
            return { success: true, data: response.data };
        } catch (error) {
            console.error('Malware detection error:', error);
            return { 
                success: false, 
                error: error.message,
                data: this.getFallbackMalwareDetection(options)
            };
        }
    }

    /**
     * Detect phishing
     */
    async detectPhishing(options) {
        try {
            const response = await this.axiosInstance.post('/api/training/detect/phishing', {
                url: options.url,
                page_content: options.pageContent
            });
            return { success: true, data: response.data };
        } catch (error) {
            console.error('Phishing detection error:', error);
            return { 
                success: false, 
                error: error.message,
                data: this.getFallbackPhishingDetection(options)
            };
        }
    }

    /**
     * Detect network intrusion
     */
    async detectIntrusion(options) {
        try {
            const response = await this.axiosInstance.post('/api/training/detect/intrusion', {
                network_data: options.networkData
            });
            return { success: true, data: response.data };
        } catch (error) {
            console.error('Intrusion detection error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Detect anomalies
     */
    async detectAnomaly(options) {
        try {
            const response = await this.axiosInstance.post('/api/training/detect/anomaly', {
                data: options.data,
                context: options.context
            });
            return { success: true, data: response.data };
        } catch (error) {
            console.error('Anomaly detection error:', error);
            return { success: false, error: error.message };
        }
    }

    // =========================================
    // Fallback Methods
    // =========================================

    getFallbackMalwareDetection(options) {
        // Basic heuristic-based fallback
        const suspiciousPatterns = ['.exe', '.dll', '.bat', '.cmd', '.ps1', '.vbs'];
        const filename = options.filename?.toLowerCase() || '';
        const isSuspicious = suspiciousPatterns.some(p => filename.includes(p));
        
        return {
            is_malware: isSuspicious,
            confidence: 0.3,
            threat_type: isSuspicious ? 'Potentially Unwanted Program' : 'Unknown',
            risk_score: isSuspicious ? 0.5 : 0.1,
            analysis_type: 'heuristic_fallback'
        };
    }

    getFallbackPhishingDetection(options) {
        const url = options.url?.toLowerCase() || '';
        const suspiciousIndicators = [
            'login', 'signin', 'verify', 'account', 'update', 'secure',
            'bank', 'paypal', 'amazon', 'microsoft', 'apple'
        ];
        
        const matches = suspiciousIndicators.filter(i => url.includes(i));
        const hasHttps = url.startsWith('https://');
        
        return {
            is_phishing: matches.length > 2 && !hasHttps,
            confidence: 0.3,
            risk_score: Math.min(matches.length * 0.15, 0.7),
            indicators: matches,
            analysis_type: 'heuristic_fallback'
        };
    }

    // ==========================================
    // Child Pages Integration Methods
    // ==========================================

    /**
     * Get global threat map data with live intelligence
     */
    async getThreatMap() {
        try {
            const response = await this.axiosInstance.get('/api/threat-map');
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('Threat map error:', error);
            return {
                success: false,
                error: error.response?.data?.detail || error.message,
                fallback: this.getFallbackThreatMap()
            };
        }
    }

    getFallbackThreatMap() {
        return {
            threats: [
                { id: 1, type: 'DDoS Attack', lat: 51.5074, lng: -0.1278, severity: 'critical', country: 'UK', timestamp: new Date().toISOString() },
                { id: 2, type: 'Ransomware', lat: 40.7128, lng: -74.0060, severity: 'high', country: 'USA', timestamp: new Date().toISOString() },
                { id: 3, type: 'Phishing Campaign', lat: 35.6762, lng: 139.6503, severity: 'medium', country: 'Japan', timestamp: new Date().toISOString() },
                { id: 4, type: 'Malware Distribution', lat: 55.7558, lng: 37.6173, severity: 'high', country: 'Russia', timestamp: new Date().toISOString() },
                { id: 5, type: 'Botnet Activity', lat: -23.5505, lng: -46.6333, severity: 'medium', country: 'Brazil', timestamp: new Date().toISOString() }
            ],
            statistics: {
                total_threats: 15420,
                active_attacks: 342,
                countries_affected: 89,
                threat_trend: '+12%'
            },
            source: 'fallback'
        };
    }

    /**
     * Get AI agent learning statistics
     */
    async getLearningStats() {
        try {
            const response = await this.axiosInstance.get('/api/agent/learning');
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('Learning stats error:', error);
            return {
                success: false,
                error: error.response?.data?.detail || error.message,
                fallback: this.getFallbackLearningStats()
            };
        }
    }

    getFallbackLearningStats() {
        return {
            totalPatterns: 15420,
            patternsLastWeek: 342,
            accuracy: 94.7,
            modelVersion: '2.1.0',
            lastTrainingDate: new Date(Date.now() - 86400000).toISOString(),
            categories: {
                malware: 4521,
                phishing: 3892,
                network_attacks: 2847,
                web_attacks: 2340,
                other: 1820
            },
            recentLearning: [
                { type: 'New malware signature', timestamp: new Date(Date.now() - 3600000).toISOString() },
                { type: 'Phishing pattern update', timestamp: new Date(Date.now() - 7200000).toISOString() },
                { type: 'Network anomaly detection', timestamp: new Date(Date.now() - 10800000).toISOString() }
            ],
            source: 'fallback'
        };
    }

    /**
     * Get available AI models and their status
     */
    async getAvailableModels() {
        try {
            const response = await this.axiosInstance.get('/api/models');
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('Available models error:', error);
            return {
                success: false,
                error: error.response?.data?.detail || error.message,
                fallback: this.getFallbackModels()
            };
        }
    }

    getFallbackModels() {
        return [
            { id: 'threat-detector', name: 'Threat Detection Model', status: 'active', accuracy: 96.2, version: '2.3.1', type: 'classification' },
            { id: 'malware-analyzer', name: 'Malware Analysis Engine', status: 'active', accuracy: 94.8, version: '1.9.0', type: 'deep_learning' },
            { id: 'phishing-detector', name: 'Phishing Detection Model', status: 'active', accuracy: 97.1, version: '2.0.5', type: 'nlp' },
            { id: 'anomaly-detector', name: 'Network Anomaly Detection', status: 'training', accuracy: 91.3, version: '1.5.2', type: 'unsupervised' },
            { id: 'vulnerability-scanner', name: 'Vulnerability Assessment', status: 'active', accuracy: 93.7, version: '2.1.0', type: 'hybrid' },
            { id: 'behavior-analyzer', name: 'Behavior Analysis Engine', status: 'active', accuracy: 89.4, version: '1.2.1', type: 'sequence' }
        ];
    }

    /**
     * Submit a task to AI agent
     */
    async submitAgentTask(task) {
        try {
            const response = await this.axiosInstance.post('/api/agent/task', {
                ...task,
                timestamp: new Date().toISOString()
            });
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('Submit task error:', error);
            return {
                success: false,
                error: error.response?.data?.detail || error.message
            };
        }
    }

    /**
     * Start model training
     */
    async startTraining(modelId, config = {}) {
        try {
            const response = await this.axiosInstance.post('/api/models/train', {
                model_id: modelId,
                config,
                timestamp: new Date().toISOString()
            });
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('Start training error:', error);
            return {
                success: false,
                error: error.response?.data?.detail || error.message
            };
        }
    }

    /**
     * Get detected threats from AI analysis
     */
    async getDetectedThreats(filters = {}) {
        try {
            const response = await this.axiosInstance.get('/api/agent/threats', { params: filters });
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('Get detected threats error:', error);
            return {
                success: false,
                error: error.response?.data?.detail || error.message,
                fallback: this.getFallbackDetectedThreats()
            };
        }
    }

    getFallbackDetectedThreats() {
        return [
            { id: 1, type: 'SQL Injection Attempt', severity: 'critical', source: '192.168.1.100', target: '/api/users', timestamp: new Date(Date.now() - 1800000).toISOString(), status: 'active' },
            { id: 2, type: 'XSS Attack', severity: 'high', source: '10.0.0.55', target: '/search', timestamp: new Date(Date.now() - 3600000).toISOString(), status: 'mitigated' },
            { id: 3, type: 'Brute Force Login', severity: 'high', source: '203.0.113.42', target: '/login', timestamp: new Date(Date.now() - 5400000).toISOString(), status: 'blocked' },
            { id: 4, type: 'Directory Traversal', severity: 'medium', source: '198.51.100.23', target: '/files', timestamp: new Date(Date.now() - 7200000).toISOString(), status: 'investigating' },
            { id: 5, type: 'Suspicious File Upload', severity: 'medium', source: '172.16.0.88', target: '/upload', timestamp: new Date(Date.now() - 9000000).toISOString(), status: 'quarantined' }
        ];
    }

    /**
     * Analyze browser session for security threats
     */
    async analyzeBrowserSession(sessionData) {
        try {
            const response = await this.axiosInstance.post('/api/browser/analyze', {
                session_data: sessionData,
                timestamp: new Date().toISOString()
            });
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('Browser session analysis error:', error);
            return {
                success: false,
                error: error.response?.data?.detail || error.message,
                fallback: {
                    risk_level: 'low',
                    threats_detected: 0,
                    recommendations: ['Enable HTTPS', 'Clear tracking cookies', 'Review browser extensions']
                }
            };
        }
    }

    /**
     * Perform scan with AI enhancement
     */
    async performAIScan(scanType, target, options = {}) {
        try {
            const response = await this.axiosInstance.post('/api/scan/ai-enhanced', {
                scan_type: scanType,
                target,
                options,
                timestamp: new Date().toISOString()
            });
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('AI scan error:', error);
            return {
                success: false,
                error: error.response?.data?.detail || error.message
            };
        }
    }

    /**
     * Get threat feed analysis
     */
    async analyzeThreatFeed(feedUrl) {
        try {
            const response = await this.axiosInstance.post('/api/threat-feeds/analyze', {
                feed_url: feedUrl,
                timestamp: new Date().toISOString()
            });
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('Threat feed analysis error:', error);
            return {
                success: false,
                error: error.response?.data?.detail || error.message
            };
        }
    }

    /**
     * Get AI agent status with detailed metrics
     */
    async getAgentStatus() {
        try {
            const response = await this.axiosInstance.get('/api/agent/status');
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('Agent status error:', error);
            return {
                success: false,
                error: error.response?.data?.detail || error.message,
                fallback: this.getFallbackAgentStatus()
            };
        }
    }

    getFallbackAgentStatus() {
        return {
            status: 'active',
            uptime: '72h 34m',
            tasksCompleted: 1247,
            tasksInProgress: 3,
            lastActivity: new Date(Date.now() - 300000).toISOString(),
            health: {
                cpu: 45,
                memory: 62,
                networkLatency: 23
            },
            capabilities: ['threat_detection', 'malware_analysis', 'phishing_detection', 'network_monitoring', 'vulnerability_scanning'],
            source: 'fallback'
        };
    }

    /**
     * Get model training history
     */
    async getTrainingHistory(modelId = null) {
        try {
            const url = modelId ? `/api/models/${modelId}/training-history` : '/api/models/training-history';
            const response = await this.axiosInstance.get(url);
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('Training history error:', error);
            return {
                success: false,
                error: error.response?.data?.detail || error.message,
                fallback: [
                    { id: 1, modelId: 'threat-detector', startTime: new Date(Date.now() - 86400000).toISOString(), endTime: new Date(Date.now() - 82800000).toISOString(), status: 'completed', accuracy: 96.2, epochs: 100 },
                    { id: 2, modelId: 'malware-analyzer', startTime: new Date(Date.now() - 172800000).toISOString(), endTime: new Date(Date.now() - 165600000).toISOString(), status: 'completed', accuracy: 94.8, epochs: 150 },
                    { id: 3, modelId: 'anomaly-detector', startTime: new Date(Date.now() - 3600000).toISOString(), endTime: null, status: 'training', accuracy: null, epochs: 45 }
                ]
            };
        }
    }

    /**
     * Get security recommendations based on current data
     */
    async getSecurityRecommendations(context = {}) {
        try {
            const response = await this.axiosInstance.post('/api/recommendations', {
                context,
                timestamp: new Date().toISOString()
            });
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('Security recommendations error:', error);
            return {
                success: false,
                error: error.response?.data?.detail || error.message,
                fallback: [
                    { priority: 'high', category: 'network', recommendation: 'Enable intrusion detection on all external interfaces' },
                    { priority: 'medium', category: 'authentication', recommendation: 'Implement multi-factor authentication' },
                    { priority: 'medium', category: 'monitoring', recommendation: 'Increase log retention period to 90 days' },
                    { priority: 'low', category: 'updates', recommendation: 'Schedule automatic security updates' }
                ]
            };
        }
    }
}

// Create singleton instance
const mlService = new MLService();

module.exports = {
    MLService,
    mlService
};
