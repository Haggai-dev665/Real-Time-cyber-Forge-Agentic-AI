/**
 * AI Assistant Screen — CyberForge
 * Chat interface wired to the ML service /analyze endpoint (Gemini + memory).
 */

class AIAssistantScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.history = [];
        this.loading = false;
        this.ML = window.CF_API?.ML || 'https://cyberforge-ddd97655464f.herokuapp.com/api/cyberforge-ml';
        this.BACKEND = window.CF_API?.API || 'https://cyberforge-ddd97655464f.herokuapp.com/api';
    }

    async show(container) {
        this.container = container;
        this.isActive = true;
        this.container.innerHTML = this._shell();
        this._bindControls();
        await this._checkService();
    }

    hide() {
        this.isActive = false;
    }

    /* ── Service Check ────────────────────────────────────────── */

    async _checkService() {
        const badge = document.getElementById('ai-svc-badge');
        try {
            const res = await fetch(`${this.ML}/health`, { signal: AbortSignal.timeout(18000) });
            const data = await res.json();
            const ok = data.status === 'healthy';
            const mlReady = data.services?.ml_models ?? false;
            const geminiReady = data.services?.gemini ?? false;
            const modelsLoaded = data.services?.models_loaded ?? [];

            if (badge) {
                badge.className = `cf-badge ${ok ? 'success' : 'warning'}`;
                badge.textContent = ok ? 'AI Online' : 'AI Degraded';
            }

            if (!ok) {
                this._appendSystemMsg('⚠️ ML service is degraded. Responses may be limited.');
            } else if (mlReady) {
                const engine = geminiReady ? 'Gemini AI + ML Models' : `ML Models (${modelsLoaded.length} active)`;
                this._appendSystemMsg(`AI Agent ready — powered by ${engine}. Ask me anything: threat analysis, URL checks, risk assessment, and more.`);
            } else {
                this._appendSystemMsg('⚠️ ML models are still loading. Try again in a moment.');
            }
        } catch {
            if (badge) { badge.className = 'cf-badge error'; badge.textContent = 'AI Offline'; }
            this._appendSystemMsg('❌ ML service is unreachable. Check your connection or the Heroku backend status.');
        }
    }

    /* ── Chat ─────────────────────────────────────────────────── */

    async _sendMessage(text) {
        if (!text.trim() || this.loading) return;
        this.loading = true;

        const input = document.getElementById('ai-input');
        const sendBtn = document.getElementById('ai-send');
        if (input) input.value = '';
        if (sendBtn) sendBtn.disabled = true;

        this._appendUserMsg(text);

        const thinkingId = 'thinking-' + Date.now();
        this._appendThinking(thinkingId);

        try {
            const payload = {
                query: text,
                context: { source: 'desktop_assistant', type: 'general_query' },
                conversation_history: this.history.slice(-10),
            };

            const res = await fetch(`${this.ML}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            this._removeThinking(thinkingId);

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            const reply = data.response || data.message || 'No response received.';
            const conf = data.confidence;
            const insights = data.insights || [];
            const recs = data.recommendations || [];

            this._appendAssistantMsg(reply, conf, insights, recs);

            this.history.push(
                { role: 'user', content: text },
                { role: 'assistant', content: reply }
            );
            if (this.history.length > 20) this.history = this.history.slice(-20);

        } catch (e) {
            this._removeThinking(thinkingId);
            this._appendErrorMsg('Request failed: ' + (e.message || 'Unknown error') + '. Is the ML service running?');
        }

        this.loading = false;
        if (sendBtn) sendBtn.disabled = false;
        if (input) input.focus();
    }

    /* ── Message Rendering ────────────────────────────────────── */

    _appendUserMsg(text) {
        const feed = document.getElementById('ai-feed');
        if (!feed) return;
        const el = document.createElement('div');
        el.className = 'msg msg-user';
        el.innerHTML = `
            <div class="msg-bubble user">
                <div class="msg-text">${this._esc(text)}</div>
                <div class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            <div class="msg-avatar user"><i class="fas fa-user"></i></div>
        `;
        feed.appendChild(el);
        this._scrollFeed();
    }

    _appendAssistantMsg(text, confidence, insights, recommendations) {
        const feed = document.getElementById('ai-feed');
        if (!feed) return;
        const el = document.createElement('div');
        el.className = 'msg msg-ai';

        let extras = '';
        if (confidence != null) {
            const pct = (confidence * 100).toFixed(0);
            const cls = confidence >= 0.8 ? 'success' : confidence >= 0.5 ? 'warning' : 'error';
            extras += `<div style="margin-top:8px"><span class="cf-badge ${cls}">Confidence: ${pct}%</span></div>`;
        }
        if (insights.length) {
            extras += `<div class="ai-extras insights">
                <strong style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:var(--cf-text-muted)">Insights</strong>
                <ul>${insights.map(i => `<li>${this._esc(i)}</li>`).join('')}</ul>
            </div>`;
        }
        if (recommendations.length) {
            extras += `<div class="ai-extras recs">
                <strong style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:var(--cf-text-muted)">Recommendations</strong>
                <ul>${recommendations.map(r => `<li>${this._esc(r)}</li>`).join('')}</ul>
            </div>`;
        }

        el.innerHTML = `
            <div class="msg-avatar ai"><i class="fas fa-robot"></i></div>
            <div class="msg-bubble ai">
                <div class="msg-text">${this._renderMarkdown(text)}</div>
                ${extras}
                <div class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
        `;
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
        el.innerHTML = `<div class="msg-system-text" style="color:var(--cf-status-error)">${this._esc(text)}</div>`;
        feed.appendChild(el);
        this._scrollFeed();
    }

    _appendThinking(id) {
        const feed = document.getElementById('ai-feed');
        if (!feed) return;
        const el = document.createElement('div');
        el.id = id;
        el.className = 'msg msg-ai';
        el.innerHTML = `
            <div class="msg-avatar ai"><i class="fas fa-robot"></i></div>
            <div class="msg-bubble ai thinking">
                <span class="thinking-dot"></span>
                <span class="thinking-dot"></span>
                <span class="thinking-dot"></span>
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

    _renderMarkdown(text) {
        return this._esc(text)
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }

    _esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /* ── Controls ─────────────────────────────────────────────── */

    _bindControls() {
        const input = document.getElementById('ai-input');
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
            this._appendSystemMsg('Conversation cleared. How can I help you?');
        });

        // Suggested prompts
        document.querySelectorAll('.ai-prompt-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const text = chip.dataset.prompt;
                if (text) this._sendMessage(text);
            });
        });
    }

    /* ── Shell ────────────────────────────────────────────────── */

    _shell() {
        const prompts = [
            'What are the top phishing indicators?',
            'Explain ransomware attack vectors',
            'How do I detect SQL injection attempts?',
            'What is a zero-day exploit?',
            'How to respond to a data breach?',
        ];

        return `
<style>
.ai-wrap { display:flex; flex-direction:column; height:calc(100vh - 160px); gap:var(--cf-space-4); }
.ai-chat-area { flex:1; display:flex; flex-direction:column; overflow:hidden; }
.ai-feed {
    flex:1; overflow-y:auto; padding:var(--cf-space-4);
    background:var(--cf-bg-secondary); border-radius:var(--cf-radius-xl);
    border:1px solid var(--cf-border-light);
    display:flex; flex-direction:column; gap:var(--cf-space-3);
}
.msg { display:flex; align-items:flex-end; gap:var(--cf-space-2); }
.msg-user { flex-direction:row-reverse; }
.msg-avatar {
    width:30px; height:30px; border-radius:50%; display:flex; align-items:center;
    justify-content:center; font-size:13px; flex-shrink:0;
}
.msg-avatar.ai  { background:var(--cf-interactive-default); color:white; }
.msg-avatar.user { background:var(--cf-surface-3); color:var(--cf-text-primary); }
.msg-bubble {
    max-width:72%; padding:var(--cf-space-3) var(--cf-space-4);
    border-radius:var(--cf-radius-xl); line-height:var(--cf-leading-relaxed);
    font-size:var(--cf-text-sm); position:relative;
}
.msg-bubble.ai {
    background:var(--cf-card-bg); border:1px solid var(--cf-border-light);
    border-bottom-left-radius:var(--cf-radius-sm);
    color:var(--cf-text-primary);
}
.msg-bubble.user {
    background:var(--cf-interactive-default); color:white;
    border-bottom-right-radius:var(--cf-radius-sm);
}
.msg-bubble.thinking { padding:var(--cf-space-3) var(--cf-space-4); display:flex; gap:6px; align-items:center; }
.thinking-dot {
    width:7px; height:7px; border-radius:50%; background:var(--cf-text-muted);
    animation:thinkingBounce 1.2s ease infinite;
}
.thinking-dot:nth-child(2) { animation-delay:0.2s; }
.thinking-dot:nth-child(3) { animation-delay:0.4s; }
@keyframes thinkingBounce {
    0%,80%,100% { transform:translateY(0); opacity:0.4; }
    40% { transform:translateY(-6px); opacity:1; }
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
.ai-extras { margin-top:8px; padding-top:8px; border-top:1px solid var(--cf-border-light); }
.ai-extras ul { padding-left:16px; margin:4px 0; }
.ai-extras li { font-size:12px; color:var(--cf-text-secondary); line-height:1.6; }
.ai-input-bar {
    display:flex; align-items:flex-end; gap:var(--cf-space-2);
    background:var(--cf-card-bg); border:1px solid var(--cf-border-light);
    border-radius:var(--cf-radius-xl); padding:var(--cf-space-2) var(--cf-space-3);
    box-shadow:var(--cf-shadow-sm);
}
.ai-input-bar textarea {
    flex:1; background:none; border:none; outline:none;
    color:var(--cf-text-primary); font-size:var(--cf-text-sm);
    font-family:var(--cf-font-primary); resize:none; line-height:var(--cf-leading-normal);
    max-height:120px; overflow-y:auto; padding:var(--cf-space-2) 0;
}
.ai-input-bar textarea::placeholder { color:var(--cf-text-muted); }
.ai-prompt-chips { display:flex; gap:var(--cf-space-2); flex-wrap:wrap; }
.ai-prompt-chip {
    padding:4px 12px; border-radius:var(--cf-radius-full);
    background:var(--cf-surface-1); border:1px solid var(--cf-border-light);
    font-size:var(--cf-text-xs); color:var(--cf-text-secondary); cursor:pointer;
    transition:all var(--cf-transition-button); white-space:nowrap;
}
.ai-prompt-chip:hover { background:var(--cf-interactive-subtle); border-color:var(--cf-interactive-default); color:var(--cf-interactive-default); }
</style>

<div class="ai-wrap">

    <div class="screen-header" style="margin-bottom:0">
        <div>
            <h1 class="screen-title">AI Security Assistant</h1>
            <p class="screen-subtitle">Powered by CyberForge ML Models + Gemini AI</p>
        </div>
        <div class="screen-actions">
            <span id="ai-svc-badge" class="cf-badge">Checking...</span>
            <button class="cf-btn" id="ai-clear"><i class="fas fa-trash-alt"></i> Clear</button>
        </div>
    </div>

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
        <textarea id="ai-input" rows="1" placeholder="Ask about threats, analyze a URL, or request a security assessment..."></textarea>
        <button class="cf-btn primary" id="ai-send" style="flex-shrink:0;height:36px">
            <i class="fas fa-paper-plane"></i>
        </button>
    </div>

</div>`;
    }
}

window.AIAssistantScreen = AIAssistantScreen;
