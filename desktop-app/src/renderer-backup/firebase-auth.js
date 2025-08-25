/**
 * Firebase Authentication Manager
 * Handles Google authentication using Firebase
 */

// Firebase configuration - replace with your actual config
const firebaseConfig = {
    apiKey: "your-api-key-here",
    authDomain: "cyber-forge-ai.firebaseapp.com",
    projectId: "cyber-forge-ai",
    storageBucket: "cyber-forge-ai.appspot.com",
    messagingSenderId: "123456789",
    appId: "your-app-id-here"
};

class FirebaseAuthManager {
    constructor() {
        this.app = null;
        this.auth = null;
        this.currentUser = null;
        this.authStateCallbacks = [];
        this.init();
    }

    async init() {
        try {
            // Initialize Firebase
            this.app = firebase.initializeApp(firebaseConfig);
            this.auth = firebase.auth();
            
            // Set up auth state listener
            this.auth.onAuthStateChanged((user) => {
                this.handleAuthStateChange(user);
            });
            
            console.log('Firebase Auth initialized successfully');
        } catch (error) {
            console.error('Firebase initialization error:', error);
        }
    }

    handleAuthStateChange(user) {
        this.currentUser = user;
        
        // Update UI based on auth state
        this.updateAuthUI(user);
        
        // Notify callbacks
        this.authStateCallbacks.forEach(callback => {
            try {
                callback(user);
            } catch (error) {
                console.error('Auth state callback error:', error);
            }
        });
        
        // Store user data locally if authenticated
        if (user) {
            this.storeUserData(user);
        } else {
            this.clearUserData();
        }
    }

    updateAuthUI(user) {
        const loginSection = document.getElementById('login-section');
        const userSection = document.getElementById('user-section');
        const loginBtn = document.getElementById('google-login-btn');
        const logoutBtn = document.getElementById('logout-btn');
        const userInfo = document.getElementById('user-info');
        
        if (user) {
            // User is signed in
            if (loginSection) loginSection.style.display = 'none';
            if (userSection) userSection.style.display = 'block';
            
            if (userInfo) {
                userInfo.innerHTML = `
                    <div class="user-profile">
                        <img src="${user.photoURL || '/default-avatar.png'}" alt="Profile" class="user-avatar">
                        <div class="user-details">
                            <h3>${user.displayName || 'Anonymous User'}</h3>
                            <p>${user.email}</p>
                        </div>
                    </div>
                `;
            }
            
            // Show authenticated content
            this.showAuthenticatedContent();
        } else {
            // User is signed out
            if (loginSection) loginSection.style.display = 'block';
            if (userSection) userSection.style.display = 'none';
            
            // Hide authenticated content
            this.hideAuthenticatedContent();
        }
    }

    async signInWithGoogle() {
        try {
            this.showAuthLoading(true);
            
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('email');
            provider.addScope('profile');
            
            const result = await this.auth.signInWithPopup(provider);
            const user = result.user;
            
            console.log('Google sign-in successful:', user.displayName);
            
            // Send user data to backend for registration/login
            await this.syncUserWithBackend(user);
            
            return user;
        } catch (error) {
            console.error('Google sign-in error:', error);
            this.showAuthError(error.message);
            throw error;
        } finally {
            this.showAuthLoading(false);
        }
    }

    async signOut() {
        try {
            await this.auth.signOut();
            console.log('User signed out successfully');
        } catch (error) {
            console.error('Sign out error:', error);
            this.showAuthError('Failed to sign out');
        }
    }

    async syncUserWithBackend(user) {
        try {
            const idToken = await user.getIdToken();
            
            const userData = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                emailVerified: user.emailVerified
            };
            
            const response = await fetch('/api/auth/firebase-sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify(userData)
            });
            
            if (!response.ok) {
                throw new Error('Backend sync failed');
            }
            
            const result = await response.json();
            console.log('User synced with backend:', result);
            
            return result;
        } catch (error) {
            console.error('Backend sync error:', error);
            // Don't throw error here - allow user to continue with frontend-only auth
        }
    }

    async getCurrentUserToken() {
        if (!this.currentUser) {
            throw new Error('No user signed in');
        }
        
        return await this.currentUser.getIdToken();
    }

    isAuthenticated() {
        return !!this.currentUser;
    }

    getUserData() {
        if (!this.currentUser) return null;
        
        return {
            uid: this.currentUser.uid,
            email: this.currentUser.email,
            displayName: this.currentUser.displayName,
            photoURL: this.currentUser.photoURL,
            emailVerified: this.currentUser.emailVerified
        };
    }

    storeUserData(user) {
        try {
            const userData = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                emailVerified: user.emailVerified,
                lastLogin: new Date().toISOString()
            };
            
            localStorage.setItem('cyberforge_user', JSON.stringify(userData));
        } catch (error) {
            console.error('Error storing user data:', error);
        }
    }

    clearUserData() {
        try {
            localStorage.removeItem('cyberforge_user');
        } catch (error) {
            console.error('Error clearing user data:', error);
        }
    }

    getStoredUserData() {
        try {
            const stored = localStorage.getItem('cyberforge_user');
            return stored ? JSON.parse(stored) : null;
        } catch (error) {
            console.error('Error getting stored user data:', error);
            return null;
        }
    }

    onAuthStateChange(callback) {
        this.authStateCallbacks.push(callback);
        
        // Call immediately with current state
        if (this.currentUser !== undefined) {
            callback(this.currentUser);
        }
    }

    removeAuthStateCallback(callback) {
        const index = this.authStateCallbacks.indexOf(callback);
        if (index > -1) {
            this.authStateCallbacks.splice(index, 1);
        }
    }

    showAuthenticatedContent() {
        const protectedElements = document.querySelectorAll('.auth-required');
        protectedElements.forEach(element => {
            element.style.display = 'block';
        });
        
        const unAuthElements = document.querySelectorAll('.auth-hidden');
        unAuthElements.forEach(element => {
            element.style.display = 'none';
        });
    }

    hideAuthenticatedContent() {
        const protectedElements = document.querySelectorAll('.auth-required');
        protectedElements.forEach(element => {
            element.style.display = 'none';
        });
        
        const unAuthElements = document.querySelectorAll('.auth-hidden');
        unAuthElements.forEach(element => {
            element.style.display = 'block';
        });
    }

    showAuthLoading(show) {
        const loadingElement = document.getElementById('auth-loading');
        const loginBtn = document.getElementById('google-login-btn');
        
        if (loadingElement) {
            loadingElement.style.display = show ? 'flex' : 'none';
        }
        
        if (loginBtn) {
            loginBtn.disabled = show;
            loginBtn.innerHTML = show ? 
                '<i class="fas fa-spinner fa-spin"></i> Signing in...' : 
                '<i class="fab fa-google"></i> Sign in with Google';
        }
    }

    showAuthError(message) {
        const errorElement = document.getElementById('auth-error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            
            // Hide error after 5 seconds
            setTimeout(() => {
                errorElement.style.display = 'none';
            }, 5000);
        }
    }

    setupEventListeners() {
        const loginBtn = document.getElementById('google-login-btn');
        const logoutBtn = document.getElementById('logout-btn');
        
        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                this.signInWithGoogle().catch(error => {
                    console.error('Login failed:', error);
                });
            });
        }
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.signOut();
            });
        }
    }
}

// Global auth manager instance
let firebaseAuthManager;

// Initialize when Firebase is loaded
window.addEventListener('load', () => {
    if (typeof firebase !== 'undefined') {
        firebaseAuthManager = new FirebaseAuthManager();
        
        // Set up event listeners once DOM is ready
        document.addEventListener('DOMContentLoaded', () => {
            firebaseAuthManager.setupEventListeners();
        });
    } else {
        console.error('Firebase not loaded');
    }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FirebaseAuthManager;
}