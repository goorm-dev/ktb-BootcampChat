// backend/utils/redis/baseCluster.js
// Redis Cluster 공통 기능을 위한 베이스 클래스

const Redis = require('ioredis');

class BaseRedisCluster {
  constructor(name, nodes, options = {}) {
    this.name = name;
    this.nodes = nodes;
    this.options = options;
    this.cluster = null;
    this.isConnected = false;
    this.useMock = false;
  }

  async connect() {
    if (this.isConnected && this.cluster) {
      return this.cluster;
    }

    // 노드 설정이 없으면 Mock 사용
    if (!this.nodes || this.nodes.length === 0) {
      console.log(`[${this.name}] No cluster nodes configured, using mock`);
      return this.createMockCluster();
    }

    try {
      console.log(`[${this.name}] Connecting to Redis Cluster...`);
      
      this.cluster = new Redis.Cluster(this.nodes, {
        redisOptions: {
          password: this.options.password,
          connectionName: this.name,
          enableReadyCheck: true,
          maxRetriesPerRequest: 3,
          connectTimeout: 10000,
          commandTimeout: 5000,
          ...this.options.redisOptions
        },
        clusterRetryStrategy: (times) => {
          const delay = Math.min(times * 100, 3000);
          return delay;
        },
        enableOfflineQueue: true,
        scaleReads: 'slave',
        ...this.options.clusterOptions
      });

      // 이벤트 핸들러
      this.cluster.on('error', (err) => {
        console.error(`[${this.name}] Cluster Error:`, err);
      });

      this.cluster.on('connect', () => {
        console.log(`[${this.name}] Cluster Connected`);
        this.isConnected = true;
      });

      this.cluster.on('ready', () => {
        console.log(`[${this.name}] Cluster Ready`);
      });

      this.cluster.on('node error', (error, address) => {
        console.error(`[${this.name}] Node error at ${address}:`, error);
      });

      // 연결 테스트
      await this.cluster.ping();
      this.isConnected = true;
      
      return this.cluster;

    } catch (error) {
      console.error(`[${this.name}] Cluster connection failed:`, error);
      console.log(`[${this.name}] Falling back to mock cluster`);
      return this.createMockCluster();
    }
  }

  createMockCluster() {
    this.useMock = true;
    this.isConnected = true;
    
    // Mock 구현 (기존 MockRedisClient와 유사)
    this.cluster = {
      store: new Map(),
      
      async get(key) {
        const item = this.store.get(key);
        if (!item) return null;
        
        if (item.expires && Date.now() > item.expires) {
          this.store.delete(key);
          return null;
        }
        
        return item.value;
      },
      
      async set(key, value) {
        this.store.set(key, { value, expires: null });
        return 'OK';
      },
      
      async setex(key, ttl, value) {
        this.store.set(key, { 
          value, 
          expires: Date.now() + (ttl * 1000) 
        });
        return 'OK';
      },
      
      async del(...keys) {
        let deleted = 0;
        for (const key of keys) {
          if (this.store.delete(key)) deleted++;
        }
        return deleted;
      },
      
      async expire(key, ttl) {
        const item = this.store.get(key);
        if (item) {
          item.expires = Date.now() + (ttl * 1000);
          return 1;
        }
        return 0;
      },
      
      async ttl(key) {
        const item = this.store.get(key);
        if (!item || !item.expires) return -1;
        const remaining = Math.floor((item.expires - Date.now()) / 1000);
        return remaining > 0 ? remaining : -1;
      },
      
      async ping() {
        return 'PONG';
      },
      
      async exists(key) {
        return this.store.has(key) ? 1 : 0;
      },
      
      async incr(key) {
        const value = parseInt(await this.get(key) || '0');
        const newValue = value + 1;
        await this.set(key, newValue.toString());
        return newValue;
      },
      
      pipeline() {
        const commands = [];
        const pipeline = {
          get: (key) => {
            commands.push(['get', key]);
            return pipeline;
          },
          set: (key, value) => {
            commands.push(['set', key, value]);
            return pipeline;
          },
          setex: (key, ttl, value) => {
            commands.push(['setex', key, ttl, value]);
            return pipeline;
          },
          del: (key) => {
            commands.push(['del', key]);
            return pipeline;
          },
          expire: (key, ttl) => {
            commands.push(['expire', key, ttl]);
            return pipeline;
          },
          exec: async () => {
            const results = [];
            for (const [cmd, ...args] of commands) {
              try {
                const result = await this[cmd](...args);
                results.push([null, result]);
              } catch (error) {
                results.push([error, null]);
              }
            }
            return results;
          }
        };
        return pipeline;
      },
      
      multi: () => this.pipeline(),
      
      cluster: (cmd) => {
        if (cmd === 'info') return 'cluster_state:ok\r\n';
        if (cmd === 'nodes') return 'mock-node-1\r\nmock-node-2\r\n';
        return null;
      },
      
      disconnect: () => {
        this.store.clear();
        console.log(`[${this.name}] Mock cluster disconnected`);
      }
    };
    
    console.log(`[${this.name}] Using mock Redis cluster`);
    return this.cluster;
  }

  // 공통 메서드 래핑
  createClient() {
    const self = this;
    
    return {
      // 기본 메서드들
      get: async (key) => {
        if (!self.cluster) await self.connect();
        return self.cluster.get(key);
      },
      
      set: async (key, value) => {
        if (!self.cluster) await self.connect();
        return self.cluster.set(key, value);
      },
      
      setEx: async (key, ttl, value) => {
        if (!self.cluster) await self.connect();
        return self.cluster.setex(key, ttl, value);
      },
      
      del: async (...keys) => {
        if (!self.cluster) await self.connect();
        return self.cluster.del(...keys);
      },
      
      expire: async (key, ttl) => {
        if (!self.cluster) await self.connect();
        return self.cluster.expire(key, ttl);
      },
      
      exists: async (key) => {
        if (!self.cluster) await self.connect();
        return self.cluster.exists(key);
      },
      
      ttl: async (key) => {
        if (!self.cluster) await self.connect();
        return self.cluster.ttl(key);
      },
      
      incr: async (key) => {
        if (!self.cluster) await self.connect();
        return self.cluster.incr(key);
      },
      
      pipeline: () => {
        if (!self.cluster) throw new Error('Cluster not connected');
        return self.cluster.pipeline();
      },
      
      multi: () => {
        if (!self.cluster) throw new Error('Cluster not connected');
        return self.cluster.multi();
      },
      
      ping: async () => {
        if (!self.cluster) await self.connect();
        return self.cluster.ping();
      },
      
      // 클러스터 정보
      getClusterInfo: async () => {
        if (!self.cluster) await self.connect();
        
        if (self.useMock) {
          return {
            info: 'mock cluster',
            nodes: ['mock-node']
          };
        }
        
        try {
          const info = await self.cluster.cluster('info');
          const nodes = await self.cluster.cluster('nodes');
          return { info, nodes };
        } catch (error) {
          console.error('Failed to get cluster info:', error);
          return null;
        }
      },
      
      // 원본 클러스터 접근
      get cluster() {
        return self.cluster;
      },
      
      // Mock 여부 확인
      get isMock() {
        return self.useMock;
      }
    };
  }
}

module.exports = BaseRedisCluster;