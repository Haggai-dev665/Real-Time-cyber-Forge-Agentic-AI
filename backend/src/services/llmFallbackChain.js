/**
 * LLM Fallback Chain — Gemini → ZySec/HF → heuristic
 *
 * Single entry point for any LLM call in the orchestrator. Tries Gemini first
 * (best quality), falls back to ZySec-AI/SecurityLLM via HF Inference API
 * (cyber-tuned but rate-limited), then drops to a heuristic synthesis.
 *
 * Each provider is wrapped in a try-catch with a per-call timeout. Returns:
 *   { text, source, latencyMs, error? }
 */

const axios = require('axios');
const { memoryService } = require('./memoryService');

const HF_SPACE_URL = process.env.HF_SPACE_URL || 'https://che237-cyberforge.hf.space';
const GEMINI_KEY   = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

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
                return { text: geminiText, source: 'gemini', model: GEMINI_MODEL, latencyMs: Date.now() - t0 };
            }
        } catch (e) {
            console.warn(`[LLMChain] Gemini failed (${e.message?.slice(0, 80)}), falling to ZySec...`);
        }

        // ── 2. ZySec-AI/SecurityLLM via HF Space's /api/v2/security-chat ──
        try {
            const zysecText = await this._callZySec(prompt, maxTokens, timeoutMs);
            if (zysecText) {
                if (contextKey) {
                    memoryService.pushLlmTurn(contextKey, 'user', prompt);
                    memoryService.pushLlmTurn(contextKey, 'assistant', zysecText);
                }
                return { text: zysecText, source: 'zysec-securityllm', model: 'ZySec-AI/SecurityLLM', latencyMs: Date.now() - t0 };
            }
        } catch (e) {
            console.warn(`[LLMChain] ZySec failed (${e.message?.slice(0, 80)}), falling to heuristic...`);
        }

        // ── 3. Heuristic — last-resort canned synthesis ───────────
        return {
            text:      this._heuristicSynthesis(prompt),
            source:    'heuristic-fallback',
            latencyMs: Date.now() - t0,
            error:     'Both Gemini and ZySec unavailable — using rule-based response',
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

    async _callZySec(prompt, maxTokens, timeoutMs) {
        const r = await axios.post(`${HF_SPACE_URL}/api/v2/security-chat`,
            { query: prompt, max_tokens: maxTokens },
            { timeout: timeoutMs }
        );
        // The HF Space auto-falls back to Gemini internally too, so any usable text wins.
        const text = r.data?.response || r.data?.text || r.data?.generated_text;
        if (!text) throw new Error(r.data?.error || 'ZySec returned no text');
        return String(text).trim();
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
