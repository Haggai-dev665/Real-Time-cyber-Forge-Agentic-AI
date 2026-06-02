/**
 * Authentication Controller
 * Handles user authentication, registration, and authorization
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
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

      const { email, password, firstName, lastName, role } = req.body;

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
          role: role || 'user'
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
        role: role || 'user',
        profile: {
          preferences: {
            theme: 'dark',
            notifications: true,
            securityLevel: 'standard'
          }
        }
      });

      await user.save();

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: user._id, 
          email: user.email,
          role: user.role 
        },
        process.env.JWT_SECRET || 'cyber-forge-secret-key',
        { expiresIn: '24h' }
      );

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
            role: user.role
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

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Update last login
      user.lastLoginAt = new Date();
      await user.save();

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: user._id, 
          email: user.email,
          role: user.role 
        },
        process.env.JWT_SECRET || 'cyber-forge-secret-key',
        { expiresIn: '24h' }
      );

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
            lastLoginAt: user.lastLoginAt
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
      // In a more advanced implementation, you might maintain a blacklist of tokens
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
        // Verify the token (allow expired tokens for refresh)
        const decoded = jwt.verify(oldToken, process.env.JWT_SECRET || 'cyber-forge-secret-key', {
          ignoreExpiration: true
        });

        // Check if token is not too old (max 7 days for refresh)
        const tokenAge = Date.now() / 1000 - decoded.iat;
        const maxRefreshAge = 7 * 24 * 60 * 60; // 7 days in seconds
        
        if (tokenAge > maxRefreshAge) {
          return res.status(401).json({
            success: false,
            message: 'Token is too old to refresh. Please log in again.'
          });
        }

        // Get user from database
        const user = await User.findById(decoded.userId);
        if (!user || !user.isActive) {
          return res.status(401).json({
            success: false,
            message: 'User not found or inactive'
          });
        }

        // Generate new JWT token
        const newToken = jwt.sign(
          { 
            userId: user._id, 
            email: user.email,
            role: user.role 
          },
          process.env.JWT_SECRET || 'cyber-forge-secret-key',
          { expiresIn: '24h' }
        );

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
      const { email, uid, displayName, photoURL, provider } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required for Google authentication'
        });
      }

      // Check if user exists
      let user = await User.findOne({ email });

      if (user) {
        // Update existing user with Google info
        user.googleId = uid;
        user.photoURL = photoURL;
        user.lastLoginAt = new Date();
        user.provider = provider || 'google.com';
        await user.save();
      } else {
        // Create new user
        const nameParts = (displayName || email.split('@')[0]).split(' ');
        user = new User({
          email,
          googleId: uid,
          firstName: nameParts[0] || 'User',
          lastName: nameParts.slice(1).join(' ') || '',
          role: 'user',
          provider: provider || 'google.com',
          photoURL,
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

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: user._id, 
          email: user.email,
          role: user.role 
        },
        process.env.JWT_SECRET || 'cyber-forge-secret-key',
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        message: 'Google authentication successful',
        data: {
          user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            displayName: displayName || `${user.firstName} ${user.lastName}`,
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
      const { code, redirect_uri } = req.body;

      if (!code) {
        return res.status(400).json({
          success: false,
          message: 'Authorization code is required'
        });
      }

      // Exchange code for tokens using Google OAuth API
      const axios = require('axios');
      const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri,
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

      // Find or create user
      let user = await User.findOne({ email: googleUser.email });

      if (user) {
        // Update existing user
        user.googleId = googleUser.id;
        user.photoURL = googleUser.picture;
        user.lastLoginAt = new Date();
        user.provider = 'google.com';
        await user.save();
      } else {
        // Create new user
        user = new User({
          email: googleUser.email,
          googleId: googleUser.id,
          firstName: googleUser.given_name || googleUser.name?.split(' ')[0] || 'User',
          lastName: googleUser.family_name || googleUser.name?.split(' ').slice(1).join(' ') || '',
          role: 'user',
          provider: 'google.com',
          photoURL: googleUser.picture,
          emailVerified: googleUser.verified_email || true,
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

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: user._id, 
          email: user.email,
          role: user.role 
        },
        process.env.JWT_SECRET || 'cyber-forge-secret-key',
        { expiresIn: '24h' }
      );

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