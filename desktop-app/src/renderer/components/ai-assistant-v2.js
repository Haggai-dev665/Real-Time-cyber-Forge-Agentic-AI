/**
 * AI Assistant V2 - Premium Chat Interface
 * A ChatGPT/Claude-quality experience for website analysis
 */

class AIAssistantV2 {
  constructor(container, apiClient) {
    this.container = container;
    this.api = apiClient;
    this.state = {
      chats: [],
      activeChatId: null,
      isLoading: false,
      currentPhase: null,
      isSidebarOpen: false,
    };
    this.STORAGE_KEY = 'cyberforge_ai_chats_v2';
    this.init();
  }

  init() {
    this.loadChats();
    this.render();
    this.bindEvents();
    this.checkAPIStatus();
    
    // Re-check API status every 30 seconds
    this.statusCheckInterval = setInterval(() => {
      this.checkAPIStatus();
    }, 30000);
    
    // Listen for theme changes and update accordingly
    this.observeThemeChanges();
  }
  
  observeThemeChanges() {
    // Watch for theme attribute changes on html element
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          // Force CSS variable recalculation by toggling a class
          const container = document.querySelector('.ai-assistant-container');
          if (container) {
            container.classList.remove('theme-transition');
            void container.offsetWidth; // Force reflow
            container.classList.add('theme-transition');
          }
        }
      });
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
  }

  // =========================================
  // STORAGE
  // =========================================

  loadChats() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      this.state.chats = stored ? JSON.parse(stored) : [];
    } catch {
      this.state.chats = [];
    }
    
    if (this.state.chats.length === 0) {
      this.createNewChat();
    } else {
      this.state.activeChatId = this.state.chats[0].id;
    }
  }

  saveChats() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state.chats));
  }

  getActiveChat() {
    return this.state.chats.find(c => c.id === this.state.activeChatId);
  }

  createNewChat() {
    const id = `chat_${Date.now()}`;
    const chat = {
      id,
      title: 'New Chat',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: []
    };
    this.state.chats.unshift(chat);
    this.state.activeChatId = id;
    this.saveChats();
    return chat;
  }

  deleteChat(chatId) {
    this.state.chats = this.state.chats.filter(c => c.id !== chatId);
    if (this.state.activeChatId === chatId) {
      this.state.activeChatId = this.state.chats[0]?.id || null;
      if (!this.state.activeChatId) {
        this.createNewChat();
      }
    }
    this.saveChats();
    this.render();
  }

  // =========================================
  // RENDER
  // =========================================

  render() {
    this.container.innerHTML = this.buildLayout();
    this.bindEvents();
    this.renderChatList();
    this.renderMessages();
    this.updateStatus();
  }

  buildLayout() {
    return `
      <div class="ai-assistant-container">
        <!-- Sidebar Overlay for Mobile -->
        <div class="ai-sidebar-overlay" id="ai-sidebar-overlay"></div>
        
        <!-- Chat History Sidebar -->
        <aside class="ai-sidebar" id="ai-sidebar">
          <div class="ai-sidebar-header">
            <button class="ai-new-chat-btn" id="ai-new-chat-btn">
              <i class="fas fa-plus"></i>
              New Chat
            </button>
            <div class="ai-search-box">
              <i class="fas fa-search ai-search-icon"></i>
              <input type="text" class="ai-search-input" id="ai-search" placeholder="Search chats...">
            </div>
          </div>
          <div class="ai-chat-list" id="ai-chat-list"></div>
          <div class="ai-sidebar-footer">
            <button class="ai-header-btn" style="width:100%; justify-content: flex-start; gap: 10px; padding: 12px;">
              <i class="fas fa-cog"></i>
              <span>Settings</span>
            </button>
          </div>
        </aside>
        
        <!-- Main Chat Area -->
        <main class="ai-main">
          <!-- Header -->
          <header class="ai-header">
            <div class="ai-header-left">
              <button class="ai-header-toggle" id="ai-sidebar-toggle">
                <i class="fas fa-bars"></i>
              </button>
              <div class="ai-header-title">
                <i class="fas fa-robot"></i>
                <span>CyberForge AI</span>
              </div>
            </div>
            <div class="ai-header-right">
              <div class="ai-status-badge" id="ai-status-badge">
                <span class="ai-status-dot"></span>
                <span id="ai-status-text">Connecting...</span>
              </div>
              <button class="ai-header-btn" id="ai-export-btn" title="Export conversation">
                <i class="fas fa-download"></i>
              </button>
              <button class="ai-header-btn" id="ai-clear-btn" title="Clear conversation">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </header>
          
          <!-- Messages Area -->
          <div class="ai-messages-wrapper">
            <div class="ai-messages" id="ai-messages">
              <div class="ai-messages-inner" id="ai-messages-inner"></div>
            </div>
          </div>
          
          <!-- Input Area -->
          <div class="ai-input-area">
            <div class="ai-input-container">
              <div class="ai-input-wrapper" id="ai-input-wrapper">
                <div class="ai-input-left">
                  <button class="ai-input-btn" id="ai-attach-btn" title="Attach file or context">
                    <i class="fas fa-paperclip"></i>
                  </button>
                </div>
                <textarea 
                  id="ai-input" 
                  class="ai-input-field" 
                  placeholder="Ask me to analyze a website, find vulnerabilities, or explain security concepts..."
                  rows="1"
                ></textarea>
                <button class="ai-send-btn" id="ai-send-btn" title="Send message">
                  <i class="fas fa-arrow-up"></i>
                </button>
              </div>
              <div class="ai-input-footer">
                <span class="ai-input-hint">
                  <kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> for new line
                </span>
                <div class="ai-input-quick-actions" id="ai-quick-actions">
                  <button class="ai-quick-action-chip" data-action="scan-website">
                    <i class="fas fa-globe"></i> Scan Website
                  </button>
                  <button class="ai-quick-action-chip" data-action="security-audit">
                    <i class="fas fa-shield-alt"></i> Security Audit
                  </button>
                  <button class="ai-quick-action-chip" data-action="tech-stack">
                    <i class="fas fa-layer-group"></i> Tech Stack
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    `;
  }

  // =========================================
  // RENDER COMPONENTS
  // =========================================

  renderChatList(filter = '') {
    const listEl = document.getElementById('ai-chat-list');
    if (!listEl) return;

    const normalized = filter.trim().toLowerCase();
    
    // Group chats by date
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    
    const groups = {
      today: [],
      yesterday: [],
      older: []
    };

    this.state.chats.forEach(chat => {
      if (normalized && !chat.title.toLowerCase().includes(normalized)) return;
      
      const chatDate = new Date(chat.updatedAt).toDateString();
      if (chatDate === today) {
        groups.today.push(chat);
      } else if (chatDate === yesterday) {
        groups.yesterday.push(chat);
      } else {
        groups.older.push(chat);
      }
    });

    let html = '';

    if (groups.today.length) {
      html += `<div class="ai-chat-section-label">Today</div>`;
      html += groups.today.map(chat => this.renderChatItem(chat)).join('');
    }

    if (groups.yesterday.length) {
      html += `<div class="ai-chat-section-label">Yesterday</div>`;
      html += groups.yesterday.map(chat => this.renderChatItem(chat)).join('');
    }

    if (groups.older.length) {
      html += `<div class="ai-chat-section-label">Previous</div>`;
      html += groups.older.map(chat => this.renderChatItem(chat)).join('');
    }

    listEl.innerHTML = html || '<div style="padding: 20px; text-align: center; color: var(--ai-text-muted);">No chats found</div>';

    // Bind chat item clicks
    listEl.querySelectorAll('.ai-chat-item').forEach(item => {
      item.addEventListener('click', () => {
        const chatId = item.dataset.chatId;
        this.state.activeChatId = chatId;
        this.renderChatList(filter);
        this.renderMessages();
        this.closeMobileSidebar();
      });
    });

    // Bind delete buttons
    listEl.querySelectorAll('.ai-chat-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const chatId = btn.dataset.chatId;
        this.deleteChat(chatId);
      });
    });
  }

  renderChatItem(chat) {
    const isActive = chat.id === this.state.activeChatId;
    const preview = chat.messages?.[chat.messages.length - 1]?.content?.slice(0, 50) || 'No messages yet';
    
    return `
      <div class="ai-chat-item ${isActive ? 'active' : ''}" data-chat-id="${chat.id}">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div style="flex: 1; min-width: 0;">
            <div class="ai-chat-item-title">${this.escapeHtml(chat.title)}</div>
            <div class="ai-chat-item-preview">${this.escapeHtml(preview)}...</div>
          </div>
          <button class="ai-chat-delete ai-header-btn" data-chat-id="${chat.id}" style="width: 24px; height: 24px; opacity: 0.5;">
            <i class="fas fa-trash" style="font-size: 10px;"></i>
          </button>
        </div>
      </div>
    `;
  }

  renderMessages() {
    const messagesEl = document.getElementById('ai-messages-inner');
    if (!messagesEl) return;

    const chat = this.getActiveChat();
    
    if (!chat || chat.messages.length === 0) {
      messagesEl.innerHTML = this.buildWelcomeScreen();
      this.bindWelcomeCards();
      return;
    }

    messagesEl.innerHTML = chat.messages.map(msg => this.renderMessage(msg)).join('');
    this.scrollToBottom();
    this.bindMessageActions();
  }

  buildWelcomeScreen() {
    return `
      <div class="ai-welcome">
        <div class="ai-welcome-logo">
          <i class="fas fa-brain"></i>
        </div>
        <h1 class="ai-welcome-title">CyberForge AI Assistant</h1>
        <p class="ai-welcome-subtitle">
          Your AI-powered security analyst. I can scrape and analyze any website in real-time, 
          finding vulnerabilities, extracting technologies, and generating comprehensive security reports.
        </p>
        <div class="ai-welcome-grid">
          <div class="ai-welcome-card" data-prompt="Scan https://example.com for security vulnerabilities and analyze all network requests, headers, and potential threats">
            <div class="ai-welcome-card-icon">
              <i class="fas fa-globe"></i>
            </div>
            <div class="ai-welcome-card-title">Live Website Scan</div>
            <div class="ai-welcome-card-desc">Scrape and analyze any website for security issues in real-time</div>
          </div>
          <div class="ai-welcome-card" data-prompt="Generate a comprehensive security audit report for https://github.com including SSL analysis, headers, and vulnerabilities">
            <div class="ai-welcome-card-icon">
              <i class="fas fa-file-alt"></i>
            </div>
            <div class="ai-welcome-card-title">Security Report</div>
            <div class="ai-welcome-card-desc">Generate detailed security audit reports with actionable insights</div>
          </div>
          <div class="ai-welcome-card" data-prompt="What are the OWASP Top 10 vulnerabilities and how do I test for them?">
            <div class="ai-welcome-card-icon">
              <i class="fas fa-graduation-cap"></i>
            </div>
            <div class="ai-welcome-card-title">Security Knowledge</div>
            <div class="ai-welcome-card-desc">Learn about vulnerabilities, attacks, and security best practices</div>
          </div>
          <div class="ai-welcome-card" data-prompt="Analyze the technology stack and detect frameworks used on https://netflix.com">
            <div class="ai-welcome-card-icon">
              <i class="fas fa-layer-group"></i>
            </div>
            <div class="ai-welcome-card-title">Tech Stack Detection</div>
            <div class="ai-welcome-card-desc">Identify frameworks, libraries, and technologies used by any site</div>
          </div>
        </div>
      </div>
    `;
  }

  renderMessage(msg) {
    const { role, content, timestamp, meta, richContent } = msg;
    const isUser = role === 'user';
    const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let contentHtml = '';
    
    if (richContent) {
      contentHtml = this.renderRichContent(richContent);
    } else {
      contentHtml = this.formatMessageContent(content);
    }

    // Add follow-up suggestions for assistant messages
    const suggestionsHtml = !isUser && meta?.suggestions ? this.renderSuggestions(meta.suggestions) : '';

    return `
      <div class="ai-message ${isUser ? 'user' : 'assistant'}">
        <div class="ai-message-header">
          <div class="ai-message-avatar ${role}">
            <i class="fas ${isUser ? 'fa-user' : 'fa-robot'}"></i>
          </div>
          <div class="ai-message-meta">
            <span class="ai-message-name">${isUser ? 'You' : 'CyberForge AI'}</span>
            <span class="ai-message-time">${time}</span>
          </div>
        </div>
        <div class="ai-message-content">
          ${contentHtml}
        </div>
        ${suggestionsHtml}
        <div class="ai-message-actions">
          <button class="ai-message-action" data-action="copy" title="Copy">
            <i class="fas fa-copy"></i> Copy
          </button>
          ${!isUser ? `
            <button class="ai-message-action" data-action="regenerate" title="Regenerate">
              <i class="fas fa-redo"></i> Regenerate
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  renderRichContent(richContent) {
    let html = '';

    // Website Analysis Panel
    if (richContent.websiteAnalysis) {
      html += this.buildWebsiteAnalysisPanel(richContent.websiteAnalysis);
    }

    // Report Panel
    if (richContent.report) {
      html += this.buildReportPanel(richContent.report);
    }

    // Image Grid
    if (richContent.images && richContent.images.length > 0) {
      html += this.buildImageGrid(richContent.images);
    }

    // Tech Stack
    if (richContent.technologies) {
      html += this.buildTechStack(richContent.technologies);
    }

    // Code Blocks
    if (richContent.code) {
      html += this.buildCodeBlock(richContent.code.language, richContent.code.content);
    }

    // Regular text content
    if (richContent.text) {
      html += this.formatMessageContent(richContent.text);
    }

    return html;
  }

  buildWebsiteAnalysisPanel(analysis) {
    const riskClass = this.getRiskClass(analysis.riskScore);
    
    return `
      <div class="ai-website-analysis">
        <div class="ai-website-header">
          <div class="ai-website-info">
            <div class="ai-website-favicon">
              ${analysis.favicon ? `<img src="${analysis.favicon}" alt="">` : '<i class="fas fa-globe" style="color: var(--ai-text-muted);"></i>'}
            </div>
            <div class="ai-website-details">
              <h3>${this.escapeHtml(analysis.title || analysis.url)}</h3>
              <div class="ai-website-url">${this.escapeHtml(analysis.url)}</div>
            </div>
          </div>
          <div class="ai-risk-badge ${riskClass}">
            <i class="fas fa-shield-alt"></i>
            Risk Score: ${analysis.riskScore}/100
          </div>
        </div>
        
        <div class="ai-analysis-tabs" id="analysis-tabs">
          <div class="ai-analysis-tab active" data-tab="overview">Overview</div>
          <div class="ai-analysis-tab" data-tab="security">Security</div>
          <div class="ai-analysis-tab" data-tab="technologies">Technologies</div>
          <div class="ai-analysis-tab" data-tab="performance">Performance</div>
          <div class="ai-analysis-tab" data-tab="images">Assets</div>
        </div>
        
        <div class="ai-analysis-content" id="analysis-content">
          ${this.buildOverviewTab(analysis)}
        </div>
      </div>
    `;
  }

  buildOverviewTab(analysis) {
    return `
      ${analysis.description ? `
        <div class="ai-website-about">
          <h4 class="ai-section-title"><i class="fas fa-info-circle"></i> About This Website</h4>
          <p class="ai-website-description">${this.escapeHtml(analysis.description)}</p>
        </div>
      ` : ''}
      
      <div class="ai-stats-grid">
        <div class="ai-stat-card">
          <div class="ai-stat-value" style="color: ${this.getRiskColor(analysis.riskScore)};">${analysis.riskScore || 'N/A'}</div>
          <div class="ai-stat-label">Risk Score</div>
        </div>
        <div class="ai-stat-card">
          <div class="ai-stat-value">${analysis.findings?.length || 0}</div>
          <div class="ai-stat-label">Issues Found</div>
        </div>
        <div class="ai-stat-card">
          <div class="ai-stat-value">${analysis.technologies?.length || 0}</div>
          <div class="ai-stat-label">Technologies</div>
        </div>
        <div class="ai-stat-card">
          <div class="ai-stat-value">${analysis.requests?.length || analysis.images?.length || 0}</div>
          <div class="ai-stat-label">Assets</div>
        </div>
      </div>
      
      ${analysis.summary ? `
        <div class="ai-tab-section">
          <h4 class="ai-section-title"><i class="fas fa-clipboard-list"></i> Analysis Summary</h4>
          <p style="color: var(--ai-text-secondary); line-height: 1.6;">${this.escapeHtml(analysis.summary)}</p>
        </div>
      ` : ''}
      
      ${analysis.findings?.length > 0 ? `
        <div class="ai-tab-section">
          <h4 class="ai-section-title"><i class="fas fa-exclamation-triangle"></i> Key Findings</h4>
          <div class="ai-findings-list">
            ${analysis.findings.slice(0, 5).map(f => `
              <div class="ai-finding-item">
                <div class="ai-finding-severity ${f.severity || 'medium'}"></div>
                <div class="ai-finding-content">
                  <div class="ai-finding-title">${this.escapeHtml(f.title || f.name)}</div>
                  <div class="ai-finding-desc">${this.escapeHtml(f.description || '')}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;
  }

  buildReportPanel(report) {
    return `
      <div class="ai-report-panel">
        <div class="ai-report-header">
          <div class="ai-report-icon">
            <i class="fas fa-file-alt"></i>
          </div>
          <div class="ai-report-info">
            <h4>${this.escapeHtml(report.title || 'Security Analysis Report')}</h4>
            <p>Generated ${new Date().toLocaleDateString()} · ${report.pages || 'Multiple'} sections</p>
          </div>
        </div>
        <div class="ai-report-actions">
          <button class="ai-report-btn primary" data-action="download-pdf">
            <i class="fas fa-file-pdf"></i> Download PDF
          </button>
          <button class="ai-report-btn" data-action="download-json">
            <i class="fas fa-code"></i> Export JSON
          </button>
          <button class="ai-report-btn" data-action="view-report">
            <i class="fas fa-eye"></i> View Full Report
          </button>
        </div>
      </div>
    `;
  }

  buildImageGrid(images) {
    return `
      <div style="margin: 16px 0;">
        <h4 style="margin-bottom: 12px; color: var(--ai-text-primary);">
          <i class="fas fa-images" style="margin-right: 8px; color: var(--ai-accent-primary);"></i>
          Extracted Images (${images.length})
        </h4>
        <div class="ai-image-grid">
          ${images.slice(0, 12).map(img => `
            <div class="ai-image-item" data-src="${img.url}">
              <img src="${img.url}" alt="${this.escapeHtml(img.alt || '')}" loading="lazy" onerror="this.parentElement.style.display='none'">
              <div class="ai-image-item-overlay">
                <i class="fas fa-search-plus" style="color: white; font-size: 20px;"></i>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  buildTechStack(technologies) {
    return `
      <div style="margin: 16px 0;">
        <h4 style="margin-bottom: 12px; color: var(--ai-text-primary);">
          <i class="fas fa-layer-group" style="margin-right: 8px; color: var(--ai-accent-primary);"></i>
          Detected Technologies
        </h4>
        <div class="ai-tech-grid">
          ${technologies.map(tech => `
            <div class="ai-tech-badge">
              ${tech.icon ? `<img src="${tech.icon}" alt="">` : '<i class="fas fa-code"></i>'}
              ${this.escapeHtml(tech.name)}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  buildCodeBlock(language, code) {
    return `
      <div class="ai-code-block">
        <div class="ai-code-header">
          <span class="ai-code-lang">${language || 'code'}</span>
          <button class="ai-code-copy" data-code="${this.escapeHtml(code)}">
            <i class="fas fa-copy"></i> Copy
          </button>
        </div>
        <div class="ai-code-content">
          <pre><code>${this.escapeHtml(code)}</code></pre>
        </div>
      </div>
    `;
  }

  renderSuggestions(suggestions) {
    if (!suggestions || suggestions.length === 0) return '';
    
    return `
      <div class="ai-suggestions">
        ${suggestions.map(s => `
          <button class="ai-suggestion-chip" data-suggestion="${this.escapeHtml(s.prompt)}">
            <i class="fas ${s.icon || 'fa-arrow-right'}"></i>
            ${this.escapeHtml(s.text)}
          </button>
        `).join('')}
      </div>
    `;
  }

  // =========================================
  // LOADING STATES
  // =========================================

  showThinkingState(phase = 'Analyzing...') {
    const messagesEl = document.getElementById('ai-messages-inner');
    if (!messagesEl) return;

    // Remove existing thinking state
    this.hideThinkingState();

    const thinkingHtml = `
      <div class="ai-thinking" id="ai-thinking-state">
        <div class="ai-thinking-header">
          <div class="ai-thinking-avatar">
            <i class="fas fa-robot"></i>
          </div>
          <div class="ai-message-meta">
            <span class="ai-message-name">CyberForge AI</span>
            <span class="ai-message-time">Now</span>
          </div>
        </div>
        <div class="ai-thinking-content">
          <div class="ai-thinking-phase">
            <div class="ai-thinking-spinner"></div>
            <div class="ai-thinking-text">
              <div class="ai-thinking-main" id="ai-thinking-phase">${phase}</div>
              <div class="ai-thinking-sub" id="ai-thinking-tools">Initializing analysis pipeline...</div>
            </div>
          </div>
          <div class="ai-thinking-progress">
            <div class="ai-thinking-progress-bar"></div>
          </div>
        </div>
      </div>
    `;

    messagesEl.insertAdjacentHTML('beforeend', thinkingHtml);
    this.scrollToBottom();
  }

  updateThinkingPhase(phase, tools = []) {
    const phaseEl = document.getElementById('ai-thinking-phase');
    const toolsEl = document.getElementById('ai-thinking-tools');
    
    if (phaseEl) phaseEl.textContent = phase;
    if (toolsEl && tools.length > 0) {
      toolsEl.textContent = `Using: ${tools.join(', ')}`;
    }
  }

  hideThinkingState() {
    const thinkingEl = document.getElementById('ai-thinking-state');
    if (thinkingEl) thinkingEl.remove();
  }

  // =========================================
  // MESSAGE FORMATTING
  // =========================================

  formatMessageContent(text) {
    if (!text) return '';
    
    let html = this.escapeHtml(text);

    // Code blocks
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      return this.buildCodeBlock(lang || 'code', code.trim());
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code style="background: var(--ai-bg-tertiary); padding: 2px 6px; border-radius: 4px; font-size: 13px;">$1</code>');

    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Headers
    html = html.replace(/^### (.+)$/gm, '<h4 style="margin: 16px 0 8px; color: var(--ai-accent-primary);">$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3 style="margin: 20px 0 12px;">$1</h3>');

    // Bullet points
    html = html.replace(/^[•\-\*] (.+)$/gm, '<div style="display: flex; gap: 10px; margin: 6px 0;"><span style="color: var(--ai-accent-primary);">•</span><span>$1</span></div>');

    // Numbered lists
    html = html.replace(/^(\d+)\. (.+)$/gm, '<div style="display: flex; gap: 10px; margin: 6px 0;"><span style="color: var(--ai-accent-orange); font-weight: 600; min-width: 20px;">$1.</span><span>$2</span></div>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color: var(--ai-text-link);">$1</a>');

    // Line breaks
    html = html.replace(/\n/g, '<br>');

    return `<p>${html}</p>`;
  }

  // =========================================
  // EVENTS
  // =========================================

  bindEvents() {
    // Send message
    const sendBtn = document.getElementById('ai-send-btn');
    const input = document.getElementById('ai-input');
    
    sendBtn?.addEventListener('click', () => this.sendMessage());
    
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Auto-resize textarea
    input?.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 200) + 'px';
    });

    // New chat
    document.getElementById('ai-new-chat-btn')?.addEventListener('click', () => {
      this.createNewChat();
      this.renderChatList();
      this.renderMessages();
    });

    // Search
    document.getElementById('ai-search')?.addEventListener('input', (e) => {
      this.renderChatList(e.target.value);
    });

    // Sidebar toggle
    document.getElementById('ai-sidebar-toggle')?.addEventListener('click', () => {
      this.toggleMobileSidebar();
    });

    document.getElementById('ai-sidebar-overlay')?.addEventListener('click', () => {
      this.closeMobileSidebar();
    });

    // Clear chat
    document.getElementById('ai-clear-btn')?.addEventListener('click', () => {
      const chat = this.getActiveChat();
      if (chat) {
        chat.messages = [];
        chat.title = 'New Chat';
        this.saveChats();
        this.renderChatList();
        this.renderMessages();
      }
    });

    // Export chat
    document.getElementById('ai-export-btn')?.addEventListener('click', () => {
      this.exportChat();
    });

    // Quick actions
    document.querySelectorAll('.ai-quick-action-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        this.handleQuickAction(action);
      });
    });
  }

  bindWelcomeCards() {
    document.querySelectorAll('.ai-welcome-card').forEach(card => {
      card.addEventListener('click', () => {
        const input = document.getElementById('ai-input');
        if (input) {
          input.value = card.dataset.prompt;
          this.sendMessage();
        }
      });
    });
  }

  bindMessageActions() {
    document.querySelectorAll('.ai-message-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'copy') {
          const content = btn.closest('.ai-message')?.querySelector('.ai-message-content')?.textContent;
          if (content) {
            navigator.clipboard.writeText(content);
            btn.innerHTML = '<i class="fas fa-check"></i> Copied';
            setTimeout(() => {
              btn.innerHTML = '<i class="fas fa-copy"></i> Copy';
            }, 2000);
          }
        }
      });
    });

    // Suggestion chips
    document.querySelectorAll('.ai-suggestion-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const input = document.getElementById('ai-input');
        if (input) {
          input.value = chip.dataset.suggestion;
          this.sendMessage();
        }
      });
    });

    // Code copy buttons
    document.querySelectorAll('.ai-code-copy').forEach(btn => {
      btn.addEventListener('click', () => {
        const code = btn.dataset.code;
        if (code) {
          navigator.clipboard.writeText(code);
          btn.innerHTML = '<i class="fas fa-check"></i> Copied';
          setTimeout(() => {
            btn.innerHTML = '<i class="fas fa-copy"></i> Copy';
          }, 2000);
        }
      });
    });

    // Bind analysis tabs
    this.bindAnalysisTabs();
  }

  bindAnalysisTabs() {
    document.querySelectorAll('.ai-analysis-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        const analysisPanel = e.target.closest('.ai-website-analysis');
        if (!analysisPanel || !tabName) return;

        // Update active tab
        analysisPanel.querySelectorAll('.ai-analysis-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');

        // Get stored analysis data
        const analysisId = analysisPanel.dataset.analysisId;
        const analysis = this.state.lastAnalysis || {};

        // Update content based on tab
        const contentEl = analysisPanel.querySelector('.ai-analysis-content');
        if (contentEl) {
          contentEl.innerHTML = this.buildTabContent(tabName, analysis);
        }
      });
    });
  }

  buildTabContent(tabName, analysis) {
    switch(tabName) {
      case 'overview':
        return this.buildOverviewTab(analysis);
      case 'security':
        return this.buildSecurityTab(analysis);
      case 'technologies':
        return this.buildTechnologiesTab(analysis);
      case 'performance':
        return this.buildPerformanceTab(analysis);
      case 'images':
        return this.buildAssetsTab(analysis);
      default:
        return this.buildOverviewTab(analysis);
    }
  }

  buildSecurityTab(analysis) {
    const headers = analysis.headers || {};
    const ssl = analysis.ssl || {};
    const findings = analysis.findings || [];
    const externalDomains = analysis.external_domains || [];
    const suspiciousRequests = analysis.suspicious_requests || [];
    
    return `
      <div class="ai-tab-section">
        <h4 class="ai-section-title"><i class="fas fa-shield-alt"></i> Security Headers</h4>
        <div class="ai-security-headers">
          ${this.buildHeaderStatus('Content-Security-Policy', headers.csp)}
          ${this.buildHeaderStatus('Strict-Transport-Security', headers.hsts)}
          ${this.buildHeaderStatus('X-Frame-Options', headers.xFrameOptions)}
          ${this.buildHeaderStatus('X-Content-Type-Options', headers.xContentType)}
          ${this.buildHeaderStatus('X-XSS-Protection', headers.xssProtection)}
          ${this.buildHeaderStatus('Referrer-Policy', headers.referrerPolicy)}
        </div>
      </div>
      
      <div class="ai-tab-section">
        <h4 class="ai-section-title"><i class="fas fa-lock"></i> SSL/TLS Status</h4>
        <div class="ai-ssl-info">
          <div class="ai-ssl-badge ${ssl.valid ? 'valid' : 'invalid'}">
            <i class="fas ${ssl.valid ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i>
            ${ssl.valid ? 'Valid SSL Certificate' : 'SSL Issues Detected'}
          </div>
          ${ssl.issuer ? `<p class="ai-ssl-detail"><strong>Issuer:</strong> ${this.escapeHtml(ssl.issuer)}</p>` : ''}
          ${ssl.expires ? `<p class="ai-ssl-detail"><strong>Expires:</strong> ${this.escapeHtml(ssl.expires)}</p>` : ''}
        </div>
      </div>
      
      ${suspiciousRequests.length > 0 ? `
      <div class="ai-tab-section">
        <h4 class="ai-section-title" style="color: var(--ai-accent-red);"><i class="fas fa-exclamation-triangle"></i> Suspicious Requests (${suspiciousRequests.length})</h4>
        <div class="ai-suspicious-box">
          ${suspiciousRequests.slice(0, 10).map(req => `
            <div class="ai-suspicious-item">
              <div class="ai-suspicious-url">${this.escapeHtml((req.url || '').slice(0, 120))}</div>
              <div class="ai-suspicious-reason"><i class="fas fa-info-circle"></i> ${this.escapeHtml(req.reason || 'Suspicious pattern detected')}</div>
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}
      
      <div class="ai-tab-section">
        <h4 class="ai-section-title"><i class="fas fa-bug"></i> Vulnerabilities (${findings.length})</h4>
        ${findings.length > 0 ? `
          <div class="ai-findings-list">
            ${findings.map(f => `
              <div class="ai-finding-item">
                <div class="ai-finding-severity ${f.severity || 'medium'}"></div>
                <div class="ai-finding-content">
                  <div class="ai-finding-title">${this.escapeHtml(f.title || f.name)}</div>
                  <div class="ai-finding-desc">${this.escapeHtml(f.description || '')}</div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : '<p class="ai-empty-state">No vulnerabilities detected</p>'}
      </div>
      
      ${externalDomains.length > 0 ? `
      <div class="ai-tab-section">
        <h4 class="ai-section-title"><i class="fas fa-globe"></i> External Domains (${externalDomains.length})</h4>
        <div class="ai-domains-wrapper">
          ${externalDomains.slice(0, 30).map(domain => `
            <span class="ai-domain-tag"><i class="fas fa-link"></i> ${this.escapeHtml(domain)}</span>
          `).join('')}
          ${externalDomains.length > 30 ? `<span class="ai-domain-tag" style="background: var(--ai-bg-secondary); color: var(--ai-text-muted);">+${externalDomains.length - 30} more</span>` : ''}
        </div>
      </div>
      ` : ''}
    `;
  }

  buildHeaderStatus(name, value) {
    const hasValue = value && value !== 'Not Set';
    return `
      <div class="ai-header-row ${hasValue ? 'present' : 'missing'}">
        <span class="ai-header-name">${name}</span>
        <span class="ai-header-value">
          <i class="fas ${hasValue ? 'fa-check' : 'fa-times'}"></i>
          ${hasValue ? this.escapeHtml(String(value).slice(0, 50)) : 'Not Set'}
        </span>
      </div>
    `;
  }

  buildTechnologiesTab(analysis) {
    const technologies = analysis.technologies || [];
    const categories = {};
    
    technologies.forEach(tech => {
      const cat = tech.category || 'Other';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(tech);
    });

    return `
      <div class="ai-tab-section">
        <h4 class="ai-section-title"><i class="fas fa-layer-group"></i> Detected Technologies</h4>
        ${Object.keys(categories).length > 0 ? Object.entries(categories).map(([cat, techs]) => `
          <div class="ai-tech-category">
            <h5 class="ai-tech-category-title">${this.escapeHtml(cat)}</h5>
            <div class="ai-tech-grid">
              ${techs.map(tech => `
                <div class="ai-tech-badge">
                  ${tech.icon ? `<img src="${tech.icon}" alt="" onerror="this.style.display='none'">` : '<i class="fas fa-code"></i>'}
                  <span>${this.escapeHtml(tech.name)}</span>
                  ${tech.version ? `<span class="ai-tech-version">${this.escapeHtml(tech.version)}</span>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        `).join('') : '<p class="ai-empty-state">No technologies detected</p>'}
      </div>
    `;
  }

  buildPerformanceTab(analysis) {
    const perf = analysis.performance || {};
    const loadTime = perf.loadTime || 'N/A';
    const pageSize = perf.pageSize || 'N/A';
    const requests = perf.requestCount || analysis.requests?.length || 0;
    const consoleLogs = analysis.console_logs || [];
    const errors = consoleLogs.filter(l => l.level === 'error');
    const warnings = consoleLogs.filter(l => l.level === 'warning');

    return `
      <div class="ai-tab-section">
        <h4 class="ai-section-title"><i class="fas fa-tachometer-alt"></i> Performance Metrics</h4>
        <div class="ai-stats-grid">
          <div class="ai-stat-card">
            <div class="ai-stat-value">${loadTime}</div>
            <div class="ai-stat-label">Load Time</div>
          </div>
          <div class="ai-stat-card">
            <div class="ai-stat-value">${pageSize}</div>
            <div class="ai-stat-label">Page Size</div>
          </div>
          <div class="ai-stat-card">
            <div class="ai-stat-value">${requests}</div>
            <div class="ai-stat-label">Requests</div>
          </div>
          <div class="ai-stat-card">
            <div class="ai-stat-value">${perf.domReady || perf.score || 'N/A'}</div>
            <div class="ai-stat-label">DOM Ready</div>
          </div>
        </div>
        ${perf.lcp || perf.cls ? `
        <div class="ai-stats-grid" style="margin-top: 10px;">
          ${perf.lcp ? `<div class="ai-stat-card"><div class="ai-stat-value">${perf.lcp}</div><div class="ai-stat-label">LCP</div></div>` : ''}
          ${perf.firstPaint ? `<div class="ai-stat-card"><div class="ai-stat-value">${perf.firstPaint}</div><div class="ai-stat-label">First Paint</div></div>` : ''}
          ${perf.cls !== null && perf.cls !== undefined ? `<div class="ai-stat-card"><div class="ai-stat-value">${perf.cls.toFixed(3)}</div><div class="ai-stat-label">CLS</div></div>` : ''}
        </div>
        ` : ''}
      </div>
      
      ${consoleLogs.length > 0 ? `
        <div class="ai-tab-section">
          <h4 class="ai-section-title"><i class="fas fa-terminal"></i> Console Output (${errors.length} errors, ${warnings.length} warnings)</h4>
          <div class="ai-console-logs">
            ${consoleLogs.slice(0, 15).map(log => `
              <div class="ai-console-item ${log.level}">
                <span class="ai-console-level">[${log.level}]</span>
                <span class="ai-console-msg">${this.escapeHtml((log.message || '').slice(0, 100))}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      ${analysis.requests?.length > 0 ? `
        <div class="ai-tab-section">
          <h4 class="ai-section-title"><i class="fas fa-network-wired"></i> Network Requests (${analysis.requests.length} total)</h4>
          <div class="ai-requests-table">
            ${analysis.requests.slice(0, 25).map(req => {
                const statusClass = req.status >= 500 ? 's-5xx' : req.status >= 400 ? 's-4xx' : req.status >= 300 ? 's-3xx' : 's-2xx';
                return `
              <div class="ai-req-row">
                <span class="ai-req-method ${(req.method || 'GET').toLowerCase()}">${req.method || 'GET'}</span>
                <span class="ai-req-status ${statusClass}">${req.status || '-'}</span>
                <span class="ai-req-url" title="${this.escapeHtml(req.url || '')}">${this.escapeHtml((req.url || '').slice(0, 70))}</span>
                <span class="ai-req-meta">${req.time || '-'}</span>
                <span class="ai-req-meta">${req.size || '-'}</span>
              </div>
            `}).join('')}
            ${analysis.requests.length > 25 ? `<div style="padding: 10px; text-align: center; color: var(--ai-text-muted); font-size: 12px;">+ ${analysis.requests.length - 25} more requests</div>` : ''}
          </div>
        </div>
      ` : ''}
    `;
  }

  buildAssetsTab(analysis) {
    const images = analysis.images || [];
    const scripts = analysis.scripts || [];
    const stylesheets = analysis.stylesheets || [];

    return `
      <div class="ai-tab-section">
        <h4 class="ai-section-title"><i class="fas fa-images"></i> Images (${images.length})</h4>
        ${images.length > 0 ? `
          <div class="ai-image-grid">
            ${images.slice(0, 12).map(img => `
              <div class="ai-image-item" data-src="${img.url || img}">
                <img src="${img.url || img}" alt="${this.escapeHtml(img.alt || '')}" loading="lazy" onerror="this.parentElement.style.display='none'">
              </div>
            `).join('')}
          </div>
        ` : '<p class="ai-empty-state">No images found</p>'}
      </div>
      
      <div class="ai-tab-section">
        <h4 class="ai-section-title"><i class="fas fa-file-code"></i> Scripts (${scripts.length})</h4>
        ${scripts.length > 0 ? `
          <div class="ai-assets-list">
            ${scripts.slice(0, 8).map(s => `
              <div class="ai-asset-item">
                <i class="fas fa-file-code"></i>
                <span>${this.escapeHtml((s.src || s).split('/').pop() || s)}</span>
              </div>
            `).join('')}
          </div>
        ` : '<p class="ai-empty-state">No external scripts</p>'}
      </div>
      
      <div class="ai-tab-section">
        <h4 class="ai-section-title"><i class="fas fa-palette"></i> Stylesheets (${stylesheets.length})</h4>
        ${stylesheets.length > 0 ? `
          <div class="ai-assets-list">
            ${stylesheets.slice(0, 8).map(s => `
              <div class="ai-asset-item">
                <i class="fas fa-css3-alt"></i>
                <span>${this.escapeHtml((s.href || s).split('/').pop() || s)}</span>
              </div>
            `).join('')}
          </div>
        ` : '<p class="ai-empty-state">No external stylesheets</p>'}
      </div>
    `;
  }

  // =========================================
  // ACTIONS
  // =========================================

  async sendMessage() {
    const input = document.getElementById('ai-input');
    const text = input?.value?.trim();
    
    if (!text || this.state.isLoading) return;

    // Add user message
    this.addMessage('user', text);
    input.value = '';
    input.style.height = 'auto';

    // Determine phase based on content
    const urlPattern = /(https?:\/\/[^\s]+)/i;
    const hasUrl = urlPattern.test(text);
    const scanKeywords = ['scan', 'analyze', 'check', 'security', 'vulnerab', 'audit', 'inspect', 'assess'];
    const hasScanIntent = scanKeywords.some(kw => text.toLowerCase().includes(kw));

    this.state.isLoading = true;
    document.getElementById('ai-send-btn').disabled = true;

    try {
      // Show intelligent loading state
      if (hasUrl && hasScanIntent) {
        this.showThinkingState('Scraping website...');
        
        // Simulate progressive phases
        setTimeout(() => this.updateThinkingPhase('Extracting HTML content...', ['web_scraper']), 800);
        setTimeout(() => this.updateThinkingPhase('Analyzing network requests...', ['network_analyzer']), 1600);
        setTimeout(() => this.updateThinkingPhase('Scanning for vulnerabilities...', ['security_scanner', 'vuln_detector']), 2400);
        setTimeout(() => this.updateThinkingPhase('Generating security report...', ['report_generator', 'ai_analyst']), 3200);
      } else {
        this.showThinkingState('Processing your request...');
        setTimeout(() => this.updateThinkingPhase('Analyzing context...', ['ai_engine']), 500);
      }

      // Call API
      const chat = this.getActiveChat();
      const history = chat?.messages?.slice(-10).map(m => ({
        role: m.role,
        content: m.content
      })) || [];

      const result = await this.api.chatWithAI(text, history, {
        source: 'desktop_assistant_v2',
        timestamp: new Date().toISOString()
      });

      this.hideThinkingState();

      if (result.success) {
        let response = result.data?.response || result.data || 'No response received';
        
        // Detect backend AI-offline messages and provide clearer feedback
        if (typeof response === 'string' && (response.includes('AI brain') || response.includes('AI capabilities are offline'))) {
          response = `⚠️ **AI Model Temporarily Unavailable**\n\nThe CyberForge backend is connected and running, but the AI language model behind it is currently offline or restarting.\n\n**What you can still do:**\n- Browse captured requests and responses\n- Use the Agent Center for browser monitoring\n- Run manual security scans\n\nThe AI will reconnect automatically. Try again in a few minutes.`;
        }
        
        // Build rich content if website was scanned
        let meta = {
          confidence: result.data?.confidence,
          insights: result.data?.insights,
          recommendations: result.data?.recommendations
        };

        // Add follow-up suggestions
        if (hasUrl && hasScanIntent) {
          meta.suggestions = [
            { text: 'Generate PDF report', prompt: 'Generate a detailed PDF security report', icon: 'fa-file-pdf' },
            { text: 'Deep vulnerability scan', prompt: 'Perform a deeper vulnerability scan', icon: 'fa-search' },
            { text: 'Compare with competitor', prompt: 'Compare security with a competitor site', icon: 'fa-balance-scale' }
          ];
        }

        // Check for website scan data
        if (result.data?.website_scan?.scanned) {
          const ws = result.data.website_scan;
          const analysisData = {
            url: ws.url,
            title: ws.title || 'Website Analysis',
            description: ws.description || ws.meta_description || '',
            riskScore: ws.risk_score || 50,
            summary: ws.summary,
            findings: ws.findings || [],
            technologies: ws.technologies || [],
            requests: ws.requests || [],
            images: ws.images || [],
            scripts: ws.scripts || [],
            stylesheets: ws.stylesheets || [],
            headers: ws.headers || {},
            ssl: ws.ssl || {},
            performance: ws.performance || {},
            // New fields from enhanced webscraper integration
            external_domains: ws.external_domains || [],
            suspicious_requests: ws.suspicious_requests || [],
            console_logs: ws.console_logs || [],
            security_report: ws.security_report || {}
          };
          
          console.log('📊 Website Analysis Data:', {
            requests: analysisData.requests.length,
            images: analysisData.images.length,
            scripts: analysisData.scripts.length,
            technologies: analysisData.technologies.length,
            console_logs: analysisData.console_logs.length
          });
          
          // Store analysis for tab switching
          this.state.lastAnalysis = analysisData;
          
          const richContent = {
            websiteAnalysis: analysisData,
            text: response
          };
          
          this.addMessage('assistant', response, meta, richContent);
        } else {
          this.addMessage('assistant', response, meta);
        }
      } else {
        this.addMessage('assistant', `❌ Error: ${result.error || 'Failed to get response'}`);
      }
    } catch (error) {
      this.hideThinkingState();
      console.error('AI Service Error:', error);
      
      // Check if it's a connection error vs API error
      const isConnectionError = error.message.includes('Failed to fetch') || 
                                 error.message.includes('NetworkError') ||
                                 error.message.includes('ECONNREFUSED');
      
      if (isConnectionError) {
        this.addMessage('assistant', `❌ **AI Service Unavailable**\n\nThe AI backend service appears to be offline or unreachable. Please try again in a moment.\n\n**Troubleshooting:**\n- Check your internet connection\n- The backend server may be restarting\n- Try refreshing the application`);
      } else {
        this.addMessage('assistant', `❌ **Error:** ${error.message}\n\nIf this persists, try starting a new chat.`);
      }
      this.updateStatus(false, 'Service Error');
    } finally {
      this.state.isLoading = false;
      document.getElementById('ai-send-btn').disabled = false;
    }
  }

  addMessage(role, content, meta = null, richContent = null) {
    const chat = this.getActiveChat();
    if (!chat) return;

    // Update title if first user message
    if (chat.messages.length === 0 && role === 'user') {
      chat.title = content.length > 40 ? content.slice(0, 40) + '...' : content;
    }

    const msg = {
      role,
      content,
      timestamp: new Date().toISOString(),
      meta,
      richContent
    };

    chat.messages.push(msg);
    chat.updatedAt = new Date().toISOString();
    this.saveChats();
    
    this.renderChatList();
    
    // Append message to DOM
    const messagesEl = document.getElementById('ai-messages-inner');
    if (messagesEl) {
      // Remove welcome screen if present
      const welcome = messagesEl.querySelector('.ai-welcome');
      if (welcome) welcome.remove();
      
      messagesEl.insertAdjacentHTML('beforeend', this.renderMessage(msg));
      this.scrollToBottom();
      this.bindMessageActions();
    }
  }

  handleQuickAction(action) {
    const input = document.getElementById('ai-input');
    if (!input) return;

    const prompts = {
      'scan-website': 'Scan https://example.com for security vulnerabilities and provide a detailed analysis',
      'security-audit': 'Perform a comprehensive security audit with SSL, headers, and vulnerability assessment',
      'tech-stack': 'Analyze and detect all technologies, frameworks, and libraries used'
    };

    input.value = prompts[action] || '';
    input.focus();
  }

  async exportChat() {
    const chat = this.getActiveChat();
    if (!chat) return;

    const content = chat.messages.map(m => 
      `[${new Date(m.timestamp).toLocaleString()}] ${m.role.toUpperCase()}:\n${m.content}\n`
    ).join('\n---\n\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cyberforge-chat-${chat.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  toggleMobileSidebar() {
    const sidebar = document.getElementById('ai-sidebar');
    this.state.isSidebarOpen = !this.state.isSidebarOpen;
    sidebar?.classList.toggle('open', this.state.isSidebarOpen);
  }

  closeMobileSidebar() {
    const sidebar = document.getElementById('ai-sidebar');
    this.state.isSidebarOpen = false;
    sidebar?.classList.remove('open');
  }

  // =========================================
  // UTILITIES
  // =========================================

  async checkAPIStatus() {
    try {
      // Try health check first
      let result = await this.api.healthCheck();
      
      // If health check fails, try a simpler ping
      if (!result.success) {
        result = await this.api.get('/health');
      }
      
      this.updateStatus(result.success, result.success ? 'Online' : 'Backend Offline');
      return result.success;
    } catch (error) {
      console.log('API health check failed:', error.message);
      this.updateStatus(false, 'Service Unavailable');
      return false;
    }
  }

  updateStatus(online = true, statusText = null) {
    const badge = document.getElementById('ai-status-badge');
    const text = document.getElementById('ai-status-text');
    
    if (badge && text) {
      if (online) {
        badge.style.background = 'rgba(246,157,57, 0.1)';
        badge.style.borderColor = 'rgba(246,157,57, 0.2)';
        badge.style.color = 'var(--ai-accent-green)';
        badge.querySelector('.ai-status-dot').style.background = 'var(--ai-accent-green)';
        text.textContent = statusText || 'Online';
      } else {
        badge.style.background = 'rgba(229,87,62, 0.1)';
        badge.style.borderColor = 'rgba(229,87,62, 0.2)';
        badge.style.color = 'var(--ai-accent-red)';
        const dot = badge.querySelector('.ai-status-dot');
        if (dot) dot.style.background = 'var(--ai-accent-red)';
        text.textContent = statusText || 'Offline';
      }
    }
  }

  scrollToBottom() {
    const messages = document.getElementById('ai-messages');
    if (messages) {
      messages.scrollTop = messages.scrollHeight;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text ?? '';
    return div.innerHTML;
  }

  getRiskClass(score) {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  getRiskColor(score) {
    if (score >= 80) return 'var(--ai-accent-red)';
    if (score >= 60) return 'var(--ai-accent-orange)';
    if (score >= 40) return 'var(--ai-accent-yellow)';
    return 'var(--ai-accent-green)';
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AIAssistantV2 };
}

// Make available globally
if (typeof window !== 'undefined') {
  window.AIAssistantV2 = AIAssistantV2;
}
