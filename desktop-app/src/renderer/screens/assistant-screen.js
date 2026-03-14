// CyberForge Assistant Screen
// Extracted from cyberforge-app.js — layout builders, AI chat logic, and event binders
// for the AI Assistant screen.

(() => {
  // =========================================
  // API PROXY (same resilient pattern)
  // =========================================

  let importedAPI = null;
  if (typeof require !== 'undefined') {
    try {
      const apiModule = require('../api-client.js');
      importedAPI = apiModule?.cyberforgeAPI || apiModule?.default?.cyberforgeAPI || null;
    } catch (error) {
      console.warn('[CyberForge:Assistant] Could not require api-client.js, falling back to window API:', error?.message || error);
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
  // STYLE INJECTION
  // =========================================

  function injectAssistantStyles() {
    if (document.getElementById('cf-assistant-styles')) return;
    const style = document.createElement('style');
    style.id = 'cf-assistant-styles';
    style.textContent = `
      .ai-chat-wrapper { display:flex; height:100%; width:100%; overflow:hidden; }
      .ai-chat-sidebar { 
        width:260px; min-width:180px; 
        transition: width 0.2s ease, opacity 0.2s ease; 
        will-change: width;
      }
      .ai-chat-list-item { 
        transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease; 
        cursor:pointer;
      }
      .ai-chat-list-item:hover { 
        transform: translateX(3px); 
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        background: var(--cf-bg-medium) !important;
      }
      .ai-chat-list-item:active { transform: scale(0.98); }
      .ai-message-animated { animation: aiMessageSlide 0.2s ease-out; }
      .ai-phase-indicator { animation: aiPulse 0.8s ease-in-out infinite; }
      .ai-btn-bounce { transition: transform 0.1s ease, box-shadow 0.1s ease; }
      .ai-btn-bounce:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
      .ai-btn-bounce:active { transform: scale(0.96); }
      .ai-input-glow { transition: box-shadow 0.15s ease, border-color 0.15s ease; }
      .ai-input-glow:focus { 
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25); 
        border-color: var(--cf-accent-purple) !important;
      }
      .ai-quick-action { transition: all 0.1s ease; }
      .ai-quick-action:hover { 
        transform: translateY(-1px); 
        background: var(--cf-accent-purple) !important;
        color: white !important;
      }
      .ai-quick-action:active { transform: scale(0.95); }
      @keyframes aiMessageSlide { 
        from { opacity: 0; transform: translateY(8px); } 
        to { opacity: 1; transform: translateY(0); } 
      }
      @keyframes aiPulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
      @keyframes aiTypingDot {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-4px); }
      }
      .ai-typing-dot { 
        display: inline-block; 
        width: 6px; height: 6px; 
        border-radius: 50%; 
        background: var(--cf-accent-purple);
        margin: 0 2px;
      }
      .ai-typing-dot:nth-child(1) { animation: aiTypingDot 1s infinite 0s; }
      .ai-typing-dot:nth-child(2) { animation: aiTypingDot 1s infinite 0.15s; }
      .ai-typing-dot:nth-child(3) { animation: aiTypingDot 1s infinite 0.3s; }
      .ai-welcome-card {
        transition: transform 0.15s ease, box-shadow 0.15s ease;
        cursor: pointer;
      }
      .ai-welcome-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0,0,0,0.2);
      }
      @media (max-width: 1100px) {
        .ai-chat-sidebar { width:200px; }
      }
      @media (max-width: 900px) {
        .ai-chat-sidebar { position:absolute; right:0; top:0; bottom:0; z-index:100; display:none; }
        .ai-chat-sidebar.open { display:flex; }
      }
      @media (max-width: 600px) {
        .ai-quick-actions-bar { display:none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  // =========================================
  // LAYOUT BUILDERS
  // =========================================

  function buildAssistantLayout() {
    return `
      <style>
        .ai-chat-wrapper { display:flex; height:100%; width:100%; overflow:hidden; }
        .ai-chat-sidebar { 
          width:260px; min-width:180px; 
          transition: width 0.2s ease, opacity 0.2s ease; 
          will-change: width;
        }
        .ai-chat-list-item { 
          transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease; 
          cursor:pointer;
        }
        .ai-chat-list-item:hover { 
          transform: translateX(3px); 
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          background: var(--cf-bg-medium) !important;
        }
        .ai-chat-list-item:active { transform: scale(0.98); }
        .ai-message-animated { animation: aiMessageSlide 0.2s ease-out; }
        .ai-phase-indicator { animation: aiPulse 0.8s ease-in-out infinite; }
        .ai-btn-bounce { transition: transform 0.1s ease, box-shadow 0.1s ease; }
        .ai-btn-bounce:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
        .ai-btn-bounce:active { transform: scale(0.96); }
        .ai-input-glow { transition: box-shadow 0.15s ease, border-color 0.15s ease; }
        .ai-input-glow:focus { 
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25); 
          border-color: var(--cf-accent-purple) !important;
        }
        .ai-quick-action { transition: all 0.1s ease; }
        .ai-quick-action:hover { 
          transform: translateY(-1px); 
          background: var(--cf-accent-purple) !important;
          color: white !important;
        }
        .ai-quick-action:active { transform: scale(0.95); }
        @keyframes aiMessageSlide { 
          from { opacity: 0; transform: translateY(8px); } 
          to { opacity: 1; transform: translateY(0); } 
        }
        @keyframes aiPulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
        @keyframes aiTypingDot {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
        .ai-typing-dot { 
          display: inline-block; 
          width: 6px; height: 6px; 
          border-radius: 50%; 
          background: var(--cf-accent-purple);
          margin: 0 2px;
        }
        .ai-typing-dot:nth-child(1) { animation: aiTypingDot 1s infinite 0s; }
        .ai-typing-dot:nth-child(2) { animation: aiTypingDot 1s infinite 0.15s; }
        .ai-typing-dot:nth-child(3) { animation: aiTypingDot 1s infinite 0.3s; }
        .ai-welcome-card {
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          cursor: pointer;
        }
        .ai-welcome-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.2);
        }
        @media (max-width: 1100px) {
          .ai-chat-sidebar { width:200px; }
        }
        @media (max-width: 900px) {
          .ai-chat-sidebar { position:absolute; right:0; top:0; bottom:0; z-index:100; display:none; }
          .ai-chat-sidebar.open { display:flex; }
        }
        @media (max-width: 600px) {
          .ai-quick-actions-bar { display:none !important; }
        }
      </style>
      <div class="cf-panel ai-chat-wrapper" style="flex:1; display:flex; height:100%;">
        <!-- Main Chat Panel -->
        <div style="flex:1; display:flex; flex-direction:column; height:100%; min-width:0;">
          <!-- Header with Status -->
          <div class="cf-panel-header" style="border-bottom:1px solid var(--cf-border); flex-shrink:0;">
            <div class="cf-panel-title" style="display:flex; align-items:center; gap:12px;">
              <i class="fas fa-robot" style="color:var(--cf-accent-purple);"></i>
              CyberForge AI Assistant
            </div>
            <div class="cf-panel-actions" style="display:flex; gap:8px; align-items:center;">
              <span id="ai-status" class="cf-badge green" style="display:flex; align-items:center; gap:4px;">
                <span class="status-dot" style="width:6px;height:6px;border-radius:50%;background:#039855;"></span>
                Online
              </span>
              <button class="cf-btn ai-btn-bounce" id="toggle-sidebar-mobile" title="Toggle history" style="display:none;">
                <i class="fas fa-history"></i>
              </button>
              <button class="cf-btn ai-btn-bounce" id="clear-chat" title="Clear conversation"><i class="fas fa-trash-alt"></i></button>
              <button class="cf-btn ai-btn-bounce" id="export-chat" title="Export conversation"><i class="fas fa-download"></i></button>
            </div>
          </div>

          <!-- Chat Meta -->
          <div style="padding:8px 16px; border-bottom:1px solid var(--cf-border); background:var(--cf-bg-medium); display:flex; align-items:center; justify-content:space-between; flex-shrink:0;">
            <div style="display:flex; flex-direction:column; min-width:0; flex:1;">
              <span id="ai-chat-title" style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">New Chat</span>
              <span id="ai-chat-subtitle" style="font-size:11px; color:var(--cf-text-muted);">No messages yet</span>
            </div>
            <button class="cf-btn ai-btn-bounce" id="ai-new-chat-inline" title="Start new chat"><i class="fas fa-plus"></i></button>
          </div>

          <!-- AI Phase Indicator -->
          <div id="ai-phase-indicator" class="ai-phase-indicator" style="display:none; padding:8px 16px; border-bottom:1px solid var(--cf-border); background:var(--cf-bg-dark); font-size:11px; color:var(--cf-text-muted); flex-shrink:0;">
            <span id="ai-phase-text"></span>
          </div>

          <!-- Quick Actions Bar -->
          <div class="ai-quick-actions-bar" style="padding:10px 16px; border-bottom:1px solid var(--cf-border); background:var(--cf-bg-medium); flex-shrink:0;">
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <button class="cf-btn ai-quick-action" data-action="scan-url" style="font-size:11px; padding:6px 10px;">
                <i class="fas fa-globe"></i> Scan URL
              </button>
              <button class="cf-btn ai-quick-action" data-action="analyze-request" style="font-size:11px; padding:6px 10px;">
                <i class="fas fa-code"></i> Analyze Request
              </button>
              <button class="cf-btn ai-quick-action" data-action="find-vulns" style="font-size:11px; padding:6px 10px;">
                <i class="fas fa-bug"></i> Find Vulnerabilities
              </button>
              <button class="cf-btn ai-quick-action" data-action="generate-payload" style="font-size:11px; padding:6px 10px;">
                <i class="fas fa-bolt"></i> Generate Payload
              </button>
              <button class="cf-btn ai-quick-action" data-action="threat-hunt" style="font-size:11px; padding:6px 10px;">
                <i class="fas fa-search"></i> Threat Hunt
              </button>
              <button class="cf-btn ai-quick-action" data-action="explain-vuln" style="font-size:11px; padding:6px 10px;">
                <i class="fas fa-graduation-cap"></i> Explain Vuln
              </button>
            </div>
          </div>

          <!-- Context Panel -->
          <div id="ai-context-panel" style="padding:8px 16px; border-bottom:1px solid var(--cf-border); background:var(--cf-bg-dark); display:none; flex-shrink:0;">
            <div style="display:flex; align-items:center; gap:8px;">
              <i class="fas fa-paperclip" style="color:var(--cf-accent-blue);"></i>
              <span id="ai-context-text" style="font-size:12px; flex:1;"></span>
              <button class="panel-action-btn" id="clear-context" title="Clear context"><i class="fas fa-times"></i></button>
            </div>
          </div>

          <!-- Chat Messages -->
          <div class="cf-panel-content" id="assistant-messages" style="flex:1; padding:16px; overflow-y:auto; display:flex; flex-direction:column; gap:14px; scroll-behavior:smooth;"></div>

          <!-- Input Area -->
          <div style="padding:12px 16px; border-top:1px solid var(--cf-border); background:var(--cf-bg-medium); flex-shrink:0;">
            <div style="display:flex; gap:8px; align-items:flex-end;">
              <div style="flex:1; position:relative;">
                <textarea id="assistant-input" class="cf-input ai-input-glow" rows="2" placeholder="Ask me anything about security... (Shift+Enter for new line)" 
                  style="width:100%; resize:none; padding-right:40px; transition: height 0.1s ease;"></textarea>
                <button class="panel-action-btn" id="attach-context" title="Attach request/finding" 
                  style="position:absolute; right:8px; bottom:8px;">
                  <i class="fas fa-paperclip"></i>
                </button>
              </div>
              <button id="assistant-send" class="cf-btn primary ai-btn-bounce" style="height:52px; padding:0 20px;">
                <i class="fas fa-paper-plane"></i>
              </button>
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:6px; font-size:11px; color:var(--cf-text-muted);">
              <span>Powered by CyberForge AI + ML Models</span>
              <span id="ai-typing-indicator" style="display:none;">
                <span class="ai-typing-dot"></span>
                <span class="ai-typing-dot"></span>
                <span class="ai-typing-dot"></span>
              </span>
            </div>
          </div>
        </div>

        <!-- Chat History Sidebar -->
        <div id="ai-chat-sidebar" class="ai-chat-sidebar" style="width:260px; border-left:1px solid var(--cf-border); background:var(--cf-bg-dark); display:flex; flex-direction:column;">
          <div style="padding:14px; border-bottom:1px solid var(--cf-border); flex-shrink:0;">
            <div style="font-weight:600; margin-bottom:10px; display:flex; align-items:center; gap:8px;">
              <i class="fas fa-comments" style="color:var(--cf-accent-blue);"></i>
              Chats
            </div>
            <button id="ai-new-chat" class="cf-btn primary ai-btn-bounce" style="width:100%; display:flex; gap:8px; align-items:center; justify-content:center;">
              <i class="fas fa-plus"></i> New Chat
            </button>
            <div style="margin-top:10px;">
              <input id="ai-chat-search" class="cf-input ai-input-glow" placeholder="Search chats..." style="width:100%;">
            </div>
          </div>
          <div id="ai-chat-list" style="flex:1; overflow-y:auto; padding:8px; display:flex; flex-direction:column; gap:5px;"></div>
        </div>
      </div>
    `;
  }

  // NEW: AI Assistant V2 Layout Builder
  function buildAssistantLayoutV2() {
    return `<div id="ai-assistant-v2-container" class="ai-assistant-v2-root" style="height:100%; width:100%;"></div>`;
  }

  // Global AI Assistant V2 instance
  let aiAssistantV2Instance = null;

  function initAIAssistantV2(container) {
    if (window.AIAssistantV2 && cyberforgeAPI) {
      aiAssistantV2Instance = new window.AIAssistantV2(container, cyberforgeAPI);
      return true;
    }
    return false;
  }

  // =========================================
  // MAIN EVENT BINDER
  // =========================================

  function bindAssistant() {
    const sendBtn = document.getElementById('assistant-send');
    const input = document.getElementById('assistant-input');
    const messages = document.getElementById('assistant-messages');
    const typingIndicator = document.getElementById('ai-typing-indicator');
    const statusBadge = document.getElementById('ai-status');
    const contextPanel = document.getElementById('ai-context-panel');
    const contextText = document.getElementById('ai-context-text');
    const phaseIndicator = document.getElementById('ai-phase-indicator');
    const phaseText = document.getElementById('ai-phase-text');
    const chatList = document.getElementById('ai-chat-list');
    const newChatBtn = document.getElementById('ai-new-chat');
    const newChatInlineBtn = document.getElementById('ai-new-chat-inline');
    const chatSearch = document.getElementById('ai-chat-search');
    const chatTitle = document.getElementById('ai-chat-title');
    const chatSubtitle = document.getElementById('ai-chat-subtitle');

    const CHAT_STORAGE_KEY = 'cyberforge_ai_chats';

    // Escape HTML to prevent XSS
    const escapeHtml = (text) => {
      const div = document.createElement('div');
      div.textContent = text ?? '';
      return div.innerHTML;
    };

    const loadChats = () => {
      try {
        const stored = localStorage.getItem(CHAT_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    };

    const saveChats = () => {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(state.aiChats || []));
    };

    const createChat = () => {
      const id = `chat_${Date.now()}`;
      const chat = {
        id,
        title: 'New Chat',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: []
      };
      state.aiChats = [chat, ...(state.aiChats || [])];
      state.activeChatId = id;
      saveChats();
      return chat;
    };

    const getActiveChat = () => {
      return (state.aiChats || []).find(c => c.id === state.activeChatId);
    };

    const updateChatMeta = () => {
      const activeChat = getActiveChat();
      if (!activeChat) return;
      chatTitle.textContent = activeChat.title || 'New Chat';
      if (activeChat.messages.length === 0) {
        chatSubtitle.textContent = 'No messages yet';
      } else {
        const last = activeChat.messages[activeChat.messages.length - 1];
        chatSubtitle.textContent = `Last message • ${new Date(last.timestamp).toLocaleTimeString()}`;
      }
    };

    const renderChatList = (filter = '') => {
      if (!chatList) return;
      const normalized = filter.trim().toLowerCase();
      chatList.innerHTML = '';
      (state.aiChats || []).forEach(chat => {
        if (normalized && !chat.title.toLowerCase().includes(normalized)) return;
        const preview = chat.messages?.[chat.messages.length - 1]?.content || 'No messages yet';
        const item = document.createElement('div');
        const isActive = chat.id === state.activeChatId;
        item.className = `ai-chat-list-item ${isActive ? 'active' : ''}`;
        item.style.cssText = `
          padding:10px 12px;
          border-radius:10px;
          cursor:pointer;
          border:1px solid var(--cf-border);
          background:${isActive ? 'var(--cf-bg-medium)' : 'transparent'};
        `;
        item.innerHTML = `
          <div style="font-weight:600; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${escapeHtml(chat.title || 'New Chat')}
          </div>
          <div style="font-size:11px; color:var(--cf-text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${escapeHtml(preview)}
          </div>
        `;
        item.addEventListener('click', () => {
          state.activeChatId = chat.id;
          saveChats();
          renderChatList(chatSearch?.value || '');
          renderChatMessages();
        });
        chatList.appendChild(item);
      });
    };

    const renderWelcome = () => {
      messages.innerHTML = `
        <div class="ai-welcome-message" style="text-align:center; padding:32px 20px;">
          <div style="width:72px; height:72px; margin:0 auto 14px; background:linear-gradient(135deg, var(--cf-accent-purple), var(--cf-accent-blue)); border-radius:18px; display:flex; align-items:center; justify-content:center; box-shadow: 0 8px 24px rgba(99,102,241,0.3);">
            <i class="fas fa-brain" style="font-size:32px; color:white;"></i>
          </div>
          <h3 style="margin-bottom:6px; font-size:18px;">CyberForge AI Assistant</h3>
          <p style="color:var(--cf-text-muted); margin-bottom:20px; max-width:520px; margin-left:auto; margin-right:auto; font-size:13px; line-height:1.5;">
            I'm your AI-powered security analyst with <strong>live website scanning</strong> capabilities. 
            Enter any URL and I'll scrape it in real-time to analyze security headers, network requests, 
            vulnerabilities, and more.
          </p>
          <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:8px; max-width:650px; margin:0 auto;">
            <div class="ai-suggestion ai-welcome-card" data-prompt="Scan https://example.com for security vulnerabilities and analyze its security headers, network requests, and potential threats" style="background:linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1)); padding:12px 18px; border-radius:12px; cursor:pointer; font-size:12px; border:1px solid rgba(99,102,241,0.4);">
              🌐 Live Website Security Scan
            </div>
            <div class="ai-suggestion ai-welcome-card" data-prompt="Explain SQL injection attacks and how to prevent them" style="background:var(--cf-bg-medium); padding:10px 16px; border-radius:12px; cursor:pointer; font-size:12px; border:1px solid var(--cf-border);">
              📚 Learn about SQL injection
            </div>
            <div class="ai-suggestion ai-welcome-card" data-prompt="Generate XSS test payloads for input field testing" style="background:var(--cf-bg-medium); padding:10px 16px; border-radius:12px; cursor:pointer; font-size:12px; border:1px solid var(--cf-border);">
              💉 Generate XSS payloads
            </div>
            <div class="ai-suggestion ai-welcome-card" data-prompt="What are the OWASP Top 10 vulnerabilities?" style="background:var(--cf-bg-medium); padding:10px 16px; border-radius:12px; cursor:pointer; font-size:12px; border:1px solid var(--cf-border);">
              📋 OWASP Top 10
            </div>
            <div class="ai-suggestion ai-welcome-card" data-prompt="Analyze https://github.com for security headers and HTTPS configuration" style="background:var(--cf-bg-medium); padding:10px 16px; border-radius:12px; cursor:pointer; font-size:12px; border:1px solid var(--cf-border);">
              🔒 Security Headers Check
            </div>
          </div>
        </div>
      `;

      document.querySelectorAll('.ai-suggestion').forEach(chip => {
        chip.addEventListener('click', () => {
          input.value = chip.dataset.prompt;
          sendMessage();
        });
      });
    };

    const renderChatMessages = () => {
      const activeChat = getActiveChat();
      messages.innerHTML = '';
      if (!activeChat || activeChat.messages.length === 0) {
        renderWelcome();
        updateChatMeta();
        return;
      }

      activeChat.messages.forEach(msg => {
        appendMessage(msg);
      });
      updateChatMeta();
      messages.scrollTop = messages.scrollHeight;
    };

    // Initialize chat state
    state.aiChats = state.aiChats || loadChats();
    if (!state.aiChats || state.aiChats.length === 0) {
      createChat();
    }
    if (!state.activeChatId) {
      state.activeChatId = state.aiChats[0].id;
    }
    if (!state.aiContext) {
      state.aiContext = null;
    }
    // Initial render will happen after message helpers are defined

    const appendMessage = (msg) => {
      const { role, content, timestamp, meta } = msg;
      const msgDiv = document.createElement('div');
      msgDiv.className = `ai-message ai-message-${role} ai-message-animated`;
      msgDiv.style.cssText = `
        display: flex;
        gap: 12px;
        ${role === 'user' ? 'flex-direction: row-reverse;' : ''}
      `;

      const avatarStyle = role === 'user'
        ? 'background: var(--cf-accent-blue);'
        : 'background: linear-gradient(135deg, var(--cf-accent-purple), var(--cf-accent-orange));';

      const icon = role === 'user' ? 'fa-user' : 'fa-robot';
      const displayTime = new Date(timestamp || Date.now()).toLocaleTimeString();
      const displayContent = role === 'assistant'
        ? formatAIResponse(content)
        : `<div style="white-space:pre-wrap;">${escapeHtml(content)}</div>`;

      const metaHtml = meta ? `
        <div style="display:flex; gap:6px; margin-top:6px; flex-wrap:wrap;">
          ${typeof meta.confidence === 'number' ? `<span class="cf-badge" style="font-size:10px;">Confidence ${(meta.confidence * 100).toFixed(0)}%</span>` : ''}
          ${Array.isArray(meta.insights) && meta.insights.length ? `<span class="cf-badge" style="font-size:10px;">${meta.insights[0]}</span>` : ''}
          ${Array.isArray(meta.recommendations) && meta.recommendations.length ? `<span class="cf-badge" style="font-size:10px;">${meta.recommendations[0]}</span>` : ''}
        </div>
      ` : '';

      msgDiv.innerHTML = `
        <div style="width:36px; height:36px; border-radius:10px; ${avatarStyle} display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 4px 12px rgba(0,0,0,0.25);">
          <i class="fas ${icon}" style="color:white; font-size:14px;"></i>
        </div>
        <div style="flex:1; max-width:72%;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; ${role === 'user' ? 'justify-content:flex-end;' : ''}">
            <span style="font-weight:600; font-size:12px;">${role === 'user' ? 'You' : 'CyberForge AI'}</span>
            <span style="font-size:10px; color:var(--cf-text-muted);">${displayTime}</span>
          </div>
          <div class="ai-message-content" style="background:var(--cf-bg-${role === 'user' ? 'dark' : 'medium'}); padding:14px 16px; border-radius:14px; border:1px solid var(--cf-border); ${role === 'user' ? 'border-bottom-right-radius:6px;' : 'border-bottom-left-radius:6px;'}">
            ${displayContent}
          </div>
          ${metaHtml}
        </div>
      `;

      messages.appendChild(msgDiv);
      messages.scrollTop = messages.scrollHeight;
    };

    // Add message to chat and persist
    const addMessage = (role, content, meta = null) => {
      const activeChat = getActiveChat();
      if (!activeChat) return;

      const welcomeMsg = messages.querySelector('.ai-welcome-message');
      if (welcomeMsg) welcomeMsg.remove();

      if (activeChat.messages.length === 0 && role === 'user' && activeChat.title === 'New Chat') {
        activeChat.title = content.length > 36 ? `${content.slice(0, 36)}...` : content;
      }

      const msg = {
        role,
        content: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
        timestamp: new Date().toISOString(),
        meta
      };
      activeChat.messages.push(msg);
      activeChat.updatedAt = new Date().toISOString();
      saveChats();
      renderChatList(chatSearch?.value || '');
      updateChatMeta();
      appendMessage(msg);
    };

    const renderStreamingContent = (text) => {
      return escapeHtml(text).replace(/\n/g, '<br>');
    };

    const sanitizeAssistantText = (text) => {
      if (typeof text !== 'string') return text;
      return text.replace(/gemini/gi, 'AI model');
    };

    const setPhase = (phase, tools = []) => {
      if (!phaseIndicator || !phaseText) return;
      const toolsText = tools.length ? ` • Tools: ${tools.join(', ')}` : '';
      phaseText.textContent = `${phase}${toolsText}`;
      phaseIndicator.style.display = 'block';
    };

    const clearPhase = () => {
      if (!phaseIndicator) return;
      phaseIndicator.style.display = 'none';
      if (phaseText) phaseText.textContent = '';
    };

    const getStreamSpeed = (text) => {
      const len = text.length;
      // Much faster streaming - almost instant but still visible
      if (len > 2000) return 1;  // Very long: blazing fast
      if (len > 1000) return 2;  // Long: very fast  
      if (len > 500) return 3;   // Medium: fast
      return 4;                   // Short: readable but quick
    };

    const streamAssistantMessage = (text, meta = null) => {
      return new Promise((resolve) => {
        const activeChat = getActiveChat();
        if (!activeChat) return resolve();

        const finalTextRaw = typeof text === 'string' ? text : JSON.stringify(text, null, 2);
        const finalText = sanitizeAssistantText(finalTextRaw);
        const speedMs = getStreamSpeed(finalText);
        
        // For very long responses, stream in chunks instead of character by character
        const chunkSize = finalText.length > 1000 ? 3 : 1;
        
        const msg = {
          role: 'assistant',
          content: finalText,
          timestamp: new Date().toISOString(),
          meta
        };
        activeChat.messages.push(msg);
        activeChat.updatedAt = new Date().toISOString();
        saveChats();
        renderChatList(chatSearch?.value || '');
        updateChatMeta();

        const tempMsg = {
          role: 'assistant',
          content: '',
          timestamp: msg.timestamp,
          meta
        };
        const metaHtml = meta ? `
          <div style="display:flex; gap:6px; margin-top:6px; flex-wrap:wrap;">
            ${typeof meta.confidence === 'number' ? `<span class="cf-badge" style="font-size:10px;">Confidence ${(meta.confidence * 100).toFixed(0)}%</span>` : ''}
            ${Array.isArray(meta.insights) && meta.insights.length ? `<span class="cf-badge" style="font-size:10px;">${meta.insights[0]}</span>` : ''}
            ${Array.isArray(meta.recommendations) && meta.recommendations.length ? `<span class="cf-badge" style="font-size:10px;">${meta.recommendations[0]}</span>` : ''}
          </div>
        ` : '';
        const msgDiv = document.createElement('div');
        msgDiv.className = 'ai-message ai-message-assistant ai-message-animated';
        msgDiv.style.cssText = `display:flex; gap:12px;`;
        msgDiv.innerHTML = `
          <div style="width:36px; height:36px; border-radius:10px; background: linear-gradient(135deg, var(--cf-accent-purple), var(--cf-accent-orange)); display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 4px 12px rgba(0,0,0,0.25);">
            <i class="fas fa-robot" style="color:white; font-size:14px;"></i>
          </div>
          <div style="flex:1; max-width:72%;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
              <span style="font-weight:600; font-size:12px;">CyberForge AI</span>
              <span style="font-size:10px; color:var(--cf-text-muted);">${new Date(tempMsg.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="ai-message-content" style="background:var(--cf-bg-medium); padding:14px 16px; border-radius:14px; border:1px solid var(--cf-border); border-bottom-left-radius:6px;"></div>
            ${metaHtml}
          </div>
        `;
        messages.appendChild(msgDiv);
        messages.scrollTop = messages.scrollHeight;

        const contentEl = msgDiv.querySelector('.ai-message-content');
        let i = 0;
        const timer = setInterval(() => {
          i += chunkSize;
          if (i > finalText.length) i = finalText.length;
          contentEl.innerHTML = renderStreamingContent(finalText.slice(0, i));
          messages.scrollTop = messages.scrollHeight;
          if (i >= finalText.length) {
            clearInterval(timer);
            contentEl.innerHTML = formatAIResponse(finalText);
            resolve();
          }
        }, speedMs);
      });
    };

    // Format AI response with markdown-like styling
    function formatAIResponse(text) {
      // Convert code blocks
      text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<div style="background:var(--cf-bg-dark); padding:12px; border-radius:8px; margin:8px 0; overflow-x:auto;">
          ${lang ? `<div style="font-size:10px; color:var(--cf-text-muted); margin-bottom:8px;">${lang}</div>` : ''}
          <pre style="margin:0; font-family:monospace; font-size:13px;"><code>${escapeHtml(code.trim())}</code></pre>
        </div>`;
      });

      // Convert inline code
      text = text.replace(/`([^`]+)`/g, '<code style="background:var(--cf-bg-dark); padding:2px 6px; border-radius:4px; font-size:12px;">$1</code>');

      // Convert bold
      text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

      // Convert bullet points
      text = text.replace(/^[•\-\*]\s+(.+)$/gm, '<div style="display:flex; gap:8px; margin:4px 0;"><span style="color:var(--cf-accent-blue);">•</span><span>$1</span></div>');

      // Convert numbered lists
      text = text.replace(/^\d+\.\s+(.+)$/gm, '<div style="display:flex; gap:8px; margin:4px 0;"><span style="color:var(--cf-accent-orange); font-weight:600;">$&</span></div>');

      // Convert headers
      text = text.replace(/^###\s+(.+)$/gm, '<h4 style="color:var(--cf-accent-purple); margin:12px 0 8px;">$1</h4>');
      text = text.replace(/^##\s+(.+)$/gm, '<h3 style="margin:12px 0 8px;">$1</h3>');

      // Convert line breaks
      text = text.replace(/\n/g, '<br>');

      return text;
    }

    // Send message to AI
    const sendMessage = async () => {
      const text = input.value.trim();
      if (!text) return;

      // Add user message
      addMessage('user', text);
      input.value = '';
      input.style.height = 'auto';

      // Show typing indicator
      typingIndicator.style.display = 'inline';
      sendBtn.disabled = true;

      // Check if message contains a URL for scanning
      const urlPattern = /(https?:\/\/[^\s]+)/i;
      const hasUrl = urlPattern.test(text);
      const scanKeywords = ['scan', 'analyze', 'check', 'security', 'vulnerab', 'audit', 'inspect', 'threat', 'assess', 'review'];
      const hasScanIntent = scanKeywords.some(kw => text.toLowerCase().includes(kw));
      
      if (hasUrl && hasScanIntent) {
        setPhase('Scraping Website', ['webscraper', 'network_analyzer', 'security_scanner']);
      } else {
        setPhase('Thinking', ['ai_agent', 'threat_analyzer', 'ml_models', 'memory_store', 'api:/analyze']);
      }

      try {
        // Prepare context
        const context = {
          source: 'desktop_assistant',
          timestamp: new Date().toISOString(),
          ...state.aiContext
        };

        // Add captured requests context if available
        if (state.requests.length > 0) {
          context.captured_requests_count = state.requests.length;
          context.recent_hosts = [...new Set(state.requests.slice(0, 10).map(r => r.host))];
        }

        // Add findings context
        if (state.findings.length > 0) {
          context.active_findings = state.findings.filter(f => f.status === 'Open').length;
        }

        const activeChat = getActiveChat();
        if (!activeChat) throw new Error('No active chat');

        const conversationHistory = activeChat.messages
          .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
          .slice(-10);

        // Update phase for AI analysis
        if (hasUrl && hasScanIntent) {
          setPhase('Analyzing Security Data', ['ai_agent', 'vulnerability_scanner', 'threat_analyzer']);
        }

        // Call the AI endpoint
        const result = await cyberforgeAPI.chatWithAI(text, conversationHistory, context);

        if (result.success) {
          const response = result.data?.response || result.data || 'No response received';
          
          // Show scan result indicator if website was scanned
          if (result.data?.website_scan?.scanned) {
            const ws = result.data.website_scan;
            setPhase(`Website Scanned: ${ws.risk_level?.toUpperCase() || 'ANALYZED'} (Score: ${ws.risk_score || 'N/A'})`, ['security_report']);
            await new Promise(r => setTimeout(r, 1500));
          }

          // Stream assistant response slowly
          setPhase('Responding', ['ai_agent', 'ml_models', 'api:/analyze']);
          await streamAssistantMessage(response, {
            confidence: result.data?.confidence,
            insights: result.data?.insights,
            recommendations: result.data?.recommendations
          });

          setPhase('Completed');
          setTimeout(clearPhase, 1200);

          // Check if response contains actionable items
          checkForActionableItems(response);
        } else {
          addMessage('assistant', `❌ Error: ${result.error || 'Failed to get response from AI'}`);
          updateAIStatus(false);
          clearPhase();
        }
      } catch (error) {
        console.error('AI chat error:', error);
        addMessage('assistant', `❌ Connection error: ${error.message}. Make sure the backend and ML services are running.`);
        updateAIStatus(false);
        clearPhase();
      } finally {
        typingIndicator.style.display = 'none';
        sendBtn.disabled = false;
        input.focus();
      }
    };

    // Check for actionable items in response
    const checkForActionableItems = (response) => {
      const lowerResponse = (typeof response === 'string' ? response : JSON.stringify(response)).toLowerCase();
      
      // If response mentions creating a finding
      if (lowerResponse.includes('vulnerability') || lowerResponse.includes('finding')) {
        // Could auto-suggest creating a finding
      }
    };

    // Update AI status indicator
    const updateAIStatus = async (online = null) => {
      if (online === null) {
        try {
          const health = await cyberforgeAPI.getMLHealth();
          online = health.success;
        } catch {
          online = false;
        }
      }
      
      statusBadge.className = `cf-badge ${online ? 'green' : 'red'}`;
      statusBadge.innerHTML = `<span class="status-dot" style="width:6px;height:6px;border-radius:50%;background:${online ? '#039855' : '#D92D20'};"></span> ${online ? 'Online' : 'Offline'}`;
    };

    // Quick action handlers
    const quickActionHandlers = {
      'scan-url': () => {
        showModal('🔍 Live Website Security Scan', `
          <div style="display:flex; flex-direction:column; gap:16px;">
            <div style="background: linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1)); padding:12px; border-radius:8px; border:1px solid rgba(99,102,241,0.3);">
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                <i class="fas fa-globe" style="color: var(--cf-accent-purple);"></i>
                <span style="font-weight:600; color: var(--cf-accent-purple);">Real-Time Website Scraping</span>
              </div>
              <p style="font-size:12px; color:var(--cf-text-muted); margin:0;">
                This will scrape the live website and analyze security headers, network requests, 
                third-party scripts, console errors, and more.
              </p>
            </div>
            <div>
              <label style="display:block; font-weight:600; margin-bottom:8px;">Target URL</label>
              <input class="cf-input" name="url" placeholder="https://example.com" style="width:100%;">
            </div>
            <div>
              <label style="display:block; font-weight:600; margin-bottom:8px;">Scan Type</label>
              <select class="cf-input" name="scanType" style="width:100%;">
                <option value="comprehensive">Comprehensive Security Audit</option>
                <option value="quick">Quick Security Check</option>
                <option value="headers">Security Headers Only</option>
                <option value="network">Network Request Analysis</option>
              </select>
            </div>
          </div>
        `, async (formData) => {
          const url = formData.get('url');
          const scanType = formData.get('scanType');
          
          let scanPrompt = '';
          switch (scanType) {
            case 'comprehensive':
              scanPrompt = `Perform a comprehensive security audit on ${url}. Analyze ALL security aspects including: security headers, HTTPS configuration, mixed content, third-party scripts, network requests, cookies, console errors, and provide detailed vulnerability assessment with remediation steps.`;
              break;
            case 'headers':
              scanPrompt = `Analyze the security headers of ${url}. Focus on missing headers like CSP, HSTS, X-Frame-Options, X-Content-Type-Options, and provide specific implementation recommendations.`;
              break;
            case 'network':
              scanPrompt = `Analyze all network requests made by ${url}. Identify suspicious third-party scripts, tracking pixels, potential data leakage, and external resource security.`;
              break;
            default:
              scanPrompt = `Perform a quick security scan on ${url}. Check for major vulnerabilities and security misconfigurations.`;
          }
          
          input.value = scanPrompt;
          sendMessage();
        });
      },
      'analyze-request': () => {
        if (state.selectedRequestId) {
          const req = state.requests.find(r => r.id === state.selectedRequestId);
          if (req) {
            state.aiContext = { request: req };
            contextPanel.style.display = 'block';
            contextText.textContent = `Attached: ${req.method} ${req.host}${req.path}`;
            input.value = 'Analyze this HTTP request for security vulnerabilities and potential attack vectors.';
            input.focus();
          }
        } else {
          showToast('warning', 'No Request Selected', 'Select a request from HTTP History first');
        }
      },
      'find-vulns': () => {
        input.value = 'Based on my captured traffic, identify potential security vulnerabilities and misconfigurations. Provide detailed findings with severity ratings.';
        sendMessage();
      },
      'generate-payload': () => {
        showModal('Generate Payload', `
          <div style="display:flex; flex-direction:column; gap:16px;">
            <div>
              <label style="display:block; font-weight:600; margin-bottom:8px;">Vulnerability Type</label>
              <select class="cf-input" name="vulnType" style="width:100%;">
                <option value="xss">Cross-Site Scripting (XSS)</option>
                <option value="sqli">SQL Injection</option>
                <option value="xxe">XML External Entity (XXE)</option>
                <option value="ssrf">Server-Side Request Forgery (SSRF)</option>
                <option value="lfi">Local File Inclusion (LFI)</option>
                <option value="rce">Remote Code Execution (RCE)</option>
                <option value="ssti">Server-Side Template Injection (SSTI)</option>
              </select>
            </div>
            <div>
              <label style="display:block; font-weight:600; margin-bottom:8px;">Context (optional)</label>
              <input class="cf-input" name="context" placeholder="e.g., PHP backend, JSON API, etc." style="width:100%;">
            </div>
          </div>
        `, (formData) => {
          const vulnType = formData.get('vulnType');
          const context = formData.get('context');
          input.value = `Generate a comprehensive list of ${vulnType.toUpperCase()} test payloads${context ? ` for a ${context} environment` : ''}. Include bypass techniques and encoding variations.`;
          sendMessage();
        });
      },
      'threat-hunt': () => {
        input.value = 'Start an AI-powered threat hunting session. Analyze my captured traffic for indicators of compromise (IOCs), suspicious patterns, and potential threats.';
        sendMessage();
      },
      'explain-vuln': () => {
        showModal('Explain Vulnerability', `
          <div style="display:flex; flex-direction:column; gap:16px;">
            <div>
              <label style="display:block; font-weight:600; margin-bottom:8px;">Vulnerability</label>
              <select class="cf-input" name="vuln" style="width:100%;">
                <option value="XSS">Cross-Site Scripting (XSS)</option>
                <option value="SQL Injection">SQL Injection</option>
                <option value="CSRF">Cross-Site Request Forgery (CSRF)</option>
                <option value="SSRF">Server-Side Request Forgery (SSRF)</option>
                <option value="XXE">XML External Entity (XXE)</option>
                <option value="IDOR">Insecure Direct Object Reference (IDOR)</option>
                <option value="Authentication Bypass">Authentication Bypass</option>
                <option value="Broken Access Control">Broken Access Control</option>
                <option value="Deserialization">Insecure Deserialization</option>
              </select>
            </div>
          </div>
        `, (formData) => {
          const vuln = formData.get('vuln');
          input.value = `Explain ${vuln} in detail. Include: 1) How the vulnerability works, 2) Real-world attack examples, 3) Detection techniques, 4) Prevention and remediation strategies.`;
          sendMessage();
        });
      }
    };

    // Bind quick action buttons
    document.querySelectorAll('.ai-quick-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (quickActionHandlers[action]) {
          quickActionHandlers[action]();
        }
      });
    });

    // Bind suggestion chips
    renderChatList();
    renderChatMessages();

    document.querySelectorAll('.ai-suggestion').forEach(chip => {
      chip.addEventListener('click', () => {
        input.value = chip.dataset.prompt;
        sendMessage();
      });
    });

    // New chat handlers
    const handleNewChat = () => {
      createChat();
      renderChatList(chatSearch?.value || '');
      renderChatMessages();
    };
    newChatBtn?.addEventListener('click', handleNewChat);
    newChatInlineBtn?.addEventListener('click', handleNewChat);

    // Chat search
    chatSearch?.addEventListener('input', (e) => {
      renderChatList(e.target.value || '');
    });

    // Bind send button
    sendBtn?.addEventListener('click', sendMessage);

    // Bind input events
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Auto-resize textarea
    input?.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });

    // Clear chat
    document.getElementById('clear-chat')?.addEventListener('click', () => {
      showConfirmModal('Clear Conversation', 'Clear messages in this chat?', () => {
        const activeChat = getActiveChat();
        if (activeChat) {
          activeChat.messages = [];
          activeChat.updatedAt = new Date().toISOString();
          saveChats();
          renderChatMessages();
          renderChatList(chatSearch?.value || '');
        }
        state.aiContext = null;
        contextPanel.style.display = 'none';
        showToast('success', 'Cleared', 'Conversation cleared');
      });
    });

    // Export chat
    document.getElementById('export-chat')?.addEventListener('click', () => {
      const activeChat = getActiveChat();
      if (!activeChat || activeChat.messages.length === 0) {
        showToast('warning', 'No Messages', 'No conversation to export');
        return;
      }

      let exportText = `CyberForge AI Assistant - Conversation Export\n`;
      exportText += `Date: ${new Date().toLocaleString()}\n`;
      exportText += `${'='.repeat(50)}\n\n`;

      activeChat.messages.forEach(msg => {
        const role = msg.role === 'user' ? 'User' : 'AI';
        exportText += `[${role}]\n${msg.content}\n\n`;
      });

      const blob = new Blob([exportText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cyberforge-chat-${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('success', 'Exported', 'Conversation exported');
    });

    // Attach context
    document.getElementById('attach-context')?.addEventListener('click', () => {
      showModal('Attach Context', `
        <div style="display:flex; flex-direction:column; gap:16px;">
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Context Type</label>
            <select class="cf-input" name="type" id="context-type-select" style="width:100%;">
              <option value="request">HTTP Request</option>
              <option value="finding">Finding</option>
              <option value="custom">Custom Text</option>
            </select>
          </div>
          <div id="context-request-select" style="display:block;">
            <label style="display:block; font-weight:600; margin-bottom:8px;">Select Request</label>
            <select class="cf-input" name="requestId" style="width:100%;">
              ${state.requests.slice(0, 20).map(r => `<option value="${r.id}">${r.method} ${r.host}${r.path}</option>`).join('')}
            </select>
          </div>
          <div id="context-finding-select" style="display:none;">
            <label style="display:block; font-weight:600; margin-bottom:8px;">Select Finding</label>
            <select class="cf-input" name="findingId" style="width:100%;">
              ${state.findings.map(f => `<option value="${f.id}">${f.severity}: ${f.title}</option>`).join('')}
            </select>
          </div>
          <div id="context-custom-input" style="display:none;">
            <label style="display:block; font-weight:600; margin-bottom:8px;">Custom Context</label>
            <textarea class="cf-input" name="customContext" rows="4" placeholder="Paste any relevant context..." style="width:100%;"></textarea>
          </div>
        </div>
      `, (formData) => {
        const type = formData.get('type');
        if (type === 'request') {
          const reqId = formData.get('requestId');
          const req = state.requests.find(r => r.id == reqId);
          if (req) {
            state.aiContext = { type: 'request', request: req };
            contextPanel.style.display = 'block';
            contextText.textContent = `Request: ${req.method} ${req.host}${req.path}`;
          }
        } else if (type === 'finding') {
          const findingId = formData.get('findingId');
          const finding = state.findings.find(f => f.id == findingId);
          if (finding) {
            state.aiContext = { type: 'finding', finding };
            contextPanel.style.display = 'block';
            contextText.textContent = `Finding: ${finding.severity} - ${finding.title}`;
          }
        } else if (type === 'custom') {
          const customContext = formData.get('customContext');
          state.aiContext = { type: 'custom', text: customContext };
          contextPanel.style.display = 'block';
          contextText.textContent = `Custom context attached`;
        }
        showToast('success', 'Attached', 'Context attached to conversation');
      });

      // Handle context type switching
      setTimeout(() => {
        document.getElementById('context-type-select')?.addEventListener('change', (e) => {
          document.getElementById('context-request-select').style.display = e.target.value === 'request' ? 'block' : 'none';
          document.getElementById('context-finding-select').style.display = e.target.value === 'finding' ? 'block' : 'none';
          document.getElementById('context-custom-input').style.display = e.target.value === 'custom' ? 'block' : 'none';
        });
      }, 100);
    });

    // Clear context
    document.getElementById('clear-context')?.addEventListener('click', () => {
      state.aiContext = null;
      contextPanel.style.display = 'none';
      showToast('success', 'Cleared', 'Context removed');
    });

    // Check AI status on load
    updateAIStatus();
  }

  // =========================================
  // EXPOSE
  // =========================================

  window.CyberForgeAssistant = {
    injectAssistantStyles,
    buildAssistantLayout,
    buildAssistantLayoutV2,
    initAIAssistantV2,
    bindAssistant,
    formatAIResponse: null // Will be available after bindAssistant runs (inner function)
  };
})();
