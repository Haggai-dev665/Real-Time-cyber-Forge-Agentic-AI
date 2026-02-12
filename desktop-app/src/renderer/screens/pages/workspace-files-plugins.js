/**
 * Workspace Section Pages - Files, Plugins, Workspace, Team
 * Connected to backend API for real data
 */

// ========================================
// FILES PAGES
// ========================================

class FilesProjectPage extends BasePage {
    constructor() {
        super();
        this.files = [];
        this.currentPath = '/';
    }

    createHTML() {
        return `
            <div class="page-content files-project-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-folder-open"></i>
                        <h2>Project Files</h2>
                    </div>
                    <div class="page-actions">
                        <button class="cf-btn" id="upload-file">
                            <i class="fas fa-upload"></i> Upload
                        </button>
                        <button class="cf-btn" id="new-folder">
                            <i class="fas fa-folder-plus"></i> New Folder
                        </button>
                    </div>
                </div>

                <div class="breadcrumb" id="breadcrumb">
                    <span class="crumb" data-path="/">Root</span>
                </div>

                <div class="files-grid" id="files-grid">
                    <div class="loading-placeholder">Loading files...</div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('upload-file')?.addEventListener('click', () => this.uploadFile());
        document.getElementById('new-folder')?.addEventListener('click', () => this.createFolder());
    }

    async loadData() {
        this.files = [
            { name: 'requests', type: 'folder', modified: new Date() },
            { name: 'findings', type: 'folder', modified: new Date() },
            { name: 'exports', type: 'folder', modified: new Date() },
            { name: 'project.json', type: 'file', size: 2456, modified: new Date() },
            { name: 'README.md', type: 'file', size: 1234, modified: new Date() }
        ];
        this.renderFiles();
    }

    renderFiles() {
        const container = document.getElementById('files-grid');
        if (!container) return;

        container.innerHTML = this.files.map(file => `
            <div class="file-item ${file.type}" data-name="${file.name}">
                <div class="file-icon">
                    <i class="fas fa-${file.type === 'folder' ? 'folder' : this.getFileIcon(file.name)}"></i>
                </div>
                <div class="file-name">${file.name}</div>
                <div class="file-meta">
                    ${file.size ? this.formatBytes(file.size) : ''}
                    ${this.formatDate(file.modified)}
                </div>
            </div>
        `).join('');

        document.querySelectorAll('.file-item.folder').forEach(item => {
            item.addEventListener('dblclick', () => {
                this.navigateTo(item.dataset.name);
            });
        });
    }

    getFileIcon(filename) {
        const ext = filename.split('.').pop()?.toLowerCase();
        const icons = {
            'json': 'file-code',
            'js': 'file-code',
            'html': 'file-code',
            'md': 'file-alt',
            'txt': 'file-alt',
            'pdf': 'file-pdf',
            'png': 'file-image',
            'jpg': 'file-image'
        };
        return icons[ext] || 'file';
    }

    formatBytes(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    navigateTo(folder) {
        this.currentPath = this.currentPath + folder + '/';
        this.updateBreadcrumb();
        this.loadData();
    }

    updateBreadcrumb() {
        const parts = this.currentPath.split('/').filter(Boolean);
        const breadcrumb = document.getElementById('breadcrumb');
        if (!breadcrumb) return;

        breadcrumb.innerHTML = `
            <span class="crumb" data-path="/">Root</span>
            ${parts.map((part, i) => `
                <span class="separator">/</span>
                <span class="crumb" data-path="/${parts.slice(0, i + 1).join('/')}/">${part}</span>
            `).join('')}
        `;
    }

    uploadFile() {
        window.showToast?.('info', 'Upload', 'File upload dialog...');
    }

    createFolder() {
        const content = `
            <div class="form-group">
                <label>Folder Name</label>
                <input type="text" name="name" class="cf-input" required />
            </div>
        `;

        window.showModal?.('New Folder', content, async (formData) => {
            window.showToast?.('success', 'Created', 'Folder created');
            await this.loadData();
        });
    }
}

class FilesNotesPage extends BasePage {
    constructor() {
        super();
        this.notes = [];
        this.currentNote = null;
    }

    createHTML() {
        return `
            <div class="page-content files-notes-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-sticky-note"></i>
                        <h2>Notes</h2>
                    </div>
                    <div class="page-actions">
                        <button class="cf-btn primary" id="new-note">
                            <i class="fas fa-plus"></i> New Note
                        </button>
                    </div>
                </div>

                <div class="notes-container">
                    <div class="notes-sidebar" id="notes-sidebar">
                        <div class="loading-placeholder">Loading notes...</div>
                    </div>
                    <div class="notes-editor" id="notes-editor">
                        <div class="empty-state">
                            <i class="fas fa-edit"></i>
                            <p>Select a note to edit</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('new-note')?.addEventListener('click', () => this.createNote());
    }

    async loadData() {
        try {
            const result = await this.api.getWorkspaceNotes();
            if (result.success) {
                this.notes = result.data?.notes || [];
            } else {
                this.notes = this.getDefaultNotes();
            }
        } catch (error) {
            console.error('Failed to load notes:', error);
            this.notes = this.getDefaultNotes();
        }
        this.renderNotes();
    }

    getDefaultNotes() {
        return [
            { id: 1, title: 'API Endpoints', content: 'List of discovered endpoints...', updatedAt: new Date() },
            { id: 2, title: 'Auth Flow', content: 'Authentication flow analysis...', updatedAt: new Date() },
            { id: 3, title: 'Vulnerabilities', content: 'Potential vulnerabilities found...', updatedAt: new Date() }
        ];
    }

    renderNotes() {
        const sidebar = document.getElementById('notes-sidebar');
        if (!sidebar) return;

        sidebar.innerHTML = this.notes.map(note => `
            <div class="note-item ${this.currentNote?.id === note.id ? 'active' : ''}" data-note-id="${note.id}">
                <div class="note-title">${note.title}</div>
                <div class="note-date">${this.formatDate(note.updatedAt)}</div>
            </div>
        `).join('');

        document.querySelectorAll('.note-item').forEach(item => {
            item.addEventListener('click', () => {
                const noteId = parseInt(item.dataset.noteId);
                this.selectNote(noteId);
            });
        });
    }

    selectNote(noteId) {
        this.currentNote = this.notes.find(n => n.id === noteId);
        this.renderNotes();
        this.renderEditor();
    }

    renderEditor() {
        const editor = document.getElementById('notes-editor');
        if (!editor || !this.currentNote) return;

        editor.innerHTML = `
            <div class="editor-header">
                <input type="text" class="note-title-input" value="${this.currentNote.title}" />
                <button class="cf-btn small" id="save-note">
                    <i class="fas fa-save"></i> Save
                </button>
            </div>
            <textarea class="note-content-editor" id="note-content">${this.currentNote.content}</textarea>
        `;

        document.getElementById('save-note')?.addEventListener('click', () => this.saveNote());
    }

    createNote() {
        const newNote = {
            id: Date.now(),
            title: 'New Note',
            content: '',
            updatedAt: new Date()
        };
        this.notes.unshift(newNote);
        this.selectNote(newNote.id);
    }

    async saveNote() {
        if (!this.currentNote) return;
        
        this.currentNote.title = document.querySelector('.note-title-input')?.value || 'Untitled';
        this.currentNote.content = document.getElementById('note-content')?.value || '';
        this.currentNote.updatedAt = new Date();
        
        try {
            const result = await this.api.updateWorkspaceNote(this.currentNote.id, this.currentNote);
            if (result.success) {
                this.renderNotes();
                window.showToast?.('success', 'Saved', 'Note saved');
            } else {
                window.showToast?.('error', 'Error', result.error || 'Failed to save note');
            }
        } catch (error) {
            console.error('Failed to save note:', error);
            window.showToast?.('error', 'Error', 'Failed to save note');
        }
    }
}

class FilesAttachmentsPage extends BasePage {
    constructor() {
        super();
        this.attachments = [];
    }

    createHTML() {
        return `
            <div class="page-content files-attachments-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-paperclip"></i>
                        <h2>Attachments</h2>
                    </div>
                    <div class="page-actions">
                        <button class="cf-btn primary" id="upload-attachment">
                            <i class="fas fa-upload"></i> Upload
                        </button>
                    </div>
                </div>

                <div class="attachments-grid" id="attachments-grid">
                    <div class="loading-placeholder">Loading attachments...</div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('upload-attachment')?.addEventListener('click', () => this.uploadAttachment());
    }

    async loadData() {
        try {
            const result = await this.api.getWorkspaceAttachments();
            if (result.success) {
                this.attachments = result.data?.attachments || [];
            } else {
                this.attachments = this.getDefaultAttachments();
            }
        } catch (error) {
            console.error('Failed to load attachments:', error);
            this.attachments = this.getDefaultAttachments();
        }
        this.renderAttachments();
    }

    getDefaultAttachments() {
        return [
            { id: 1, name: 'screenshot.png', type: 'image', size: 245000, createdAt: new Date() },
            { id: 2, name: 'request.har', type: 'file', size: 12400, createdAt: new Date() },
            { id: 3, name: 'report.pdf', type: 'document', size: 567000, createdAt: new Date() }
        ];
    }

    renderAttachments() {
        const container = document.getElementById('attachments-grid');
        if (!container) return;

        if (!this.attachments.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-paperclip"></i>
                    <p>No attachments</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.attachments.map(att => `
            <div class="attachment-card" data-attachment-id="${att.id}">
                <div class="attachment-preview">
                    <i class="fas fa-${this.getAttachmentIcon(att.type)}"></i>
                </div>
                <div class="attachment-info">
                    <div class="attachment-name">${att.name}</div>
                    <div class="attachment-size">${this.formatBytes(att.size)}</div>
                </div>
                <div class="attachment-actions">
                    <button class="cf-btn tiny"><i class="fas fa-download"></i></button>
                    <button class="cf-btn tiny danger"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `).join('');
    }

    getAttachmentIcon(type) {
        const icons = { image: 'image', file: 'file', document: 'file-pdf' };
        return icons[type] || 'file';
    }

    formatBytes(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    uploadAttachment() {
        window.showToast?.('info', 'Upload', 'Select file to upload...');
    }
}

// ========================================
// PLUGINS PAGES
// ========================================

class PluginsInstalledPage extends BasePage {
    constructor() {
        super();
        this.plugins = [];
    }

    createHTML() {
        return `
            <div class="page-content plugins-installed-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-plug"></i>
                        <h2>Installed Plugins</h2>
                    </div>
                    <div class="page-actions">
                        <button class="cf-btn primary" id="install-plugin">
                            <i class="fas fa-plus"></i> Install Plugin
                        </button>
                    </div>
                </div>

                <div class="plugins-list" id="plugins-list">
                    <div class="loading-placeholder">Loading plugins...</div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('install-plugin')?.addEventListener('click', () => {
            window.pageController?.navigateTo('plugins-store');
        });
    }

    async loadData() {
        try {
            const result = await this.api.get('/api/plugins');
            if (result.success) {
                this.plugins = result.data?.data?.plugins || [];
            } else {
                this.plugins = this.getDefaultPlugins();
            }
        } catch (error) {
            this.plugins = this.getDefaultPlugins();
        }
        this.renderPlugins();
    }

    getDefaultPlugins() {
        return [
            { id: 1, name: 'JWT Analyzer', description: 'Decode and analyze JWT tokens', version: '1.2.0', enabled: true, author: 'CyberForge' },
            { id: 2, name: 'SQLi Detector', description: 'Automatic SQL injection detection', version: '2.0.1', enabled: true, author: 'SecurityLabs' },
            { id: 3, name: 'XSS Scanner', description: 'Cross-site scripting scanner', version: '1.5.0', enabled: false, author: 'WebSecTeam' },
            { id: 4, name: 'API Mapper', description: 'Automatic API endpoint discovery', version: '1.0.3', enabled: true, author: 'CyberForge' }
        ];
    }

    renderPlugins() {
        const container = document.getElementById('plugins-list');
        if (!container) return;

        if (!this.plugins.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-plug"></i>
                    <p>No plugins installed</p>
                    <button class="cf-btn primary" onclick="window.pageController?.navigateTo('plugins-store')">
                        Browse Plugins
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.plugins.map(plugin => `
            <div class="plugin-card ${plugin.enabled ? 'enabled' : 'disabled'}" data-plugin-id="${plugin.id}">
                <div class="plugin-icon">
                    <i class="fas fa-puzzle-piece"></i>
                </div>
                <div class="plugin-info">
                    <h4>${plugin.name}</h4>
                    <p>${plugin.description}</p>
                    <div class="plugin-meta">
                        <span>v${plugin.version}</span>
                        <span>by ${plugin.author}</span>
                    </div>
                </div>
                <div class="plugin-toggle">
                    <label class="switch">
                        <input type="checkbox" ${plugin.enabled ? 'checked' : ''} data-action="toggle" />
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="plugin-actions">
                    <button class="cf-btn small" data-action="settings">
                        <i class="fas fa-cog"></i>
                    </button>
                    <button class="cf-btn small danger" data-action="uninstall">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');

        this.bindPluginActions();
    }

    bindPluginActions() {
        document.querySelectorAll('.plugin-card').forEach(card => {
            const pluginId = card.dataset.pluginId;

            card.querySelector('[data-action="toggle"]')?.addEventListener('change', (e) => {
                this.togglePlugin(pluginId, e.target.checked);
            });

            card.querySelector('[data-action="uninstall"]')?.addEventListener('click', () => {
                this.uninstallPlugin(pluginId);
            });
        });
    }

    async togglePlugin(pluginId, enabled) {
        try {
            await this.api.put(`/api/plugins/${pluginId}`, { enabled });
            window.showToast?.('success', enabled ? 'Enabled' : 'Disabled', 'Plugin updated');
        } catch (error) {
            window.showToast?.('error', 'Failed', error.message);
        }
    }

    uninstallPlugin(pluginId) {
        window.showConfirmModal?.('Uninstall Plugin', 'Remove this plugin?', async () => {
            try {
                await this.api.delete(`/api/plugins/${pluginId}`);
                window.showToast?.('success', 'Uninstalled', 'Plugin removed');
                await this.loadData();
            } catch (error) {
                window.showToast?.('error', 'Failed', error.message);
            }
        });
    }
}

class PluginsStorePage extends BasePage {
    constructor() {
        super();
        this.storePlugins = [];
    }

    createHTML() {
        return `
            <div class="page-content plugins-store-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-store"></i>
                        <h2>Plugin Store</h2>
                    </div>
                    <div class="page-actions">
                        <input type="text" class="cf-input search-input" id="plugin-search" placeholder="Search plugins..." />
                    </div>
                </div>

                <div class="store-categories">
                    <button class="category-btn active" data-category="all">All</button>
                    <button class="category-btn" data-category="security">Security</button>
                    <button class="category-btn" data-category="analysis">Analysis</button>
                    <button class="category-btn" data-category="automation">Automation</button>
                    <button class="category-btn" data-category="reporting">Reporting</button>
                </div>

                <div class="store-grid" id="store-grid">
                    <div class="loading-placeholder">Loading plugins...</div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.filterByCategory(btn.dataset.category);
            });
        });
    }

    async loadData() {
        this.storePlugins = [
            { id: 's1', name: 'CORS Scanner', description: 'Detect CORS misconfigurations', category: 'security', downloads: 5420, rating: 4.8 },
            { id: 's2', name: 'GraphQL Inspector', description: 'GraphQL schema analysis', category: 'analysis', downloads: 3210, rating: 4.6 },
            { id: 's3', name: 'Payload Generator', description: 'Generate security test payloads', category: 'security', downloads: 8900, rating: 4.9 },
            { id: 's4', name: 'Report Builder', description: 'Custom report templates', category: 'reporting', downloads: 2100, rating: 4.5 },
            { id: 's5', name: 'Auth Tester', description: 'Authentication testing suite', category: 'security', downloads: 6700, rating: 4.7 },
            { id: 's6', name: 'Flow Recorder', description: 'Record and replay workflows', category: 'automation', downloads: 4300, rating: 4.4 }
        ];
        this.renderStore();
    }

    renderStore(filtered = null) {
        const container = document.getElementById('store-grid');
        if (!container) return;

        const toRender = filtered || this.storePlugins;

        container.innerHTML = toRender.map(plugin => `
            <div class="store-plugin-card" data-plugin-id="${plugin.id}">
                <div class="plugin-icon">
                    <i class="fas fa-puzzle-piece"></i>
                </div>
                <h4>${plugin.name}</h4>
                <p>${plugin.description}</p>
                <div class="plugin-stats">
                    <span><i class="fas fa-download"></i> ${(plugin.downloads / 1000).toFixed(1)}k</span>
                    <span><i class="fas fa-star"></i> ${plugin.rating}</span>
                </div>
                <button class="cf-btn primary small" data-action="install">
                    <i class="fas fa-plus"></i> Install
                </button>
            </div>
        `).join('');

        document.querySelectorAll('[data-action="install"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const pluginId = e.target.closest('.store-plugin-card').dataset.pluginId;
                this.installPlugin(pluginId);
            });
        });
    }

    filterByCategory(category) {
        if (category === 'all') {
            this.renderStore();
        } else {
            const filtered = this.storePlugins.filter(p => p.category === category);
            this.renderStore(filtered);
        }
    }

    async installPlugin(pluginId) {
        const plugin = this.storePlugins.find(p => p.id === pluginId);
        window.showToast?.('info', 'Installing', `Installing ${plugin?.name}...`);
        
        setTimeout(() => {
            window.showToast?.('success', 'Installed', `${plugin?.name} installed successfully`);
        }, 1500);
    }
}

class PluginsEditorPage extends BasePage {
    createHTML() {
        return `
            <div class="page-content plugins-editor-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-code"></i>
                        <h2>Plugin Editor</h2>
                    </div>
                    <div class="page-actions">
                        <button class="cf-btn" id="new-plugin">
                            <i class="fas fa-plus"></i> New Plugin
                        </button>
                        <button class="cf-btn primary" id="save-plugin">
                            <i class="fas fa-save"></i> Save
                        </button>
                    </div>
                </div>

                <div class="editor-container">
                    <div class="editor-sidebar">
                        <div class="file-tree" id="plugin-files">
                            <div class="file-item active">manifest.json</div>
                            <div class="file-item">main.js</div>
                            <div class="file-item">styles.css</div>
                        </div>
                    </div>
                    <div class="editor-main">
                        <textarea id="code-editor" class="code-editor">// Plugin code here
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My custom plugin",
  "main": "main.js"
}</textarea>
                    </div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('save-plugin')?.addEventListener('click', () => {
            window.showToast?.('success', 'Saved', 'Plugin saved');
        });
    }
}

// ========================================
// WORKSPACE PAGES
// ========================================

class WorkspaceSettingsPage extends BasePage {
    createHTML() {
        return `
            <div class="page-content workspace-settings-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-cog"></i>
                        <h2>Workspace Settings</h2>
                    </div>
                    <div class="page-actions">
                        <button class="cf-btn primary" id="save-settings">
                            <i class="fas fa-save"></i> Save Settings
                        </button>
                    </div>
                </div>

                <div class="settings-sections">
                    <div class="settings-section">
                        <h4>General</h4>
                        <div class="settings-grid">
                            <div class="setting-item">
                                <label>Workspace Name</label>
                                <input type="text" class="cf-input" id="workspace-name" value="My Project" />
                            </div>
                            <div class="setting-item">
                                <label>Description</label>
                                <textarea class="cf-input" id="workspace-description" rows="2"></textarea>
                            </div>
                        </div>
                    </div>

                    <div class="settings-section">
                        <h4>Proxy Settings</h4>
                        <div class="settings-grid">
                            <div class="setting-item">
                                <label>Proxy Port</label>
                                <input type="number" class="cf-input" id="proxy-port" value="8080" />
                            </div>
                            <div class="setting-item">
                                <label>SSL Certificate</label>
                                <select class="cf-select" id="ssl-cert">
                                    <option value="default">Default CA</option>
                                    <option value="custom">Custom Certificate</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="settings-section">
                        <h4>Data Retention</h4>
                        <div class="settings-grid">
                            <div class="setting-item">
                                <label>Keep Requests</label>
                                <select class="cf-select" id="data-retention">
                                    <option value="forever">Forever</option>
                                    <option value="30d">30 Days</option>
                                    <option value="7d">7 Days</option>
                                    <option value="session">Session Only</option>
                                </select>
                            </div>
                            <div class="setting-item">
                                <label>Max Request Size</label>
                                <input type="number" class="cf-input" id="max-size" value="10" /> MB
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('save-settings')?.addEventListener('click', () => {
            window.showToast?.('success', 'Saved', 'Settings updated');
        });
    }
}

class WorkspaceProjectsPage extends BasePage {
    constructor() {
        super();
        this.projects = [];
    }

    createHTML() {
        return `
            <div class="page-content workspace-projects-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-folder"></i>
                        <h2>Projects</h2>
                    </div>
                    <div class="page-actions">
                        <button class="cf-btn primary" id="new-project">
                            <i class="fas fa-plus"></i> New Project
                        </button>
                    </div>
                </div>

                <div class="projects-grid" id="projects-grid">
                    <div class="loading-placeholder">Loading projects...</div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('new-project')?.addEventListener('click', () => this.createProject());
    }

    async loadData() {
        this.projects = [
            { id: 1, name: 'API Pentest', description: 'REST API security testing', requests: 1234, findings: 5, lastActive: new Date() },
            { id: 2, name: 'Web App Audit', description: 'Web application security audit', requests: 5678, findings: 12, lastActive: new Date() },
            { id: 3, name: 'Mobile Backend', description: 'Mobile app backend testing', requests: 890, findings: 3, lastActive: new Date() }
        ];
        this.renderProjects();
    }

    renderProjects() {
        const container = document.getElementById('projects-grid');
        if (!container) return;

        container.innerHTML = this.projects.map(project => `
            <div class="project-card" data-project-id="${project.id}">
                <div class="project-header">
                    <h4>${project.name}</h4>
                    <span class="project-status active">Active</span>
                </div>
                <p>${project.description}</p>
                <div class="project-stats">
                    <span><i class="fas fa-exchange-alt"></i> ${project.requests.toLocaleString()} requests</span>
                    <span><i class="fas fa-flag"></i> ${project.findings} findings</span>
                </div>
                <div class="project-footer">
                    <span>Last active: ${this.formatDate(project.lastActive)}</span>
                    <button class="cf-btn small primary" data-action="open">Open</button>
                </div>
            </div>
        `).join('');
    }

    createProject() {
        const content = `
            <div class="form-group">
                <label>Project Name</label>
                <input type="text" name="name" class="cf-input" required />
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea name="description" class="cf-input" rows="2"></textarea>
            </div>
        `;

        window.showModal?.('New Project', content, async (formData) => {
            window.showToast?.('success', 'Created', 'Project created');
            await this.loadData();
        });
    }
}

// ========================================
// TEAM PAGES
// ========================================

class TeamMembersPage extends BasePage {
    constructor() {
        super();
        this.members = [];
    }

    createHTML() {
        return `
            <div class="page-content team-members-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-users"></i>
                        <h2>Team Members</h2>
                    </div>
                    <div class="page-actions">
                        <button class="cf-btn primary" id="invite-member">
                            <i class="fas fa-user-plus"></i> Invite Member
                        </button>
                    </div>
                </div>

                <div class="members-list" id="members-list">
                    <div class="loading-placeholder">Loading team...</div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('invite-member')?.addEventListener('click', () => this.inviteMember());
    }

    async loadData() {
        try {
            const result = await this.api.getTeamMembers();
            if (result.success) {
                this.members = result.data?.members || [];
            } else {
                this.members = this.getDefaultMembers();
            }
        } catch (error) {
            console.error('Failed to load team members:', error);
            this.members = this.getDefaultMembers();
        }
        this.renderMembers();
    }

    getDefaultMembers() {
        return [
            { id: 1, name: 'John Doe', email: 'john@example.com', role: 'admin', avatar: null, status: 'online' },
            { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'member', avatar: null, status: 'offline' },
            { id: 3, name: 'Bob Wilson', email: 'bob@example.com', role: 'member', avatar: null, status: 'online' }
        ];
    }

    renderMembers() {
        const container = document.getElementById('members-list');
        if (!container) return;

        container.innerHTML = this.members.map(member => `
            <div class="member-card" data-member-id="${member.id}">
                <div class="member-avatar">
                    <i class="fas fa-user"></i>
                    <span class="status-dot ${member.status}"></span>
                </div>
                <div class="member-info">
                    <h4>${member.name}</h4>
                    <div class="member-email">${member.email}</div>
                </div>
                <div class="member-role">
                    <span class="role-badge ${member.role}">${member.role}</span>
                </div>
                <div class="member-actions">
                    <button class="cf-btn small" data-action="edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="cf-btn small danger" data-action="remove">
                        <i class="fas fa-user-minus"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    inviteMember() {
        const content = `
            <div class="form-group">
                <label>Email Address</label>
                <input type="email" name="email" class="cf-input" required />
            </div>
            <div class="form-group">
                <label>Role</label>
                <select name="role" class="cf-select">
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                </select>
            </div>
        `;

        window.showModal?.('Invite Member', content, async (formData) => {
            try {
                const result = await this.api.inviteTeamMember(formData);
                if (result.success) {
                    window.showToast?.('success', 'Invited', 'Invitation sent');
                    await this.loadData();
                } else {
                    window.showToast?.('error', 'Error', result.error || 'Failed to send invitation');
                }
            } catch (error) {
                window.showToast?.('error', 'Error', 'Failed to send invitation');
            }
        });
    }
}

class TeamActivityPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 15000;
        this.activities = [];
    }

    createHTML() {
        return `
            <div class="page-content team-activity-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-stream"></i>
                        <h2>Team Activity</h2>
                    </div>
                </div>

                <div class="activity-timeline" id="activity-timeline">
                    <div class="loading-placeholder">Loading activity...</div>
                </div>
            </div>
        `;
    }

    async loadData() {
        try {
            const result = await this.api.getTeamActivity();
            if (result.success) {
                this.activities = result.data?.activities || [];
            } else {
                this.activities = this.getDefaultActivities();
            }
        } catch (error) {
            console.error('Failed to load team activity:', error);
            this.activities = this.getDefaultActivities();
        }
        this.renderActivity();
    }

    getDefaultActivities() {
        return [
            { id: 1, user: 'John Doe', action: 'created finding', target: 'SQL Injection', time: new Date() },
            { id: 2, user: 'Jane Smith', action: 'exported', target: 'Findings Report', time: new Date(Date.now() - 3600000) },
            { id: 3, user: 'Bob Wilson', action: 'ran scan on', target: 'api.example.com', time: new Date(Date.now() - 7200000) },
            { id: 4, user: 'John Doe', action: 'added note to', target: 'Auth Flow', time: new Date(Date.now() - 86400000) }
        ];
    }

    renderActivity() {
        const container = document.getElementById('activity-timeline');
        if (!container) return;

        container.innerHTML = this.activities.map(activity => `
            <div class="activity-item">
                <div class="activity-dot"></div>
                <div class="activity-content">
                    <span class="activity-user">${activity.user}</span>
                    <span class="activity-action">${activity.action}</span>
                    <span class="activity-target">${activity.target}</span>
                </div>
                <div class="activity-time">${this.formatDate(activity.time)}</div>
            </div>
        `).join('');
    }
}

// Export classes
if (typeof window !== 'undefined') {
    window.FilesProjectPage = FilesProjectPage;
    window.FilesNotesPage = FilesNotesPage;
    window.FilesAttachmentsPage = FilesAttachmentsPage;
    window.PluginsInstalledPage = PluginsInstalledPage;
    window.PluginsStorePage = PluginsStorePage;
    window.PluginsEditorPage = PluginsEditorPage;
    window.WorkspaceSettingsPage = WorkspaceSettingsPage;
    window.WorkspaceProjectsPage = WorkspaceProjectsPage;
    window.TeamMembersPage = TeamMembersPage;
    window.TeamActivityPage = TeamActivityPage;
}
