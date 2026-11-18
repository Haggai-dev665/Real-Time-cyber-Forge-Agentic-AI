/**
 * CyberForge ML API Routes
 * REST endpoints for ML model predictions
 */

const { ENGINES, engineOfSpaceAnswer } = require('../services/answerEngine');
const express = require('express');
const { verifiedUser } = require('../middleware/verifiedUser');
const router = express.Router();

// Every route below requires a signed-in user, and takes the user's identity
// from the session rather than from the request.
router.use(verifiedUser);
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

/** The conversation so far, as the ML service takes it: at most 8 turns, roles user|assistant, 2,000 characters each. */
function chatHistory(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.slice(-8)
        .filter(turn => turn && typeof turn === 'object' && typeof turn.content === 'string' && turn.content.trim())
        .map(turn => ({ role: turn.role === 'assistant' ? 'assistant' : 'user', content: turn.content.slice(0, 2000) }));
}
const THINK_MODES = new Set(['auto', 'on', 'off']);
const thinkMode = value => (THINK_MODES.has(value) ? value : undefined);
const answerTokens = value => Math.min(1200, Math.max(16, Number.isFinite(+value) && +value > 0 ? Math.round(+value) : 700));

/** What the assistant says when the model was asked and did not finish (shared by both chat routes). */
function noAnswer(reason) {
    return {
        success: true, answered: false, reason, model: 'none',
        response: `The Analysis Agents' language model did not answer this time (${reason}). Try again in a moment, or ask something shorter.`,
        engine: ENGINES.noAnswer()
    };
}

/**
 * @route   POST /api/cyberforge-ml/v2/security-chat/stream
 * @desc    The assistant's answer as it is written (server-sent events): the
 *          model's reasoning ({type:"thinking", delta}), then the answer
 *          ({type:"answer", delta}), then {type:"final", result} with the
 *          checked answer and the engine that produced it. The final answer
 *          can differ from the streamed text: the ML service adds or substitutes
 *          reviewed facts when the model's answer misses or contradicts them.
 * @body    { query: string, history?: [{role, content}], think?: "auto"|"on"|"off", max_tokens?: number }
 */
router.post('/v2/security-chat/stream', async (req, res) => {
    const { query } = req.body || {};
    if (!query || typeof query !== 'string') return res.status(400).json({ error: 'query required' });
    if (query.length > 32000) return res.status(400).json({ error: 'query is longer than 32000 characters' });
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    // no-transform: the compression middleware must not hold the stream back
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
    const send = event => res.write(`data: ${JSON.stringify(event)}\n\n`);
    let finished = false;
    const finish = result => { if (finished) return; finished = true; send({ type: 'final', result }); res.end(); };
    let upstream;
    try {
        upstream = await cyberforgeML.securityChatStream(query, {
            maxTokens: answerTokens(req.body.max_tokens), history: chatHistory(req.body.history), think: thinkMode(req.body.think) || 'auto'
        });
    } catch (error) {
        return finish(noAnswer('the ML service could not be reached'));
    }
    if (!upstream || upstream.status !== 200 || !upstream.data || typeof upstream.data.on !== 'function') {
        if (upstream && upstream.data && typeof upstream.data.resume === 'function') upstream.data.resume();
        return finish(noAnswer(`the ML service answered ${upstream ? upstream.status : 'nothing'}`));
    }
    // An ML service without streaming answers with one JSON body: pass that answer on whole.
    const type = String((upstream.headers && upstream.headers['content-type']) || '');
    if (!type.includes('event-stream')) {
        let body = '';
        upstream.data.on('data', chunk => { body += chunk.toString('utf8'); });
        upstream.data.on('error', () => finish(noAnswer('the connection to the ML service was lost')));
        upstream.data.on('end', () => {
            let result = null;
            try { result = JSON.parse(body); } catch (_) { /* not JSON */ }
            if (!result || result.answered === false || chatNeedsFallback(result)) {
                const reason = result && typeof result.error === 'string' && result.error ? result.error.slice(0, 200) : 'no reason given';
                return finish(noAnswer(reason));
            }
            finish({ ...result, engine: engineOfSpaceAnswer(result) });
        });
        return;
    }
    // the person left: stop reading, so the ML service can stop writing
    res.on('close', () => { if (!finished && typeof upstream.data.destroy === 'function') upstream.data.destroy(); });
    let buffer = '';
    upstream.data.on('data', chunk => {
        buffer += chunk.toString('utf8');
        let at;
        while ((at = buffer.indexOf('\n\n')) >= 0) {
            const block = buffer.slice(0, at);
            buffer = buffer.slice(at + 2);
            const line = block.split('\n').find(l => l.startsWith('data: '));
            if (!line) continue;
            let event;
            try { event = JSON.parse(line.slice(6)); } catch (_) { continue; }
            if (event.type === 'final') {
                const result = event.result && typeof event.result === 'object' ? event.result : {};
                if (result.answered === false || !result.response) {
                    const reason = typeof result.error === 'string' && result.error ? result.error.slice(0, 200) : 'no reason given';
                    finish(noAnswer(reason));
                } else {
                    finish({ ...result, engine: engineOfSpaceAnswer(result) });
                }
            } else if ((event.type === 'thinking' || event.type === 'answer') && typeof event.delta === 'string') {
                send({ type: event.type, delta: event.delta });
            }
        }
    });
    upstream.data.on('end', () => finish(noAnswer('the answer stopped before it was finished')));
    upstream.data.on('error', () => finish(noAnswer('the connection to the ML service was lost')));
});

/**
 * @route   POST /api/cyberforge-ml/v2/security-chat
 * @desc    Cybersecurity Q&A, answered by the open-source model in the ML
 *          service, or by its rule-based summary, or by the backend's
 *          reference text. Every answer carries `engine`: which of these it was.
 * @body    { query: string, max_tokens?: number, history?: [{role, content}], think?: "auto"|"on"|"off" }
 */
router.post('/v2/security-chat', async (req, res) => {
    try {
        const { query, max_tokens } = req.body;
        if (!query) return res.status(400).json({ error: 'query required' });
        let result;
        try {
            result = await cyberforgeML.securityChat(query, max_tokens, 40, { history: chatHistory(req.body.history), think: thinkMode(req.body.think) });
        } catch (svcErr) {
            result = null; // upstream threw → fall through to KB guidance
        }
        // If the HF Space errored or returned an empty body (models loading),
        // serve grounded knowledge so the assistant is never blank.
        // The model was asked and did not finish: say so, with the reason,
        // rather than offering stock text as if it answered the question.
        if (result && result.answered === false) {
            const reason = typeof result.error === 'string' && result.error ? result.error.slice(0, 200) : 'no reason given';
            return res.json({
                success: true,
                answered: false,
                reason,
                model: 'none',
                response: `The Analysis Agents' language model did not answer this time (${reason}). It runs on a small shared CPU, so a long question can run out of time. Try again in a moment, or ask something shorter.`,
                engine: ENGINES.noAnswer()
            });
        }
        if (chatNeedsFallback(result)) {
            return res.json({ success: true, response: securityChatFallback(query), model: 'cyberforge-kb', fallback: true, engine: ENGINES.knowledgeBase() });
        }
        res.json({ ...result, engine: engineOfSpaceAnswer(result) });
    } catch (error) {
        // Even on unexpected errors, keep the assistant useful.
        res.json({ success: true, response: securityChatFallback(req.body && req.body.query), model: 'cyberforge-kb', fallback: true, engine: ENGINES.knowledgeBase() });
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
