/**
 * CyberForge ML API Routes
 * REST endpoints for ML model predictions
 */

const express = require('express');
const router = express.Router();
const { cyberforgeML } = require('../services/cyberforgeMLService');

/**
 * @route   GET /api/ml/health
 * @desc    Check ML service health
 * @access  Public
 */
router.get('/health', async (req, res) => {
    try {
        const health = await cyberforgeML.healthCheck();
        res.json(health);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   GET /api/ml/models
 * @desc    Get available models and their info
 * @access  Public
 */
router.get('/models', (req, res) => {
    try {
        const models = cyberforgeML.getModelInfo();
        res.json({
            count: Object.keys(models).length,
            models: models
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   GET /api/ml/models/:modelName
 * @desc    Get specific model info
 * @access  Public
 */
router.get('/models/:modelName', (req, res) => {
    try {
        const info = cyberforgeML.getModelInfo(req.params.modelName);
        if (!info) {
            return res.status(404).json({ error: 'Model not found' });
        }
        res.json({ model: req.params.modelName, ...info });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   POST /api/ml/predict
 * @desc    Make a prediction using specified model
 * @access  Public
 * @body    { model: string, features: object }
 */
router.post('/predict', async (req, res) => {
    try {
        const { model, features } = req.body;
        
        if (!model) {
            return res.status(400).json({ error: 'Model name required' });
        }
        if (!features || typeof features !== 'object') {
            return res.status(400).json({ error: 'Features object required' });
        }

        const result = await cyberforgeML.predict(model, features);
        
        if (result.error) {
            return res.status(400).json(result);
        }

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   POST /api/ml/predict/batch
 * @desc    Batch prediction for multiple samples
 * @access  Public
 * @body    { model: string, samples: array }
 */
router.post('/predict/batch', async (req, res) => {
    try {
        const { model, samples } = req.body;
        
        if (!model) {
            return res.status(400).json({ error: 'Model name required' });
        }
        if (!Array.isArray(samples)) {
            return res.status(400).json({ error: 'Samples array required' });
        }

        const results = await cyberforgeML.batchPredict(model, samples);
        res.json({
            model,
            count: results.length,
            predictions: results
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   POST /api/ml/analyze/url
 * @desc    Analyze a URL for security threats
 * @access  Public
 * @body    { url: string, features?: object }
 */
router.post('/analyze/url', async (req, res) => {
    try {
        const { url, features = {} } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: 'URL required' });
        }

        const result = await cyberforgeML.analyzeUrl(url, features);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   POST /api/ml/analyze/website
 * @desc    Analyze scraped website data
 * @access  Public
 * @body    { scraped_data: object }
 */
router.post('/analyze/website', async (req, res) => {
    try {
        const { scraped_data } = req.body;
        
        if (!scraped_data) {
            return res.status(400).json({ error: 'Scraped data required' });
        }

        const result = await cyberforgeML.analyzeWebsiteData(scraped_data);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   POST /api/ml/analyze
 * @desc    AI analysis – proxies to HF Space /analyze (Gemini + ML fallback)
 * @access  Public
 * @body    { query: string, context?: object, conversation_history?: array }
 */
router.post('/analyze', async (req, res) => {
    try {
        const { query, context = {}, conversation_history = [] } = req.body;
        if (!query) {
            return res.status(400).json({ error: 'query required' });
        }
        const result = await cyberforgeML.analyze(query, context, conversation_history);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   POST /api/ml/scan
 * @desc    Quick threat scan with all models
 * @access  Public
 * @body    { url: string } or { features: object }
 */
router.post('/scan', async (req, res) => {
    try {
        const { url, features } = req.body;
        
        if (url) {
            const result = await cyberforgeML.analyzeUrl(url, features || {});
            return res.json({
                scan_type: 'url',
                ...result
            });
        }
        
        if (features) {
            // Run all models on the features
            const results = {};
            for (const modelName of Object.keys(cyberforgeML.models)) {
                results[modelName] = await cyberforgeML.predict(modelName, features);
            }
            
            const scores = Object.values(results).map(r => r.threat_score);
            const maxScore = Math.max(...scores);
            
            return res.json({
                scan_type: 'features',
                timestamp: new Date().toISOString(),
                overall_risk_level: cyberforgeML.getRiskLevel(maxScore),
                max_threat_score: maxScore,
                recommended_action: maxScore >= 0.6 ? 'block' : maxScore >= 0.4 ? 'warn' : 'allow',
                model_predictions: results
            });
        }
        
        return res.status(400).json({ error: 'URL or features required' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   POST /api/cyberforge-ml/v2/url-classify
 * @desc    BERT URL phishing classifier (Phase 3 — elftsdmr/malware-url-detect)
 * @body    { url: string }
 */
router.post('/v2/url-classify', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'url required' });
        const result = await cyberforgeML.classifyUrlPhishing(url);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   POST /api/cyberforge-ml/v2/dga-detect
 * @desc    DGA-generated domain detector (Phase 3 — YangYang-Research/dga-detection)
 * @body    { domain: string }
 */
router.post('/v2/dga-detect', async (req, res) => {
    try {
        const { domain } = req.body;
        if (!domain) return res.status(400).json({ error: 'domain required' });
        const result = await cyberforgeML.detectDga(domain);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   POST /api/cyberforge-ml/v2/security-chat
 * @desc    Cybersecurity Q&A LLM — DeepSeek via HF Inference Providers, Mistral-7B
 *          fallback, ML heuristic as last resort.
 * @body    { query: string, max_tokens?: number }
 */
router.post('/v2/security-chat', async (req, res) => {
    try {
        const { query, max_tokens } = req.body;
        if (!query) return res.status(400).json({ error: 'query required' });
        const result = await cyberforgeML.securityChat(query, max_tokens);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   POST /api/cyberforge-ml/v2/ioc-scan
 * @desc    Multi-IOC scan (URL/domain/IP/hash) across all ML models + DGA + BERT,
 *          with a DeepSeek narrative when the Space has HF_TOKEN.
 * @body    { url?: string, domain?: string, ip?: string, hash?: string, context?: object }
 */
router.post('/v2/ioc-scan', async (req, res) => {
    try {
        const { url, domain, ip, hash, context } = req.body || {};
        if (!url && !domain && !ip && !hash) {
            return res.status(400).json({ error: 'at least one of url, domain, ip, hash required' });
        }
        const result = await cyberforgeML.iocScan({ url, domain, ip, hash, context });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   POST /api/cyberforge-ml/v2/url-enrich
 * @desc    AI Deep Scan — ML predictions + BERT + DGA + feature importances in one scored result.
 * @body    { url: string }
 */
router.post('/v2/url-enrich', async (req, res) => {
    try {
        const { url } = req.body || {};
        if (!url) return res.status(400).json({ error: 'url required' });
        const result = await cyberforgeML.urlEnrich(url);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   GET /api/cyberforge-ml/v2/status
 * @desc    Status of phase-3 transformer models on HF Space (loaded / errors / available)
 */
router.get('/v2/status', async (req, res) => {
    try {
        const result = await cyberforgeML.transformerStatus();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
