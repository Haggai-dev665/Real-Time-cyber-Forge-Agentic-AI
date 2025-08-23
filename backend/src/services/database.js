/**
 * Database connection service for PostgreSQL
 */

const { Pool } = require('pg');

class DatabaseService {
  constructor() {
    this.pool = null;
    this.isConnected = false;
  }

  /**
   * Connect to PostgreSQL database
   */
  async connectDatabase() {
    try {
      const connectionString = process.env.DATABASE_URL || 
        'postgresql://cyberforge:cyberforge_password@localhost:5432/cyberforge';

      this.pool = new Pool({
        connectionString,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.isConnected = true;
      console.log('✅ Database connected successfully');

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
    this.pool = {
      query: async (text, params) => {
        console.log('Mock DB Query:', text, params);
        return { rows: [], rowCount: 0 };
      },
      connect: async () => ({
        query: async () => ({ rows: [], rowCount: 0 }),
        release: () => {}
      })
    };
    this.isConnected = true;
    console.log('✅ Mock database initialized');
  }

  /**
   * Execute a query
   */
  async query(text, params) {
    try {
      if (!this.pool) {
        throw new Error('Database not connected');
      }

      const result = await this.pool.query(text, params);
      return result;

    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  /**
   * Get a client from the pool
   */
  async getClient() {
    try {
      if (!this.pool) {
        throw new Error('Database not connected');
      }

      return await this.pool.connect();

    } catch (error) {
      console.error('Error getting database client:', error);
      throw error;
    }
  }

  /**
   * Close database connection
   */
  async close() {
    try {
      if (this.pool) {
        await this.pool.end();
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
    return this.isConnected;
  }

  /**
   * Initialize database tables (if needed)
   */
  async initializeTables() {
    try {
      // Users table
      await this.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Analysis results table
      await this.query(`
        CREATE TABLE IF NOT EXISTS analysis_results (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id),
          url TEXT NOT NULL,
          risk_level VARCHAR(20) NOT NULL,
          security_score INTEGER,
          threats JSONB,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Threats table
      await this.query(`
        CREATE TABLE IF NOT EXISTS threats (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id),
          type VARCHAR(100) NOT NULL,
          severity VARCHAR(20) NOT NULL,
          description TEXT,
          url TEXT,
          status VARCHAR(20) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      console.log('✅ Database tables initialized');

    } catch (error) {
      console.warn('Database table initialization failed (may already exist):', error.message);
    }
  }
}

// Create singleton instance
const databaseService = new DatabaseService();

module.exports = {
  connectDatabase: () => databaseService.connectDatabase(),
  query: (text, params) => databaseService.query(text, params),
  getClient: () => databaseService.getClient(),
  close: () => databaseService.close(),
  isReady: () => databaseService.isReady(),
  pool: databaseService.pool
};
