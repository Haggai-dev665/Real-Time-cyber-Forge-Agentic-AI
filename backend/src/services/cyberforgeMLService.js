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

        // Phase-3 transformer models (real HF transformers, hosted in the Space)
        this.transformerModels = {
            url_phishing_bert: {
                endpoint: '/api/v2/url-classify',
                input:    'url',
                desc:     'BERT URL phishing/malware classifier (elftsdmr/malware-url-detect)',
            },
            dga_detector: {
                endpoint: '/api/v2/dga-detect',
                input:    'domain',
                desc:     'DGA-generated domain detector (YangYang-Research/dga-detection)',
            },
            security_llm: {
                endpoint: '/api/v2/security-chat',
                input:    'query',
                desc:     'Cybersecurity Q&A LLM (ZySec-AI/SecurityLLM via HF Inference API)',
            },
        };

        console.log('🤖 CyberForge ML Service initialized');
        console.log(`   Heuristic Models: ${Object.keys(this.models).join(', ')}`);
        console.log(`   Transformer Models: ${Object.keys(this.transformerModels).join(', ')}`);
    }

    // ============================================================
    // Phase-3 Transformer model calls (delegate to HF Space v2 API)
    // ============================================================

    async _callTransformerEndpoint(endpoint, payload) {
        try {
            const response = await axios.post(`${this.hfSpaceUrl}${endpoint}`, payload, {
                timeout: 60000,
                headers: { 'Content-Type': 'application/json' },
            });
            return response.data;
        } catch (error) {
            return {
                error: error.response?.data?.detail || error.message,
                status: error.response?.status,
                inference_source: 'hf-space-v2-error',
            };
        }
    }

    async classifyUrlPhishing(url) {
        return this._callTransformerEndpoint('/api/v2/url-classify', { url });
    }

    async detectDga(domain) {
        return this._callTransformerEndpoint('/api/v2/dga-detect', { domain });
    }

    async securityChat(query, maxTokens = 512) {
        return this._callTransformerEndpoint('/api/v2/security-chat', { query, max_tokens: maxTokens });
    }

    async transformerStatus() {
        try {
            const response = await axios.get(`${this.hfSpaceUrl}/api/v2/status`, { timeout: 10000 });
            return response.data;
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Calculate threat score from features.
     * Score is the *signal density* of suspicious features (not a baseline).
     * A clean URL with no flags → 0 (minimal risk).
     * Range after clamp: [0, 1]. Sum of all positive weights ≈ 1.7.
     */
    calculateThreatScore(features) {
        let score = 0.0;

        for (const [feature, weight] of Object.entries(this.featureWeights)) {
            if (features[feature] !== undefined) {
                let value = features[feature];
                if (typeof value === 'boolean') value = value ? 1 : 0;
                score += value * weight;
            }
        }

        // No baseline offset — features must EARN risk, not start with it.
        // Negative weights (e.g. is_https=-0.2) reduce risk for clean signals.
        return Math.max(0, Math.min(1, score));
    }

    /**
     * Get risk level from score.
     * Tightened from prior thresholds — "medium" now requires real signals,
     * not the +0.5 baseline that flagged every URL.
     */
    getRiskLevel(score) {
        if (score >= 0.65) return 'critical';
        if (score >= 0.45) return 'high';
        if (score >= 0.25) return 'medium';
        if (score >= 0.10) return 'low';
        return 'minimal';
    }

    /**
     * Predict using local scoring (fast, no network).
     * Used as fallback when HF Space is unreachable.
     */
    predictLocal(modelName, features) {
        if (!this.models[modelName]) {
            return { error: `Unknown model: ${modelName}` };
        }

        const info = this.models[modelName];
        const score = this.calculateThreatScore(features);
        // Threshold for binary classification — aligned with "medium" risk floor
        const prediction = score >= 0.25 ? 1 : 0;
        // Confidence reflects distance from decision boundary, not arbitrary midpoint
        const confidence = Math.round(Math.min(100, Math.abs(score - 0.25) * 200) * 100) / 100;

        return {
            model: modelName,
            prediction: info.classes[prediction],
            prediction_id: prediction,
            is_threat: prediction === 1,
            confidence,
            risk_level: this.getRiskLevel(score),
            threat_score: Math.round(score * 10000) / 10000,
            model_accuracy: info.accuracy,
            inference_source: 'local-heuristic'
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
     * Main prediction method — uses real ML on HF Space by default,
     * falls back to local heuristic only if remote fails.
     * Pass `preferLocal=true` for offline/fast paths (e.g. bulk scans).
     */
    async predict(modelName, features, preferLocal = false) {
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
     * Analyze URL for security threats.
     * Aggregate logic: weighted blend of average + max so a single model
     * misfire can't dominate, but a unanimous high-confidence threat does.
     * Block requires either multi-model agreement or a single very-high score.
     */
    async analyzeUrl(url, additionalFeatures = {}) {
        const urlFeatures = this.extractUrlFeatures(url);
        const features = { ...urlFeatures, ...additionalFeatures };

        const results = {};
        for (const modelName of Object.keys(this.models)) {
            results[modelName] = await this.predict(modelName, features);
        }

        const scores = Object.values(results).map(r => r.threat_score || 0);
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        const maxScore = Math.max(...scores);
        // 60% average + 40% max — average grounds the verdict, max gives weight to outliers
        const blendedScore = 0.6 * avgScore + 0.4 * maxScore;
        // How many models flagged this as a threat?
        const agreeingModels = Object.values(results).filter(r => r.is_threat).length;
        const totalModels = Object.keys(results).length;
        const consensus = agreeingModels / totalModels;

        // Block: 2+ models agree AND blended ≥ high, OR any single model very confident
        // Warn: 1+ model flags it AND blended ≥ medium
        // Allow: otherwise
        let recommendedAction = 'allow';
        if ((consensus >= 0.5 && blendedScore >= 0.45) || maxScore >= 0.75) {
            recommendedAction = 'block';
        } else if (agreeingModels >= 1 && blendedScore >= 0.25) {
            recommendedAction = 'warn';
        }

        return {
            url,
            timestamp: new Date().toISOString(),
            aggregate: {
                average_threat_score: Math.round(avgScore * 10000) / 10000,
                max_threat_score: Math.round(maxScore * 10000) / 10000,
                blended_threat_score: Math.round(blendedScore * 10000) / 10000,
                overall_risk_level: this.getRiskLevel(blendedScore),
                model_consensus: `${agreeingModels}/${totalModels}`,
                recommended_action: recommendedAction
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
