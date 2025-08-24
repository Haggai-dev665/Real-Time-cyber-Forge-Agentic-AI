/**
 * Database connection service for MongoDB
 */

const mongoose = require('mongoose');

class DatabaseService {
  constructor() {
    this.isConnected = false;
  }

  /**
   * Connect to MongoDB database
   */
  async connectDatabase() {
    try {
      const connectionString = process.env.DATABASE_URL || 
        'mongodb://localhost:27017/cyberforge';

      // MongoDB connection options
      const options = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4 // Use IPv4, skip trying IPv6
      };

      await mongoose.connect(connectionString, options);

      this.isConnected = true;
      console.log('✅ MongoDB connected successfully');

      // Handle connection events
      mongoose.connection.on('error', (error) => {
        console.error('❌ MongoDB connection error:', error);
      });

      mongoose.connection.on('disconnected', () => {
        console.log('⚠️ MongoDB disconnected');
      });

    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      
      // If connection fails, use fallback mock database
      console.log('🔄 Using fallback mock database...');
      this.setupMockDatabase();
    }
  }

  /**
   * Setup mock database for development/fallback
   */
  setupMockDatabase() {
    // Create mock mongoose connection
    this.mockDb = {
      isConnected: true,
      models: new Map()
    };
    this.isConnected = true;
    console.log('✅ Mock database initialized');
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    if (mongoose.connection.readyState === 1) {
      return { connected: true, state: 'connected' };
    } else {
      return { connected: false, state: mongoose.connection.readyState };
    }
  }

  /**
   * Close database connection
   */
  async close() {
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
        this.isConnected = false;
        console.log('✅ Database connection closed');
      }
    } catch (error) {
      console.error('Error closing database:', error);
    }
  }

  /**
   * Check if database is connected
   */
  isReady() {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  /**
   * Check if database is healthy
   */
  async healthCheck() {
    try {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.db.admin().ping();
        return { healthy: true, message: 'Database connection is healthy' };
      } else {
        return { healthy: false, message: 'Database not connected' };
      }
    } catch (error) {
      return { healthy: false, message: error.message };
    }
  }
}

// Create singleton instance
const databaseService = new DatabaseService();

module.exports = {
  connectDatabase: () => databaseService.connectDatabase(),
  getConnectionStatus: () => databaseService.getConnectionStatus(),
  close: () => databaseService.close(),
  isReady: () => databaseService.isReady(),
  healthCheck: () => databaseService.healthCheck(),
  mongoose: mongoose
};
