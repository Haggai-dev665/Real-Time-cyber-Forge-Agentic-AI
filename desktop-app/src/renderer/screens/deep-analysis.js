/**
 * Deep Analysis Screen
 * Advanced URL and content security analysis powered by the ML service.
 */

class DeepAnalysisScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.activeTab = 'url';
        this.analysisHistory = [];
        this._bound = {};
    }

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    show(container) {
        this.container = container;
        this.isActive = true;
        this.container.innerHTML = this._shell();
        this._bindEvents();
        this._renderTab(this.activeTab);
    }

    hide() {
        this.isActive = false;
        this.container = null;
    }

    // -------------------------------------------------------------------------
    // XSS helpers
    // -------------------------------------------------------------------------

    _esc(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // -------------------------------------------------------------------------
    // Shell HTML
    // -------------------------------------------------------------------------

    _shell() {
        return `
<div id="deep-analysis-root" style="
    display:flex;
    flex-direction:column;
    gap:var(--cf-space-5);
    padding:var(--cf-space-6);
    min-height:100%;
    background:var(--cf-bg-app);
    color:var(--cf-text-primary);
    font-family:var(--cf-font-primary);
">
    <!-- Header -->
    <div class="screen-header">
        <div>
            <div class="screen-title">Deep Analysis</div>
            <div class="screen-subtitle">Advanced URL and content security analysis via the ML service</div>
        </div>
        <div class="screen-actions">
            <button class="cf-btn sm" id="da-clear-history-btn">Clear History</button>
        </div>
    </div>

    <!-- Tab bar -->
    <div id="da-tab-bar" style="
        display:flex;
        gap:var(--cf-space-2);
        border-bottom:1px solid var(--cf-border-medium);
        padding-bottom:0;
    ">
        ${['url','content','history'].map(t => this._tabBtn(t)).join('')}
    </div>

    <!-- Tab content -->
    <div id="da-tab-content" style="flex:1;"></div>
</div>`;
    }

    _tabBtn(tab) {
        const labels = { url: 'URL Analysis', content: 'Content Analysis', history: 'History' };
        return `<button
            class="cf-btn da-tab-btn"
            data-tab="${tab}"
            style="
                border-radius:var(--cf-radius-md) var(--cf-radius-md) 0 0;
                border-bottom:3px solid transparent;
                background:transparent;
                color:var(--cf-text-secondary);
            "
        >${this._esc(labels[tab])}</button>`;
    }

    // -------------------------------------------------------------------------
    // Event binding
    // -------------------------------------------------------------------------

    _bindEvents() {
        const root = this.container.querySelector('#deep-analysis-root');

        root.querySelector('#da-tab-bar').addEventListener('click', e => {
            const btn = e.target.closest('.da-tab-btn');
            if (!btn) return;
            this._renderTab(btn.dataset.tab);
        });

        root.querySelector('#da-clear-history-btn').addEventListener('click', () => {
            this.analysisHistory = [];
            if (this.activeTab === 'history') this._renderTab('history');
            this._showToast('History cleared.');
        });
    }

    // -------------------------------------------------------------------------
    // Tab rendering
    // -------------------------------------------------------------------------

    _renderTab(tab) {
        this.activeTab = tab;
        const root = this.container.querySelector('#deep-analysis-root');

        // Update tab button styles
        root.querySelectorAll('.da-tab-btn').forEach(btn => {
            const active = btn.dataset.tab === tab;
            btn.style.borderBottomColor = active ? 'var(--cf-interactive-default)' : 'transparent';
            btn.style.color = active ? 'var(--cf-interactive-default)' : 'var(--cf-text-secondary)';
            btn.style.fontWeight = active ? 'var(--cf-weight-semibold)' : 'var(--cf-weight-normal)';
        });

        const pane = root.querySelector('#da-tab-content');

        switch (tab) {
            case 'url':     pane.innerHTML = this._urlTabHTML();     this._bindUrlTab(pane);     break;
            case 'content': pane.innerHTML = this._contentTabHTML(); this._bindContentTab(pane); break;
            case 'history': pane.innerHTML = this._historyTabHTML(); this._bindHistoryTab(pane); break;
        }
    }

    // -------------------------------------------------------------------------
    // URL Analysis tab
    // -------------------------------------------------------------------------

    _urlTabHTML() {
        return `
<div style="display:flex;flex-direction:column;gap:var(--cf-space-5);">
    <div class="cf-card">
        <div class="cf-card-header"><span class="cf-card-title">URL Analysis</span></div>
        <div class="cf-card-body" style="display:flex;flex-direction:column;gap:var(--cf-space-4);">
            <div style="display:flex;gap:var(--cf-space-3);">
                <input
                    id="da-url-input"
                    type="url"
                    placeholder="https://example.com/path"
                    style="
                        flex:1;
                        padding:var(--cf-space-3) var(--cf-space-4);
                        background:var(--cf-input-bg);
                        border:1px solid var(--cf-input-border);
                        border-radius:var(--cf-radius-md);
                        color:var(--cf-text-primary);
                        font-family:var(--cf-font-mono);
                        font-size:var(--cf-text-sm);
                        outline:none;
                    "
                />
                <button id="da-url-analyze-btn" class="cf-btn primary">Analyze</button>
            </div>
            <div id="da-url-result"></div>
        </div>
    </div>
</div>`;
    }

    _bindUrlTab(pane) {
        const input = pane.querySelector('#da-url-input');
        const btn   = pane.querySelector('#da-url-analyze-btn');
        const result = pane.querySelector('#da-url-result');

        const run = async () => {
            const url = (input.value || '').trim();
            if (!url) { this._showError(result, 'Please enter a URL.'); return; }

            this._showSpinner(result, 'Analyzing URL…');
            btn.disabled = true;

            try {
                const res = await fetch('http://localhost:8001/analyze-url', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url })
                });
                if (!res.ok) throw new Error(`ML service returned ${res.status}`);
                const data = await res.json();
                const card = this._buildUrlResultCard(url, data);
                result.innerHTML = card;
                this._saveHistory('url', url, data);
            } catch (err) {
                this._showError(result, err.message || 'Request failed.');
            } finally {
                btn.disabled = false;
            }
        };

        btn.addEventListener('click', run);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') run(); });
    }

    _buildUrlResultCard(url, data) {
        const score      = typeof data.threat_score === 'number' ? data.threat_score : (data.score ?? 0);
        const pct        = Math.min(100, Math.max(0, Math.round(score * 100)));
        const barColor   = pct >= 70 ? 'var(--cf-status-error)' : pct >= 40 ? 'var(--cf-status-warning)' : 'var(--cf-status-success)';
        const verdictCls = pct >= 70 ? 'error' : pct >= 40 ? 'warning' : 'success';
        const verdict    = this._esc(data.verdict || (pct >= 70 ? 'Malicious' : pct >= 40 ? 'Suspicious' : 'Clean'));
        const insights   = Array.isArray(data.insights) ? data.insights : (data.findings ? [data.findings] : []);
        const recs       = Array.isArray(data.recommendations) ? data.recommendations : [];

        return `
<div class="cf-card" style="margin-top:var(--cf-space-4);border-left:3px solid ${barColor};">
    <div class="cf-card-header" style="display:flex;align-items:center;justify-content:space-between;">
        <span class="cf-card-title" style="font-family:var(--cf-font-mono);font-size:var(--cf-text-sm);">${this._esc(url)}</span>
        <span class="cf-badge ${verdictCls}">${verdict}</span>
    </div>
    <div class="cf-card-body" style="display:flex;flex-direction:column;gap:var(--cf-space-4);">
        <!-- Threat score bar -->
        <div>
            <div style="display:flex;justify-content:space-between;margin-bottom:var(--cf-space-1);">
                <span style="font-size:var(--cf-text-xs);color:var(--cf-text-muted);">Threat Score</span>
                <span style="font-size:var(--cf-text-xs);font-weight:var(--cf-weight-semibold);color:${barColor};">${pct}%</span>
            </div>
            <div style="height:8px;border-radius:var(--cf-radius-full);background:var(--cf-surface-1);overflow:hidden;">
                <div style="height:100%;width:${pct}%;background:${barColor};border-radius:var(--cf-radius-full);transition:width .4s ease;"></div>
            </div>
        </div>

        ${insights.length ? `
        <div>
            <div style="font-size:var(--cf-text-sm);font-weight:var(--cf-weight-semibold);color:var(--cf-text-primary);margin-bottom:var(--cf-space-2);">Insights</div>
            <ul style="margin:0;padding-left:var(--cf-space-5);display:flex;flex-direction:column;gap:var(--cf-space-1);">
                ${insights.map(i => `<li style="font-size:var(--cf-text-sm);color:var(--cf-text-secondary);">${this._esc(i)}</li>`).join('')}
            </ul>
        </div>` : ''}

        ${recs.length ? `
        <div>
            <div style="font-size:var(--cf-text-sm);font-weight:var(--cf-weight-semibold);color:var(--cf-text-primary);margin-bottom:var(--cf-space-2);">Recommendations</div>
            <ul style="margin:0;padding-left:var(--cf-space-5);display:flex;flex-direction:column;gap:var(--cf-space-1);">
                ${recs.map(r => `<li style="font-size:var(--cf-text-sm);color:var(--cf-text-secondary);">${this._esc(r)}</li>`).join('')}
            </ul>
        </div>` : ''}
    </div>
</div>`;
    }

    // -------------------------------------------------------------------------
    // Content Analysis tab
    // -------------------------------------------------------------------------

    _contentTabHTML() {
        return `
<div style="display:flex;flex-direction:column;gap:var(--cf-space-5);">
    <div class="cf-card">
        <div class="cf-card-header"><span class="cf-card-title">Content Analysis</span></div>
        <div class="cf-card-body" style="display:flex;flex-direction:column;gap:var(--cf-space-4);">
            <textarea
                id="da-content-input"
                placeholder="Paste text, code, log output, or any content to analyse…"
                style="
                    width:100%;
                    min-height:180px;
                    padding:var(--cf-space-3) var(--cf-space-4);
                    background:var(--cf-input-bg);
                    border:1px solid var(--cf-input-border);
                    border-radius:var(--cf-radius-md);
                    color:var(--cf-text-primary);
                    font-family:var(--cf-font-mono);
                    font-size:var(--cf-text-sm);
                    resize:vertical;
                    outline:none;
                    box-sizing:border-box;
                "
            ></textarea>
            <div style="display:flex;justify-content:flex-end;">
                <button id="da-content-analyze-btn" class="cf-btn primary">Analyze</button>
            </div>
            <div id="da-content-result"></div>
        </div>
    </div>
</div>`;
    }

    _bindContentTab(pane) {
        const textarea = pane.querySelector('#da-content-input');
        const btn      = pane.querySelector('#da-content-analyze-btn');
        const result   = pane.querySelector('#da-content-result');

        const run = async () => {
            const content = (textarea.value || '').trim();
            if (!content) { this._showError(result, 'Please paste some content to analyse.'); return; }

            this._showSpinner(result, 'Running content analysis…');
            btn.disabled = true;

            try {
                const res = await fetch('http://localhost:8001/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: content, context: 'deep_analysis' })
                });
                if (!res.ok) throw new Error(`ML service returned ${res.status}`);
                const data = await res.json();
                result.innerHTML = this._buildContentResultCard(data);
                this._saveHistory('content', content.slice(0, 80) + (content.length > 80 ? '…' : ''), data);
            } catch (err) {
                this._showError(result, err.message || 'Request failed.');
            } finally {
                btn.disabled = false;
            }
        };

        btn.addEventListener('click', run);
    }

    _buildContentResultCard(data) {
        const response   = this._esc(data.response || data.result || data.analysis || JSON.stringify(data));
        const confidence = typeof data.confidence === 'number' ? Math.round(data.confidence * 100) : null;
        const confBadge  = confidence !== null
            ? `<span class="cf-badge ${confidence >= 70 ? 'success' : confidence >= 40 ? 'warning' : 'error'}">${confidence}% confidence</span>`
            : '';

        return `
<div class="cf-card" style="margin-top:var(--cf-space-4);">
    <div class="cf-card-header" style="display:flex;align-items:center;justify-content:space-between;">
        <span class="cf-card-title">AI Response</span>
        ${confBadge}
    </div>
    <div class="cf-card-body">
        <p style="
            font-size:var(--cf-text-sm);
            color:var(--cf-text-secondary);
            line-height:1.6;
            white-space:pre-wrap;
            margin:0;
        ">${response}</p>
    </div>
</div>`;
    }

    // -------------------------------------------------------------------------
    // History tab
    // -------------------------------------------------------------------------

    _historyTabHTML() {
        if (!this.analysisHistory.length) {
            return `
<div class="cf-empty" style="padding:var(--cf-space-10) 0;">
    <div class="cf-empty-icon">&#128269;</div>
    <div class="cf-empty-title">No Analysis History</div>
    <div class="cf-empty-text">Run a URL or content analysis to see history here.</div>
</div>`;
        }

        const rows = this.analysisHistory.map((item, idx) => `
<div class="da-hist-row" data-idx="${idx}" style="
    display:flex;
    align-items:center;
    gap:var(--cf-space-4);
    padding:var(--cf-space-3) var(--cf-space-4);
    border-radius:var(--cf-radius-md);
    cursor:pointer;
    background:var(--cf-surface-0);
    border:1px solid var(--cf-border-light);
    transition:background .15s;
" onmouseover="this.style.background='var(--cf-cf-table-row-hover,var(--cf-surface-1))'"
   onmouseout="this.style.background='var(--cf-surface-0)'">
    <span class="cf-badge ${item.type === 'url' ? 'info' : 'warning'}">${this._esc(item.type)}</span>
    <span style="flex:1;font-size:var(--cf-text-sm);color:var(--cf-text-primary);font-family:var(--cf-font-mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this._esc(item.label)}</span>
    <span style="font-size:var(--cf-text-xs);color:var(--cf-text-muted);white-space:nowrap;">${this._esc(item.timestamp)}</span>
</div>`).join('');

        return `
<div class="cf-card">
    <div class="cf-card-header"><span class="cf-card-title">Analysis History (${this.analysisHistory.length})</span></div>
    <div class="cf-card-body" style="display:flex;flex-direction:column;gap:var(--cf-space-2);">
        ${rows}
    </div>
</div>
<div id="da-hist-detail" style="margin-top:var(--cf-space-4);"></div>`;
    }

    _bindHistoryTab(pane) {
        pane.querySelectorAll('.da-hist-row').forEach(row => {
            row.addEventListener('click', () => {
                const idx  = parseInt(row.dataset.idx, 10);
                const item = this.analysisHistory[idx];
                if (!item) return;
                const detail = pane.querySelector('#da-hist-detail');
                if (!detail) return;

                if (item.type === 'url') {
                    detail.innerHTML = this._buildUrlResultCard(item.label, item.raw);
                } else {
                    detail.innerHTML = this._buildContentResultCard(item.raw);
                }
                detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });
    }

    // -------------------------------------------------------------------------
    // History persistence (in-memory)
    // -------------------------------------------------------------------------

    _saveHistory(type, label, raw) {
        this.analysisHistory.unshift({
            type,
            label,
            raw,
            timestamp: new Date().toLocaleString()
        });
        // Cap at 50 entries
        if (this.analysisHistory.length > 50) this.analysisHistory.length = 50;
    }

    // -------------------------------------------------------------------------
    // Shared UI helpers
    // -------------------------------------------------------------------------

    _showSpinner(el, msg) {
        el.innerHTML = `
<div class="cf-loading" style="padding:var(--cf-space-6) 0;">
    <div class="cf-spinner"></div>
    <span style="margin-left:var(--cf-space-3);color:var(--cf-text-muted);font-size:var(--cf-text-sm);">${this._esc(msg)}</span>
</div>`;
    }

    _showError(el, msg) {
        el.innerHTML = `
<div style="
    padding:var(--cf-space-4);
    border-radius:var(--cf-radius-md);
    background:var(--cf-status-error-bg);
    color:var(--cf-status-error);
    font-size:var(--cf-text-sm);
    border:1px solid var(--cf-status-error);
">${this._esc(msg)}</div>`;
    }

    _showToast(msg) {
        if (window.notificationSystem?.info) {
            window.notificationSystem.info('Deep Analysis', msg);
        }
    }
}

window.DeepAnalysisScreen = DeepAnalysisScreen;
