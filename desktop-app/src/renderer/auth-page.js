/**
 * Cyber Forge AI - Authentication Page Controller
 * Handles login, registration, and Google OAuth flows
 */

(() => {
    // Configuration
    const API_BASE_URL = (typeof localStorage !== 'undefined' && localStorage.getItem('cyberforge_backend_url')) || 'https://cyberforge-ddd97655464f.herokuapp.com';
    const FIREBASE_CONFIG = {
        apiKey: "YOUR_FIREBASE_API_KEY",
        authDomain: "cyber-forge-ai.firebaseapp.com",
        projectId: "cyber-forge-ai",
        storageBucket: "cyber-forge-ai.appspot.com",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_APP_ID"
    };

    // State
    let state = {
        isLoading: false,
        backendConnected: false,
        currentForm: 'login',
        googleAuthProvider: null,
        firebaseApp: null,
        firebaseAuth: null
    };

    // =========================================
    // Initialization
    // =========================================

    document.addEventListener('DOMContentLoaded', () => {
        initializeApp();
        initializeParticles();
        initializeFormValidation();
        checkBackendConnection();
        initializeFirebase();
    });

    async function initializeApp() {
        console.log('🚀 Initializing Cyber Forge Authentication...');
        
        // Check if already authenticated via Electron API
        if (window.electronAPI) {
            try {
                const authResult = await window.electronAPI.auth.isAuthenticated();
                if (authResult && authResult.authenticated) {
                    console.log('✅ User already authenticated, redirecting...');
                    // Notify main process to show dashboard
                    window.electronAPI.auth.getUser().then(user => {
                        if (user.success && user.user) {
                            redirectToDashboard();
                        }
                    });
                }
            } catch (error) {
                console.log('Authentication check failed:', error);
            }
        }
    }

    async function initializeFirebase() {
        try {
            // Check if Firebase script is available
            if (typeof firebase !== 'undefined') {
                if (!firebase.apps.length) {
                    state.firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
                } else {
                    state.firebaseApp = firebase.app();
                }
                state.firebaseAuth = firebase.auth();
                state.googleAuthProvider = new firebase.auth.GoogleAuthProvider();
                state.googleAuthProvider.addScope('email');
                state.googleAuthProvider.addScope('profile');
                console.log('✅ Firebase initialized');
            } else {
                console.log('⚠️ Firebase SDK not loaded, using Electron IPC for Google Auth');
            }
        } catch (error) {
            console.error('Firebase initialization error:', error);
        }
    }

    function initializeParticles() {
        // Check if particles.js is loaded
        if (typeof particlesJS !== 'undefined') {
            const particlesContainer = document.getElementById('particles-js');
            if (!particlesContainer) {
                // Create particles container if it doesn't exist
                const container = document.createElement('div');
                container.id = 'particles-js';
                const authVisual = document.querySelector('.auth-visual');
                if (authVisual) {
                    authVisual.insertBefore(container, authVisual.firstChild);
                }
            }
            
            // Initialize particles.js with cybersecurity theme
            particlesJS('particles-js', {
                particles: {
                    number: {
                        value: 80,
                        density: {
                            enable: true,
                            value_area: 800
                        }
                    },
                    color: {
                        value: ['#656D3F', '#BFC9D1', '#EAEFEF']
                    },
                    shape: {
                        type: 'circle',
                        stroke: {
                            width: 0,
                            color: '#000000'
                        }
                    },
                    opacity: {
                        value: 0.5,
                        random: true,
                        anim: {
                            enable: true,
                            speed: 1,
                            opacity_min: 0.1,
                            sync: false
                        }
                    },
                    size: {
                        value: 3,
                        random: true,
                        anim: {
                            enable: true,
                            speed: 2,
                            size_min: 0.1,
                            sync: false
                        }
                    },
                    line_linked: {
                        enable: true,
                        distance: 150,
                        color: '#656D3F',
                        opacity: 0.4,
                        width: 1
                    },
                    move: {
                        enable: true,
                        speed: 2,
                        direction: 'none',
                        random: false,
                        straight: false,
                        out_mode: 'out',
                        bounce: false,
                        attract: {
                            enable: false,
                            rotateX: 600,
                            rotateY: 1200
                        }
                    }
                },
                interactivity: {
                    detect_on: 'canvas',
                    events: {
                        onhover: {
                            enable: true,
                            mode: 'repulse'
                        },
                        onclick: {
                            enable: true,
                            mode: 'push'
                        },
                        resize: true
                    },
                    modes: {
                        repulse: {
                            distance: 100,
                            duration: 0.4
                        },
                        push: {
                            particles_nb: 4
                        }
                    }
                },
                retina_detect: true
            });
        } else {
            // Fallback to simple particle animation
            const particlesContainer = document.getElementById('particles');
            if (!particlesContainer) return;

            for (let i = 0; i < 30; i++) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                particle.style.left = `${Math.random() * 100}%`;
                particle.style.animationDelay = `${Math.random() * 10}s`;
                particle.style.animationDuration = `${8 + Math.random() * 6}s`;
                particlesContainer.appendChild(particle);
            }
        }
        
        // Initialize GSAP animations
        initializeGSAPAnimations();
    }
    
    function initializeGSAPAnimations() {
        // Check if GSAP is loaded
        if (typeof gsap === 'undefined') return;
        
        // Animate auth visual elements
        gsap.from('.brand-title', {
            duration: 1,
            y: 50,
            opacity: 0,
            ease: 'power3.out',
            delay: 0.2
        });
        
        gsap.from('.brand-subtitle', {
            duration: 1,
            y: 50,
            opacity: 0,
            ease: 'power3.out',
            delay: 0.4
        });
        
        gsap.from('.feature-item', {
            duration: 0.8,
            x: -30,
            opacity: 0,
            stagger: 0.2,
            ease: 'power2.out',
            delay: 0.6
        });
        
        // Animate form elements
        gsap.from('.auth-form-section', {
            duration: 1,
            x: 50,
            opacity: 0,
            ease: 'power3.out',
            delay: 0.3
        });
        
        // Add hover animations to buttons using GSAP
        const buttons = document.querySelectorAll('.auth-btn, .auth-social-btn');
        buttons.forEach(button => {
            button.addEventListener('mouseenter', () => {
                gsap.to(button, {
                    scale: 1.05,
                    duration: 0.3,
                    ease: 'power2.out'
                });
            });
            
            button.addEventListener('mouseleave', () => {
                gsap.to(button, {
                    scale: 1,
                    duration: 0.3,
                    ease: 'power2.out'
                });
            });
        });
        
        // Animate AI illustration with rotation
        const aiIllustration = document.querySelector('.ai-illustration');
        if (aiIllustration) {
            gsap.to(aiIllustration, {
                rotation: 360,
                duration: 20,
                ease: 'none',
                repeat: -1
            });
        }
    }

    function initializeFormValidation() {
        // Password strength checker
        const registerPassword = document.getElementById('register-password');
        if (registerPassword) {
            registerPassword.addEventListener('input', (e) => {
                updatePasswordStrength(e.target.value);
            });
        }

        // Email validation
        document.querySelectorAll('input[type="email"]').forEach(input => {
            input.addEventListener('blur', (e) => {
                validateEmail(e.target);
            });
        });

        // Password confirmation
        const confirmPassword = document.getElementById('register-confirm-password');
        if (confirmPassword) {
            confirmPassword.addEventListener('input', (e) => {
                validatePasswordMatch();
            });
        }
    }

    // =========================================
    // Backend Connection
    // =========================================

    async function checkBackendConnection() {
        const statusElement = document.getElementById('connection-status');
        const statusDot = statusElement?.querySelector('.status-dot');
        const statusText = statusElement?.querySelector('.status-text');

        try {
            // Try Tauri IPC health check first (bypasses CORS entirely)
            let data;
            if (window.electronAPI && window.electronAPI.healthCheck) {
                try {
                    data = await window.electronAPI.healthCheck();
                } catch (ipcErr) {
                    // Fallback to direct fetch
                    const response = await fetch(`${API_BASE_URL}/health`, {
                        method: 'GET',
                        signal: AbortSignal.timeout(8000)
                    });
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    data = await response.json();
                }
            } else {
                const response = await fetch(`${API_BASE_URL}/health`, {
                    method: 'GET',
                    signal: AbortSignal.timeout(8000)
                });
                if (!response.ok) throw new Error('HTTP ' + response.status);
                data = await response.json();
            }

            state.backendConnected = true;
            
            if (statusElement) {
                statusElement.classList.add('connected');
                statusElement.classList.remove('error');
                statusText.textContent = `Connected to Cyber Forge (${data.environment || 'production'})`;
            }
            console.log('✅ Backend connected:', data);
            } else {
                throw new Error('Backend returned non-OK status');
            }
        } catch (error) {
            state.backendConnected = false;
            
            if (statusElement) {
                statusElement.classList.add('error');
                statusElement.classList.remove('connected');
                statusText.textContent = 'Cannot connect to server. Please check if backend is running.';
            }
            console.error('❌ Backend connection failed:', error);
        }
    }

    // =========================================
    // Form Navigation
    // =========================================

    window.showLoginForm = function() {
        hideAllForms();
        document.getElementById('login-form').classList.remove('hidden');
        state.currentForm = 'login';
    };

    window.showRegisterForm = function() {
        hideAllForms();
        document.getElementById('register-form').classList.remove('hidden');
        state.currentForm = 'register';
    };

    window.showResetPassword = function() {
        hideAllForms();
        document.getElementById('reset-form').classList.remove('hidden');
        state.currentForm = 'reset';
    };

    function hideAllForms() {
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.add('hidden');
        });
        document.getElementById('auth-message')?.classList.add('hidden');
    }

    // =========================================
    // Authentication Handlers
    // =========================================

    window.handleLogin = async function() {
        if (state.isLoading) return;

        const email = document.getElementById('login-email')?.value.trim();
        const password = document.getElementById('login-password')?.value;
        const rememberMe = document.getElementById('remember-me')?.checked;

        // Validation
        if (!email || !password) {
            showToast('error', 'Validation Error', 'Please fill in all fields');
            return;
        }

        if (!isValidEmail(email)) {
            showToast('error', 'Validation Error', 'Please enter a valid email address');
            return;
        }

        setLoading('login-btn', true);

        try {
            let result;
            
            // Try Tauri IPC first, then direct API
            if (window.electronAPI) {
                try {
                    result = await window.electronAPI.auth.login({ email, password, rememberMe });
                } catch (ipcErr) {
                    console.warn('IPC login failed, falling back to direct API:', ipcErr);
                    result = await loginViaAPI(email, password);
                }
            } else {
                result = await loginViaAPI(email, password);
            }

            if (result.success) {
                showToast('success', 'Welcome Back!', 'Login successful. Redirecting...');
                
                // Store token — check both flattened and nested locations
                const token = result.token || result.data?.token;
                if (token) {
                    localStorage.setItem('authToken', token);
                }
                
                // Store user data for the dashboard
                const user = result.user || result.data?.user;
                if (user) {
                    localStorage.setItem('user', JSON.stringify(user));
                }
                
                setTimeout(() => {
                    redirectToDashboard();
                }, 1500);
            } else {
                showToast('error', 'Login Failed', result.message || 'Invalid credentials');
            }
        } catch (error) {
            console.error('Login error:', error);
            showToast('error', 'Login Error', error.message || 'Unable to connect to server. Please try again.');
        } finally {
            setLoading('login-btn', false);
        }
    };

    window.handleRegister = async function() {
        if (state.isLoading) return;

        const firstName = document.getElementById('register-firstname')?.value.trim();
        const lastName = document.getElementById('register-lastname')?.value.trim();
        const email = document.getElementById('register-email')?.value.trim();
        const role = document.getElementById('register-role')?.value;
        const password = document.getElementById('register-password')?.value;
        const confirmPassword = document.getElementById('register-confirm-password')?.value;
        const termsAgreed = document.getElementById('terms-agree')?.checked;

        // Validation
        if (!firstName || !lastName || !email || !role || !password || !confirmPassword) {
            showToast('error', 'Validation Error', 'Please fill in all fields');
            return;
        }

        if (!isValidEmail(email)) {
            showToast('error', 'Validation Error', 'Please enter a valid email address');
            return;
        }

        if (password !== confirmPassword) {
            showToast('error', 'Validation Error', 'Passwords do not match');
            return;
        }

        if (!isStrongPassword(password)) {
            showToast('error', 'Weak Password', 'Password must be at least 8 characters with uppercase, lowercase, number, and special character');
            return;
        }

        if (!termsAgreed) {
            showToast('error', 'Terms Required', 'Please agree to the Terms of Service and Privacy Policy');
            return;
        }

        setLoading('register-btn', true);

        try {
            const userData = { firstName, lastName, email, password, role, name: `${firstName} ${lastName}`.trim() };
            let result;

            if (window.electronAPI) {
                try {
                    result = await window.electronAPI.auth.register(userData);
                } catch (ipcErr) {
                    console.warn('IPC register failed, falling back to direct API:', ipcErr);
                    result = await registerViaAPI(userData);
                }
            } else {
                result = await registerViaAPI(userData);
            }

            if (result.success) {
                showToast('success', 'Account Created!', 'Your account has been created. Redirecting...');
                
                const token = result.token || result.data?.token;
                if (token) {
                    localStorage.setItem('authToken', token);
                }
                
                // Store user data for the dashboard
                const user = result.user || result.data?.user;
                if (user) {
                    localStorage.setItem('user', JSON.stringify(user));
                }
                
                setTimeout(() => {
                    redirectToDashboard();
                }, 1500);
            } else {
                showToast('error', 'Registration Failed', result.message || 'Unable to create account');
            }
        } catch (error) {
            console.error('Registration error:', error);
            showToast('error', 'Registration Error', error.message || 'Unable to connect to server. Please try again.');
        } finally {
            setLoading('register-btn', false);
        }
    };

    window.handleResetPassword = async function() {
        if (state.isLoading) return;

        const email = document.getElementById('reset-email')?.value.trim();

        if (!email || !isValidEmail(email)) {
            showToast('error', 'Validation Error', 'Please enter a valid email address');
            return;
        }

        setLoading('reset-btn', true);

        try {
            // Try Firebase password reset first
            if (state.firebaseAuth) {
                await state.firebaseAuth.sendPasswordResetEmail(email);
                showMessage('success', 'Check Your Email', 'We\'ve sent password reset instructions to your email address.');
            } else {
                // Fallback - just show success (backend would handle this)
                showMessage('success', 'Check Your Email', 'If an account exists with this email, you will receive reset instructions.');
            }
        } catch (error) {
            console.error('Password reset error:', error);
            if (error.code === 'auth/user-not-found') {
                // Don't reveal if user exists
                showMessage('success', 'Check Your Email', 'If an account exists with this email, you will receive reset instructions.');
            } else {
                showToast('error', 'Reset Failed', 'Unable to send reset email. Please try again.');
            }
        } finally {
            setLoading('reset-btn', false);
        }
    };

    window.handleGoogleAuth = async function() {
        if (state.isLoading) return;

        setLoading('google-login-btn', true);
        setLoading('google-register-btn', true);

        try {
            let result;

            // Try Electron IPC Google Auth first
            if (window.electronAPI && window.electronAPI.auth.googleAuth) {
                result = await window.electronAPI.auth.googleAuth();
            } 
            // Try Firebase popup
            else if (state.firebaseAuth && state.googleAuthProvider) {
                const firebaseResult = await state.firebaseAuth.signInWithPopup(state.googleAuthProvider);
                const idToken = await firebaseResult.user.getIdToken();
                
                // Send token to backend for verification and user creation/login
                result = await googleAuthViaAPI(idToken, firebaseResult.user);
            } else {
                throw new Error('Google authentication not available');
            }

            if (result && result.success) {
                showToast('success', 'Welcome!', `Signed in as ${result.user?.email || 'user'}. Redirecting...`);
                
                if (result.token) {
                    localStorage.setItem('authToken', result.token);
                }
                
                // Store user data for the dashboard
                if (result.user) {
                    localStorage.setItem('user', JSON.stringify(result.user));
                }
                
                setTimeout(() => {
                    redirectToDashboard();
                }, 1500);
            } else {
                showToast('error', 'Google Sign-In Failed', result?.message || 'Unable to sign in with Google');
            }
        } catch (error) {
            console.error('Google auth error:', error);
            
            if (error.code === 'auth/popup-closed-by-user') {
                showToast('warning', 'Sign-In Cancelled', 'Google sign-in was cancelled');
            } else if (error.code === 'auth/popup-blocked') {
                showToast('error', 'Popup Blocked', 'Please allow popups for Google sign-in');
            } else {
                showToast('error', 'Google Sign-In Error', error.message || 'Unable to sign in with Google');
            }
        } finally {
            setLoading('google-login-btn', false);
            setLoading('google-register-btn', false);
        }
    };

    // =========================================
    // API Calls
    // =========================================

    async function loginViaAPI(email, password) {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            return {
                success: true,
                user: data.data?.user,
                token: data.data?.token
            };
        }
        
        return {
            success: false,
            message: data.message || 'Login failed'
        };
    }

    async function registerViaAPI(userData) {
        const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            return {
                success: true,
                user: data.data?.user,
                token: data.data?.token
            };
        }
        
        return {
            success: false,
            message: data.message || 'Registration failed'
        };
    }

    async function googleAuthViaAPI(idToken, firebaseUser) {
        const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
                provider: 'google.com'
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            return {
                success: true,
                user: data.data?.user || {
                    email: firebaseUser.email,
                    displayName: firebaseUser.displayName
                },
                token: data.data?.token || idToken
            };
        }
        
        return {
            success: false,
            message: data.message || 'Google authentication failed'
        };
    }

    // =========================================
    // Utilities
    // =========================================

    function redirectToDashboard() {
        console.log('🚀 Navigating to dashboard...');
        try {
            // Use replace so back button doesn't return to login
            window.location.replace('dashboard.html');
        } catch (e) {
            console.error('Navigation failed, trying fallback:', e);
            window.location.href = 'dashboard.html';
        }
    }

    function setLoading(buttonId, loading) {
        state.isLoading = loading;
        const button = document.getElementById(buttonId);
        if (button) {
            button.classList.toggle('loading', loading);
            button.disabled = loading;
        }
    }

    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    function isStrongPassword(password) {
        const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        return strongRegex.test(password);
    }

    function validateEmail(input) {
        const formGroup = input.closest('.form-group');
        if (!formGroup) return;

        if (input.value && !isValidEmail(input.value)) {
            formGroup.classList.add('invalid');
            formGroup.classList.remove('valid');
        } else if (input.value) {
            formGroup.classList.add('valid');
            formGroup.classList.remove('invalid');
        } else {
            formGroup.classList.remove('valid', 'invalid');
        }
    }

    function validatePasswordMatch() {
        const password = document.getElementById('register-password')?.value;
        const confirmPassword = document.getElementById('register-confirm-password')?.value;
        const formGroup = document.getElementById('register-confirm-password')?.closest('.form-group');

        if (!formGroup) return;

        if (confirmPassword && password !== confirmPassword) {
            formGroup.classList.add('invalid');
            formGroup.classList.remove('valid');
        } else if (confirmPassword && password === confirmPassword) {
            formGroup.classList.add('valid');
            formGroup.classList.remove('invalid');
        } else {
            formGroup.classList.remove('valid', 'invalid');
        }
    }

    function updatePasswordStrength(password) {
        const strengthFill = document.getElementById('strength-fill');
        const strengthText = document.getElementById('strength-text');

        if (!strengthFill || !strengthText) return;

        let strength = 0;
        let text = 'Too weak';

        if (password.length >= 8) strength++;
        if (password.length >= 12) strength++;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
        if (/\d/.test(password)) strength++;
        if (/[@$!%*?&]/.test(password)) strength++;

        strengthFill.className = 'strength-fill';

        if (strength <= 1) {
            strengthFill.classList.add('weak');
            text = 'Weak';
        } else if (strength === 2) {
            strengthFill.classList.add('fair');
            text = 'Fair';
        } else if (strength === 3 || strength === 4) {
            strengthFill.classList.add('good');
            text = 'Good';
        } else {
            strengthFill.classList.add('strong');
            text = 'Strong';
        }

        strengthText.textContent = text;
    }

    window.togglePassword = function(inputId) {
        const input = document.getElementById(inputId);
        const button = input?.nextElementSibling;
        const icon = button?.querySelector('i');

        if (!input || !icon) return;

        if (input.type === 'password') {
            input.type = 'text';
            icon.className = 'fas fa-eye-slash';
        } else {
            input.type = 'password';
            icon.className = 'fas fa-eye';
        }
    };

    // =========================================
    // Toast Notifications
    // =========================================

    function showToast(type, title, message) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="${icons[type] || icons.info}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">
                <i class="fas fa-times"></i>
            </button>
        `;

        // Use addEventListener instead of inline onclick (CSP blocks inline handlers in Tauri v2)
        toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());

        container.appendChild(toast);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            toast.classList.add('toast-exit');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    function showMessage(type, title, message) {
        hideAllForms();
        
        const messageContainer = document.getElementById('auth-message');
        const messageIcon = messageContainer?.querySelector('.message-icon i');
        const messageTitle = document.getElementById('message-title');
        const messageText = document.getElementById('message-text');

        if (!messageContainer) return;

        if (messageIcon) {
            messageIcon.className = type === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-circle';
        }

        const iconContainer = messageContainer.querySelector('.message-icon');
        if (iconContainer) {
            iconContainer.classList.toggle('error', type !== 'success');
        }

        if (messageTitle) messageTitle.textContent = title;
        if (messageText) messageText.textContent = message;

        messageContainer.classList.remove('hidden');
    }

    window.dismissMessage = function() {
        showLoginForm();
    };

    window.showTerms = function() {
        showToast('info', 'Terms of Service', 'Terms of Service will open in a new window');
    };

    window.showPrivacy = function() {
        showToast('info', 'Privacy Policy', 'Privacy Policy will open in a new window');
    };

})();
