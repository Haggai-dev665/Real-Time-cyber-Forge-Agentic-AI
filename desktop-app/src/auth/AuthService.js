/**
 * Authentication Service for Desktop Application
 * Handles user authentication with the backend including Google OAuth
 */

const { ipcMain, dialog, BrowserWindow, session } = require('electron');
const axios = require('axios');
const Store = require('electron-store');

// Firebase Admin for token verification (optional, for enhanced security)
let firebaseInitialized = false;

class AuthService {
  constructor() {
    this.store = new Store({
      encryptionKey: 'cyber-forge-secure-storage-key-2024',
      name: 'cyber-forge-auth'
    });
    this.backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    this.currentUser = null;
    this.authToken = null;
    this.authWindow = null;
    this.mainWindow = null;
    this.onAuthSuccessCallback = null;
    this.setupIPCHandlers();
  }

  setMainWindow(window) {
    this.mainWindow = window;
  }

  setOnAuthSuccess(callback) {
    this.onAuthSuccessCallback = callback;
  }

  setupIPCHandlers() {
    // Remove existing handlers to prevent duplicates
    const handlers = [
      'auth:login', 'auth:register', 'auth:logout', 'auth:getCurrentUser',
      'auth:isAuthenticated', 'auth:updateProfile', 'auth:changePassword',
      'auth:googleAuth', 'auth:onAuthSuccess', 'auth:checkSession',
      'auth:getToken'
    ];
    
    handlers.forEach(channel => {
      try {
        ipcMain.removeHandler(channel);
      } catch (e) {
        // Handler didn't exist, that's fine
      }
    });

    // Login handler
    ipcMain.handle('auth:login', async (event, credentials) => {
      return this.login(credentials);
    });

    // Register handler
    ipcMain.handle('auth:register', async (event, userData) => {
      return this.register(userData);
    });

    // Logout handler
    ipcMain.handle('auth:logout', async () => {
      return this.logout();
    });

    // Get current user
    ipcMain.handle('auth:getCurrentUser', async () => {
      return this.getCurrentUser();
    });

    // Check authentication status
    ipcMain.handle('auth:isAuthenticated', async () => {
      return {
        authenticated: this.isAuthenticated(),
        user: this.currentUser
      };
    });

    // Update profile
    ipcMain.handle('auth:updateProfile', async (event, profileData) => {
      return this.updateProfile(profileData);
    });

    // Change password
    ipcMain.handle('auth:changePassword', async (event, passwordData) => {
      return this.changePassword(passwordData);
    });

    // Get stored token for renderer API client
    ipcMain.handle('auth:getToken', async () => {
      return { token: this.authToken };
    });

    // Google OAuth handler
    ipcMain.handle('auth:googleAuth', async () => {
      return this.googleAuth();
    });

    // Auth success callback (from renderer)
    ipcMain.handle('auth:onAuthSuccess', async () => {
      if (this.onAuthSuccessCallback) {
        this.onAuthSuccessCallback();
      }
      return { success: true };
    });

    // Check session validity
    ipcMain.handle('auth:checkSession', async () => {
      return this.checkSession();
    });
  }

  // Google OAuth via popup window
  async googleAuth() {
    return new Promise((resolve, reject) => {
      const googleAuthUrl = this.getGoogleAuthUrl();
      
      // Create auth window
      this.authWindow = new BrowserWindow({
        width: 500,
        height: 700,
        show: true,
        modal: true,
        parent: this.mainWindow,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        },
        title: 'Sign in with Google'
      });

      this.authWindow.loadURL(googleAuthUrl);

      // Handle OAuth callback
      this.authWindow.webContents.on('will-redirect', async (event, url) => {
        await this.handleGoogleCallback(url, resolve, reject);
      });

      this.authWindow.webContents.on('will-navigate', async (event, url) => {
        await this.handleGoogleCallback(url, resolve, reject);
      });

      this.authWindow.on('closed', () => {
        this.authWindow = null;
        resolve({
          success: false,
          message: 'Authentication window was closed'
        });
      });
    });
  }

  getGoogleAuthUrl() {
    const clientId = process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID';
    const redirectUri = 'http://localhost:8000/api/auth/google/callback';
    const scope = encodeURIComponent('email profile openid');
    
    return `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${scope}` +
      `&access_type=offline` +
      `&prompt=consent`;
  }

  async handleGoogleCallback(url, resolve, reject) {
    try {
      const urlObj = new URL(url);
      
      // Check if this is our callback URL
      if (urlObj.pathname.includes('/api/auth/google/callback')) {
        const code = urlObj.searchParams.get('code');
        const error = urlObj.searchParams.get('error');

        if (error) {
          if (this.authWindow) {
            this.authWindow.close();
          }
          resolve({
            success: false,
            message: `Google authentication error: ${error}`
          });
          return;
        }

        if (code) {
          // Exchange code for tokens via backend
          try {
            const response = await axios.post(`${this.backendUrl}/api/auth/google/token`, {
              code,
              redirect_uri: 'http://localhost:8000/api/auth/google/callback'
            });

            if (response.data.success) {
              const { user, token } = response.data.data;
              
              this.authToken = token;
              this.currentUser = user;
              
              this.store.set('authToken', token);
              this.store.set('currentUser', user);

              if (this.authWindow) {
                this.authWindow.close();
              }

              resolve({
                success: true,
                user,
                token,
                message: 'Google authentication successful'
              });
            } else {
              throw new Error(response.data.message);
            }
          } catch (apiError) {
            console.error('Google token exchange error:', apiError);
            if (this.authWindow) {
              this.authWindow.close();
            }
            resolve({
              success: false,
              message: apiError.response?.data?.message || 'Failed to authenticate with Google'
            });
          }
        }
      }
      
      // Check for token in URL (alternative flow)
      if (urlObj.searchParams.get('token')) {
        const token = urlObj.searchParams.get('token');
        const user = JSON.parse(decodeURIComponent(urlObj.searchParams.get('user') || '{}'));

        this.authToken = token;
        this.currentUser = user;
        
        this.store.set('authToken', token);
        this.store.set('currentUser', user);

        if (this.authWindow) {
          this.authWindow.close();
        }

        resolve({
          success: true,
          user,
          token,
          message: 'Google authentication successful'
        });
      }
    } catch (error) {
      console.error('Google callback error:', error);
    }
  }

  async checkSession() {
    if (!this.authToken) {
      return { valid: false, isAuthenticated: false, message: 'No token found' };
    }

    try {
      const response = await axios.get(`${this.backendUrl}/api/auth/verify-token`, {
        headers: {
          Authorization: `Bearer ${this.authToken}`
        }
      });

      if (response.data.success) {
        return { valid: true, isAuthenticated: true, user: response.data.user };
      } else {
        this.clearAuth();
        return { valid: false, isAuthenticated: false, message: 'Token invalid' };
      }
    } catch (error) {
      if (error.response?.status === 401) {
        this.clearAuth();
      }
      return { valid: false, isAuthenticated: false, message: 'Session check failed' };
    }
  }

  clearAuth() {
    this.authToken = null;
    this.currentUser = null;
    this.store.delete('authToken');
    this.store.delete('currentUser');
  }

  async login(credentials) {
    try {
      const response = await axios.post(`${this.backendUrl}/api/auth/login`, credentials);
      
      if (response.data.success) {
        const { user, token } = response.data.data;
        
        // Store auth data
        this.authToken = token;
        this.currentUser = user;
        
        // Persist to secure storage
        this.store.set('authToken', token);
        this.store.set('currentUser', user);

        // Immediately trigger success callback so the main process can load the dashboard
        if (this.onAuthSuccessCallback) {
          try {
            await this.onAuthSuccessCallback();
          } catch (callbackError) {
            console.error('Auth success callback error:', callbackError);
          }
        }
        
        return {
          success: true,
          user,
          token,
          message: 'Login successful'
        };
      } else {
        return {
          success: false,
          message: response.data.message || 'Login failed'
        };
      }
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Network error during login'
      };
    }
  }

  async register(userData) {
    try {
      const response = await axios.post(`${this.backendUrl}/api/auth/register`, userData);
      
      if (response.data.success) {
        const { user, token } = response.data.data;
        
        // Store auth data
        this.authToken = token;
        this.currentUser = user;
        
        // Persist to secure storage
        this.store.set('authToken', token);
        this.store.set('currentUser', user);

        // Trigger dashboard load on successful registration
        if (this.onAuthSuccessCallback) {
          try {
            await this.onAuthSuccessCallback();
          } catch (callbackError) {
            console.error('Auth success callback error:', callbackError);
          }
        }
        
        return {
          success: true,
          user,
          token,
          message: 'Registration successful'
        };
      } else {
        return {
          success: false,
          message: response.data.message || 'Registration failed'
        };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Network error during registration'
      };
    }
  }

  async logout() {
    try {
      // Clear stored data
      this.authToken = null;
      this.currentUser = null;
      this.store.delete('authToken');
      this.store.delete('currentUser');
      
      return {
        success: true,
        message: 'Logout successful'
      };
    } catch (error) {
      console.error('Logout error:', error);
      return {
        success: false,
        message: 'Error during logout'
      };
    }
  }

  async getCurrentUser() {
    if (this.currentUser) {
      return {
        success: true,
        user: this.currentUser
      };
    }

    // Try to load from storage
    const storedUser = this.store.get('currentUser');
    const storedToken = this.store.get('authToken');
    
    if (storedUser && storedToken) {
      // Verify token is still valid
      try {
        const response = await axios.get(`${this.backendUrl}/api/auth/profile`, {
          headers: {
            Authorization: `Bearer ${storedToken}`
          }
        });
        
        if (response.data.success) {
          this.currentUser = response.data.data.user;
          this.authToken = storedToken;
          
          return {
            success: true,
            user: this.currentUser
          };
        }
      } catch (error) {
        // Token invalid, clear storage
        this.store.delete('authToken');
        this.store.delete('currentUser');
      }
    }

    return {
      success: false,
      message: 'Not authenticated'
    };
  }

  async updateProfile(profileData) {
    if (!this.authToken) {
      return {
        success: false,
        message: 'Not authenticated'
      };
    }

    try {
      const response = await axios.put(`${this.backendUrl}/api/auth/profile`, profileData, {
        headers: {
          Authorization: `Bearer ${this.authToken}`
        }
      });
      
      if (response.data.success) {
        this.currentUser = response.data.data.user;
        this.store.set('currentUser', this.currentUser);
        
        return {
          success: true,
          user: this.currentUser,
          message: 'Profile updated successfully'
        };
      } else {
        return {
          success: false,
          message: response.data.message || 'Profile update failed'
        };
      }
    } catch (error) {
      console.error('Profile update error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Network error during profile update'
      };
    }
  }

  async changePassword(passwordData) {
    if (!this.authToken) {
      return {
        success: false,
        message: 'Not authenticated'
      };
    }

    try {
      const response = await axios.post(`${this.backendUrl}/api/auth/change-password`, passwordData, {
        headers: {
          Authorization: `Bearer ${this.authToken}`
        }
      });
      
      return {
        success: response.data.success,
        message: response.data.message
      };
    } catch (error) {
      console.error('Password change error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Network error during password change'
      };
    }
  }

  isAuthenticated() {
    return !!(this.authToken && this.currentUser);
  }

  getAuthToken() {
    return this.authToken;
  }

  // Initialize authentication on app startup
  async initialize() {
    await this.getCurrentUser();
  }

  // Add auth headers to WebSocket connection
  getAuthHeaders() {
    if (this.authToken) {
      return {
        Authorization: `Bearer ${this.authToken}`
      };
    }
    return {};
  }
}

module.exports = AuthService;