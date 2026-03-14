// CyberForge AI Agent Screen
// Extracted from cyberforge-app.js — AI agent layout builder and console binder.

(() => {
  // =========================================
  // API PROXY
  // =========================================

  let importedAPI = null;
  if (typeof require !== 'undefined') {
    try {
      const apiModule = require('../api-client.js');
      importedAPI = apiModule?.cyberforgeAPI || apiModule?.default?.cyberforgeAPI || null;
    } catch (error) {
      console.warn('[CyberForge:AIAgent] Could not require api-client.js, falling back to window API:', error?.message || error);
    }
  }

  function resolveAPIClient() {
    return importedAPI || window.cyberforgeAPI || window.apiClient || null;
  }

  const cyberforgeAPI = new Proxy({}, {
    get(_target, prop) {
      const api = resolveAPIClient();
      const value = api?.[prop];
      if (typeof value === 'function') {
        return value.bind(api);
      }
      return value;
    }
  });

  // =========================================
  // SHARED REFERENCE HELPERS
  // =========================================

  const state = new Proxy({}, {
    get(_, prop) {
      const s = window.CyberForgeApp?.state;
      return s ? s[prop] : undefined;
    },
    set(_, prop, value) {
      const s = window.CyberForgeApp?.state;
      if (s) s[prop] = value;
      return true;
    }
  });

  const showToast = (...args) => window.CyberForgeToast?.showToast?.(...args);
  const showModal = (...args) => window.CyberForgeModal?.showModal?.(...args);
  const showConfirmModal = (...args) => window.CyberForgeModal?.showConfirmModal?.(...args);
  const renderScreen = (...args) => window.CyberForgeApp?.renderScreen?.(...args);

  // =========================================
  // STYLES
  // =========================================

  function injectAIAgentStyles() {
    if (document.getElementById('cf-ai-agent-styles')) return;
    const style = document.createElement('style');
    style.id = 'cf-ai-agent-styles';
    style.textContent = `/* AI Agent screen — no extra styles needed */`;
    document.head.appendChild(style);
  }

  // =========================================
  // LAYOUT
  // =========================================

  function buildAIAgentLayout() {
    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">AI Agent</div>
          <div class="cf-panel-actions">
            <span class="cf-badge green" id="agent-status">Online</span>
          </div>
        </div>
        <div style="display:flex; gap:16px; padding:16px; border-bottom:1px solid var(--cf-border); flex-wrap:wrap;">
          <div class="cf-badge orange">Context: Security</div>
          <div class="cf-badge blue">Memory: Enabled</div>
          <div class="cf-badge purple">Tasks: 0 pending</div>
        </div>
        <div class="cf-panel-content" id="agent-messages" style="padding:16px; overflow:auto; flex:1;">
          <div class="empty-state">
            <i class="fas fa-brain empty-state-icon"></i>
            <div class="empty-state-title">Agent ready</div>
            <div class="empty-state-description">Send a command or ask for a security analysis.</div>
          </div>
        </div>
        <div style="padding:12px; border-top:1px solid var(--cf-border); display:flex; gap:8px; align-items:center;">
          <input id="agent-input" class="cf-input" placeholder="Ask the agent or issue a task (e.g., analyze URL https://example.com)" style="flex:1;">
          <button id="agent-run" class="cf-btn">Run</button>
          <button id="agent-send" class="cf-btn primary">Send</button>
        </div>
      </div>
    `;
  }

  // =========================================
  // EVENT BINDERS
  // =========================================

  function bindAgentConsole() {
    const sendBtn = document.getElementById('agent-send');
    const runBtn = document.getElementById('agent-run');
    const input = document.getElementById('agent-input');
    const messages = document.getElementById('agent-messages');
    const addMessage = (role, text) => {
      const wrapper = document.createElement('div');
      wrapper.style.marginBottom = '10px';
      wrapper.innerHTML = `<div class="cf-badge ${role === 'user' ? 'blue' : 'orange'}">${role}</div><div style="margin-top:4px;">${text}</div>`;
      messages.appendChild(wrapper);
      messages.scrollTop = messages.scrollHeight;
    };
    const send = async () => {
      const text = input.value.trim();
      if (!text) return;
      addMessage('user', text);
      input.value = '';
      
      // Show typing indicator
      const typingDiv = document.createElement('div');
      typingDiv.id = 'agent-typing';
      typingDiv.innerHTML = '<div class="cf-badge orange">agent</div><div style="margin-top:4px;"><i class="fas fa-spinner fa-spin"></i> Thinking...</div>';
      messages.appendChild(typingDiv);
      messages.scrollTop = messages.scrollHeight;
      
      // Call real backend AI
      try {
        const result = await cyberforgeAPI.chatWithAI(text, [], { source: 'desktop' });
        typingDiv.remove();
        
        if (result.success) {
          const response = result.data.response || result.data;
          addMessage('agent', typeof response === 'string' ? response : JSON.stringify(response, null, 2));
        } else {
          addMessage('agent', `Error: ${result.error || 'Failed to get response'}`);
        }
      } catch (error) {
        typingDiv.remove();
        addMessage('agent', `Connection error: ${error.message}. Backend may be offline.`);
      }
    };
    
    const run = async () => {
      addMessage('agent', 'Starting security scan...');
      try {
        const result = await cyberforgeAPI.scanForThreats([], 'quick');
        if (result.success) {
          addMessage('agent', `Scan complete: ${JSON.stringify(result.data.data || result.data, null, 2)}`);
        } else {
          addMessage('agent', `Scan failed: ${result.error}`);
        }
      } catch (error) {
        addMessage('agent', `Scan error: ${error.message}`);
      }
    };
    sendBtn?.addEventListener('click', send);
    runBtn?.addEventListener('click', run);
    input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
  }

  // =========================================
  // EXPOSE PUBLIC API
  // =========================================

  window.CyberForgeAIAgent = {
    injectAIAgentStyles,
    buildAIAgentLayout,
    bindAgentConsole
  };
})();
