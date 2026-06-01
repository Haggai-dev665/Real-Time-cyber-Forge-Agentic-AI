/**
 * CyberForge ML API Routes
 * REST endpoints for ML model predictions
 */

const express = require('express');
const router = express.Router();
const { cyberforgeML } = require('../services/cyberforgeMLService');

// ── Security-chat resilience ────────────────────────────────────────────────
// The HF Space's DeepSeek/Mistral chat depends on api-inference.huggingface.co,
// which is frequently unreachable from the Space (ConnectionError) or returns an
// empty body while models load. Detect those cases and serve grounded built-in
// cybersecurity guidance so the AI Assistance screen is always useful — this is
// the assistant's own knowledge, not fabricated telemetry.
function chatNeedsFallback(result) {
  if (!result || typeof result !== 'object') return true;
  if (result.error) return true;                       // upstream/ConnectionError
  if (result.success === false) return true;
  const text = result.response || result.answer || result.text || result.output || result.reply || result.message;
  return !(typeof text === 'string' && text.trim().length > 0);
}

function securityChatFallback(query) {
  const q = String(query || '').toLowerCase();
  const kb = [
    { k: ['phish'], a: 'Phishing is a social-engineering attack where an adversary impersonates a trusted entity (email, SMS, or a cloned site) to trick a victim into revealing credentials or running malware. Defenses: verify sender domains, never enter credentials from emailed links, enforce MFA, and detonate suspicious URLs in the sandbox before clicking. CyberForge\'s BERT URL classifier scores links for phishing in real time.' },
    { k: ['dga', 'domain generation'], a: 'A DGA (Domain Generation Algorithm) is malware that algorithmically generates many pseudo-random domains so its command-and-control server is hard to block. Indicators: high-entropy domain names and bursts of failed DNS lookups. CyberForge\'s DGA detector flags these by character entropy and n-gram patterns — try the dga-detector model on the Model Inference screen.' },
    { k: ['ransomware'], a: 'Ransomware encrypts a victim\'s files and demands payment. Response priorities: isolate the host immediately (Agent Core can quarantine), preserve forensic evidence, identify the strain, and restore from offline backups rather than paying. Early signals: mass file renames, shadow-copy deletion, and unusual outbound C2 beacons.' },
    { k: ['c2', 'command and control', 'beacon'], a: 'Command-and-Control (C2) is the channel malware uses to receive instructions and exfiltrate data. Hunt for it via periodic "beaconing" (regular-interval outbound connections), suspicious user-agents, and traffic to newly-registered or DGA domains. CyberForge surfaces beacon candidates in the Signal Pipeline and Threat Overview.' },
    { k: ['malware', 'trojan', 'stealer'], a: 'Malware is any software built to harm or gain unauthorized access. Triage: detonate the sample in the sandbox to observe behavior (file writes, registry persistence, network beacons), classify it with the malware model, then contain affected hosts. CyberForge fuses ML + BERT + DGA signals into one risk score per indicator.' },
    { k: ['mitre', 'att&ck'], a: 'MITRE ATT&CK is a knowledge base of real-world adversary tactics and techniques (e.g. T1566 Phishing, T1071 C2 over web protocols). CyberForge maps detected threats to ATT&CK technique IDs so you can see the kill-chain stage and choose the right containment playbook.' },
    { k: ['ioc', 'indicator'], a: 'An IOC (Indicator of Compromise) is forensic evidence of an intrusion — malicious URLs, domains, IPs, or file hashes. Use the IOC multi-scan (Model Inference → ioc-multiscan) to score any url/domain/ip/hash across all models at once, then add confirmed IOCs to your blocklist.' },
    { k: ['mfa', '2fa', 'multi-factor', 'multifactor'], a: 'Multi-Factor Authentication (MFA) requires a second proof of identity beyond a password, blocking most credential-theft attacks even when a password leaks. Prefer phishing-resistant factors (FIDO2/passkeys) over SMS, which is vulnerable to SIM-swap.' },
    { k: ['zero day', 'zero-day', 'cve', 'vulnerabilit'], a: 'A zero-day is a vulnerability exploited before a patch exists. Mitigate with defense-in-depth: network segmentation, least privilege, EDR behavioral detection, and rapid patching once a CVE is published. Track exposure on the Threat Overview and prioritize by exploitability and asset criticality.' },
    { k: ['sql', 'injection'], a: 'SQL injection lets an attacker run arbitrary database queries by smuggling SQL through unsanitized input. Defenses: parameterized queries / prepared statements, least-privilege DB accounts, input validation, and a WAF. It maps to MITRE T1190 (Exploit Public-Facing Application).' },
    { k: ['ddos', 'denial of service'], a: 'A DDoS floods a target with traffic to exhaust its resources. Mitigate with upstream scrubbing/CDN, rate limiting, anycast distribution, and autoscaling. Distinguish volumetric (bandwidth), protocol (SYN floods), and application-layer (HTTP) attacks — each needs a different control.' },
  ];
  for (const e of kb) { if (e.k.some((kw) => q.includes(kw))) return e.a; }
  return 'I\'m the CyberForge security assistant. I can explain threats (phishing, malware, ransomware, C2, DGA, SQL injection, DDoS), map activity to MITRE ATT&CK, triage IOCs, and recommend containment steps. The deep-reasoning model is warming up on the inference service — ask me about a specific threat type, host, or indicator and I\'ll give grounded guidance right now.';
}

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
        let result;
        try {
            result = await cyberforgeML.securityChat(query, max_tokens);
        } catch (svcErr) {
            result = null; // upstream threw → fall through to KB guidance
        }
        // If the HF Space errored or returned an empty body (models loading),
        // serve grounded knowledge so the assistant is never blank.
        if (chatNeedsFallback(result)) {
            return res.json({ success: true, response: securityChatFallback(query), model: 'cyberforge-kb', fallback: true });
        }
        res.json(result);
    } catch (error) {
        // Even on unexpected errors, keep the assistant useful.
        res.json({ success: true, response: securityChatFallback(req.body && req.body.query), model: 'cyberforge-kb', fallback: true });
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
