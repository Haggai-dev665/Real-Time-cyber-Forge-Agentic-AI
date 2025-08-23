/**
 * Authentication Service for Desktop Application
 * Handles user authentication with the backend
 */

const { ipcMain, dialog } = require('electron');
const axios = require('axios');
const Store = require('electron-store');

class AuthService {
  constructor() {
    this.store = new Store();
    this.backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    this.currentUser = null;
    this.authToken = null;
    this.setupIPCHandlers();
  }

  setupIPCHandlers() {
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
      return this.isAuthenticated();
    });

    // Update profile
    ipcMain.handle('auth:updateProfile', async (event, profileData) => {
      return this.updateProfile(profileData);
    });

    // Change password
    ipcMain.handle('auth:changePassword', async (event, passwordData) => {
      return this.changePassword(passwordData);
    });
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
        
        return {
          success: true,
          user,
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
        
        return {
          success: true,
          user,
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