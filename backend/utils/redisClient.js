// backend/utils/redisClient.js
const Redis = require('redis');
const { redisHost, redisPort } = require('../config/keys');

class MockRedisClient {
  constructor() {
    this.store = new Map();
    this.isConnected = true;
    console.log('Using in-memory Redis mock (Redis server not available)');
  }

  async connect() { return this; }

  // String Set
  async set(key, value, options = {}) {
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    this.store.set(key, { value: stringValue, expires: options.ttl ? Date.now() + (options.ttl * 1000) : null });
    return 'OK';
  }

  // String Get
  async get(key) {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expires && Date.now() > item.expires) {
      this.store.delete(key);
      return null;
    }
    try { return JSON.parse(item.value); }
    catch { return item.value; }
  }

  // setEx
  async setEx(key, seconds, value) {
    return this.set(key, value, { ttl: seconds });
  }

  // Delete
  async del(key) { return this.store.delete(key) ? 1 : 0; }

  // Expire
  async expire(key, seconds) {
    const item = this.store.get(key);
    if (item) {
      item.expires = Date.now() + (seconds * 1000);
      return 1;
    }
    return 0;
  }

  // Hash Set (hSet)
  async hSet(key, data, value) {
    // hSet(key, field, value) or hSet(key, {field1: value1, field2: value2})
    let hash = this.store.get(key);
    if (!hash || typeof hash.value !== 'object') {
      hash = { value: {}, expires: null };
      this.store.set(key, hash);
    }
    if (typeof data === 'object' && value === undefined) {
      // hSet(key, {field1: value1, field2: value2})
      Object.entries(data).forEach(([field, val]) => {
        hash.value[field] = val;
      });
      return Object.keys(data).length;
    } else if (typeof data === 'string' && value !== undefined) {
      // hSet(key, field, value)
      hash.value[data] = value;
      return 1;
    }
    throw new Error('Invalid hSet arguments');
  }

  // Hash Get (hGet)
  async hGet(key, field) {
    const hash = this.store.get(key);
    if (!hash || typeof hash.value !== 'object') return null;
    return hash.value[field] ?? null;
  }

  // Hash GetAll (hGetAll)
  async hGetAll(key) {
    const hash = this.store.get(key);
    if (!hash || typeof hash.value !== 'object') return null;
    // Redis는 string만 반환
    const result = {};
    for (const [k, v] of Object.entries(hash.value)) {
      result[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
    }
    return result;
  }

  // hmset alias for hSet (Node Redis에서 deprecate 됐지만, 일부 호환용)
  async hmset(key, data) {
    return this.hSet(key, data);
  }

  async quit() {
    this.store.clear();
    console.log('Mock Redis connection closed');
  }

  // Set Add
  async sAdd(key, ...members) {
    let set = this.store.get(key);
    if (!set || set.type !== 'set') {
      set = { value: new Set(), expires: null, type: 'set' };
      this.store.set(key, set);
    }
    let added = 0;
    members.forEach(member => {
      if (!set.value.has(member)) {
        set.value.add(member);
        added++;
      }
    });
    return added;
  }

// Set Members
  async sMembers(key) {
    const set = this.store.get(key);
    if (!set || set.type !== 'set') return [];
    return Array.from(set.value);
  }

// Set Remove
  async sRem(key, ...members) {
    const set = this.store.get(key);
    if (!set || set.type !== 'set') return 0;
    let removed = 0;
    members.forEach(member => {
      if (set.value.delete(member)) removed++;
    });
    return removed;
  }

// Set Cardinality
  async sCard(key) {
    const set = this.store.get(key);
    if (!set || set.type !== 'set') return 0;
    return set.value.size;
  }

  // MockRedisClient에 추가!
  async rPush(key, ...values) {
    let list = this.store.get(key);
    if (!list || list.type !== 'list') {
      list = { value: [], expires: null, type: 'list' };
      this.store.set(key, list);
    }
    list.value.push(...values);
    return list.value.length;
  }

  async lRange(key, start, end) {
    const list = this.store.get(key);
    if (!list || list.type !== 'list') return [];
    // Redis lrange는 end 포함! (slice는 end-1까지)
    const arr = list.value;
    const normalizedStart = start < 0 ? arr.length + start : start;
    const normalizedEnd = end < 0 ? arr.length + end : end;
    return arr.slice(normalizedStart, normalizedEnd + 1);
  }

  async lLen(key) {
    const list = this.store.get(key);
    if (!list || list.type !== 'list') return 0;
    return list.value.length;
  }
}

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.maxRetries = 5;
    this.useMock = false;
  }

  async connect() {
    if (this.isConnected && this.client) return this.client;

    if (!redisHost || !redisPort) {
      this.client = new MockRedisClient();
      this.isConnected = true;
      this.useMock = true;
      return this.client;
    }

    try {
      this.client = Redis.createClient({
        url: `redis://${redisHost}:${redisPort}`,
        socket: {
          host: redisHost,
          port: redisPort,
          connectTimeout: 5000,
          reconnectStrategy: (retries) => {
            if (retries > this.maxRetries) {
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
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        if (!this.useMock) {
          this.client = new MockRedisClient();
          this.isConnected = true;
          this.useMock = true;
        }
      });

      await this.client.connect();
      return this.client;
    } catch (error) {
      this.client = new MockRedisClient();
      this.isConnected = true;
      this.useMock = true;
      return this.client;
    }
  }

  // ----- String -----
  async set(key, value, options = {}) {
    if (!this.isConnected) await this.connect();
    if (this.useMock) return this.client.set(key, value, options);

    let stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (options.ttl) return await this.client.setEx(key, options.ttl, stringValue);
    return await this.client.set(key, stringValue);
  }

  async get(key) {
    if (!this.isConnected) await this.connect();
    if (this.useMock) return this.client.get(key);

    const value = await this.client.get(key);
    if (!value) return null;
    try { return JSON.parse(value); }
    catch { return value; }
  }

  async setEx(key, seconds, value) {
    if (!this.isConnected) await this.connect();
    if (this.useMock) return this.client.setEx(key, seconds, value);

    let stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return await this.client.setEx(key, seconds, stringValue);
  }

  async del(key) {
    if (!this.isConnected) await this.connect();
    return await this.client.del(key);
  }

  async expire(key, seconds) {
    if (!this.isConnected) await this.connect();
    return await this.client.expire(key, seconds);
  }

  // ----- Hash -----
  async hSet(key, data, value) {
    if (!this.isConnected) await this.connect();
    if (this.useMock) return this.client.hSet(key, data, value);

    // node-redis v4는 hSet(key, {field: value, ...}) 또는 hSet(key, field, value) 모두 지원
    if (typeof data === 'object' && value === undefined) {
      return await this.client.hSet(key, data);
    } else if (typeof data === 'string' && value !== undefined) {
      return await this.client.hSet(key, data, value);
    }
    throw new Error('Invalid hSet arguments');
  }

  async hGet(key, field) {
    if (!this.isConnected) await this.connect();
    if (this.useMock) return this.client.hGet(key, field);
    return await this.client.hGet(key, field);
  }

  async hGetAll(key) {
    if (!this.isConnected) await this.connect();
    if (this.useMock) return this.client.hGetAll(key);
    return await this.client.hGetAll(key);
  }

  // hmset 지원 (실제 redis에서는 hSet이 대체)
  async hmset(key, data) {
    if (!this.isConnected) await this.connect();
    if (this.useMock) return this.client.hmset(key, data);
    // node-redis에서는 hSet이 대체
    return await this.client.hSet(key, data);
  }

  // Set Add
  async sAdd(key, ...members) {
    if (!this.isConnected) await this.connect();
    if (this.useMock) return this.client.sAdd(key, ...members);
    return await this.client.sAdd(key, members);
  }

// Set Members
  async sMembers(key) {
    if (!this.isConnected) await this.connect();
    if (this.useMock) return this.client.sMembers(key);
    return await this.client.sMembers(key);
  }

// Set Remove
  async sRem(key, ...members) {
    if (!this.isConnected) await this.connect();
    if (this.useMock) return this.client.sRem(key, ...members);
    return await this.client.sRem(key, members);
  }

// Set Cardinality
  async sCard(key) {
    if (!this.isConnected) await this.connect();
    if (this.useMock) return this.client.sCard(key);
    return await this.client.sCard(key);
  }

  async rPush(key, ...values) {
    if (!this.isConnected) await this.connect();
    if (this.useMock) return this.client.rPush(key, ...values);
    return await this.client.rPush(key, values);
  }

  async lRange(key, start, end) {
    if (!this.isConnected) await this.connect();
    if (this.useMock) return this.client.lRange(key, start, end);
    return await this.client.lRange(key, start, end);
  }

  async lLen(key) {
    if (!this.isConnected) await this.connect();
    if (this.useMock) return this.client.lLen(key);
    return await this.client.lLen(key);
  }


  async quit() {
    if (this.client) {
      try {
        await this.client.quit();
        this.isConnected = false;
        this.client = null;
      } catch (error) {
        // 무시
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
