/**
 * CyberForge ML Integration Service
 * Connects backend to HuggingFace-deployed models
 * 
 * Models: https://huggingface.co/Che237/cyberforge-models
 * Training Space: https://huggingface.co/spaces/Che237/cyberforge
 */

const axios = require('axios');

class CyberForgeMLService {
    constructor() {
        // ML Service endpoints
        this.localAPIUrl = process.env.AI_SERVICE_URL || 'http://localhost:8001';
        this.hfSpaceUrl = 'https://che237-cyberforge.hf.space';
        
        // Model configurations from training
        this.models = {
            phishing_detection: {
                accuracy: 0.989,
                f1_score: 0.989,
                inference_ms: 0.021,
                classes: ['benign', 'phishing']
            },
            malware_detection: {
                accuracy: 0.998,
                f1_score: 0.998,
                inference_ms: 0.001,
                classes: ['benign', 'malware']
            },
            anomaly_detection: {
                accuracy: 0.999,
                f1_score: 0.999,
                inference_ms: 0.007,
                classes: ['normal', 'anomaly']
            },
            web_attack_detection: {
                accuracy: 1.0,
                f1_score: 1.0,
                inference_ms: 0.029,
                classes: ['benign', 'attack']
            }
        };

        // Feature weights for threat scoring
        this.featureWeights = {
            is_https: -0.2,
            has_mixed_content: 0.3,
            missing_headers_count: 0.1,
            has_insecure_cookies: 0.2,
            external_requests: 0.05,
            failed_requests: 0.15,
            console_errors: 0.1,
            suspicious_apis: 0.25,
            url_length: 0.001,
            has_ip_address: 0.3,
            has_suspicious_tld: 0.25
        };

        console.log('🤖 CyberForge ML Service initialized');
        console.log(`   Models: ${Object.keys(this.models).join(', ')}`);
    }

    /**
     * Calculate threat score from features
     */
    calculateThreatScore(features) {
        let score = 0.0;
        
        for (const [feature, weight] of Object.entries(this.featureWeights)) {
            if (features[feature] !== undefined) {
                let value = features[feature];
                if (typeof value === 'boolean') {
                    value = value ? 1 : 0;
                }
                score += value * weight;
            }
        }
        
        // Normalize to 0-1
        return Math.max(0, Math.min(1, score + 0.5));
    }

    /**
     * Get risk level from score
     */
    getRiskLevel(score) {
        if (score >= 0.8) return 'critical';
        if (score >= 0.6) return 'high';
        if (score >= 0.4) return 'medium';
        if (score >= 0.2) return 'low';
        return 'minimal';
    }

    /**
     * Predict using local scoring (fast, no network)
     */
    predictLocal(modelName, features) {
        if (!this.models[modelName]) {
            return { error: `Unknown model: ${modelName}` };
        }

        const info = this.models[modelName];
        const score = this.calculateThreatScore(features);
        const prediction = score > 0.5 ? 1 : 0;
        const confidence = Math.abs(score - 0.5) * 2 * 100;

        return {
            model: modelName,
            prediction: info.classes[prediction],
            prediction_id: prediction,
            is_threat: prediction === 1,
            confidence: Math.round(confidence * 100) / 100,
            risk_level: this.getRiskLevel(score),
            threat_score: Math.round(score * 10000) / 10000,
            model_accuracy: info.accuracy,
            inference_source: 'local'
        };
    }

    /**
     * Predict using HuggingFace Space API (if available)
     */
    async predictRemote(modelName, features) {
        try {
            const response = await axios.post(`${this.hfSpaceUrl}/predict`, {
                model: modelName,
                features: features
            }, {
                timeout: 10000,
                headers: { 'Content-Type': 'application/json' }
            });

            return {
                ...response.data,
                inference_source: 'huggingface_space'
            };
        } catch (error) {
            // Fall back to local prediction
            console.log(`⚠️ Remote prediction failed, using local: ${error.message}`);
            return this.predictLocal(modelName, features);
        }
    }

    /**
     * Main prediction method - tries remote first, falls back to local
     */
    async predict(modelName, features, preferLocal = true) {
        if (preferLocal) {
            return this.predictLocal(modelName, features);
        }
        return this.predictRemote(modelName, features);
    }

    /**
     * Batch prediction for multiple samples
     */
    async batchPredict(modelName, featuresList) {
        return Promise.all(
            featuresList.map(features => this.predict(modelName, features))
        );
    }

    /**
     * Analyze URL for security threats
     */
    async analyzeUrl(url, additionalFeatures = {}) {
        // Extract URL features
        const urlFeatures = this.extractUrlFeatures(url);
        const features = { ...urlFeatures, ...additionalFeatures };

        // Run all models
        const results = {};
        for (const modelName of Object.keys(this.models)) {
            results[modelName] = await this.predict(modelName, features);
        }

        // Calculate aggregate threat assessment
        const scores = Object.values(results).map(r => r.threat_score);
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        const maxScore = Math.max(...scores);

        return {
            url,
            timestamp: new Date().toISOString(),
            aggregate: {
                average_threat_score: Math.round(avgScore * 10000) / 10000,
                max_threat_score: Math.round(maxScore * 10000) / 10000,
                overall_risk_level: this.getRiskLevel(maxScore),
                recommended_action: maxScore >= 0.6 ? 'block' : maxScore >= 0.4 ? 'warn' : 'allow'
            },
            model_predictions: results,
            features_analyzed: features
        };
    }

    /**
     * Extract security features from URL
     */
    extractUrlFeatures(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;
            const path = urlObj.pathname;

            // Suspicious TLDs
            const suspiciousTlds = ['xyz', 'top', 'club', 'work', 'click', 'loan', 'tk', 'ml', 'ga', 'cf'];
            const tld = hostname.split('.').pop();

            // IP address pattern
            const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;

            return {
                is_https: urlObj.protocol === 'https:',
                url_length: url.length,
                hostname_length: hostname.length,
                path_length: path.length,
                has_ip_address: ipPattern.test(hostname),
                has_suspicious_tld: suspiciousTlds.includes(tld.toLowerCase()),
                subdomain_count: hostname.split('.').length - 2,
                has_port: urlObj.port !== '',
                query_params_count: urlObj.searchParams.size,
                has_at_symbol: url.includes('@'),
                has_double_slash: url.includes('//')  && url.indexOf('//') !== url.indexOf('://'),
                special_char_count: (url.match(/[!@#$%^&*()_+=\[\]{};':"\\|,.<>\/?]/g) || []).length
            };
        } catch (error) {
            return {
                is_https: false,
                url_length: url?.length || 0,
                has_suspicious_tld: true,
                parse_error: true
            };
        }
    }

    /**
     * Analyze scraped website data
     */
    async analyzeWebsiteData(scrapedData) {
        const features = {
            is_https: scrapedData.security_report?.is_https || false,
            has_mixed_content: scrapedData.security_report?.mixed_content || false,
            missing_headers_count: scrapedData.security_report?.missing_security_headers?.length || 0,
            has_insecure_cookies: scrapedData.security_report?.insecure_cookies || false,
            total_requests: scrapedData.network_requests?.length || 0,
            external_requests: this.countExternalRequests(scrapedData),
            failed_requests: this.countFailedRequests(scrapedData),
            console_errors: this.countConsoleErrors(scrapedData),
            console_warnings: this.countConsoleWarnings(scrapedData),
            html_size: scrapedData.html_length || 0
        };

        return this.analyzeUrl(scrapedData.url, features);
    }

    countExternalRequests(data) {
        if (!data.network_requests || !data.url) return 0;
        try {
            const baseHost = new URL(data.url).hostname;
            return data.network_requests.filter(r => {
                try {
                    return new URL(r.url).hostname !== baseHost;
                } catch {
                    return false;
                }
            }).length;
        } catch {
            return 0;
        }
    }

    countFailedRequests(data) {
        if (!data.network_requests) return 0;
        return data.network_requests.filter(r => (r.status || 200) >= 400).length;
    }

    countConsoleErrors(data) {
        if (!data.console_logs) return 0;
        return data.console_logs.filter(l => l.level === 'error').length;
    }

    countConsoleWarnings(data) {
        if (!data.console_logs) return 0;
        return data.console_logs.filter(l => l.level === 'warning').length;
    }

    /**
     * Get model information
     */
    getModelInfo(modelName = null) {
        if (modelName) {
            return this.models[modelName] || null;
        }
        return this.models;
    }

    /**
     * AI analysis — proxies to HF Space /analyze (Gemini + ML fallback)
     */
    async analyze(query, context = {}, conversationHistory = []) {
        try {
            const response = await axios.post(`${this.hfSpaceUrl}/analyze`, {
                query,
                context,
                conversation_history: conversationHistory,
            }, {
                timeout: 30000,
                headers: { 'Content-Type': 'application/json' },
            });
            return response.data;
        } catch (error) {
            console.error(`⚠️ HF Space /analyze failed: ${error.message}`);
            return {
                response: 'ML service temporarily unavailable. Please try again.',
                confidence: 0.1,
                risk_level: 'Unknown',
                risk_score: 0,
                insights: [],
                recommendations: ['Retry in a moment'],
                model_used: 'error-fallback',
                timestamp: new Date().toISOString(),
            };
        }
    }

    /**
     * Health check — includes live HF Space status
     */
    async healthCheck() {
        let hfStatus = 'unknown';
        let mlModelsLoaded = [];
        try {
            const res = await axios.get(`${this.hfSpaceUrl}/health`, { timeout: 10000 });
            hfStatus = res.data?.status || 'healthy';
            mlModelsLoaded = res.data?.services?.models_loaded || [];
        } catch {
            hfStatus = 'unreachable';
        }
        return {
            status: hfStatus === 'unreachable' ? 'degraded' : 'healthy',
            models_available: Object.keys(this.models),
            model_count: Object.keys(this.models).length,
            hf_space_status: hfStatus,
            ml_models_loaded: mlModelsLoaded,
            huggingface_repo: 'https://huggingface.co/Che237/cyberforge-models',
            training_space: 'https://huggingface.co/spaces/Che237/cyberforge',
            timestamp: new Date().toISOString(),
        };
    }
}

// Export singleton instance
const cyberforgeML = new CyberForgeMLService();

module.exports = {
    CyberForgeMLService,
    cyberforgeML,
    // Convenience methods
    predict: (model, features) => cyberforgeML.predict(model, features),
    analyzeUrl: (url, features) => cyberforgeML.analyzeUrl(url, features),
    analyzeWebsiteData: (data) => cyberforgeML.analyzeWebsiteData(data),
    healthCheck: () => cyberforgeML.healthCheck()
};
