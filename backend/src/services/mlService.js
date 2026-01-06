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
    async chatWithAI(message, conversationId = null, context = {}) {
        try {
            const response = await this.axiosInstance.post('/analyze', {
                query: message,
                conversation_history: conversationId ? [conversationId] : [],
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
}

// Create singleton instance
const mlService = new MLService();

module.exports = {
    MLService,
    mlService
};
