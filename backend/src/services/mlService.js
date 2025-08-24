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
            const response = await this.axiosInstance.post('/api/analysis/website', {
                url,
                content,
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
            const response = await this.axiosInstance.post('/api/threats/scan', {
                ...data,
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
            const response = await this.axiosInstance.post('/api/ai/chat', {
                message,
                conversation_id: conversationId,
                context,
                timestamp: new Date().toISOString()
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
}

// Create singleton instance
const mlService = new MLService();

module.exports = {
    MLService,
    mlService
};
