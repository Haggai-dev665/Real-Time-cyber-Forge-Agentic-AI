/**
 * Settings Screen
 * Application configuration and preferences
 */

class SettingsScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.settings = {
            theme: 'dark',
            notifications: true,
            autoUpdate: true,
            scanFrequency: 'daily',
            threatAlerts: true,
            dataRetention: '30',
            apiEndpoint: localStorage.getItem('cyberforge_backend_url') || 'https://cyberforge-ddd97655464f.herokuapp.com'
        };
        this.originalSettings = {};
    }

    async show(container, options = {}) {
        this.container = container;
        this.isActive = true;
        
        // Load current settings
        await this.loadSettings();
        
        // Create settings HTML
        this.container.innerHTML = this.createHTML();
        
        // Initialize components
        this.initializeComponents();
        
        // Add entrance animation
        this.container.classList.add('screen-enter');
    }

    hide() {
        this.isActive = false;
    }

    createHTML() {
        return `
            <div class="settings-screen">
                <!-- Header -->
                <div class="settings-header">
                    <div class="header-content">
                        <h1>Settings</h1>
                        <p>Configure your Cyber Forge AI preferences</p>
                    </div>
                    <div class="header-actions">
                        <button class="btn btn-secondary" id="reset-settings-btn">
                            <i class="fas fa-undo"></i> Reset to Defaults
                        </button>
                        <button class="btn btn-success" id="save-settings-btn">
                            <i class="fas fa-save"></i> Save Changes
                        </button>
                    </div>
                </div>

                <!-- Settings Content -->
                <div class="settings-content">
                    <!-- Sidebar Navigation -->
                    <div class="settings-sidebar">
                        <nav class="settings-nav">
                            <button class="settings-nav-item active" data-section="appearance">
                                <i class="fas fa-palette"></i>
                                <span>Appearance</span>
                            </button>
                            <button class="settings-nav-item" data-section="security">
                                <i class="fas fa-shield-alt"></i>
                                <span>Security</span>
                            </button>
                            <button class="settings-nav-item" data-section="notifications">
                                <i class="fas fa-bell"></i>
                                <span>Notifications</span>
                            </button>
                            <button class="settings-nav-item" data-section="performance">
                                <i class="fas fa-tachometer-alt"></i>
                                <span>Performance</span>
                            </button>
                            <button class="settings-nav-item" data-section="advanced">
                                <i class="fas fa-cogs"></i>
                                <span>Advanced</span>
                            </button>
                            <button class="settings-nav-item" data-section="about">
                                <i class="fas fa-info-circle"></i>
                                <span>About</span>
                            </button>
                        </nav>
                    </div>

                    <!-- Settings Panels -->
                    <div class="settings-main">
                        <!-- Appearance Settings -->
                        <div class="settings-panel active" id="appearance-panel">
                            <h2>Appearance</h2>
                            <p>Customize the look and feel of the application</p>

                            <div class="setting-group">
                                <label class="setting-label">Theme</label>
                                <div class="theme-selector">
                                    <div class="theme-option" data-theme="dark">
                                        <div class="theme-preview dark-preview">
                                            <div class="preview-header"></div>
                                            <div class="preview-content"></div>
                                        </div>
                                        <span>Dark</span>
                                    </div>
                                    <div class="theme-option" data-theme="light">
                                        <div class="theme-preview light-preview">
                                            <div class="preview-header"></div>
                                            <div class="preview-content"></div>
                                        </div>
                                        <span>Light</span>
                                    </div>
                                    <div class="theme-option" data-theme="cyber">
                                        <div class="theme-preview cyber-preview">
                                            <div class="preview-header"></div>
                                            <div class="preview-content"></div>
                                        </div>
                                        <span>Cyber</span>
                                    </div>
                                    <div class="theme-option" data-theme="blue">
                                        <div class="theme-preview blue-preview">
                                            <div class="preview-header"></div>
                                            <div class="preview-content"></div>
                                        </div>
                                        <span>Blue</span>
                                    </div>
                                    <div class="theme-option" data-theme="high-contrast">
                                        <div class="theme-preview contrast-preview">
                                            <div class="preview-header"></div>
                                            <div class="preview-content"></div>
                                        </div>
                                        <span>High Contrast</span>
                                    </div>
                                </div>
                            </div>

                            <div class="setting-group">
                                <label class="setting-label">
                                    <input type="checkbox" id="enable-animations" checked>
                                    Enable animations and transitions
                                </label>
                                <p class="setting-description">Disable to improve performance on slower devices</p>
                            </div>

                            <div class="setting-group">
                                <label class="setting-label">
                                    <input type="checkbox" id="compact-mode">
                                    Compact mode
                                </label>
                                <p class="setting-description">Reduce spacing for more content on screen</p>
                            </div>
                        </div>

                        <!-- Security Settings -->
                        <div class="settings-panel" id="security-panel">
                            <h2>Security</h2>
                            <p>Configure security and threat detection settings</p>

                            <div class="setting-group">
                                <label class="setting-label">Scan Frequency</label>
                                <select class="form-input" id="scan-frequency">
                                    <option value="realtime">Real-time</option>
                                    <option value="hourly">Every Hour</option>
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="manual">Manual Only</option>
                                </select>
                                <p class="setting-description">How often to perform automatic security scans</p>
                            </div>

                            <div class="setting-group">
                                <label class="setting-label">
                                    <input type="checkbox" id="real-time-protection" checked>
                                    Enable real-time protection
                                </label>
                                <p class="setting-description">Monitor for threats in real-time</p>
                            </div>

                            <div class="setting-group">
                                <label class="setting-label">
                                    <input type="checkbox" id="auto-quarantine" checked>
                                    Automatically quarantine detected threats
                                </label>
                                <p class="setting-description">Automatically isolate malicious content</p>
                            </div>

                            <div class="setting-group">
                                <label class="setting-label">Threat Alert Level</label>
                                <select class="form-input" id="threat-alert-level">
                                    <option value="all">All Threats</option>
                                    <option value="medium">Medium and Above</option>
                                    <option value="high">High and Critical Only</option>
                                    <option value="critical">Critical Only</option>
                                </select>
                            </div>
                        </div>

                        <!-- Notifications Settings -->
                        <div class="settings-panel" id="notifications-panel">
                            <h2>Notifications</h2>
                            <p>Control when and how you receive notifications</p>

                            <div class="setting-group">
                                <label class="setting-label">
                                    <input type="checkbox" id="enable-notifications" checked>
                                    Enable notifications
                                </label>
                            </div>

                            <div class="setting-group">
                                <label class="setting-label">
                                    <input type="checkbox" id="threat-notifications" checked>
                                    Threat detection alerts
                                </label>
                            </div>

                            <div class="setting-group">
                                <label class="setting-label">
                                    <input type="checkbox" id="scan-notifications" checked>
                                    Scan completion notifications
                                </label>
                            </div>

                            <div class="setting-group">
                                <label class="setting-label">
                                    <input type="checkbox" id="update-notifications" checked>
                                    Software update notifications
                                </label>
                            </div>

                            <div class="setting-group">
                                <label class="setting-label">Notification Duration</label>
                                <select class="form-input" id="notification-duration">
                                    <option value="3000">3 seconds</option>
                                    <option value="5000">5 seconds</option>
                                    <option value="10000">10 seconds</option>
                                    <option value="0">Until dismissed</option>
                                </select>
                            </div>
                        </div>

                        <!-- Performance Settings -->
                        <div class="settings-panel" id="performance-panel">
                            <h2>Performance</h2>
                            <p>Optimize application performance and resource usage</p>

                            <div class="setting-group">
                                <label class="setting-label">Data Retention Period</label>
                                <select class="form-input" id="data-retention">
                                    <option value="7">7 days</option>
                                    <option value="30">30 days</option>
                                    <option value="90">90 days</option>
                                    <option value="365">1 year</option>
                                    <option value="0">Never delete</option>
                                </select>
                                <p class="setting-description">How long to keep analysis and threat data</p>
                            </div>

                            <div class="setting-group">
                                <label class="setting-label">
                                    <input type="checkbox" id="auto-cleanup" checked>
                                    Automatically clean up old data
                                </label>
                            </div>

                            <div class="setting-group">
                                <label class="setting-label">Maximum Memory Usage</label>
                                <input type="range" class="range-input" id="memory-limit" min="512" max="8192" value="2048">
                                <div class="range-value">2048 MB</div>
                                <p class="setting-description">Limit memory usage to prevent system slowdown</p>
                            </div>

                            <div class="setting-group">
                                <label class="setting-label">
                                    <input type="checkbox" id="hardware-acceleration" checked>
                                    Enable hardware acceleration
                                </label>
                                <p class="setting-description">Use GPU for faster processing when available</p>
                            </div>
                        </div>

                        <!-- Advanced Settings -->
                        <div class="settings-panel" id="advanced-panel">
                            <h2>Advanced</h2>
                            <p>Advanced configuration options for expert users</p>

                            <div class="setting-group">
                                <label class="setting-label">Backend API Endpoint</label>
                                <input type="url" class="form-input" id="api-endpoint" placeholder="https://cyberforge-ddd97655464f.herokuapp.com">
                                <p class="setting-description">URL of the backend API server</p>
                            </div>

                            <div class="setting-group">
                                <label class="setting-label">
                                    <input type="checkbox" id="debug-mode">
                                    Enable debug mode
                                </label>
                                <p class="setting-description">Show additional logging and debug information</p>
                            </div>

                            <div class="setting-group">
                                <label class="setting-label">
                                    <input type="checkbox" id="telemetry">
                                    Send anonymous usage data
                                </label>
                                <p class="setting-description">Help improve the application by sharing usage statistics</p>
                            </div>

                            <div class="setting-group">
                                <button class="btn btn-secondary" id="export-settings-btn">
                                    <i class="fas fa-download"></i> Export Settings
                                </button>
                                <button class="btn btn-secondary" id="import-settings-btn">
                                    <i class="fas fa-upload"></i> Import Settings
                                </button>
                            </div>
                        </div>

                        <!-- About Panel -->
                        <div class="settings-panel" id="about-panel">
                            <h2>About Cyber Forge AI</h2>
                            
                            <div class="about-content">
                                <div class="app-info">
                                    <div class="app-icon">
                                        <i class="fas fa-shield-halved"></i>
                                    </div>
                                    <div class="app-details">
                                        <h3>Cyber Forge AI</h3>
                                        <p class="version">Version 4.0.0</p>
                                        <p class="build">Build 2024.08.25</p>
                                    </div>
                                </div>

                                <div class="system-info">
                                    <h4>System Information</h4>
                                    <div class="info-grid">
                                        <div class="info-item">
                                            <label>Platform:</label>
                                            <span id="platform-info">Loading...</span>
                                        </div>
                                        <div class="info-item">
                                            <label>Architecture:</label>
                                            <span id="arch-info">Loading...</span>
                                        </div>
                                        <div class="info-item">
                                            <label>Node.js:</label>
                                            <span id="node-info">Loading...</span>
                                        </div>
                                        <div class="info-item">
                                            <label>Electron:</label>
                                            <span id="electron-info">Loading...</span>
                                        </div>
                                    </div>
                                </div>

                                <div class="license-info">
                                    <h4>License & Credits</h4>
                                    <p>This software is licensed under the MIT License.</p>
                                    <p>Built with Electron, Chart.js, and other open-source technologies.</p>
                                    
                                    <div class="action-buttons">
                                        <button class="btn btn-secondary" id="view-license-btn">
                                            <i class="fas fa-file-alt"></i> View License
                                        </button>
                                        <button class="btn btn-secondary" id="check-updates-btn">
                                            <i class="fas fa-sync-alt"></i> Check for Updates
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    initializeComponents() {
        this.loadCurrentSettings();
        this.setupEventListeners();
        this.setupThemeSelector();
        this.loadSystemInfo();
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.settings-nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const section = e.currentTarget.dataset.section;
                this.showSection(section);
            });
        });

        // Header actions
        document.getElementById('save-settings-btn').addEventListener('click', () => this.saveSettings());
        document.getElementById('reset-settings-btn').addEventListener('click', () => this.resetSettings());

        // Theme selector
        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const theme = e.currentTarget.dataset.theme;
                this.selectTheme(theme);
            });
        });

        // Range inputs
        const memoryRange = document.getElementById('memory-limit');
        if (memoryRange) {
            memoryRange.addEventListener('input', (e) => {
                const value = e.target.value;
                e.target.nextElementSibling.textContent = `${value} MB`;
            });
        }

        // Advanced actions
        document.getElementById('export-settings-btn').addEventListener('click', () => this.exportSettings());
        document.getElementById('import-settings-btn').addEventListener('click', () => this.importSettings());
        document.getElementById('view-license-btn').addEventListener('click', () => this.viewLicense());
        document.getElementById('check-updates-btn').addEventListener('click', () => this.checkUpdates());
    }

    setupThemeSelector() {
        const currentTheme = window.themeManager?.currentTheme || 'dark';
        const themeOption = document.querySelector(`[data-theme="${currentTheme}"]`);
        if (themeOption) {
            themeOption.classList.add('selected');
        }
    }

    loadCurrentSettings() {
        // Load settings from localStorage or API
        const savedSettings = localStorage.getItem('cyberforge-settings');
        if (savedSettings) {
            this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
        }
        
        // Update form fields
        Object.keys(this.settings).forEach(key => {
            const element = document.getElementById(key.replace(/([A-Z])/g, '-$1').toLowerCase());
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = this.settings[key];
                } else {
                    element.value = this.settings[key];
                }
            }
        });

        // Store original settings for comparison
        this.originalSettings = { ...this.settings };
    }

    async loadSettings() {
        // TODO: Load settings from backend API if needed
    }

    showSection(sectionName) {
        // Update navigation
        document.querySelectorAll('.settings-nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');

        // Show panel
        document.querySelectorAll('.settings-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        document.getElementById(`${sectionName}-panel`).classList.add('active');
    }

    selectTheme(themeName) {
        // Update visual selection
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('selected');
        });
        document.querySelector(`[data-theme="${themeName}"]`).classList.add('selected');

        // Apply theme immediately
        if (window.themeManager) {
            window.themeManager.setTheme(themeName);
        }

        this.settings.theme = themeName;
    }

    async saveSettings() {
        // Collect all settings from form
        const formData = new FormData();
        
        // Get all form inputs
        const inputs = this.container.querySelectorAll('input, select');
        inputs.forEach(input => {
            const key = this.toCamelCase(input.id);
            if (key && this.settings.hasOwnProperty(key)) {
                if (input.type === 'checkbox') {
                    this.settings[key] = input.checked;
                } else {
                    this.settings[key] = input.value;
                }
            }
        });

        try {
            // Save to localStorage
            localStorage.setItem('cyberforge-settings', JSON.stringify(this.settings));
            
            // TODO: Save to backend API if needed
            
            window.notificationSystem?.success('Settings Saved', 'Your preferences have been saved successfully');
            this.originalSettings = { ...this.settings };
            
        } catch (error) {
            console.error('Failed to save settings:', error);
            window.notificationSystem?.error('Save Failed', 'Failed to save settings');
        }
    }

    async resetSettings() {
        const confirmed = await window.modal?.confirm(
            'Reset Settings',
            'Are you sure you want to reset all settings to their default values?'
        );
        
        if (!confirmed) return;

        // Reset to defaults
        this.settings = {
            theme: 'dark',
            notifications: true,
            autoUpdate: true,
            scanFrequency: 'daily',
            threatAlerts: true,
            dataRetention: '30',
            apiEndpoint: localStorage.getItem('cyberforge_backend_url') || 'https://cyberforge-ddd97655464f.herokuapp.com'
        };

        // Update form
        this.loadCurrentSettings();
        
        // Apply theme
        if (window.themeManager) {
            window.themeManager.setTheme(this.settings.theme);
        }

        window.notificationSystem?.success('Settings Reset', 'All settings have been reset to defaults');
    }

    exportSettings() {
        const settingsBlob = new Blob([JSON.stringify(this.settings, null, 2)], { 
            type: 'application/json' 
        });
        
        const url = URL.createObjectURL(settingsBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cyberforge-settings-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        window.notificationSystem?.success('Settings Exported', 'Settings file has been downloaded');
    }

    importSettings() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedSettings = JSON.parse(e.target.result);
                    this.settings = { ...this.settings, ...importedSettings };
                    this.loadCurrentSettings();
                    
                    window.notificationSystem?.success('Settings Imported', 'Settings have been imported successfully');
                } catch (error) {
                    window.notificationSystem?.error('Import Failed', 'Invalid settings file format');
                }
            };
            reader.readAsText(file);
        };
        
        input.click();
    }

    loadSystemInfo() {
        // Mock system info - in real app, this would come from Electron main process
        document.getElementById('platform-info').textContent = 'Windows 10';
        document.getElementById('arch-info').textContent = 'x64';
        document.getElementById('node-info').textContent = '18.16.0';
        document.getElementById('electron-info').textContent = '25.0.0';
    }

    viewLicense() {
        window.modal?.show({
            title: 'MIT License',
            size: 'large',
            content: `
                <div class="license-text">
                    <pre>MIT License

Copyright (c) 2024 Cyber Forge AI

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.</pre>
                </div>
            `,
            actions: [
                { label: 'Close', class: 'btn-primary' }
            ]
        });
    }

    checkUpdates() {
        window.notificationSystem?.loading('Checking Updates', 'Checking for application updates...');
        
        // Mock update check
        setTimeout(() => {
            window.notificationSystem?.success('Up to Date', 'You are running the latest version of Cyber Forge AI');
        }, 2000);
    }

    toCamelCase(str) {
        return str.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
    }

    hasUnsavedChanges() {
        return JSON.stringify(this.settings) !== JSON.stringify(this.originalSettings);
    }

    destroy() {
        // Cleanup if needed
    }
}

// Export for global access
window.SettingsScreen = SettingsScreen;