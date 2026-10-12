/**
 * Redis connection service for caching and session management
 */

const redis = require('redis');

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.mode = 'not-started';
    this.fallbackReason = null;
  }

  /**
   * Connect to Redis
   */
  /**
   * Connect to Redis, or fall back to an in-process cache.
   *
   * Redis only backs the memory service's per-domain cache, so the backend
   * must start without it. A missing, malformed, unreachable or unauthorized
   * Redis is reported through status() and /health instead of stopping startup.
   */
  async connectRedis() {
    let client = null;
    try {
      client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          connectTimeout: 5000,
          // Give up quickly at startup; later drops are retried with a short backoff.
          reconnectStrategy: (retries) => (this.mode === 'redis' ? Math.min(retries * 200, 3000) : false)
        }
      });
      client.on('error', (error) => {
        if (this.mode === 'redis') console.error('Redis connection error:', error.code || error.name);
      });

      await client.connect();
      await client.ping(); // an unauthorized connection fails here, not on first use

      this.client = client;
      this.isConnected = true;
      this.mode = 'redis';
      this.fallbackReason = null;
      console.log('✅ Redis connected successfully');
    } catch (error) {
      if (client) client.disconnect().catch(() => {});
      // The message can echo parts of the URL, so only its kind is kept.
      this.fallbackReason = error.code || (/protocol|url/i.test(error.message) ? 'invalid REDIS_URL' : error.name || 'error');
      this.setupMockRedis();
      this.mode = 'memory';
      console.warn(`⚠️ Redis unavailable (${this.fallbackReason}); caching in process memory instead. Cached data is lost on restart and not shared between instances.`);
    }
  }

  /** Which cache is in use: { mode: 'redis' | 'memory' | 'not-started', reason } */
  status() {
    return { mode: this.mode, reason: this.fallbackReason };
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
          setTimeout(() => mockStore.delete(key), options.EX * 1000).unref();
        }
        return 'OK';
      },
      del: async (key) => mockStore.delete(key),
      exists: async (key) => mockStore.has(key) ? 1 : 0,
      expire: async (key, seconds) => {
        if (mockStore.has(key)) {
          setTimeout(() => mockStore.delete(key), seconds * 1000).unref();
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
  status: () => redisService.status(),
  client: redisService.client
};
