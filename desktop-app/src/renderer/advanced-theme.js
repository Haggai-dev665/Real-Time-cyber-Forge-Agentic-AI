/**
 * Advanced Theme System and UI Enhancements
 */

class AdvancedThemeSystem {
    constructor() {
        this.currentTheme = localStorage.getItem('cyber-forge-theme') || 'dark';
        this.particleSystem = null;
        this.notificationSystem = null;
        this.initialized = false;
        
        this.init();
    }

    init() {
        if (this.initialized) return;
        
        this.setTheme(this.currentTheme);
        this.initParticleSystem();
        this.initNotificationSystem();
        this.initAdvancedAnimations();
        this.initMicroInteractions();
        this.addThemeSwitcher();
        this.addMessageIcons();
        
        this.initialized = true;
        console.log('Advanced Theme System initialized');
    }

    setTheme(theme) {
        const root = document.documentElement;
        const themeTransition = document.querySelector('.theme-transition') || this.createThemeTransition();
        
        // Show transition effect
        themeTransition.classList.add('active');
        
        setTimeout(() => {
            root.setAttribute('data-theme', theme);
            this.currentTheme = theme;
            localStorage.setItem('cyber-forge-theme', theme);
            
            // Update theme switcher UI
            this.updateThemeSwitcher();
            
            // Reinitialize particle system with new colors
            if (this.particleSystem) {
                this.particleSystem.updateColors();
            }
            
            // Hide transition effect
            setTimeout(() => {
                themeTransition.classList.remove('active');
            }, 300);
        }, 150);
    }

    createThemeTransition() {
        const transition = document.createElement('div');
        transition.className = 'theme-transition';
        document.body.appendChild(transition);
        return transition;
    }

    addThemeSwitcher() {
        const header = document.querySelector('.header-content');
        if (!header) return;

        const themeSwitcher = document.createElement('div');
        themeSwitcher.className = 'theme-switcher';
        themeSwitcher.innerHTML = `
            <div class="theme-option light" data-theme="light">
                <i class="fas fa-sun"></i>
            </div>
            <div class="theme-option dark" data-theme="dark">
                <i class="fas fa-moon"></i>
            </div>
            <div class="theme-option auto" data-theme="auto">
                <i class="fas fa-magic"></i>
            </div>
            <div class="theme-slider ${this.currentTheme}"></div>
        `;

        // Insert before status indicators
        const statusIndicators = header.querySelector('.status-indicators');
        if (statusIndicators) {
            header.insertBefore(themeSwitcher, statusIndicators);
        } else {
            header.appendChild(themeSwitcher);
        }

        // Add click handlers
        themeSwitcher.addEventListener('click', (e) => {
            const option = e.target.closest('.theme-option');
            if (option) {
                const theme = option.dataset.theme;
                this.setTheme(theme);
            }
        });
    }

    updateThemeSwitcher() {
        const slider = document.querySelector('.theme-slider');
        const options = document.querySelectorAll('.theme-option');
        
        if (slider) {
            slider.className = `theme-slider ${this.currentTheme}`;
        }
        
        options.forEach(option => {
            option.classList.toggle('active', option.dataset.theme === this.currentTheme);
        });
    }

    addMessageIcons() {
        const header = document.querySelector('.header-content');
        if (!header) return;

        const messageIcons = document.createElement('div');
        messageIcons.className = 'header-messages';
        messageIcons.innerHTML = `
            <div class="message-icon" id="notifications-icon">
                <i class="fas fa-bell"></i>
                <div class="message-badge">3</div>
                <div class="message-dropdown">
                    <h3>Notifications <span class="btn-icon" onclick="this.closest('.message-dropdown').parentElement.classList.remove('active')"><i class="fas fa-times"></i></span></h3>
                    <div class="message-list">
                        <div class="message-item unread">
                            <div class="message-item-title">New Threat Detected</div>
                            <div class="message-item-content">Potential malware detected on website: example.com</div>
                            <div class="message-item-time">2 minutes ago</div>
                        </div>
                        <div class="message-item">
                            <div class="message-item-title">Analysis Complete</div>
                            <div class="message-item-content">Network scan completed successfully</div>
                            <div class="message-item-time">15 minutes ago</div>
                        </div>
                        <div class="message-item">
                            <div class="message-item-title">AI Insight Generated</div>
                            <div class="message-item-content">New security recommendations available</div>
                            <div class="message-item-time">1 hour ago</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="message-icon" id="messages-icon">
                <i class="fas fa-envelope"></i>
                <div class="message-badge">1</div>
                <div class="message-dropdown">
                    <h3>Messages <span class="btn-icon" onclick="this.closest('.message-dropdown').parentElement.classList.remove('active')"><i class="fas fa-times"></i></span></h3>
                    <div class="message-list">
                        <div class="message-item unread">
                            <div class="message-item-title">System Update Available</div>
                            <div class="message-item-content">Cyber Forge AI v2.1 is now available</div>
                            <div class="message-item-time">Just now</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="message-icon" id="alerts-icon">
                <i class="fas fa-exclamation-triangle"></i>
                <div class="message-dropdown">
                    <h3>System Alerts <span class="btn-icon" onclick="this.closest('.message-dropdown').parentElement.classList.remove('active')"><i class="fas fa-times"></i></span></h3>
                    <div class="message-list">
                        <div class="message-item">
                            <div class="message-item-title">All Systems Operational</div>
                            <div class="message-item-content">No alerts at this time</div>
                            <div class="message-item-time">Current status</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Insert before theme switcher
        const themeSwitcher = header.querySelector('.theme-switcher');
        if (themeSwitcher) {
            header.insertBefore(messageIcons, themeSwitcher);
        } else {
            const statusIndicators = header.querySelector('.status-indicators');
            if (statusIndicators) {
                header.insertBefore(messageIcons, statusIndicators);
            } else {
                header.appendChild(messageIcons);
            }
        }

        // Add click handlers for dropdowns
        document.querySelectorAll('.message-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                e.stopPropagation();
                // Close other dropdowns
                document.querySelectorAll('.message-icon.active').forEach(other => {
                    if (other !== icon) other.classList.remove('active');
                });
                // Toggle current dropdown
                icon.classList.toggle('active');
            });
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', () => {
            document.querySelectorAll('.message-icon.active').forEach(icon => {
                icon.classList.remove('active');
            });
        });
    }

    initParticleSystem() {
        this.particleSystem = new ParticleSystem();
    }

    initNotificationSystem() {
        this.notificationSystem = new NotificationSystem();
    }

    initAdvancedAnimations() {
        // Add entrance animations to existing elements
        this.addEntranceAnimations();
        
        // Initialize parallax effects
        this.initParallaxEffects();
        
        // Add hover animations
        this.addHoverAnimations();
        
        // Initialize intersection observer for animations
        this.initScrollAnimations();
    }

    addEntranceAnimations() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach((item, index) => {
            item.classList.add('stagger-item');
            item.style.animationDelay = `${index * 0.1}s`;
        });

        const metricCards = document.querySelectorAll('.metric-card');
        metricCards.forEach((card, index) => {
            card.classList.add('slide-in-bottom');
            card.style.animationDelay = `${index * 0.2}s`;
        });

        const dashboardCards = document.querySelectorAll('.dashboard-card');
        dashboardCards.forEach((card, index) => {
            card.classList.add('fade-in-up');
            card.style.animationDelay = `${index * 0.3}s`;
        });
    }

    addHoverAnimations() {
        // Add hover effects to cards
        document.querySelectorAll('.metric-card, .dashboard-card').forEach(card => {
            card.classList.add('hover-lift');
        });

        // Add ripple effect to buttons
        document.querySelectorAll('.btn-primary, .btn-secondary').forEach(btn => {
            btn.classList.add('ripple');
        });

        // Add glow effect to important elements
        document.querySelectorAll('.nav-item, .quick-action-btn').forEach(item => {
            item.classList.add('hover-glow');
        });
    }

    initParallaxEffects() {
        const parallaxElements = document.querySelectorAll('.parallax');
        
        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset;
            parallaxElements.forEach(element => {
                const rate = scrolled * -0.5;
                element.style.transform = `translateY(${rate}px)`;
            });
        });
    }

    initScrollAnimations() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                }
            });
        }, {
            threshold: 0.1
        });

        document.querySelectorAll('.tab-content > *').forEach(element => {
            observer.observe(element);
        });
    }

    initMicroInteractions() {
        // Add magnetic effect to interactive elements
        document.querySelectorAll('.btn-primary, .btn-secondary, .nav-item').forEach(element => {
            element.addEventListener('mouseenter', this.addMagneticEffect);
            element.addEventListener('mouseleave', this.removeMagneticEffect);
        });

        // Add breathing animation to status indicators
        document.querySelectorAll('.status-dot').forEach(dot => {
            dot.classList.add('breathing');
        });

        // Add floating animation to icons
        document.querySelectorAll('.metric-icon, .logo i').forEach(icon => {
            icon.classList.add('floating');
        });
    }

    addMagneticEffect(e) {
        const element = e.currentTarget;
        element.classList.add('magnetic');
    }

    removeMagneticEffect(e) {
        const element = e.currentTarget;
        element.classList.remove('magnetic');
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
        this.particleCount = 50;
        this.container = null;
        this.init();
    }

    init() {
        this.createContainer();
        this.createParticles();
        this.animate();
    }

    createContainer() {
        this.container = document.createElement('div');
        this.container.className = 'particle-system';
        document.body.appendChild(this.container);
    }

    createParticles() {
        for (let i = 0; i < this.particleCount; i++) {
            this.createParticle();
        }
    }

    createParticle() {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        // Random size
        const size = Math.random() > 0.7 ? 'large' : Math.random() > 0.5 ? 'small' : '';
        if (size) particle.classList.add(size);
        
        // Random position
        particle.style.left = Math.random() * 100 + 'vw';
        particle.style.animationDelay = Math.random() * 20 + 's';
        particle.style.animationDuration = (15 + Math.random() * 10) + 's';
        
        this.container.appendChild(particle);
        this.particles.push(particle);
    }

    updateColors() {
        // Update particle colors based on current theme
        const style = getComputedStyle(document.documentElement);
        const particleColor = style.getPropertyValue('--particle-color');
        
        this.particles.forEach(particle => {
            particle.style.background = particleColor;
        });
    }

    animate() {
        // Particles animate via CSS, but we can add additional logic here
        requestAnimationFrame(() => this.animate());
    }
}

class NotificationSystem {
    constructor() {
        this.notifications = [];
        this.container = null;
        this.toastContainer = null;
        this.init();
    }

    init() {
        this.createContainers();
    }

    createContainers() {
        // Main notification container
        this.container = document.createElement('div');
        this.container.className = 'notification-center';
        document.body.appendChild(this.container);

        // Toast container
        this.toastContainer = document.createElement('div');
        this.toastContainer.className = 'toast-container';
        document.body.appendChild(this.toastContainer);
    }

    show(title, message, type = 'info', duration = 5000, actions = []) {
        const notification = this.createNotification(title, message, type, actions);
        this.container.appendChild(notification);

        // Trigger entrance animation
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });

        // Auto-remove after duration
        setTimeout(() => {
            this.hide(notification);
        }, duration);

        return notification;
    }

    createNotification(title, message, type, actions) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const iconMap = {
            success: 'fas fa-check',
            warning: 'fas fa-exclamation-triangle',
            error: 'fas fa-times',
            info: 'fas fa-info'
        };

        notification.innerHTML = `
            <div class="notification-icon">
                <i class="${iconMap[type] || iconMap.info}"></i>
            </div>
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
                <div class="notification-time">${new Date().toLocaleTimeString()}</div>
                ${actions.length > 0 ? `
                    <div class="notification-actions">
                        ${actions.map(action => `
                            <button class="notification-action ${action.type || ''}" onclick="${action.handler}">
                                ${action.text}
                            </button>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            <button class="notification-close" onclick="this.parentElement.click()">
                <i class="fas fa-times"></i>
            </button>
        `;

        // Add click to dismiss
        notification.addEventListener('click', () => {
            this.hide(notification);
        });

        return notification;
    }

    hide(notification) {
        notification.classList.add('hide');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 600);
    }

    toast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const iconMap = {
            success: 'fas fa-check',
            warning: 'fas fa-exclamation-triangle',
            error: 'fas fa-times',
            info: 'fas fa-info'
        };

        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-icon">
                    <i class="${iconMap[type] || iconMap.info}"></i>
                </div>
                <div class="toast-text">${message}</div>
            </div>
        `;

        this.toastContainer.appendChild(toast);

        // Trigger entrance animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Auto-remove after duration
        setTimeout(() => {
            toast.classList.add('hide');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 500);
        }, duration);

        return toast;
    }
}

// Initialize the advanced theme system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.advancedThemeSystem = new AdvancedThemeSystem();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AdvancedThemeSystem, ParticleSystem, NotificationSystem };
}