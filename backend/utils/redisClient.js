// backend/utils/redisClient.js
const Redis = require('redis');
const { redisHost, redisPort } = require('../config/keys');

class MockRedisClient {
  constructor() {
    this.store = new Map();
    this.isConnected = true;
    console.log('Using in-memory Redis mock (Redis server not available)');
  }

  async connect() {
    return this;
  }

  async set(key, value, options = {}) {
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    this.store.set(key, { value: stringValue, expires: options.ttl ? Date.now() + (options.ttl * 1000) : null });
    return 'OK';
  }

  async get(key) {
    const item = this.store.get(key);
    if (!item) return null;
    
    if (item.expires && Date.now() > item.expires) {
      this.store.delete(key);
      return null;
    }
    
    try {
      return JSON.parse(item.value);
    } catch {
      return item.value;
    }
  }

  async setEx(key, seconds, value) {
    return this.set(key, value, { ttl: seconds });
  }

  async del(key) {
    return this.store.delete(key) ? 1 : 0;
  }

  async expire(key, seconds) {
    const item = this.store.get(key);
    if (item) {
      item.expires = Date.now() + (seconds * 1000);
      return 1;
    }
    return 0;
  }

  async quit() {
    this.store.clear();
    console.log('Mock Redis connection closed');
  }
}

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxRetries = 5;
    this.retryDelay = 5000;
    this.useMock = false;
  }

  async connect() {
    if (this.isConnected && this.client) {
      return this.client;
    }

    // Check if Redis configuration is available
    if (!redisHost || !redisPort) {
      console.log('Redis configuration not found, using in-memory mock');
      this.client = new MockRedisClient();
      this.isConnected = true;
      this.useMock = true;
      return this.client;
    }

    try {
      console.log('Connecting to Redis...');

      this.client = Redis.createClient({
        url: `redis://${redisHost}:${redisPort}`,
        socket: {
          host: redisHost,
          port: redisPort,
          connectTimeout: 5000,
          reconnectStrategy: (retries) => {
            if (retries > this.maxRetries) {
              console.log('Max Redis reconnection attempts reached, switching to in-memory mock');
              this.client = new MockRedisClient();
              this.isConnected = true;
              this.useMock = true;
              return false;
            }
            return Math.min(retries * 50, 2000);
          }
        }
      });

      this.client.on('connect', () => {
        console.log('Redis Client Connected');
        this.isConnected = true;
        this.connectionAttempts = 0;
      });

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err.message);
        if (!this.useMock) {
          console.log('Switching to in-memory mock Redis');
          this.client = new MockRedisClient();
          this.isConnected = true;
          this.useMock = true;
        }
      });

      await this.client.connect();
      return this.client;

    } catch (error) {
      console.error('Redis connection failed:', error.message);
      console.log('Using in-memory mock Redis instead');
      this.client = new MockRedisClient();
      this.isConnected = true;
      this.useMock = true;
      return this.client;
    }
  }

  async set(key, value, options = {}) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      if (this.useMock) {
        return await this.client.set(key, value, options);
      }

      let stringValue;
      if (typeof value === 'object') {
        stringValue = JSON.stringify(value);
      } else {
        stringValue = String(value);
      }

      if (options.ttl) {
        return await this.client.setEx(key, options.ttl, stringValue);
      }
      return await this.client.set(key, stringValue);
    } catch (error) {
      console.error('Redis set error:', error);
      throw error;
    }
  }

  async get(key) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      if (this.useMock) {
        return await this.client.get(key);
      }

      const value = await this.client.get(key);
      if (!value) return null;

      try {
        return JSON.parse(value);
      } catch (parseError) {
        return value;
      }
    } catch (error) {
      console.error('Redis get error:', error);
      throw error;
    }
  }

  async setEx(key, seconds, value) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      if (this.useMock) {
        return await this.client.setEx(key, seconds, value);
      }

      let stringValue;
      if (typeof value === 'object') {
        stringValue = JSON.stringify(value);
      } else {
        stringValue = String(value);
      }

      return await this.client.setEx(key, seconds, stringValue);
    } catch (error) {
      console.error('Redis setEx error:', error);
      throw error;
    }
  }

  async del(key) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      return await this.client.del(key);
    } catch (error) {
      console.error('Redis del error:', error);
      throw error;
    }
  }

  async expire(key, seconds) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      return await this.client.expire(key, seconds);
    } catch (error) {
      console.error('Redis expire error:', error);
      throw error;
    }
  }

  async quit() {
    if (this.client) {
      try {
        await this.client.quit();
        this.isConnected = false;
        this.client = null;
        console.log('Redis connection closed successfully');
      } catch (error) {
        console.error('Redis quit error:', error);
      }
    }
  }

  async lPush(key, value) {
    if (!this.isConnected) {
      await this.connect();
    }
    if (this.useMock) {
      // mock: 배열을 문자열로 저장
      let arr = [];
      const item = this.client.store.get(key);
      if (item) {
        try { arr = JSON.parse(item.value); } catch { arr = []; }
      }
      arr.unshift(value);
      this.client.store.set(key, { value: JSON.stringify(arr), expires: null });
      return arr.length;
    }
    return await this.client.lPush(key, value);
  }

  async lTrim(key, start, stop) {
    if (!this.isConnected) {
      await this.connect();
    }
    if (this.useMock) {
      let arr = [];
      const item = this.client.store.get(key);
      if (item) {
        try { arr = JSON.parse(item.value); } catch { arr = []; }
      }
      arr = arr.slice(start, stop + 1);
      this.client.store.set(key, { value: JSON.stringify(arr), expires: null });
      return 'OK';
    }
    return await this.client.lTrim(key, start, stop);
  }
}

const redisClient = new RedisClient();
module.exports = redisClient;