/**
 * Lottie Animation Manager
 * Handles all Lottie animations in the application
 */

class LottieAnimationManager {
    constructor() {
        this.animations = new Map();
        this.animationConfigs = {
            'loading-shield': {
                path: './animations/loading-shield.json',
                loop: true,
                autoplay: true,
                speed: 1
            },
            'cyber-eye': {
                path: './animations/cyber-eye.json',
                loop: true,
                autoplay: true,
                speed: 0.8
            },
            'data-stream': {
                path: './animations/data-stream.json',
                loop: true,
                autoplay: true,
                speed: 1.2
            },
            'pulse': {
                // Simple CSS animation for pulse effect
                type: 'css',
                className: 'pulse-animation'
            },
            'alert-pulse': {
                type: 'css',
                className: 'alert-pulse-animation'
            },
            'scanner': {
                type: 'css',
                className: 'scanner-animation'
            },
            'ai-thinking': {
                type: 'css',
                className: 'ai-thinking-animation'
            }
        };
        
        this.init();
    }

    init() {
        this.createAnimationStyles();
        this.setupAnimationObserver();
    }

    createAnimationStyles() {
        const styles = `
            /* CSS Animations */
            .pulse-animation {
                animation: pulse-effect 2s ease-in-out infinite;
            }

            @keyframes pulse-effect {
                0%, 100% { 
                    opacity: 1; 
                    transform: scale(1); 
                }
                50% { 
                    opacity: 0.7; 
                    transform: scale(1.05); 
                }
            }

            .alert-pulse-animation {
                animation: alert-pulse 1.5s ease-in-out infinite;
            }

            @keyframes alert-pulse {
                0%, 100% { 
                    box-shadow: 0 0 0 0 rgba(229,87,62, 0.7); 
                }
                50% { 
                    box-shadow: 0 0 0 10px rgba(229,87,62, 0); 
                }
            }

            .scanner-animation {
                position: relative;
                overflow: hidden;
            }

            .scanner-animation::after {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, 
                    transparent, 
                    rgba(255, 255, 255, 0.3), 
                    transparent
                );
                animation: scanner-sweep 2s ease-in-out infinite;
            }

            @keyframes scanner-sweep {
                0% { left: -100%; }
                100% { left: 100%; }
            }

            .ai-thinking-animation {
                animation: ai-thinking 2s ease-in-out infinite;
            }

            @keyframes ai-thinking {
                0%, 100% { 
                    transform: rotate(0deg) scale(1); 
                    filter: brightness(1); 
                }
                25% { 
                    transform: rotate(5deg) scale(1.05); 
                    filter: brightness(1.2); 
                }
                75% { 
                    transform: rotate(-5deg) scale(1.05); 
                    filter: brightness(1.2); 
                }
            }

            .lottie-container {
                width: 24px;
                height: 24px;
                display: inline-block;
                vertical-align: middle;
                margin-right: 8px;
            }

            .item-animation {
                position: absolute;
                right: 8px;
                top: 50%;
                transform: translateY(-50%);
                width: 20px;
                height: 20px;
                pointer-events: none;
            }

            .nav-item {
                position: relative;
            }

            .nav-item .item-animation .lottie-container {
                width: 20px;
                height: 20px;
                margin: 0;
            }
        `;

        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    }

    setupAnimationObserver() {
        // Observe visibility changes to start/stop animations
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const animationElement = entry.target;
                const animationType = animationElement.dataset.animation;
                
                if (entry.isIntersecting) {
                    this.startAnimation(animationElement, animationType);
                } else {
                    this.pauseAnimation(animationElement, animationType);
                }
            });
        }, { threshold: 0.1 });

        // Observe all animation elements
        document.querySelectorAll('[data-animation]').forEach(el => {
            observer.observe(el);
        });
    }

    loadLottieAnimation(container, animationName) {
        const config = this.animationConfigs[animationName];
        if (!config || config.type === 'css') return null;

        const animation = lottie.loadAnimation({
            container: container,
            renderer: 'svg',
            loop: config.loop,
            autoplay: config.autoplay,
            path: config.path
        });

        if (config.speed) {
            animation.setSpeed(config.speed);
        }

        this.animations.set(container, animation);
        return animation;
    }

    startAnimation(element, animationType) {
        const config = this.animationConfigs[animationType];
        if (!config) return;

        if (config.type === 'css') {
            element.classList.add(config.className);
        } else {
            // Create Lottie container if needed
            let lottieContainer = element.querySelector('.lottie-container');
            if (!lottieContainer) {
                lottieContainer = document.createElement('div');
                lottieContainer.className = 'lottie-container';
                element.appendChild(lottieContainer);
            }

            if (!this.animations.has(lottieContainer)) {
                this.loadLottieAnimation(lottieContainer, animationType);
            } else {
                const animation = this.animations.get(lottieContainer);
                animation.play();
            }
        }
    }

    pauseAnimation(element, animationType) {
        const config = this.animationConfigs[animationType];
        if (!config) return;

        if (config.type === 'css') {
            element.classList.remove(config.className);
        } else {
            const lottieContainer = element.querySelector('.lottie-container');
            if (lottieContainer && this.animations.has(lottieContainer)) {
                const animation = this.animations.get(lottieContainer);
                animation.pause();
            }
        }
    }

    createLoadingAnimation(container) {
        return this.loadLottieAnimation(container, 'loading-shield');
    }

    createCyberEyeAnimation(container) {
        return this.loadLottieAnimation(container, 'cyber-eye');
    }

    createDataStreamAnimation(container) {
        return this.loadLottieAnimation(container, 'data-stream');
    }

    destroyAnimation(container) {
        if (this.animations.has(container)) {
            const animation = this.animations.get(container);
            animation.destroy();
            this.animations.delete(container);
        }
    }

    destroyAllAnimations() {
        this.animations.forEach((animation, container) => {
            animation.destroy();
        });
        this.animations.clear();
    }
}

// Export for use in other modules
window.LottieAnimationManager = LottieAnimationManager;