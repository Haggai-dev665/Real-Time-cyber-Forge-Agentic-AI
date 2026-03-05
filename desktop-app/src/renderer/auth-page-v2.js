/**
 * Cyber Forge AI - Enhanced Authentication Page V2
 * Modern glassmorphism design with AI visualization
 */

// =====================================================
// CONFIGURATION
// =====================================================

const _HEROKU = 'https://cyberforge-ddd97655464f.herokuapp.com';
const API_BASE_URL = (localStorage.getItem('cyberforge_backend_url') || _HEROKU) + '/api';
const WS_URL = (localStorage.getItem('cyberforge_backend_url') || _HEROKU).replace(/^https?/, m => m === 'https' ? 'wss' : 'ws');

// =====================================================
// STATE MANAGEMENT
// =====================================================

const authState = {
    isConnected: false,
    isLoading: false,
    isBootstrapping: true,
    currentForm: 'login' // 'login', 'register', 'reset'
};

const AUTH_STORAGE_KEYS = {
    token: 'authToken',
    refreshToken: 'refreshToken',
    user: 'user'
};

// =====================================================
// DOM ELEMENTS
// =====================================================

const elements = {
    // Forms
    loginForm: null,
    registerForm: null,
    resetForm: null,
    
    // Buttons
    loginBtn: null,
    registerBtn: null,
    resetBtn: null,
    googleLoginBtn: null,
    
    // Connection
    connectionStatus: null,
    connectionText: null,
    
    // Toast
    toastContainer: null
};

function normalizeAuthResponse(payload) {
    const data = payload || {};
    const nested = data.data || {};

    return {
        success: Boolean(data.success),
        message: data.message || nested.message,
        token: data.token || nested.token,
        refreshToken: data.refreshToken || nested.refreshToken,
        user: data.user || nested.user,
        errors: data.errors || nested.errors
    };
}

function navigateToDashboard() {
    setTimeout(() => {
        try {
            window.location.replace('dashboard.html');
        } catch (_) {
            window.location.href = 'dashboard.html';
        }
    }, 700);
}

// =====================================================
// INITIALIZATION
// =====================================================

document.addEventListener('DOMContentLoaded', async () => {
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 180ms ease-out';

    initializeTheme();
    initializeElements();
    setupEventListeners();

    const hasSession = await bootstrapAuthSession();
    if (!hasSession) {
        checkServerConnection();
        animateEntrance();
    }

    // Always make the page visible — even if we're about to redirect,
    // this prevents an invisible page if navigation is delayed.
    document.body.style.opacity = '1';

    authState.isBootstrapping = false;
});

function initializeTheme() {
    if (window.CyberForgeTheme) {
        window.CyberForgeTheme.initTheme('light');
        return;
    }

    const saved = localStorage.getItem('cyberforge-theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
}

async function bootstrapAuthSession() {
    const electronToken = await tryHydrateSessionFromSecureStorage();
    const token = electronToken
        || sessionStorage.getItem(AUTH_STORAGE_KEYS.token)
        || localStorage.getItem(AUTH_STORAGE_KEYS.token);

    if (!token) {
        return false;
    }

    const valid = await validateTokenWithProfile(token);
    if (valid) {
        navigateToDashboard();
        return true;
    }

    const refreshed = await trySilentRefresh(token);
    if (refreshed) {
        navigateToDashboard();
        return true;
    }

    clearAuthStorage();
    return false;
}

async function tryHydrateSessionFromSecureStorage() {
    if (!(typeof window !== 'undefined' && window.electronAPI?.auth)) {
        return null;
    }

    try {
        const auth = await window.electronAPI.auth.isAuthenticated();
        if (!auth?.authenticated) return null;

        const [tokenResult, userResult] = await Promise.all([
            window.electronAPI.auth.getToken(),
            window.electronAPI.auth.getUser()
        ]);

        const token = tokenResult?.token;
        if (!token) return null;

        localStorage.setItem(AUTH_STORAGE_KEYS.token, token);

        if (userResult?.success && userResult?.user) {
            localStorage.setItem(AUTH_STORAGE_KEYS.user, JSON.stringify(userResult.user));
        }

        return token;
    } catch (error) {
        console.warn('Secure auth hydration failed:', error?.message || error);
        return null;
    }
}

async function validateTokenWithProfile(token) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`${API_BASE_URL}/auth/profile`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            signal: controller.signal
        });

        clearTimeout(timeout);
        return response.ok;
    } catch (_) {
        return false;
    }
}

async function trySilentRefresh(token) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ refreshToken: token })
        });

        if (!response.ok) return false;

        const payload = await response.json();
        const auth = normalizeAuthResponse(payload);
        if (!auth.success || !auth.token) return false;

        localStorage.setItem(AUTH_STORAGE_KEYS.token, auth.token);
        if (auth.user) {
            localStorage.setItem(AUTH_STORAGE_KEYS.user, JSON.stringify(auth.user));
        }

        return true;
    } catch (_) {
        return false;
    }
}

function clearAuthStorage() {
    localStorage.removeItem(AUTH_STORAGE_KEYS.token);
    localStorage.removeItem(AUTH_STORAGE_KEYS.refreshToken);
    localStorage.removeItem(AUTH_STORAGE_KEYS.user);
    sessionStorage.removeItem(AUTH_STORAGE_KEYS.token);
    sessionStorage.removeItem(AUTH_STORAGE_KEYS.refreshToken);
    sessionStorage.removeItem(AUTH_STORAGE_KEYS.user);
}

function initializeElements() {
    elements.loginForm = document.getElementById('login-form');
    elements.registerForm = document.getElementById('register-form');
    elements.resetForm = document.getElementById('reset-form');
    
    elements.loginBtn = document.getElementById('login-btn');
    elements.registerBtn = document.getElementById('register-btn');
    elements.resetBtn = document.getElementById('reset-btn');
    elements.googleLoginBtn = document.getElementById('google-login-btn');
    
    elements.connectionStatus = document.getElementById('connection-status');
    elements.connectionText = document.getElementById('connection-text');
    
    elements.toastContainer = document.getElementById('toast-container');
}

function setupEventListeners() {
    // Form submissions via Enter key
    document.getElementById('login-form-element')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    
    document.getElementById('register-form-element')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleRegister();
    });
    
    document.getElementById('reset-form-element')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleResetPassword();
    });
}

function animateEntrance() {
    const formCard = document.querySelector('.auth-form-card:not(.hidden)');
    if (formCard) {
        formCard.classList.add('slide-up');
    }
}

// =====================================================
// SERVER CONNECTION
// =====================================================

async function checkServerConnection() {
    updateConnectionStatus('connecting');
    
    try {
        const fetchWithTimeout = async (url, timeoutMs = 10000) => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);
            try {
                return await fetch(url, { method: 'GET', signal: controller.signal });
            } finally {
                clearTimeout(timeout);
            }
        };

        // Use local backend in desktop development
        const baseUrl = localStorage.getItem('cyberforge_backend_url') || 'https://cyberforge-ddd97655464f.herokuapp.com';
        
        try {
            const response = await fetchWithTimeout(`${baseUrl}/health`);
            authState.isConnected = response.ok;
            updateConnectionStatus(response.ok ? 'connected' : 'disconnected');
        } catch (err) {
            console.error('Health check failed:', err);
            authState.isConnected = false;
            updateConnectionStatus('disconnected');
        }
    } catch (error) {
        console.error('Server connection error:', error);
        authState.isConnected = false;
        updateConnectionStatus('disconnected');
    }
    
    // Retry connection every 30 seconds if disconnected
    if (!authState.isConnected) {
        setTimeout(checkServerConnection, 30000);
    }
}

function updateConnectionStatus(status) {
    if (!elements.connectionStatus || !elements.connectionText) return;
    
    elements.connectionStatus.classList.remove('connected', 'disconnected', 'connecting');
    
    switch (status) {
        case 'connected':
            elements.connectionStatus.classList.add('connected');
            elements.connectionText.textContent = 'Connected to server';
            break;
        case 'disconnected':
            elements.connectionStatus.classList.add('disconnected');
            elements.connectionText.textContent = 'Server unavailable';
            break;
        case 'connecting':
            elements.connectionStatus.classList.add('connecting');
            elements.connectionText.textContent = 'Connecting...';
            break;
    }
}

// =====================================================
// FORM SWITCHING
// =====================================================

function showLoginForm() {
    hideAllForms();
    elements.loginForm?.classList.remove('hidden');
    elements.loginForm?.classList.add('fade-in');
    authState.currentForm = 'login';
}

function showRegisterForm() {
    hideAllForms();
    elements.registerForm?.classList.remove('hidden');
    elements.registerForm?.classList.add('fade-in');
    authState.currentForm = 'register';
}

function showResetPassword() {
    hideAllForms();
    elements.resetForm?.classList.remove('hidden');
    elements.resetForm?.classList.add('fade-in');
    authState.currentForm = 'reset';
}

function hideAllForms() {
    elements.loginForm?.classList.add('hidden');
    elements.registerForm?.classList.add('hidden');
    elements.resetForm?.classList.add('hidden');
    
    // Remove animation classes
    elements.loginForm?.classList.remove('fade-in', 'slide-up');
    elements.registerForm?.classList.remove('fade-in', 'slide-up');
    elements.resetForm?.classList.remove('fade-in', 'slide-up');
}

// =====================================================
// AUTHENTICATION HANDLERS
// =====================================================

async function handleLogin(event) {
    if (event) {
        event.preventDefault();
    }
    
    if (authState.isLoading) return;
    
    const email = document.getElementById('login-email')?.value?.trim();
    const password = document.getElementById('login-password')?.value;
    const rememberMe = document.getElementById('remember-me')?.checked;
    
    // Validation
    if (!email || !password) {
        showToast('error', 'Missing Fields', 'Please enter your email and password.');
        return;
    }
    
    if (!isValidEmail(email)) {
        showToast('error', 'Invalid Email', 'Please enter a valid email address.');
        return;
    }
    
    setButtonLoading(elements.loginBtn, true);
    authState.isLoading = true;
    
    try {
        console.log('🔐 Attempting login:', { email, url: `${API_BASE_URL}/auth/login` });
        
        // Check if running in Electron with IPC available
        const useIPC = typeof window !== 'undefined' && window.electronAPI?.auth?.login;
        
        let data;
        if (useIPC) {
            // Use Electron IPC for persistent login (stores in electron-store)
            console.log('📡 Using Electron IPC for login...');
            data = await window.electronAPI.auth.login({ email, password, rememberMe });
        } else {
            // Fallback to direct API call (web mode)
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            console.log('📡 Login response status:', response.status, response.statusText);
            data = await response.json();
            
            // Wrap in expected format for consistency
            if (response.ok && data.success) {
                data = { success: true, user: data.data.user, token: data.data.token };
            }
        }
        
        console.log('📦 Login response data:', data);

        const auth = normalizeAuthResponse(data);

        if (auth.success && auth.token) {
            // Always persist to localStorage for desktop app (survives app restart)
            localStorage.setItem('authToken', auth.token);
            sessionStorage.setItem('authToken', auth.token);
            if (auth.refreshToken) {
                localStorage.setItem('refreshToken', auth.refreshToken);
                sessionStorage.setItem('refreshToken', auth.refreshToken);
            }
            if (auth.user) {
                localStorage.setItem('user', JSON.stringify(auth.user));
                sessionStorage.setItem('user', JSON.stringify(auth.user));
            }

            const userEmail = auth.user?.email || email;
            
            showToast('success', 'Welcome Back!', `Signed in as ${userEmail}`);
            
            // Navigate to dashboard after short delay
            navigateToDashboard();
        } else {
            showToast('error', 'Login Failed', auth.message || 'Invalid credentials. Please try again.');
        }
    } catch (error) {
        console.error('❌ Login error:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        showToast('error', 'Connection Error', 'Unable to connect to server. Please try again.');
    } finally {
        setButtonLoading(elements.loginBtn, false);
        authState.isLoading = false;
    }
}

async function handleRegister(event) {
    if (event) {
        event.preventDefault();
    }
    
    if (authState.isLoading) return;
    
    const firstName = document.getElementById('register-firstname')?.value?.trim();
    const lastName = document.getElementById('register-lastname')?.value?.trim();
    const email = document.getElementById('register-email')?.value?.trim();
    const role = document.getElementById('register-role')?.value;
    const password = document.getElementById('register-password')?.value;
    const confirmPassword = document.getElementById('register-confirm-password')?.value;
    const termsAgreed = document.getElementById('terms-agree')?.checked;
    
    // Validation
    if (!firstName || !lastName || !email || !role || !password || !confirmPassword) {
        showToast('error', 'Missing Fields', 'Please fill in all required fields.');
        return;
    }
    
    if (!isValidEmail(email)) {
        showToast('error', 'Invalid Email', 'Please enter a valid email address.');
        return;
    }
    
    if (password.length < 8) {
        showToast('error', 'Weak Password', 'Password must be at least 8 characters long.');
        return;
    }

    // Must match backend validation in backend/src/routes/auth.js
    // At least: 1 lowercase, 1 uppercase, 1 number, 1 special character
    const passwordPolicy = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
    if (!passwordPolicy.test(password)) {
        showToast(
            'error',
            'Weak Password',
            'Password must include lowercase, uppercase, number, and a special character (@$!%*?&).'
        );
        return;
    }
    
    if (password !== confirmPassword) {
        showToast('error', 'Password Mismatch', 'Passwords do not match.');
        return;
    }
    
    if (!termsAgreed) {
        showToast('error', 'Terms Required', 'Please agree to the Terms of Service and Privacy Policy.');
        // Highlight the checkbox area
        const termsCheckbox = document.getElementById('terms-agree');
        const termsLabel = termsCheckbox?.parentElement;
        if (termsLabel) {
            termsLabel.style.border = '1px solid #ef4444';
            termsLabel.style.borderRadius = '8px';
            termsLabel.style.padding = '8px';
            setTimeout(() => {
                termsLabel.style.border = '';
                termsLabel.style.padding = '';
            }, 3000);
        }
        return;
    }
    
    setButtonLoading(elements.registerBtn, true);
    authState.isLoading = true;
    
    try {
        console.log('📝 Attempting registration:', { email, firstName, lastName, role, url: `${API_BASE_URL}/auth/register` });
        
        // Check if running in Electron with IPC available
        const useIPC = typeof window !== 'undefined' && window.electronAPI?.auth?.register;
        
        let data;
        if (useIPC) {
            // Use Electron IPC for persistent login (stores in electron-store)
            console.log('📡 Using Electron IPC for registration...');
            data = await window.electronAPI.auth.register({
                firstName,
                lastName,
                email,
                password,
                role
            });
        } else {
            // Fallback to direct API call (web mode)
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    firstName,
                    lastName,
                    email,
                    password,
                    role
                })
            });
            
            console.log('📡 Register response status:', response.status, response.statusText);
            data = await response.json();
            
            // Wrap in expected format for consistency
            if (response.ok && data.success) {
                data = { success: true, user: data.data.user, token: data.data.token };
            }
        }
        
        console.log('📦 Register response data:', data);

        const auth = normalizeAuthResponse(data);

        if (auth.success && auth.token) {
            showToast('success', 'Account Created!', 'You are now signed in.');
            
            // Store tokens in localStorage for api-client.js
            const storage = localStorage;
            storage.setItem('authToken', auth.token);
            if (auth.refreshToken) {
                storage.setItem('refreshToken', auth.refreshToken);
            }
            if (auth.user) {
                storage.setItem('user', JSON.stringify(auth.user));
            }
            
            // Navigate to dashboard after short delay
            navigateToDashboard();
        } else {
            const validationMsg = Array.isArray(auth?.errors) && auth.errors.length > 0
                ? (auth.errors[0].msg || auth.errors[0].message)
                : null;
            showToast(
                'error',
                'Registration Failed',
                validationMsg || auth.message || 'Unable to create account. Please try again.'
            );
        }
    } catch (error) {
        console.error('❌ Registration error:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        showToast('error', 'Connection Error', 'Unable to connect to server. Please try again.');
    } finally {
        setButtonLoading(elements.registerBtn, false);
        authState.isLoading = false;
    }
}

async function handleResetPassword() {
    if (authState.isLoading) return;
    
    const email = document.getElementById('reset-email')?.value?.trim();
    
    // Validation
    if (!email) {
        showToast('error', 'Missing Email', 'Please enter your email address.');
        return;
    }
    
    if (!isValidEmail(email)) {
        showToast('error', 'Invalid Email', 'Please enter a valid email address.');
        return;
    }
    
    setButtonLoading(elements.resetBtn, true);
    authState.isLoading = true;
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        // Always show success to prevent email enumeration
        showToast('success', 'Check Your Email', 'If an account exists with this email, you will receive reset instructions.');
        
        // Clear form and switch to login
        document.getElementById('reset-form-element')?.reset();
        setTimeout(() => {
            showLoginForm();
        }, 2000);
    } catch (error) {
        console.error('Reset password error:', error);
        // Still show success for security
        showToast('success', 'Check Your Email', 'If an account exists with this email, you will receive reset instructions.');
    } finally {
        setButtonLoading(elements.resetBtn, false);
        authState.isLoading = false;
    }
}

async function handleGoogleAuth() {
    showToast('info', 'Google Sign-In', 'Google authentication is being configured...');
    
    // TODO: Implement Google OAuth flow
    // This would typically open a popup or redirect to Google's OAuth endpoint
    // and handle the callback with the authorization code
}

// =====================================================
// PASSWORD UTILITIES
// =====================================================

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const toggle = input?.parentElement?.querySelector('.password-toggle i');
    
    if (!input || !toggle) return;
    
    if (input.type === 'password') {
        input.type = 'text';
        toggle.classList.remove('fa-eye');
        toggle.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        toggle.classList.remove('fa-eye-slash');
        toggle.classList.add('fa-eye');
    }
}

function checkPasswordStrength(password) {
    const strengthFill = document.getElementById('strength-fill');
    const strengthText = document.getElementById('strength-text');
    
    if (!strengthFill || !strengthText) return;
    
    // Remove all strength classes
    strengthFill.classList.remove('weak', 'fair', 'good', 'strong');
    
    if (!password) {
        strengthText.textContent = 'Password strength';
        return;
    }
    
    let strength = 0;
    
    // Length check
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    
    // Character variety
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    
    // Determine strength level
    let level, text;
    if (strength <= 2) {
        level = 'weak';
        text = 'Weak - Add more characters';
    } else if (strength <= 3) {
        level = 'fair';
        text = 'Fair - Add uppercase or symbols';
    } else if (strength <= 5) {
        level = 'good';
        text = 'Good - Almost there!';
    } else {
        level = 'strong';
        text = 'Strong password!';
    }
    
    strengthFill.classList.add(level);
    strengthText.textContent = text;
}

// =====================================================
// UI UTILITIES
// =====================================================

function setButtonLoading(button, isLoading) {
    if (!button) return;
    
    if (isLoading) {
        button.classList.add('loading');
        button.disabled = true;
    } else {
        button.classList.remove('loading');
        button.disabled = false;
    }
}

function showToast(type, title, message) {
    const container = elements.toastContainer;
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const iconMap = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="toast-icon fas ${iconMap[type] || iconMap.info}"></i>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// =====================================================
// VALIDATION UTILITIES
// =====================================================

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// =====================================================
// EXPOSE FUNCTIONS GLOBALLY
// =====================================================

// These functions are called from onclick handlers in HTML
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleResetPassword = handleResetPassword;
window.handleGoogleAuth = handleGoogleAuth;
window.showLoginForm = showLoginForm;
window.showRegisterForm = showRegisterForm;
window.showResetPassword = showResetPassword;
window.togglePassword = togglePassword;
window.checkPasswordStrength = checkPasswordStrength;

// =====================================================
// VISUAL ENHANCEMENTS (no auth logic changes)
// =====================================================

/**
 * Theme toggle button handler.
 * Delegates to CyberForgeTheme if available, otherwise manual toggle.
 */
(function initVisualEnhancements() {
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-toggle-icon');

    function updateThemeIcon(theme) {
        if (!themeIcon) return;
        themeIcon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
    }

    // Set initial icon based on current theme
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    updateThemeIcon(currentTheme);

    // Listen for theme changes from CyberForgeTheme
    document.addEventListener('cyberforge:theme-changed', (e) => {
        updateThemeIcon(e.detail?.theme);
    });

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            if (window.CyberForgeTheme) {
                window.CyberForgeTheme.toggleTheme();
            } else {
                const cur = document.documentElement.getAttribute('data-theme') || 'dark';
                const next = cur === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', next);
                localStorage.setItem('cyberforge-theme', next);
                updateThemeIcon(next);
            }
        });
    }

    /**
     * Enhanced form switching — focus first input after transition.
     */
    const origShowLogin = window.showLoginForm;
    const origShowRegister = window.showRegisterForm;
    const origShowReset = window.showResetPassword;

    window.showLoginForm = function () {
        origShowLogin();
        requestAnimationFrame(() => {
            document.getElementById('login-email')?.focus();
        });
    };

    window.showRegisterForm = function () {
        origShowRegister();
        requestAnimationFrame(() => {
            document.getElementById('register-firstname')?.focus();
        });
    };

    window.showResetPassword = function () {
        origShowReset();
        requestAnimationFrame(() => {
            document.getElementById('reset-email')?.focus();
        });
    };

    /**
     * Enhanced password toggle — add visual feedback class.
     */
    const origTogglePassword = window.togglePassword;
    window.togglePassword = function (inputId) {
        origTogglePassword(inputId);
        const input = document.getElementById(inputId);
        const btn = input?.parentElement?.querySelector('.password-toggle');
        if (btn) {
            const isText = input.type === 'text';
            btn.classList.toggle('toggled', isText);
        }
    };
})();
