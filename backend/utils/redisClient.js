const IORedis = require('ioredis');
const { redisHost, redisPort, redisNodes } = require('../config/keys');

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
  async setEx(key, seconds, value) { return this.set(key, value, { ttl: seconds }); }
  async del(key) { return this.store.delete(key) ? 1 : 0; }
  async expire(key, seconds) {
    const item = this.store.get(key);
    if (item) {
      item.expires = Date.now() + (seconds * 1000);
      return 1;
    }
    return 0;
  }
  async hSet(key, data, value) {
    let hash = this.store.get(key);
    if (!hash || typeof hash.value !== 'object') {
      hash = { value: {}, expires: null };
      this.store.set(key, hash);
    }
    if (typeof data === 'object' && value === undefined) {
      Object.entries(data).forEach(([field, val]) => { hash.value[field] = val; });
      return Object.keys(data).length;
    } else if (typeof data === 'string' && value !== undefined) {
      hash.value[data] = value;
      return 1;
    }
    throw new Error('Invalid hSet arguments');
  }
  async hGet(key, field) {
    const hash = this.store.get(key);
    if (!hash || typeof hash.value !== 'object') return null;
    return hash.value[field] ?? null;
  }
  async hGetAll(key) {
    const hash = this.store.get(key);
    if (!hash || typeof hash.value !== 'object') return null;
    const result = {};
    for (const [k, v] of Object.entries(hash.value)) {
      result[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
    }
    return result;
  }
  async hmset(key, data) { return this.hSet(key, data); }
  async quit() { this.store.clear(); }
  async sAdd(key, ...members) {
    let set = this.store.get(key);
    if (!set || set.type !== 'set') {
      set = { value: new Set(), expires: null, type: 'set' };
      this.store.set(key, set);
    }
    let added = 0;
    members.forEach(member => { if (!set.value.has(member)) { set.value.add(member); added++; } });
    return added;
  }
  async sMembers(key) {
    const set = this.store.get(key);
    if (!set || set.type !== 'set') return [];
    return Array.from(set.value);
  }
  async sRem(key, ...members) {
    const set = this.store.get(key);
    if (!set || set.type !== 'set') return 0;
    let removed = 0;
    members.forEach(member => { if (set.value.delete(member)) removed++; });
    return removed;
  }
  async sCard(key) {
    const set = this.store.get(key);
    if (!set || set.type !== 'set') return 0;
    return set.value.size;
  }
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
  async lPush(key, value) {
    let list = this.store.get(key);
    if (!list || list.type !== 'list') {
      list = { value: [], expires: null, type: 'list' };
      this.store.set(key, list);
    }
    list.value.unshift(value);
    return list.value.length;
  }
  async lTrim(key, start, stop) {
    let list = this.store.get(key);
    if (!list || list.type !== 'list') return 'OK';
    list.value = list.value.slice(start, stop + 1);
    return 'OK';
  }

  async lSet(key, index, value) {
    const item = this.store.get(key);
    if (!item) return null;
    if (Array.isArray(item.value)) {
      item.value[index] = value;
      return 'OK';
    } else if (item.value instanceof Set) {
      throw new Error('lSet: Not a list');
    } else {
      throw new Error('lSet: Not a list');
    }
  }


  async keys(pattern) {
    const prefix = pattern.replace('*', '');
    return Array.from(this.store.keys()).filter(key => key.startsWith(prefix));
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
    try {
      if (redisNodes) {
        // 클러스터 모드
        const nodes = redisNodes.split(',').map(addr => {
          const [host, port] = addr.split(':');
          return { host, port: Number(port) };
        });
        console.log('[Redis] Connecting in CLUSTER mode to:', nodes.map(n => `${n.host}:${n.port}`).join(', '));
        this.client = new IORedis.Cluster(nodes, {
          redisOptions: { connectTimeout: 5000 }
        });
      } else if (redisHost && redisPort) {
        // 싱글 모드
        console.log(`[Redis] Connecting in STANDALONE mode to: ${redisHost}:${redisPort}`);
        this.client = new IORedis({
          host: redisHost,
          port: Number(redisPort),
          connectTimeout: 5000,
          retryStrategy: (times) => (times > this.maxRetries ? null : Math.min(times * 100, 2000))
        });
      } else {
        console.warn('[Redis] No redisHost/redisPort/redisNodes found, using MockRedisClient');
        this.client = new MockRedisClient();
        this.isConnected = true;
        this.useMock = true;
        return this.client;
      }

      this.client.on('connect', () => {
        this.isConnected = true;
        console.log('[Redis] Connected');
      });
      this.client.on('error', (err) => {
        console.error('[Redis] Error:', err);
        if (!this.useMock) {
          this.client = new MockRedisClient();
          this.isConnected = true;
          this.useMock = true;
        }
      });

      // 연결 체크 (ioredis는 connect 함수 없음)
      await this.client.ping();
      return this.client;
    } catch (error) {
      console.error('[Redis] Connection failed:', error.message);
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
    return this.client.setex(key, seconds, stringValue);
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
      return await this.client.hset(key, data);
    } else if (typeof data === 'string' && value !== undefined) {
      return await this.client.hset(key, data, value);
    }
    throw new Error('Invalid hSet arguments');
  }

  async hGet(key, field) {
    if (!this.isConnected) await this.connect();
    if (this.useMock) return this.client.hGet(key, field);
    return this.client.hget(key, field);
  }

  async hGetAll(key) {
    if (!this.isConnected) await this.connect();
    if (this.useMock) return this.client.hGetAll(key);
    return this.client.hgetall(key);
  }
  async hmset(key, data) {
    if (!this.isConnected) await this.connect();
    if (this.useMock) return this.client.hmset(key, data);
    return await this.client.hmset(key, data);
  }
  async sAdd(key, ...members) {
    if (!this.isConnected) await this.connect();
    if (this.useMock) return this.client.sAdd(key, ...members);
    return await this.client.sadd(key, ...members);
  }
  async sMembers(key) {
    if (!this.isConnected) await this.connect();
    if (this.useMock) return this.client.sMembers(key);
    return this.client.smembers(key);
  }
  async sRem(key, ...members) {
    if (!this.isConnected) await this.connect();
    if (this.useMock) return this.client.sRem(key, ...members);
    return await this.client.srem(key, ...members);
  }
  async sCard(key) {
    if (!this.isConnected) await this.connect();
    if (this.useMock) return this.client.sCard(key);
    return this.client.scard(key);
  }
  async rPush(key, ...values) {
    if (!this.isConnected) await this.connect();
    if (this.useMock) return this.client.rPush(key, ...values);
    return this.client.rpush(key, ...values);
  }
  async lRange(key, start, end) {
    if (!this.isConnected) await this.connect();
    if (this.useMock) return this.client.lRange(key, start, end);
    return this.client.lrange(key, start, end);
  }
  async lLen(key) {
    if (!this.isConnected) await this.connect();
    if (this.useMock) return this.client.lLen(key);
    return this.client.llen(key);
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
    return this.client.lpush(key, value);
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
    return this.client.ltrim(key, start, stop);
  }

  async lSet(key, index, value) {
    if (!this.isConnected) await this.connect();
    if (this.useMock) return this.client.lSet(key, index, value);
    return this.client.lset(key, index, value);
  }


  async keys(pattern) {
    if (!this.isConnected) await this.connect();
    if (this.useMock) {
      return this.client.keys(pattern);
    }
    return this.client.keys(pattern);
  }
}
// 환경 변수 예시
// 운영 클러스터: REDIS_NODES=10.0.0.1:6379,10.0.0.2:6379,...
// 개발:          REDIS_HOST=localhost REDIS_PORT=6379

const redisClient = new RedisClient();
module.exports = redisClient;
