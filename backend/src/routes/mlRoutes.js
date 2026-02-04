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

module.exports = router;
