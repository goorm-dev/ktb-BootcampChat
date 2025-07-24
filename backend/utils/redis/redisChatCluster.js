// backend/utils/redis/redisChatCluster.js
const BaseRedisCluster = require('./baseCluster');

// 채팅 클러스터 노드 설정
const chatNodes = [
  {
    port: process.env.REDIS_CHAT_PORT_1 || 7006,
    host: process.env.REDIS_CHAT_HOST_1 || '127.0.0.1'
  },
  {
    port: process.env.REDIS_CHAT_PORT_2 || 7004,
    host: process.env.REDIS_CHAT_HOST_2 || '127.0.0.1'
  },
  {
    port: process.env.REDIS_CHAT_PORT_3 || 7005,
    host: process.env.REDIS_CHAT_HOST_3 || '127.0.0.1'
  }
].filter(node => node.host && node.port);

// 채팅 클러스터 옵션
const chatOptions = {
  password: process.env.REDIS_CHAT_PASSWORD,
  redisOptions: {
    // 채팅 특화 설정
    connectionName: 'chat-cluster',
    // 채팅은 쓰기가 많으므로 마스터 우선
    enableAutoPipelining: true,
    autoPipeliningIgnoredCommands: ['info', 'ping', 'flushall']
  },
  clusterOptions: {
    // 채팅은 성능이 중요
    enableOfflineQueue: false,
    lazyConnect: false
  }
};

// 채팅 클러스터 인스턴스 생성
const chatCluster = new BaseRedisCluster('ChatCluster', chatNodes, chatOptions);

// 채팅 전용 클라이언트 생성
const redisChatClient = chatCluster.createClient();

// 채팅 전용 추가 메서드들
// Sorted Set 메서드들
redisChatClient.zadd = async (key, score, member) => {
  if (!chatCluster.cluster) await chatCluster.connect();
  return chatCluster.cluster.zadd(key, score, member);
};

redisChatClient.zrange = async (key, start, stop, ...args) => {
  if (!chatCluster.cluster) await chatCluster.connect();
  return chatCluster.cluster.zrange(key, start, stop, ...args);
};

redisChatClient.zrem = async (key, member) => {
  if (!chatCluster.cluster) await chatCluster.connect();
  return chatCluster.cluster.zrem(key, member);
};

redisChatClient.zremrangebyrank = async (key, start, stop) => {
  if (!chatCluster.cluster) await chatCluster.connect();
  return chatCluster.cluster.zremrangebyrank(key, start, stop);
};

// Set 메서드들
redisChatClient.sadd = async (key, ...members) => {
  if (!chatCluster.cluster) await chatCluster.connect();
  return chatCluster.cluster.sadd(key, ...members);
};

redisChatClient.srem = async (key, ...members) => {
  if (!chatCluster.cluster) await chatCluster.connect();
  return chatCluster.cluster.srem(key, ...members);
};

redisChatClient.smembers = async (key) => {
  if (!chatCluster.cluster) await chatCluster.connect();
  return chatCluster.cluster.smembers(key);
};

// 자동 연결 시도
chatCluster.connect().catch(err => {
  console.error('Failed to initialize chat cluster:', err);
});

module.exports = redisChatClient;