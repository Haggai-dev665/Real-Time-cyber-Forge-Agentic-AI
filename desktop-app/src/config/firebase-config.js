/**
 * Firebase Configuration for CyberForge Desktop App
 * 
 * Instructions:
 * 1. Go to Firebase Console (https://console.firebase.google.com)
 * 2. Create a new project or use existing one
 * 3. Enable Authentication and add Google as a provider
 * 4. Get your config from Project Settings > General > Your apps
 * 5. Replace the placeholder values below with your actual config
 * 
 * For development: Use environment variables or a separate config file
 * For production: These should be injected during build process
 */

const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || "YOUR_API_KEY",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "your-project.firebaseapp.com",
    projectId: process.env.FIREBASE_PROJECT_ID || "your-project-id",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "your-project.appspot.com",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "123456789",
    appId: process.env.FIREBASE_APP_ID || "1:123456789:web:abc123def456"
};

/**
 * Google OAuth Configuration
 */
const googleOAuthConfig = {
    clientId: process.env.GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "YOUR_CLIENT_SECRET",
    redirectUri: "https://cyberforge-ddd97655464f.herokuapp.com/api/auth/google/callback",
    scopes: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
    ]
};

/**
 * Generate Google OAuth URL for authentication popup
 * @param {string} state - Optional state parameter for CSRF protection
 * @returns {string} - Google OAuth authorization URL
 */
function getGoogleAuthUrl(state = '') {
    const params = new URLSearchParams({
        client_id: googleOAuthConfig.clientId,
        redirect_uri: googleOAuthConfig.redirectUri,
        response_type: 'code',
        scope: googleOAuthConfig.scopes.join(' '),
        access_type: 'offline',
        prompt: 'consent'
    });
    
    if (state) {
        params.append('state', state);
    }
    
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Parse the OAuth callback URL to extract code or error
 * @param {string} url - The callback URL
 * @returns {Object} - Object containing code or error
 */
function parseOAuthCallback(url) {
    try {
        const urlObj = new URL(url);
        const code = urlObj.searchParams.get('code');
        const error = urlObj.searchParams.get('error');
        const state = urlObj.searchParams.get('state');
        
        return { code, error, state };
    } catch (e) {
        return { error: 'Failed to parse callback URL' };
    }
}

// Export for use in other modules
module.exports = {
    firebaseConfig,
    googleOAuthConfig,
    getGoogleAuthUrl,
    parseOAuthCallback
};

// Also make available on window for browser context
if (typeof window !== 'undefined') {
    window.firebaseConfig = firebaseConfig;
    window.googleOAuthConfig = googleOAuthConfig;
    window.getGoogleAuthUrl = getGoogleAuthUrl;
}
