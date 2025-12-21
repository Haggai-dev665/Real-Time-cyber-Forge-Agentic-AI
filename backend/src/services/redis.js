/**
 * Redis connection service for caching and session management
 */

const redis = require('redis');

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  /**
   * Connect to Redis
   */
  async connectRedis() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

      this.client = redis.createClient({
        url: redisUrl,
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            console.warn('Redis connection refused');
            return Math.min(options.attempt * 100, 3000);
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            console.error('Redis retry time exhausted');
            return new Error('Retry time exhausted');
          }
          if (options.attempt > 10) {
            return undefined;
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

      this.client.on('error', (error) => {
        console.error('Redis connection error:', error.message);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        console.log('✅ Redis connected successfully');
      });

      this.client.on('disconnect', () => {
        this.isConnected = false;
        console.log('⚠️ Redis disconnected');
      });

      await this.client.connect();

    } catch (error) {
      console.error('❌ Redis connection failed:', error.message);
      throw new Error(`Redis connection failed: ${error.message}`);
    }
  }

  /**
   * Setup mock Redis for development/fallback
   */
  setupMockRedis() {
    console.log('🔄 Using fallback mock Redis...');
    
    const mockStore = new Map();
    
    this.client = {
      get: async (key) => mockStore.get(key) || null,
      set: async (key, value, options) => {
        mockStore.set(key, value);
        if (options && options.EX) {
          // Mock expiration
          setTimeout(() => mockStore.delete(key), options.EX * 1000);
        }
        return 'OK';
      },
      del: async (key) => mockStore.delete(key),
      exists: async (key) => mockStore.has(key) ? 1 : 0,
      expire: async (key, seconds) => {
        if (mockStore.has(key)) {
          setTimeout(() => mockStore.delete(key), seconds * 1000);
          return 1;
        }
        return 0;
      },
      flushall: async () => {
        mockStore.clear();
        return 'OK';
      },
      quit: async () => {
        mockStore.clear();
        return 'OK';
      }
    };

    this.isConnected = true;
    console.log('✅ Mock Redis initialized');
  }

  /**
   * Get value from Redis
   */
  async get(key) {
    try {
      if (!this.client) {
        throw new Error('Redis not connected');
      }

      return await this.client.get(key);

    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  /**
   * Set value in Redis
   */
  async set(key, value, expiration = null) {
    try {
      if (!this.client) {
        throw new Error('Redis not connected');
      }

      const options = expiration ? { EX: expiration } : {};
      return await this.client.set(key, value, options);

    } catch (error) {
      console.error('Redis set error:', error);
      return null;
    }
  }

  /**
   * Delete key from Redis
   */
  async del(key) {
    try {
      if (!this.client) {
        throw new Error('Redis not connected');
      }

      return await this.client.del(key);

    } catch (error) {
      console.error('Redis del error:', error);
      return null;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key) {
    try {
      if (!this.client) {
        throw new Error('Redis not connected');
      }

      return await this.client.exists(key);

    } catch (error) {
      console.error('Redis exists error:', error);
      return false;
    }
  }

  /**
   * Set expiration for a key
   */
  async expire(key, seconds) {
    try {
      if (!this.client) {
        throw new Error('Redis not connected');
      }

      return await this.client.expire(key, seconds);

    } catch (error) {
      console.error('Redis expire error:', error);
      return false;
    }
  }

  /**
   * Clear all data
   */
  async flushAll() {
    try {
      if (!this.client) {
        throw new Error('Redis not connected');
      }

      return await this.client.flushall();

    } catch (error) {
      console.error('Redis flushall error:', error);
      return null;
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    try {
      if (this.client) {
        await this.client.quit();
        this.isConnected = false;
        console.log('✅ Redis connection closed');
      }
    } catch (error) {
      console.error('Error closing Redis:', error);
    }
  }

  /**
   * Check if Redis is connected
   */
  isReady() {
    return this.isConnected;
  }
}

// Create singleton instance
const redisService = new RedisService();

module.exports = {
  connectRedis: () => redisService.connectRedis(),
  get: (key) => redisService.get(key),
  set: (key, value, expiration) => redisService.set(key, value, expiration),
  del: (key) => redisService.del(key),
  exists: (key) => redisService.exists(key),
  expire: (key, seconds) => redisService.expire(key, seconds),
  flushAll: () => redisService.flushAll(),
  close: () => redisService.close(),
  isReady: () => redisService.isReady(),
  client: redisService.client
};
