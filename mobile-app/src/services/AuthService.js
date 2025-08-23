/**
 * Authentication Service for Mobile Application
 * Handles user authentication with the backend
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

const API_BASE_URL = __DEV__ ? 'http://localhost:8000' : 'https://your-api-domain.com';

class AuthService {
  constructor() {
    this.currentUser = null;
    this.authToken = null;
    this.listeners = new Set();
  }

  // Add authentication state listener
  addAuthListener(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Notify all listeners of auth state change
  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error('Auth listener error:', error);
      }
    });
  }

  async login(credentials) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (data.success) {
        const { user, token } = data.data;
        
        // Store auth data
        this.authToken = token;
        this.currentUser = user;
        
        // Persist to storage
        await AsyncStorage.setItem('authToken', token);
        await AsyncStorage.setItem('currentUser', JSON.stringify(user));
        
        this.notifyListeners('login', { user });
        
        return {
          success: true,
          user,
          message: 'Login successful'
        };
      } else {
        return {
          success: false,
          message: data.message || 'Login failed'
        };
      }
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: 'Network error during login'
      };
    }
  }

  async register(userData) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (data.success) {
        const { user, token } = data.data;
        
        // Store auth data
        this.authToken = token;
        this.currentUser = user;
        
        // Persist to storage
        await AsyncStorage.setItem('authToken', token);
        await AsyncStorage.setItem('currentUser', JSON.stringify(user));
        
        this.notifyListeners('register', { user });
        
        return {
          success: true,
          user,
          message: 'Registration successful'
        };
      } else {
        return {
          success: false,
          message: data.message || 'Registration failed'
        };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        message: 'Network error during registration'
      };
    }
  }

  async logout() {
    try {
      // Clear stored data
      this.authToken = null;
      this.currentUser = null;
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('currentUser');
      
      this.notifyListeners('logout', {});
      
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
    try {
      const storedUser = await AsyncStorage.getItem('currentUser');
      const storedToken = await AsyncStorage.getItem('authToken');
      
      if (storedUser && storedToken) {
        // Verify token is still valid
        const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
          headers: {
            Authorization: `Bearer ${storedToken}`
          }
        });
        
        const data = await response.json();
        
        if (data.success) {
          this.currentUser = data.data.user;
          this.authToken = storedToken;
          
          return {
            success: true,
            user: this.currentUser
          };
        } else {
          // Token invalid, clear storage
          await this.logout();
        }
      }
    } catch (error) {
      console.error('Get current user error:', error);
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
      const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.authToken}`
        },
        body: JSON.stringify(profileData),
      });

      const data = await response.json();
      
      if (data.success) {
        this.currentUser = data.data.user;
        await AsyncStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        
        this.notifyListeners('profileUpdate', { user: this.currentUser });
        
        return {
          success: true,
          user: this.currentUser,
          message: 'Profile updated successfully'
        };
      } else {
        return {
          success: false,
          message: data.message || 'Profile update failed'
        };
      }
    } catch (error) {
      console.error('Profile update error:', error);
      return {
        success: false,
        message: 'Network error during profile update'
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
      const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.authToken}`
        },
        body: JSON.stringify(passwordData),
      });

      const data = await response.json();
      
      return {
        success: data.success,
        message: data.message
      };
    } catch (error) {
      console.error('Password change error:', error);
      return {
        success: false,
        message: 'Network error during password change'
      };
    }
  }

  isAuthenticated() {
    return !!(this.authToken && this.currentUser);
  }

  getAuthToken() {
    return this.authToken;
  }

  // Get auth headers for API requests
  getAuthHeaders() {
    if (this.authToken) {
      return {
        Authorization: `Bearer ${this.authToken}`
      };
    }
    return {};
  }

  // Initialize authentication on app startup
  async initialize() {
    await this.getCurrentUser();
  }

  // Show authentication error alert
  showAuthError(message) {
    Alert.alert(
      'Authentication Error',
      message,
      [{ text: 'OK', style: 'default' }],
      { cancelable: false }
    );
  }

  // Show authentication success alert
  showAuthSuccess(message) {
    Alert.alert(
      'Success',
      message,
      [{ text: 'OK', style: 'default' }],
      { cancelable: false }
    );
  }
}

// Create singleton instance
const authService = new AuthService();

export default authService;