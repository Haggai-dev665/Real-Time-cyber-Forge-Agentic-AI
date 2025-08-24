/**
 * Firebase Authentication Middleware for Backend
 * Handles Firebase token verification and user management
 */

const admin = require('firebase-admin');
const User = require('../models/User');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
    // In production, use service account key file or environment variables
    const serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID || "cyber-forge-ai",
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs"
    };

    try {
        if (process.env.FIREBASE_PRIVATE_KEY) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: process.env.FIREBASE_PROJECT_ID || "cyber-forge-ai"
            });
            console.log('✅ Firebase Admin SDK initialized');
        } else {
            console.log('⚠️  Firebase credentials not found, using development mode');
        }
    } catch (error) {
        console.error('❌ Firebase Admin SDK initialization failed:', error.message);
    }
}

/**
 * Middleware to verify Firebase ID token
 */
const verifyFirebaseToken = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        
        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
        }

        if (!authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. Invalid token format.'
            });
        }

        const idToken = authHeader.substring(7); // Remove 'Bearer ' prefix

        if (!idToken) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
        }

        // Verify the Firebase ID token
        if (!admin.apps.length) {
            // Fallback for development - basic validation
            console.log('⚠️  Development mode: Skipping Firebase token verification');
            req.user = {
                uid: 'dev-user-123',
                email: 'dev@cyberforge.ai',
                email_verified: true,
                name: 'Development User'
            };
            return next();
        }

        const decodedToken = await admin.auth().verifyIdToken(idToken);
        
        // Get or create user in database
        const userData = {
            firebaseUid: decodedToken.uid,
            email: decodedToken.email,
            emailVerified: decodedToken.email_verified,
            displayName: decodedToken.name || decodedToken.email.split('@')[0],
            photoURL: decodedToken.picture,
            provider: decodedToken.firebase.sign_in_provider,
            lastLoginAt: new Date()
        };

        const user = await syncFirebaseUser(userData);
        
        // Add user info to request
        req.user = {
            id: user._id,
            firebaseUid: user.firebaseUid,
            email: user.email,
            displayName: user.displayName,
            role: user.role || 'user',
            isActive: user.isActive,
            emailVerified: user.emailVerified
        };

        next();

    } catch (error) {
        console.error('Firebase token verification error:', error);
        
        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({
                success: false,
                message: 'Token expired. Please sign in again.',
                code: 'TOKEN_EXPIRED'
            });
        }

        if (error.code === 'auth/id-token-revoked') {
            return res.status(401).json({
                success: false,
                message: 'Token has been revoked. Please sign in again.',
                code: 'TOKEN_REVOKED'
            });
        }

        return res.status(401).json({
            success: false,
            message: 'Invalid token.',
            code: 'INVALID_TOKEN'
        });
    }
};

/**
 * Sync Firebase user with local database
 */
const syncFirebaseUser = async (userData) => {
    try {
        let user = await User.findOne({ firebaseUid: userData.firebaseUid });
        
        if (user) {
            // Update existing user
            user.email = userData.email;
            user.emailVerified = userData.emailVerified;
            user.displayName = userData.displayName;
            user.photoURL = userData.photoURL;
            user.lastLoginAt = userData.lastLoginAt;
            user.isActive = true;
            
            await user.save();
        } else {
            // Create new user
            user = new User({
                firebaseUid: userData.firebaseUid,
                email: userData.email,
                emailVerified: userData.emailVerified,
                firstName: userData.displayName.split(' ')[0] || 'User',
                lastName: userData.displayName.split(' ').slice(1).join(' ') || '',
                displayName: userData.displayName,
                photoURL: userData.photoURL,
                provider: userData.provider,
                role: 'user',
                isActive: true,
                createdAt: new Date(),
                lastLoginAt: userData.lastLoginAt,
                activity: {
                    lastActiveAt: new Date(),
                    loginCount: 1
                }
            });
            
            await user.save();
            console.log(`✅ Created new user: ${userData.email}`);
        }
        
        return user;
    } catch (error) {
        console.error('Error syncing Firebase user:', error);
        throw error;
    }
};

/**
 * Firebase sync endpoint for frontend
 */
const handleFirebaseSync = async (req, res) => {
    try {
        const { uid, email, displayName, photoURL, emailVerified } = req.body;
        
        if (!uid || !email) {
            return res.status(400).json({
                success: false,
                message: 'Missing required user data'
            });
        }

        const userData = {
            firebaseUid: uid,
            email,
            emailVerified: emailVerified || false,
            displayName: displayName || email.split('@')[0],
            photoURL,
            provider: 'google.com',
            lastLoginAt: new Date()
        };

        const user = await syncFirebaseUser(userData);
        
        res.json({
            success: true,
            message: 'User synced successfully',
            user: {
                id: user._id,
                email: user.email,
                displayName: user.displayName,
                role: user.role,
                isActive: user.isActive,
                emailVerified: user.emailVerified,
                createdAt: user.createdAt
            }
        });

    } catch (error) {
        console.error('Firebase sync error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to sync user data'
        });
    }
};

/**
 * Get current user profile
 */
const getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                displayName: user.displayName,
                firstName: user.firstName,
                lastName: user.lastName,
                photoURL: user.photoURL,
                role: user.role,
                isActive: user.isActive,
                emailVerified: user.emailVerified,
                createdAt: user.createdAt,
                lastLoginAt: user.lastLoginAt
            }
        });

    } catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get user data'
        });
    }
};

/**
 * Optional Firebase authentication middleware
 * Allows endpoints to work with or without authentication
 */
const optionalFirebaseAuth = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        const idToken = authHeader.substring(7);
        
        if (!idToken) {
            return next();
        }

        if (!admin.apps.length) {
            return next();
        }

        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const user = await User.findOne({ firebaseUid: decodedToken.uid });
        
        if (user && user.isActive) {
            req.user = {
                id: user._id,
                firebaseUid: user.firebaseUid,
                email: user.email,
                displayName: user.displayName,
                role: user.role || 'user',
                isActive: user.isActive,
                emailVerified: user.emailVerified
            };
        }

        next();

    } catch (error) {
        // Ignore errors in optional auth
        next();
    }
};

/**
 * Role-based authorization middleware
 */
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions'
            });
        }

        next();
    };
};

module.exports = {
    verifyFirebaseToken,
    optionalFirebaseAuth,
    requireRole,
    handleFirebaseSync,
    getCurrentUser,
    syncFirebaseUser
};