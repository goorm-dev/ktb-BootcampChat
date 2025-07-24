// backend/utils/redis/redisSessionCluster.js
const BaseRedisCluster = require('./baseCluster');

// 세션 클러스터 노드 설정
const sessionNodes = [
  {
    port: process.env.REDIS_1_HOST_PORT || 7001,
    host: process.env.REDIS_1_HOST || '127.0.0.1'
  },
  {
    port: process.env.REDIS_2_HOST_PORT || 7002,
    host: process.env.REDIS_2_HOST || '127.0.0.1'
  },
  {
    port: process.env.REDIS_3_HOST_PORT || 7003,
    host: process.env.REDIS_3_HOST || '127.0.0.1'
  }
].filter(node => node.host && node.port); // 유효한 노드만 필터링

// 세션 클러스터 옵션
const sessionOptions = {
//   password: process.env.REDIS_SESSION_PASSWORD,
  redisOptions: {
    // 세션 특화 설정
    connectionName: 'session-cluster',
    // 세션은 읽기가 많으므로 슬레이브 우선
    // preferredSlaves: [{ ip: '127.0.0.1', port: 7003, prio: 1 }]
  },
  clusterOptions: {
    // 세션은 안정성이 중요
    maxRedirections: 16,
    retryDelayOnFailover: 100,
    retryDelayOnClusterDown: 300,
    slotsRefreshTimeout: 2000,
    slotsRefreshInterval: 5000
  }
};

// 세션 클러스터 인스턴스 생성
const sessionCluster = new BaseRedisCluster('SessionCluster', sessionNodes, sessionOptions);

// 세션 전용 클라이언트 생성
const redisSessionClient = sessionCluster.createClient();

// 세션 전용 추가 메서드
redisSessionClient.getHashTag = (userId) => {
  return `{user:${userId}}`;
};

// 패턴 검색 (클러스터 전체)
redisSessionClient.keys = async (pattern) => {
  if (!sessionCluster.cluster) await sessionCluster.connect();
  
  if (sessionCluster.useMock) {
    const keys = [];
    for (const key of sessionCluster.cluster.store.keys()) {
      if (key.match(new RegExp(pattern.replace('*', '.*')))) {
        keys.push(key);
      }
    }
    return keys;
  }
  
  const nodes = sessionCluster.cluster.nodes('master');
  const allKeys = [];
  
  for (const node of nodes) {
    try {
      const keys = await node.keys(pattern);
      allKeys.push(...keys);
    } catch (error) {
      console.error('Failed to get keys from node:', error);
    }
  }
  
  return [...new Set(allKeys)]; // 중복 제거
};

// 자동 연결 시도
sessionCluster.connect().catch(err => {
  console.error('Failed to initialize session cluster:', err);
});

module.exports = redisSessionClient;