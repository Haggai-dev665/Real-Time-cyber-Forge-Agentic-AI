/**
 * Theme Manager
 * Handles theme switching, persistence, and system integration
 */

class ThemeManager {
    constructor() {
        this.currentTheme = 'dark';
        this.systemPreference = 'dark';
        this.themes = ['dark', 'light', 'cyber', 'high-contrast', 'blue'];
        this.storageKey = 'cyberforge-theme';
        this.systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
        this.transitionDuration = 150;
        
        this.init();
    }

    init() {
        this.detectSystemTheme();
        this.loadSavedTheme();
        this.applyTheme(this.currentTheme);
        this.setupEventListeners();
    }

    detectSystemTheme() {
        this.systemPreference = this.systemThemeQuery.matches ? 'dark' : 'light';
        
        // Listen for system theme changes
        this.systemThemeQuery.addEventListener('change', (e) => {
            this.systemPreference = e.matches ? 'dark' : 'light';
            
            // If user hasn't set a preference, follow system
            const savedTheme = localStorage.getItem(this.storageKey);
            if (!savedTheme || savedTheme === 'auto') {
                this.setTheme(this.systemPreference);
            }
        });
    }

    loadSavedTheme() {
        const savedTheme = localStorage.getItem(this.storageKey);
        if (savedTheme) {
            if (savedTheme === 'auto') {
                this.currentTheme = this.systemPreference;
            } else if (this.themes.includes(savedTheme)) {
                this.currentTheme = savedTheme;
            }
        }
    }

    setupEventListeners() {
        // Theme toggle button
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.cycleTheme();
            });
        }

        // Listen for theme change events
        document.addEventListener('themeChange', (e) => {
            this.handleThemeChange(e.detail);
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'T') {
                e.preventDefault();
                this.cycleTheme();
            }
        });
    }

    setTheme(themeName, save = true) {
        if (!this.themes.includes(themeName) && themeName !== 'auto') {
            console.warn('Unknown theme:', themeName);
            return;
        }

        // Add transition class to prevent flash
        document.body.classList.add('theme-transitioning');

        // Determine actual theme to apply
        const actualTheme = themeName === 'auto' ? this.systemPreference : themeName;
        
        this.currentTheme = actualTheme;
        this.applyTheme(actualTheme);

        // Save preference
        if (save) {
            localStorage.setItem(this.storageKey, themeName);
        }

        // Update UI elements
        this.updateThemeUI(actualTheme);

        // Remove transition class after animation
        setTimeout(() => {
            document.body.classList.remove('theme-transitioning');
        }, this.transitionDuration);

        // Emit theme change event
        this.emitThemeChange(actualTheme);
    }

    applyTheme(themeName) {
        // Remove all theme classes
        this.themes.forEach(theme => {
            document.documentElement.classList.remove(`theme-${theme}`);
        });

        // Add current theme class
        document.documentElement.classList.add(`theme-${themeName}`);
        document.documentElement.setAttribute('data-theme', themeName);

        // Update CSS custom properties if needed
        this.updateCustomProperties(themeName);
    }

    updateCustomProperties(themeName) {
        const root = document.documentElement;
        
        // Theme-specific custom property updates
        switch (themeName) {
            case 'cyber':
                root.style.setProperty('--font-family', "'JetBrains Mono', monospace");
                break;
            case 'high-contrast':
                root.style.setProperty('--transition-fast', '0ms');
                root.style.setProperty('--transition-normal', '0ms');
                break;
            default:
                root.style.setProperty('--font-family', "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif");
                root.style.setProperty('--transition-fast', '0.15s ease');
                root.style.setProperty('--transition-normal', '0.3s ease');
        }
    }

    updateThemeUI(themeName) {
        // Update theme toggle button
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('i');
            if (icon) {
                icon.className = this.getThemeIcon(themeName);
            }
            themeToggle.title = `Current theme: ${themeName}`;
        }

        // Update any theme indicators
        const themeIndicators = document.querySelectorAll('[data-theme-indicator]');
        themeIndicators.forEach(indicator => {
            indicator.textContent = themeName;
            indicator.className = `theme-indicator theme-${themeName}`;
        });
    }

    getThemeIcon(themeName) {
        const icons = {
            dark: 'fas fa-moon',
            light: 'fas fa-sun',
            cyber: 'fas fa-terminal',
            'high-contrast': 'fas fa-adjust',
            blue: 'fas fa-palette'
        };
        return icons[themeName] || 'fas fa-palette';
    }

    cycleTheme() {
        const currentIndex = this.themes.indexOf(this.currentTheme);
        const nextIndex = (currentIndex + 1) % this.themes.length;
        const nextTheme = this.themes[nextIndex];
        
        this.setTheme(nextTheme);
        
        // Show notification
        if (window.notificationSystem) {
            window.notificationSystem.info('Theme Changed', `Switched to ${nextTheme} theme`);
        }
    }

    emitThemeChange(themeName) {
        const event = new CustomEvent('themeChanged', {
            detail: {
                theme: themeName,
                timestamp: new Date().toISOString()
            }
        });
        document.dispatchEvent(event);
    }

    handleThemeChange(detail) {
        // Handle external theme change requests
        if (detail.theme) {
            this.setTheme(detail.theme);
        }
    }

    // Theme-specific methods
    isDarkTheme() {
        return ['dark', 'cyber', 'high-contrast'].includes(this.currentTheme);
    }

    isLightTheme() {
        return this.currentTheme === 'light';
    }

    supportsAnimations() {
        // Disable animations for high-contrast theme
        return this.currentTheme !== 'high-contrast';
    }

    getContrastRatio() {
        // Return appropriate contrast ratios for current theme
        const ratios = {
            'high-contrast': 21,
            'dark': 7,
            'light': 7,
            'cyber': 7,
            'blue': 7
        };
        return ratios[this.currentTheme] || 7;
    }

    // Advanced theme features
    createCustomTheme(name, properties) {
        if (this.themes.includes(name)) {
            console.warn('Theme already exists:', name);
            return false;
        }

        // Create CSS for custom theme
        const css = this.generateThemeCSS(name, properties);
        
        // Inject into document
        const style = document.createElement('style');
        style.id = `theme-${name}`;
        style.textContent = css;
        document.head.appendChild(style);

        // Add to themes list
        this.themes.push(name);
        
        return true;
    }

    generateThemeCSS(name, properties) {
        let css = `[data-theme="${name}"] {\n`;
        
        Object.entries(properties).forEach(([property, value]) => {
            css += `  --${property}: ${value};\n`;
        });
        
        css += '}\n';
        return css;
    }

    exportTheme(themeName = this.currentTheme) {
        const root = document.documentElement;
        const computedStyle = getComputedStyle(root);
        const themeProperties = {};

        // Extract CSS custom properties
        const properties = [
            'primary', 'secondary', 'accent',
            'bg-primary', 'bg-secondary', 'bg-tertiary',
            'text-primary', 'text-secondary', 'text-muted',
            'border-color', 'shadow-color'
        ];

        properties.forEach(prop => {
            const value = computedStyle.getPropertyValue(`--${prop}`).trim();
            if (value) {
                themeProperties[prop] = value;
            }
        });

        return {
            name: themeName,
            properties: themeProperties,
            timestamp: new Date().toISOString()
        };
    }

    importTheme(themeData) {
        if (!themeData.name || !themeData.properties) {
            console.error('Invalid theme data');
            return false;
        }

        return this.createCustomTheme(themeData.name, themeData.properties);
    }

    // Accessibility features
    enableHighContrast() {
        this.setTheme('high-contrast');
    }

    enableReducedMotion() {
        document.documentElement.style.setProperty('--transition-fast', '0ms');
        document.documentElement.style.setProperty('--transition-normal', '0ms');
        document.documentElement.style.setProperty('--transition-slow', '0ms');
    }

    // Integration with system preferences
    respectSystemPreferences() {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        const highContrast = window.matchMedia('(prefers-contrast: high)');

        if (reducedMotion.matches) {
            this.enableReducedMotion();
        }

        if (highContrast.matches) {
            this.enableHighContrast();
        }

        // Listen for changes
        reducedMotion.addEventListener('change', (e) => {
            if (e.matches) {
                this.enableReducedMotion();
            }
        });

        highContrast.addEventListener('change', (e) => {
            if (e.matches) {
                this.enableHighContrast();
            }
        });
    }

    // Theme scheduling
    scheduleThemeChange(themeName, time) {
        const now = new Date();
        const targetTime = new Date(time);
        const delay = targetTime.getTime() - now.getTime();

        if (delay > 0) {
            setTimeout(() => {
                this.setTheme(themeName);
                if (window.notificationSystem) {
                    window.notificationSystem.info('Scheduled Theme', `Switched to ${themeName} theme`);
                }
            }, delay);
            return true;
        }
        
        return false;
    }

    // Auto theme based on time
    enableAutoTheme() {
        const updateThemeBasedOnTime = () => {
            const hour = new Date().getHours();
            const isDaytime = hour >= 6 && hour < 18;
            const newTheme = isDaytime ? 'light' : 'dark';
            
            if (newTheme !== this.currentTheme) {
                this.setTheme(newTheme, false); // Don't save auto-changes
            }
        };

        // Update now
        updateThemeBasedOnTime();

        // Update every hour
        setInterval(updateThemeBasedOnTime, 60 * 60 * 1000);
    }

    // Performance optimization
    preloadThemes() {
        this.themes.forEach(theme => {
            if (theme !== this.currentTheme) {
                // Preload theme assets
                const link = document.createElement('link');
                link.rel = 'prefetch';
                link.href = `css/themes/${theme}.css`;
                document.head.appendChild(link);
            }
        });
    }

    // Debug and development
    getThemeInfo() {
        return {
            current: this.currentTheme,
            available: this.themes,
            system: this.systemPreference,
            saved: localStorage.getItem(this.storageKey),
            supportsAnimations: this.supportsAnimations(),
            isDark: this.isDarkTheme()
        };
    }

    // Cleanup
    destroy() {
        this.systemThemeQuery.removeEventListener('change', this.detectSystemTheme);
    }
}

// Export singleton instance
window.themeManager = new ThemeManager();