/**
 * The backend's language-model order (F28, plan section 15):
 *
 *   1. A hosted model, only when the server is configured for one
 *      (GEMINI_API_KEY). Not set in the deployed app.
 *   2. The ML service's chat route: its open-source model (Qwen3.5-2B, run in
 *      the Space), or the service's rule-based summary when that model does
 *      not answer.
 *   3. Template text from the backend.
 *
 * Each step has a timeout. Returns { text, source, model, engine, latencyMs,
 * error? }, where `engine` says which of these produced the text
 * (services/answerEngine.js). Step 2 used to be labelled "ZySec-AI/SecurityLLM",
 * a model nothing here runs.
 */

const axios = require('axios');
const { getMLServiceUrl } = require('../config/ml.config');
const { memoryService } = require('./memoryService');

const HF_SPACE_URL = getMLServiceUrl();
const GEMINI_KEY   = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const { ENGINES, engineOfSpaceAnswer } = require('./answerEngine');

class LLMFallbackChain {
    /**
     * Ask the LLM chain for a security-domain answer.
     *
     * @param {string} prompt          — user query / analysis context
     * @param {object} opts
     * @param {string} opts.contextKey — memory key for conversation continuity
     * @param {number} opts.maxTokens
     * @param {number} opts.timeoutMs
     */
    async ask(prompt, { contextKey = null, maxTokens = 512, timeoutMs = 25000 } = {}) {
        const t0 = Date.now();
        const history = contextKey ? memoryService.getLlmContext(contextKey) : [];

        // ── 1. Gemini (primary) ───────────────────────────────────
        try {
            const geminiText = await this._callGemini(prompt, history, maxTokens, timeoutMs);
            if (geminiText) {
                if (contextKey) {
                    memoryService.pushLlmTurn(contextKey, 'user', prompt);
                    memoryService.pushLlmTurn(contextKey, 'assistant', geminiText);
                }
                return { text: geminiText, source: 'gemini', model: GEMINI_MODEL, engine: ENGINES.hosted('gemini', GEMINI_MODEL), latencyMs: Date.now() - t0 };
            }
        } catch (e) {
            console.warn(`[LLMChain] Gemini failed (${e.message?.slice(0, 80)}), falling to the ML service...`);
        }

        // ── 2. The ML service's /api/v2/security-chat: its open-source model, or
        //       its rule-based summary when the model does not answer. The answer
        //       says which; it used to be labelled "ZySec SecurityLLM" either way.
        try {
            const spaceAnswer = await this._callSpace(prompt, maxTokens, timeoutMs);
            if (spaceAnswer) {
                if (contextKey) {
                    memoryService.pushLlmTurn(contextKey, 'user', prompt);
                    memoryService.pushLlmTurn(contextKey, 'assistant', spaceAnswer.text);
                }
                const engine = engineOfSpaceAnswer(spaceAnswer.raw);
                return { text: spaceAnswer.text, source: engine.id, model: engine.model, engine, latencyMs: Date.now() - t0 };
            }
        } catch (e) {
            console.warn(`[LLMChain] ML service failed (${e.message?.slice(0, 80)}), falling to template text...`);
        }

        // ── 3. Heuristic — last-resort canned synthesis ───────────
        return {
            text:      this._heuristicSynthesis(prompt),
            source:    'heuristic-fallback',
            engine:    ENGINES.template(),
            latencyMs: Date.now() - t0,
            error:     'No language model answered: template text',
        };
    }

    /**
     * Quick threat-explanation flavor — short answer focused on a URL/file.
     */
    async explainThreat({ target, riskScore, findings, mitre = [], iocs = [] }) {
        const prompt = `Explain the security risk of "${target}" in 3-4 sentences.
Risk score: ${riskScore}/100
Findings: ${(findings || []).slice(0, 6).map(f => '- ' + f).join('\n')}
MITRE: ${mitre.slice(0, 4).map(t => `${t.techniqueId} (${t.tactic})`).join(', ') || 'none'}
IOCs: ${iocs.slice(0, 5).map(i => `${i.type}:${i.value}`).join(', ') || 'none'}

Be concise. Lead with the verdict.`;
        return this.ask(prompt, { maxTokens: 350, timeoutMs: 20000 });
    }

    // ────────────────────────────────────────────────────────────
    // PROVIDER CALLS
    // ────────────────────────────────────────────────────────────

    async _callGemini(prompt, history, maxTokens, timeoutMs) {
        if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY not set');
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
        const contents = [
            ...history.map(h => ({
                role:  h.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: h.content }],
            })),
            { role: 'user', parts: [{ text: prompt }] },
        ];
        const r = await axios.post(url, {
            contents,
            generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 },
        }, { timeout: timeoutMs });
        const text = r.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('Gemini returned empty response');
        return text.trim();
    }

    async _callSpace(prompt, maxTokens, timeoutMs) {
        const r = await axios.post(`${HF_SPACE_URL}/api/v2/security-chat`,
            // the model's time inside this request's own timeout, with a margin
            { query: prompt, max_tokens: maxTokens, time_budget_s: Math.max(5, Math.floor(timeoutMs / 1000) - 8) },
            { timeout: timeoutMs }
        );
        const text = r.data?.response || r.data?.text || r.data?.generated_text;
        if (!text) throw new Error(r.data?.error || 'the ML service returned no text');
        return { text: String(text).trim(), raw: r.data };
    }

    _heuristicSynthesis(prompt) {
        // Extract risk score / target if present in the prompt for a slightly smarter fallback
        const scoreMatch = prompt.match(/Risk score:\s*(\d+)/i);
        const targetMatch = prompt.match(/"([^"]+)"/);
        const target = targetMatch ? targetMatch[1] : 'target';
        const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;
        if (score >= 65) return `${target} shows critical-level threat indicators (score ${score}/100). Block access and investigate the listed IOCs and MITRE techniques. Both AI providers are currently unavailable — verdict based on rule-based analysis only.`;
        if (score >= 45) return `${target} shows high-risk indicators (score ${score}/100). Recommended: block traffic, alert SOC, capture session for review. AI explanation unavailable; rely on the IOC + MITRE evidence below.`;
        if (score >= 25) return `${target} shows moderate suspicious signals (score ${score}/100). Treat with caution — review listed findings before allowing further activity. AI explanation unavailable.`;
        return `${target} shows minimal threat signals (score ${score}/100). No immediate action needed. AI providers unavailable, but heuristic scoring suggests low risk.`;
    }
}

const llmFallbackChain = new LLMFallbackChain();
module.exports = { LLMFallbackChain, llmFallbackChain };
