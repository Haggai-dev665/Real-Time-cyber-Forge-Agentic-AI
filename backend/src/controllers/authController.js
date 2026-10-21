/**
 * Authentication Controller
 * Handles user authentication, registration, and authorization
 */

const bcrypt = require('bcryptjs');
const { signSessionToken, verifySessionToken } = require('../services/sessionTokens');
const { ensurePersonalWorkspace, linkIdentity, userIdForIdentity, hasIdentity, IdentityConflictError } = require('../services/workspaceService');
const audit = require('../services/auditLogService');

/** The principal an audit event is recorded for, from an account record. */
const principalOf = (user, workspaceId) => ({
  userId: user._id,
  workspaceId: workspaceId || (user.defaultWorkspaceId ? String(user.defaultWorkspaceId) : null)
});

/**
 * Give the account its workspace and record an outside identity. A failure
 * here does not undo a sign-in that has already succeeded: the workspace is
 * created on first use (middleware/workspace.js) and the migration repairs
 * links. It is logged so it is not silent.
 */
async function prepareAccount(user, identity) {
  try {
    if (identity) await linkIdentity(user._id, identity.provider, identity.subject, identity.source);
    return String(await ensurePersonalWorkspace(user));
  } catch (error) {
    console.error('Account preparation failed:', error.message);
    return user.defaultWorkspaceId ? String(user.defaultWorkspaceId) : null;
  }
}
const User = require('../models/User');
const { validationResult } = require('express-validator');
const { appwriteService } = require('../services/appwriteService');

class AuthController {
  /**
   * Register a new user
   */
  async register(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { email, password, firstName, lastName } = req.body;

      if (!appwriteService?.isInitialized) {
        return res.status(503).json({
          success: false,
          message: 'Authentication service unavailable. Appwrite is not initialized.'
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'User already exists with this email'
        });
      }

      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      let appwriteAuthUser;
      try {
        appwriteAuthUser = await appwriteService.registerAppwriteUser({
          email,
          password,
          firstName,
          lastName,
          role: 'user'
        });
      } catch (appwriteError) {
        console.error('Appwrite registration error:', appwriteError);
        return res.status(500).json({
          success: false,
          message: 'Failed to create account in Appwrite. Please try again.'
        });
      }

      // Create new user
      const user = new User({
        email,
        passwordHash,
        appwriteUserId: appwriteAuthUser.$id,
        firstName,
        lastName,
        role: 'user',
        profile: {
          preferences: {
            theme: 'dark',
            notifications: true,
            securityLevel: 'standard'
          }
        }
      });

      await user.save();
      const workspaceId = await prepareAccount(user, { provider: 'appwrite', subject: appwriteAuthUser.$id, source: 'registration' });
      await audit.record({ principal: principalOf(user, workspaceId), action: 'auth.register', resource: 'account', details: { method: 'password' }, req });

      // Generate JWT token
      const token = signSessionToken(user);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: {
            id: user._id,
            appwriteUserId: user.appwriteUserId,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            workspaceId
          },
          token
        }
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during registration'
      });
    }
  }

  /**
   * Login user
   */
  async login(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { email, password } = req.body;

      // Find user
      const user = await User.findOne({ email }).select('+passwordHash');
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      if (!user.isActive || user.isLocked()) {
        return res.status(401).json({ success: false, message: 'Account unavailable' });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        await audit.record({ principal: principalOf(user), action: 'auth.login', resource: 'account', outcome: 'failure', details: { method: 'password', reason: 'wrong password' }, req });
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Update last login
      user.lastLoginAt = new Date();
      await user.save();
      // an account from before workspaces existed gets its own at its next sign-in
      const workspaceId = await prepareAccount(user);
      await audit.record({ principal: principalOf(user, workspaceId), action: 'auth.login', resource: 'account', details: { method: 'password' }, req });

      // Generate JWT token
      const token = signSessionToken(user);

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            lastLoginAt: user.lastLoginAt,
            workspaceId
          },
          token
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during login'
      });
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(req, res) {
    try {
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            profile: user.profile,
            createdAt: user.createdAt,
            lastLoginAt: user.lastLoginAt
          }
        }
      });

    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const updates = req.body;
      const allowedUpdates = ['firstName', 'lastName', 'profile'];
      const filteredUpdates = {};

      // Filter allowed updates
      Object.keys(updates).forEach(key => {
        if (allowedUpdates.includes(key)) {
          filteredUpdates[key] = updates[key];
        }
      });

      const user = await User.findByIdAndUpdate(
        req.user.userId,
        filteredUpdates,
        { new: true, runValidators: true }
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            profile: user.profile
          }
        }
      });

    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Change password
   */
  async changePassword(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { currentPassword, newPassword } = req.body;

      const user = await User.findById(req.user.userId).select('+passwordHash');
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isCurrentPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // Hash new password
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      user.passwordHash = newPasswordHash;
      await user.save();

      res.json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Logout user (invalidate token on client side)
   */
  async logout(req, res) {
    try {
      // Session tokens are not revocable yet, but the account's open live
      // streams end here rather than running on until the token expires.
      require('../routes/stream').closeStreamsFor(req.user.userId, 'signed_out');
      await audit.record({ principal: req.user, action: 'auth.logout', resource: 'account', req });
      res.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Refresh JWT token
   * Issues a new token if the old one is still valid or recently expired
   */
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;
      const authHeader = req.header('Authorization');
      
      // Try to get token from header or body
      let oldToken = refreshToken;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        oldToken = authHeader.substring(7);
      }

      if (!oldToken) {
        return res.status(400).json({
          success: false,
          message: 'Token is required'
        });
      }

      try {
        // Refresh accepts expired sessions only within the validated seven-day window.
        const decoded = verifySessionToken(oldToken, { forRefresh: true });

        // Get user from database
        const user = await User.findById(decoded.userId);
        if (!user || !user.isActive || user.isLocked()) {
          return res.status(401).json({
            success: false,
            message: 'User not found or inactive'
          });
        }

        // Generate new JWT token
        const newToken = signSessionToken(user);

        res.json({
          success: true,
          message: 'Token refreshed successfully',
          data: {
            token: newToken,
            user: {
              id: user._id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              role: user.role
            }
          }
        });

      } catch (jwtError) {
        console.error('JWT verification error:', jwtError);
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }

    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Google OAuth Authentication
   * Handles both new user registration and existing user login via Google
   */
  async googleAuth(req, res) {
    try {
      if (!req.user?.firebaseUid || req.firebaseIdentity?.provider !== 'google.com') {
        return res.status(401).json({ success: false, message: 'Verified Google identity required' });
      }

      // The middleware maps the verified Firebase subject. Body identity fields
      // never select an account or change an existing provider link.
      const user = await User.findById(req.user.userId);
      if (!user || !user.isActive || user.isLocked()) {
        return res.status(401).json({ success: false, message: 'Account unavailable' });
      }
      const token = signSessionToken(user);

      res.json({
        success: true,
        message: 'Google authentication successful',
        data: {
          user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            displayName: user.displayName || `${user.firstName} ${user.lastName}`,
            role: user.role,
            photoURL: user.photoURL,
            provider: user.provider
          },
          token
        }
      });

    } catch (error) {
      console.error('Google auth error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during Google authentication'
      });
    }
  }

  /**
   * Exchange Google OAuth authorization code for tokens
   */
  async exchangeGoogleToken(req, res) {
    try {
      const { code, redirect_uri, code_verifier } = req.body;

      if (!code) {
        return res.status(400).json({
          success: false,
          message: 'Authorization code is required'
        });
      }
      // The desktop's loopback flow: the code is good only with the PKCE
      // verifier the app made for it (RFC 7636), and only for a loopback
      // redirect. A code intercepted on its way to the app is useless without it.
      if (typeof redirect_uri !== 'string' || !/^http:\/\/127\.0\.0\.1:\d{2,5}(\/[A-Za-z0-9_\/-]*)?$/.test(redirect_uri)) {
        return res.status(400).json({ success: false, message: 'redirect_uri must be the app\'s loopback address' });
      }
      if (typeof code_verifier !== 'string' || !/^[A-Za-z0-9._~-]{43,128}$/.test(code_verifier)) {
        return res.status(400).json({ success: false, code: 'PKCE_REQUIRED', message: 'A PKCE code_verifier is required. Update the desktop app.' });
      }

      // Exchange code for tokens using Google OAuth API
      const axios = require('axios');
      const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri,
        code_verifier,
        grant_type: 'authorization_code'
      });

      const { access_token, id_token } = tokenResponse.data;

      // Get user info from Google
      const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      });

      const googleUser = userInfoResponse.data;

      if (!googleUser.id || !googleUser.email || googleUser.verified_email !== true) {
        return res.status(401).json({ success: false, message: 'Verified Google email required' });
      }

      // The account is the one this Google account is linked to, by Google's
      // own ID for it. An email address does not select an account: until
      // now this signed the caller in to whatever account had the same
      // address, including one created with a password by somebody else.
      const linkedUserId = await userIdForIdentity('google', googleUser.id);
      let user = linkedUserId ? await User.findById(linkedUserId) : null;
      if (linkedUserId && !user) {
        return res.status(401).json({ success: false, message: 'Account unavailable' });
      }

      if (!user) {
        const sameAddress = await User.findOne({ email: googleUser.email }).select('+passwordHash');
        if (sameAddress && sameAddress.passwordHash) {
          // Somebody chose a password for an account with this address. Whether
          // that was this person cannot be known from here, so nothing is linked.
          return res.status(409).json({
            success: false,
            code: 'ACCOUNT_EXISTS',
            message: 'An account with this email address already exists. Sign in with its password. Connecting Google to an existing account is not available yet.'
          });
        }
        if (sameAddress && await hasIdentity(sameAddress._id, 'google')) {
          // The account already belongs to a different Google account. An
          // address can pass from one person to another; the account does not.
          return res.status(409).json({
            success: false,
            code: 'ACCOUNT_EXISTS',
            message: 'An account with this email address already exists and belongs to a different Google account.'
          });
        }
        // What is left is an account with no password and no Google link: one
        // made by an earlier provider sign-in for this verified address, before
        // links were recorded. It is linked now, once.
        user = sameAddress;
      }

      if (user) {
        if (!user.isActive || user.isLocked()) {
          return res.status(401).json({ success: false, message: 'Account unavailable' });
        }
        user.photoURL = googleUser.picture;
        user.lastLoginAt = new Date();
        user.provider = 'google.com';
        await user.save();
      } else {
        // Create new user
        user = new User({
          email: googleUser.email,
          firstName: googleUser.given_name || googleUser.name?.split(' ')[0] || 'User',
          lastName: googleUser.family_name || googleUser.name?.split(' ').slice(1).join(' ') || '',
          role: 'user',
          provider: 'google.com',
          photoURL: googleUser.picture,
          emailVerified: true,
          isActive: true,
          profile: {
            preferences: {
              theme: 'dark',
              notifications: true,
              securityLevel: 'standard'
            }
          }
        });
        await user.save();
      }

      try {
        await linkIdentity(user._id, 'google', googleUser.id, 'sign-in');
      } catch (error) {
        if (!(error instanceof IdentityConflictError)) throw error;
        return res.status(409).json({ success: false, code: error.code, message: error.message });
      }
      const googleWorkspaceId = await prepareAccount(user);
      await audit.record({ principal: principalOf(user, googleWorkspaceId), action: 'auth.login', resource: 'account', details: { method: 'google' }, req });

      // Generate JWT token
      const token = signSessionToken(user);

      res.json({
        success: true,
        message: 'Google authentication successful',
        data: {
          user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            displayName: googleUser.name || `${user.firstName} ${user.lastName}`,
            role: user.role,
            photoURL: user.photoURL,
            provider: 'google.com'
          },
          token
        }
      });

    } catch (error) {
      console.error('Google token exchange error:', error.response?.data || error);
      res.status(500).json({
        success: false,
        message: 'Failed to exchange Google authorization code'
      });
    }
  }

  /**
   * Handle Google OAuth callback (redirect from Google)
   */
  async googleCallback(req, res) {
    try {
      const { code, error } = req.query;

      if (error) {
        return res.redirect(`http://localhost:3000/auth/error?message=${encodeURIComponent(error)}`);
      }

      if (!code) {
        return res.redirect('http://localhost:3000/auth/error?message=No authorization code received');
      }

      // For desktop app, redirect back with the code
      // The desktop app will handle the code exchange
      res.redirect(`http://localhost:8000/api/auth/google/callback?code=${code}`);

    } catch (error) {
      console.error('Google callback error:', error);
      res.redirect('http://localhost:3000/auth/error?message=Authentication failed');
    }
  }
}

module.exports = new AuthController();
