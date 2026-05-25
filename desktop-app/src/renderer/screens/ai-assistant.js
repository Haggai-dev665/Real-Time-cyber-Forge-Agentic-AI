/**
 * AI Assistant Screen — CyberForge (Wave 2)
 *
 * Enhancements over Wave 1:
 *  1. Routes to /api/ai/chat-context (backend bridge) which assembles live
 *     context (threats, scans, telemetry) and forwards to HF /api/v2/chat.
 *  2. Listens to Tauri telemetry events (cf:system-telemetry, cf:behavioral-alert)
 *     and attaches them to every turn so the chatbot is grounded in live data.
 *  3. Sources panel under each AI reply — cites the evidence used.
 *  4. "Translate" action button — sends raw data in translate mode for plain-
 *     language IOC/signal explanation.
 *  5. CF.notify on high-risk (risk_level = high | critical) replies.
 *  6. All colours via --cf-* tokens. No hardcoded hex. Zero Tauri invokes
 *     (telemetry is received via window events, not direct Rust commands).
 *
 * Preserved from Wave 1:
 *  show(container), hide(), _esc(), _renderMarkdown(), _appendSystemMsg(),
 *  the prompt-chip system, and the clear-button UX.
 */

class AIAssistantScreen {
    constructor() {
        this.container   = null;
        this.isActive    = false;
        this.history     = [];
        this.loading     = false;
        this.sessionId   = 'sess-' + Math.random().toString(36).slice(2, 10);

        // API base URLs
        this.BACKEND = window.CF_API?.API
            || 'https://cyberforge-ddd97655464f.herokuapp.com/api';
        this.ML      = window.CF_API?.ML
            || 'https://cyberforge-ddd97655464f.herokuapp.com/api/cyberforge-ml';

        // Live telemetry state — updated by Tauri event listeners
        this._telemetry         = {};
        this._behavioralAlerts  = [];
        this._telemetryUnlisten = null;
        this._behaviorUnlisten  = null;
    }

    /* ── Lifecycle ─────────────────────────────────────────────── */

    async show(container) {
        this.container = container;
        this.isActive  = true;
        this.container.innerHTML = this._shell();
        this._bindControls();
        this._startTelemetryListeners();
        await this._checkService();
    }

    hide() {
        this.isActive = false;
        this._stopTelemetryListeners();
    }

    /* ── Tauri telemetry event listeners ─────────────────────── */

    _startTelemetryListeners() {
        // Tauri v2 emits custom events via window.dispatchEvent;
        // the Rust side fires them as 'cf:system-telemetry', 'cf:behavioral-alert'.
        // We listen without invoking any Tauri command directly.
        this._telemetryHandler = (e) => {
            if (e.detail) this._telemetry = e.detail;
        };
        this._behaviorHandler = (e) => {
            if (e.detail) {
                this._behavioralAlerts.unshift(e.detail);
                if (this._behavioralAlerts.length > 20) {
                    this._behavioralAlerts = this._behavioralAlerts.slice(0, 20);
                }
            }
        };
        window.addEventListener('cf:system-telemetry', this._telemetryHandler);
        window.addEventListener('cf:behavioral-alert', this._behaviorHandler);
    }

    _stopTelemetryListeners() {
        if (this._telemetryHandler) {
            window.removeEventListener('cf:system-telemetry', this._telemetryHandler);
        }
        if (this._behaviorHandler) {
            window.removeEventListener('cf:behavioral-alert', this._behaviorHandler);
        }
    }

    /* ── Service Check ────────────────────────────────────────── */

    async _checkService() {
        const badge = document.getElementById('ai-svc-badge');
        try {
            const res  = await fetch(`${this.ML}/health`, { signal: AbortSignal.timeout(18000) });
            const data = await res.json();
            const ok          = data.status === 'healthy';
            const mlReady     = data.services?.ml_models    ?? false;
            const geminiReady = data.services?.gemini       ?? false;
            const modelsLoaded = data.services?.models_loaded ?? [];

            if (badge) {
                badge.className  = `cf-badge ${ok ? 'success' : 'warning'}`;
                badge.textContent = ok ? 'AI Online' : 'AI Degraded';
            }
            if (!ok) {
                this._appendSystemMsg('ML service is degraded. Responses may be limited.');
            } else if (mlReady) {
                const engine = geminiReady
                    ? 'Gemini AI + ML Models (context-grounded)'
                    : `ML Models (${modelsLoaded.length} active, context-grounded)`;
                this._appendSystemMsg(
                    `AI Security Assistant ready — powered by ${engine}. ` +
                    'Every answer is grounded in your live threat data and telemetry. ' +
                    'Ask about threats, paste a URL, or use "Translate" to decode raw signals.'
                );
            } else {
                this._appendSystemMsg('ML models are still loading. Try again in a moment.');
            }
        } catch (_) {
            if (badge) { badge.className = 'cf-badge error'; badge.textContent = 'AI Offline'; }
            this._appendSystemMsg(
                'ML service is unreachable. Check your connection or the Heroku backend status.'
            );
        }
    }

    /* ── Context Assembly ─────────────────────────────────────── */

    _buildContext() {
        return {
            telemetry:         this._telemetry,
            behavioral_alerts: this._behavioralAlerts.slice(0, 5),
        };
    }

    /* ── Chat ─────────────────────────────────────────────────── */

    async _sendMessage(text, options) {
        options = options || {};
        if (!text.trim() || this.loading) return;
        this.loading = true;

        const input   = document.getElementById('ai-input');
        const sendBtn = document.getElementById('ai-send');
        if (input)   input.value = '';
        if (sendBtn) sendBtn.disabled = true;

        this._appendUserMsg(text, options.isTranslate);

        const thinkingId = 'thinking-' + Date.now();
        this._appendThinking(thinkingId);

        try {
            const payload = {
                message:              text,
                session_id:           this.sessionId,
                conversation_history: this.history.slice(-10),
                translate:            options.isTranslate || false,
                raw_data:             options.rawData    || '',
                // Live telemetry merged in
                ...this._buildContext(),
            };

            // Try context-grounded bridge first; fall back to legacy /analyze
            let data = null;
            let usedBridge = false;
            try {
                const bridgeRes = await fetch(`${this.BACKEND}/ai/chat-context`, {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify(payload),
                    signal:  AbortSignal.timeout(50000),
                });
                if (bridgeRes.ok) {
                    data      = await bridgeRes.json();
                    usedBridge = true;
                }
            } catch (_) { /* fall through to legacy */ }

            // Legacy fallback: HF /analyze directly
            if (!data) {
                const legacyRes = await fetch(`${this.ML}/analyze`, {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({
                        query:                text,
                        context:              { source: 'desktop_assistant' },
                        conversation_history: this.history.slice(-10),
                    }),
                    signal: AbortSignal.timeout(35000),
                });
                if (!legacyRes.ok) throw new Error(`HTTP ${legacyRes.status}`);
                data = await legacyRes.json();
            }

            this._removeThinking(thinkingId);

            const reply       = data.response  || data.message || 'No response received.';
            const conf        = data.confidence;
            const riskLevel   = (data.risk_level  || 'unknown').toLowerCase();
            const riskScore   = data.risk_score  || 0;
            const modelUsed   = data.model_used  || (usedBridge ? 'bridge' : 'ml-fallback');
            const sources     = data.sources     || [];
            const ctxMeta     = data.context_assembled || null;
            const insights    = data.insights    || [];
            const recs        = data.recommendations || [];

            this._appendAssistantMsg(reply, {
                conf, riskLevel, riskScore, modelUsed, sources, ctxMeta, insights, recs
            });

            // CF.notify on high/critical risk
            if (riskLevel === 'high' || riskLevel === 'critical') {
                const notifyType = riskLevel === 'critical' ? 'error' : 'warning';
                if (window.CF?.notify) {
                    window.CF.notify(
                        notifyType,
                        `${riskLevel.toUpperCase()} Risk Detected`,
                        `AI flagged: risk score ${riskScore}/100. Review the response.`
                    );
                }
            }

            this.history.push(
                { role: 'user',      content: text  },
                { role: 'assistant', content: reply }
            );
            if (this.history.length > 20) this.history = this.history.slice(-20);

        } catch (e) {
            this._removeThinking(thinkingId);
            this._appendErrorMsg('Request failed: ' + (e.message || 'Unknown error'));
        }

        this.loading = false;
        if (sendBtn) sendBtn.disabled = false;
        if (input)   input.focus();
    }

    /* ── Message Rendering ────────────────────────────────────── */

    _appendUserMsg(text, isTranslate) {
        const feed = document.getElementById('ai-feed');
        if (!feed) return;
        const el = document.createElement('div');
        el.className = 'msg msg-user';
        const badge = isTranslate
            ? `<span class="ai-translate-badge"><i class="fas fa-language"></i> Translate</span>`
            : '';
        el.innerHTML = `
            <div class="msg-bubble user">
                ${badge}
                <div class="msg-text">${this._esc(text)}</div>
                <div class="msg-time">${this._ts()}</div>
            </div>
            <div class="msg-avatar user"><i class="fas fa-user"></i></div>
        `;
        feed.appendChild(el);
        this._scrollFeed();
    }

    _appendAssistantMsg(text, opts) {
        opts = opts || {};
        const { conf, riskLevel, riskScore, modelUsed, sources, ctxMeta, insights, recs } = opts;
        const feed = document.getElementById('ai-feed');
        if (!feed) return;
        const el = document.createElement('div');
        el.className = 'msg msg-ai';

        // Risk badge
        let riskBadge = '';
        if (riskLevel && riskLevel !== 'unknown') {
            const rCls = { critical: 'error', high: 'error', medium: 'warning', low: 'success' };
            const cls  = rCls[riskLevel] || 'info';
            riskBadge  = `<span class="cf-badge ${cls} ai-risk-badge">
                <i class="fas fa-shield-halved"></i>
                ${this._esc(riskLevel.toUpperCase())} · ${riskScore}/100
            </span>`;
        }

        // Confidence badge
        let confBadge = '';
        if (conf != null) {
            const pct  = (conf * 100).toFixed(0);
            const cCls = conf >= 0.8 ? 'success' : conf >= 0.5 ? 'warning' : 'error';
            confBadge  = `<span class="cf-badge ${cCls}">Confidence: ${pct}%</span>`;
        }

        // Model chip
        const modelChip = modelUsed
            ? `<span class="ai-model-chip"><i class="fas fa-microchip"></i> ${this._esc(modelUsed)}</span>`
            : '';

        // Context metadata (how much live data was assembled)
        let ctxLine = '';
        if (ctxMeta) {
            const parts = [];
            if (ctxMeta.threats_found  > 0) parts.push(`${ctxMeta.threats_found} threats`);
            if (ctxMeta.scans_found    > 0) parts.push(`${ctxMeta.scans_found} scans`);
            if (ctxMeta.has_telemetry)       parts.push('telemetry');
            if (ctxMeta.has_behavioral)      parts.push('behavioral');
            if (parts.length) {
                ctxLine = `<div class="ai-ctx-line"><i class="fas fa-database"></i> Grounded on: ${this._esc(parts.join(', '))} — ${ctxMeta.elapsed_ms}ms</div>`;
            }
        }

        // Sources panel
        let sourcePanel = '';
        if (sources && sources.length) {
            const srcItems = sources.slice(0, 8).map(s =>
                `<div class="ai-src-item">
                    <span class="ai-src-type">${this._esc(s.type || 'source')}</span>
                    <span class="ai-src-label">${this._esc(s.label || '')}</span>
                    ${s.value ? `<span class="ai-src-value">${this._esc(String(s.value).slice(0, 60))}</span>` : ''}
                </div>`
            ).join('');
            sourcePanel = `
                <details class="ai-sources-panel">
                    <summary><i class="fas fa-link"></i> Sources (${sources.length})</summary>
                    <div class="ai-src-list">${srcItems}</div>
                </details>`;
        }

        // Insights & recommendations (from legacy /analyze path)
        let extrasHtml = '';
        if (insights && insights.length) {
            extrasHtml += `<div class="ai-extras insights">
                <strong class="ai-extras-label">Insights</strong>
                <ul>${insights.map(i => `<li>${this._esc(i)}</li>`).join('')}</ul>
            </div>`;
        }
        if (recs && recs.length) {
            extrasHtml += `<div class="ai-extras recs">
                <strong class="ai-extras-label">Recommendations</strong>
                <ul>${recs.map(r => `<li>${this._esc(r)}</li>`).join('')}</ul>
            </div>`;
        }

        // "Translate this response" action
        const translateBtn = `<button class="ai-translate-btn" data-content="${this._esc(text)}" title="Ask the AI to explain this in plain language">
            <i class="fas fa-language"></i> Translate
        </button>`;

        el.innerHTML = `
            <div class="msg-avatar ai"><i class="fas fa-robot"></i></div>
            <div class="msg-bubble ai">
                <div class="ai-msg-meta">
                    ${riskBadge}${confBadge}${modelChip}
                </div>
                <div class="msg-text">${this._renderMarkdown(text)}</div>
                ${ctxLine}
                ${sourcePanel}
                ${extrasHtml}
                <div class="ai-msg-footer">
                    ${translateBtn}
                    <span class="msg-time">${this._ts()}</span>
                </div>
            </div>
        `;

        // Wire translate button
        const tBtn = el.querySelector('.ai-translate-btn');
        if (tBtn) {
            tBtn.addEventListener('click', () => {
                const rawContent = tBtn.dataset.content || text;
                this._sendMessage(
                    `Please explain the following in plain, non-technical language so a non-security professional can understand it:\n\n${rawContent.slice(0, 800)}`,
                    { isTranslate: true, rawData: rawContent.slice(0, 1500) }
                );
            });
        }

        feed.appendChild(el);
        this._scrollFeed();
    }

    _appendSystemMsg(text) {
        const feed = document.getElementById('ai-feed');
        if (!feed) return;
        const el = document.createElement('div');
        el.className = 'msg msg-system';
        el.innerHTML = `<div class="msg-system-text">${this._esc(text)}</div>`;
        feed.appendChild(el);
        this._scrollFeed();
    }

    _appendErrorMsg(text) {
        const feed = document.getElementById('ai-feed');
        if (!feed) return;
        const el = document.createElement('div');
        el.className = 'msg msg-system';
        el.innerHTML = `<div class="msg-system-text msg-system-error">${this._esc(text)}</div>`;
        feed.appendChild(el);
        this._scrollFeed();
    }

    _appendThinking(id) {
        const feed = document.getElementById('ai-feed');
        if (!feed) return;
        const el = document.createElement('div');
        el.id        = id;
        el.className = 'msg msg-ai';
        el.innerHTML = `
            <div class="msg-avatar ai"><i class="fas fa-robot"></i></div>
            <div class="msg-bubble ai thinking">
                <span class="thinking-dot"></span>
                <span class="thinking-dot"></span>
                <span class="thinking-dot"></span>
                <span class="thinking-label">Analyzing with live context…</span>
            </div>
        `;
        feed.appendChild(el);
        this._scrollFeed();
    }

    _removeThinking(id) {
        document.getElementById(id)?.remove();
    }

    _scrollFeed() {
        const feed = document.getElementById('ai-feed');
        if (feed) feed.scrollTop = feed.scrollHeight;
    }

    _ts() {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    _renderMarkdown(text) {
        return this._esc(text)
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g,    '<em>$1</em>')
            .replace(/`([^`]+)`/g,    '<code>$1</code>')
            .replace(/\n/g,           '<br>');
    }

    _esc(s) {
        return String(s || '')
            .replace(/&/g,  '&amp;')
            .replace(/</g,  '&lt;')
            .replace(/>/g,  '&gt;')
            .replace(/"/g,  '&quot;');
    }

    /* ── Controls ─────────────────────────────────────────────── */

    _bindControls() {
        const input   = document.getElementById('ai-input');
        const sendBtn = document.getElementById('ai-send');
        const clearBtn = document.getElementById('ai-clear');

        sendBtn?.addEventListener('click', () => {
            const text = input?.value.trim();
            if (text) this._sendMessage(text);
        });

        input?.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const text = input.value.trim();
                if (text) this._sendMessage(text);
            }
        });

        clearBtn?.addEventListener('click', () => {
            const feed = document.getElementById('ai-feed');
            if (feed) feed.innerHTML = '';
            this.history = [];
            this.sessionId = 'sess-' + Math.random().toString(36).slice(2, 10);
            this._appendSystemMsg('Conversation cleared. New session started.');
        });

        // Suggested prompts
        document.querySelectorAll('.ai-prompt-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const text = chip.dataset.prompt;
                if (text) this._sendMessage(text);
            });
        });

        // Telemetry indicator refresh
        this._updateTelemetryBar();
        setInterval(() => { if (this.isActive) this._updateTelemetryBar(); }, 6000);
    }

    _updateTelemetryBar() {
        const bar = document.getElementById('ai-telem-bar');
        if (!bar) return;
        const t = this._telemetry;
        if (!t || Object.keys(t).length === 0) {
            bar.textContent = 'Telemetry: waiting for Tauri events…';
            return;
        }
        const parts = [];
        if (t.cpu    != null) parts.push(`CPU ${t.cpu}%`);
        if (t.ram    != null) parts.push(`RAM ${t.ram}%`);
        if (t.net_in_kbps != null) parts.push(`Net ${t.net_in_kbps} kbps`);
        const alertCount = this._behavioralAlerts.length;
        if (alertCount > 0) parts.push(`${alertCount} behavioral alert${alertCount > 1 ? 's' : ''}`);
        bar.textContent = parts.length
            ? 'Live context: ' + parts.join(' · ')
            : 'Telemetry: active';
    }

    /* ── Shell ────────────────────────────────────────────────── */

    _shell() {
        const prompts = [
            'What are the top phishing indicators?',
            'Explain ransomware attack vectors',
            'How do I detect SQL injection attempts?',
            'What is a zero-day exploit?',
            'How to respond to a data breach?',
            'What does my current risk score mean?',
        ];

        return `
<style>
/* ── Layout ──────────────────────────────────────────────────── */
.ai-wrap {
    display:flex; flex-direction:column;
    height:calc(100vh - 160px); gap:var(--cf-space-3);
}
.ai-chat-area { flex:1; display:flex; flex-direction:column; overflow:hidden; }
.ai-feed {
    flex:1; overflow-y:auto; padding:var(--cf-space-4);
    background:var(--cf-bg-secondary); border-radius:var(--cf-radius-xl);
    border:1px solid var(--cf-border-light);
    display:flex; flex-direction:column; gap:var(--cf-space-3);
}

/* ── Messages ────────────────────────────────────────────────── */
.msg { display:flex; align-items:flex-end; gap:var(--cf-space-2); }
.msg-user { flex-direction:row-reverse; }
.msg-avatar {
    width:30px; height:30px; border-radius:50%; display:flex;
    align-items:center; justify-content:center; font-size:13px; flex-shrink:0;
}
.msg-avatar.ai   { background:var(--cf-interactive-default); color:white; }
.msg-avatar.user { background:var(--cf-surface-3); color:var(--cf-text-primary); }
.msg-bubble {
    max-width:72%; padding:var(--cf-space-3) var(--cf-space-4);
    border-radius:var(--cf-radius-xl); line-height:var(--cf-leading-relaxed);
    font-size:var(--cf-text-sm); position:relative;
}
.msg-bubble.ai {
    background:var(--cf-card-bg); border:1px solid var(--cf-border-light);
    border-bottom-left-radius:var(--cf-radius-sm); color:var(--cf-text-primary);
}
.msg-bubble.user {
    background:var(--cf-interactive-default); color:white;
    border-bottom-right-radius:var(--cf-radius-sm);
}
.msg-bubble.thinking {
    padding:var(--cf-space-3) var(--cf-space-4);
    display:flex; gap:6px; align-items:center; flex-wrap:wrap;
}
.thinking-dot {
    width:7px; height:7px; border-radius:50%; background:var(--cf-text-muted);
    animation:thinkingBounce 1.2s ease infinite;
}
.thinking-dot:nth-child(2) { animation-delay:0.2s; }
.thinking-dot:nth-child(3) { animation-delay:0.4s; }
.thinking-label {
    font-size:11px; color:var(--cf-text-muted); margin-left:4px; font-style:italic;
}
@keyframes thinkingBounce {
    0%,80%,100% { transform:translateY(0); opacity:0.4; }
    40%          { transform:translateY(-6px); opacity:1; }
}
.msg-text { color:inherit; }
.msg-bubble.ai .msg-text code {
    background:var(--cf-surface-2); padding:1px 5px;
    border-radius:var(--cf-radius-sm); font-family:var(--cf-font-mono); font-size:11px;
}
.msg-time { font-size:10px; margin-top:4px; opacity:0.5; }
.msg-system { justify-content:center; }
.msg-system-text {
    font-size:12px; color:var(--cf-text-muted);
    background:var(--cf-surface-1); border:1px solid var(--cf-border-light);
    padding:6px 14px; border-radius:var(--cf-radius-full); text-align:center;
}
.msg-system-error { color:var(--cf-status-error); }

/* ── AI message meta row ─────────────────────────────────────── */
.ai-msg-meta {
    display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px; align-items:center;
}
.ai-risk-badge { font-size:10px; }
.ai-model-chip {
    font-size:10px; color:var(--cf-text-muted); padding:2px 8px;
    border:1px solid var(--cf-border-light); border-radius:var(--cf-radius-full);
    display:inline-flex; align-items:center; gap:4px;
}

/* ── Context grounding line ──────────────────────────────────── */
.ai-ctx-line {
    font-size:10px; color:var(--cf-text-muted); margin-top:6px;
    display:flex; align-items:center; gap:5px; opacity:0.75;
}

/* ── Sources panel ───────────────────────────────────────────── */
.ai-sources-panel {
    margin-top:8px; border-top:1px solid var(--cf-border-light); padding-top:6px;
}
.ai-sources-panel summary {
    font-size:11px; color:var(--cf-text-muted); cursor:pointer;
    display:flex; align-items:center; gap:6px; user-select:none;
    list-style:none; outline:none;
}
.ai-sources-panel summary::-webkit-details-marker { display:none; }
.ai-src-list { margin-top:6px; display:flex; flex-direction:column; gap:3px; }
.ai-src-item {
    display:flex; align-items:center; gap:6px; font-size:10px;
    color:var(--cf-text-secondary);
}
.ai-src-type {
    background:var(--cf-surface-2); border-radius:var(--cf-radius-sm);
    padding:1px 6px; font-size:9px; text-transform:uppercase;
    letter-spacing:0.04em; color:var(--cf-text-muted); flex-shrink:0;
}
.ai-src-label { font-weight:500; color:var(--cf-text-primary); }
.ai-src-value { color:var(--cf-text-muted); font-family:var(--cf-font-mono); font-size:9px; }

/* ── Extras (insights / recs) ────────────────────────────────── */
.ai-extras { margin-top:8px; padding-top:8px; border-top:1px solid var(--cf-border-light); }
.ai-extras-label {
    font-size:11px; text-transform:uppercase; letter-spacing:0.05em;
    color:var(--cf-text-muted); display:block; margin-bottom:4px;
}
.ai-extras ul { padding-left:16px; margin:4px 0; }
.ai-extras li { font-size:12px; color:var(--cf-text-secondary); line-height:1.6; }

/* ── AI message footer ───────────────────────────────────────── */
.ai-msg-footer {
    display:flex; align-items:center; justify-content:space-between;
    margin-top:8px; padding-top:6px; border-top:1px solid var(--cf-border-light);
}
.ai-translate-btn {
    font-size:11px; color:var(--cf-interactive-default);
    background:none; border:1px solid var(--cf-interactive-default);
    border-radius:var(--cf-radius-full); padding:2px 10px; cursor:pointer;
    display:flex; align-items:center; gap:5px;
    transition:background var(--cf-transition-button), color var(--cf-transition-button);
}
.ai-translate-btn:hover {
    background:var(--cf-interactive-subtle); color:var(--cf-text-primary);
}
.ai-translate-badge {
    display:inline-flex; align-items:center; gap:5px;
    font-size:10px; background:var(--cf-surface-2);
    border-radius:var(--cf-radius-full); padding:1px 8px;
    color:var(--cf-interactive-default); margin-bottom:5px;
}

/* ── Telemetry bar ───────────────────────────────────────────── */
.ai-telem-bar {
    font-size:10px; color:var(--cf-text-muted);
    padding:4px 12px; background:var(--cf-surface-1);
    border:1px solid var(--cf-border-light);
    border-radius:var(--cf-radius-full); text-align:center;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}

/* ── Input bar ───────────────────────────────────────────────── */
.ai-input-bar {
    display:flex; align-items:flex-end; gap:var(--cf-space-2);
    background:var(--cf-card-bg); border:1px solid var(--cf-border-light);
    border-radius:var(--cf-radius-xl); padding:var(--cf-space-2) var(--cf-space-3);
    box-shadow:var(--cf-shadow-sm);
}
.ai-input-bar textarea {
    flex:1; background:none; border:none; outline:none;
    color:var(--cf-text-primary); font-size:var(--cf-text-sm);
    font-family:var(--cf-font-primary); resize:none;
    line-height:var(--cf-leading-normal); max-height:120px;
    overflow-y:auto; padding:var(--cf-space-2) 0;
}
.ai-input-bar textarea::placeholder { color:var(--cf-text-muted); }

/* ── Prompt chips ────────────────────────────────────────────── */
.ai-prompt-chips { display:flex; gap:var(--cf-space-2); flex-wrap:wrap; }
.ai-prompt-chip {
    padding:4px 12px; border-radius:var(--cf-radius-full);
    background:var(--cf-surface-1); border:1px solid var(--cf-border-light);
    font-size:var(--cf-text-xs); color:var(--cf-text-secondary); cursor:pointer;
    transition:all var(--cf-transition-button); white-space:nowrap;
}
.ai-prompt-chip:hover {
    background:var(--cf-interactive-subtle);
    border-color:var(--cf-interactive-default);
    color:var(--cf-interactive-default);
}
</style>

<div class="ai-wrap">

    <div class="screen-header" style="margin-bottom:0">
        <div>
            <h1 class="screen-title">AI Security Assistant</h1>
            <p class="screen-subtitle">Context-grounded — powered by live threat data, telemetry &amp; ML models</p>
        </div>
        <div class="screen-actions">
            <span id="ai-svc-badge" class="cf-badge">Checking…</span>
            <button class="cf-btn" id="ai-clear"><i class="fas fa-trash-alt"></i> Clear</button>
        </div>
    </div>

    <!-- Live telemetry indicator -->
    <div id="ai-telem-bar" class="ai-telem-bar">Telemetry: waiting for Tauri events…</div>

    <!-- Prompt chips -->
    <div class="ai-prompt-chips">
        ${prompts.map(p => `<button class="ai-prompt-chip" data-prompt="${this._esc(p)}">${this._esc(p)}</button>`).join('')}
    </div>

    <!-- Chat feed -->
    <div class="ai-chat-area">
        <div id="ai-feed" class="ai-feed"></div>
    </div>

    <!-- Input bar -->
    <div class="ai-input-bar">
        <textarea id="ai-input" rows="1"
            placeholder="Ask about threats, paste a URL to analyze, or ask me to translate raw data…"></textarea>
        <button class="cf-btn primary" id="ai-send" style="flex-shrink:0;height:36px">
            <i class="fas fa-paper-plane"></i>
        </button>
    </div>

</div>`;
    }
}

window.AIAssistantScreen = AIAssistantScreen;
