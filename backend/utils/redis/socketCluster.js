// utils/redis/socketCluster.js
const { createClient } = require('redis');

// 환경변수에서 Redis 클러스터 구성 읽기
const buildClusterNodes = () => {
  const nodes = [];
  
  // Master 노드들 추가
  if (process.env.REDIS_1_HOST && process.env.REDIS_1_HOST_PORT) {
    nodes.push({ 
      host: process.env.REDIS_1_HOST, 
      port: parseInt(process.env.REDIS_1_HOST_PORT) 
    });
  }
  if (process.env.REDIS_2_HOST && process.env.REDIS_2_HOST_PORT) {
    nodes.push({ 
      host: process.env.REDIS_2_HOST, 
      port: parseInt(process.env.REDIS_2_HOST_PORT) 
    });
  }
  if (process.env.REDIS_3_HOST && process.env.REDIS_3_HOST_PORT) {
    nodes.push({ 
      host: process.env.REDIS_3_HOST, 
      port: parseInt(process.env.REDIS_3_HOST_PORT) 
    });
  }
  if (process.env.REDIS_4_HOST && process.env.REDIS_4_HOST_PORT) {
    nodes.push({ 
      host: process.env.REDIS_4_HOST, 
      port: parseInt(process.env.REDIS_4_HOST_PORT) 
    });
  }

  // Replica 노드들 추가
  if (process.env.REDIS_1_REPLICA && process.env.REDIS_1_REPLICA_PORT) {
    nodes.push({ 
      host: process.env.REDIS_1_REPLICA, 
      port: parseInt(process.env.REDIS_1_REPLICA_PORT) 
    });
  }
  if (process.env.REDIS_2_REPLICA && process.env.REDIS_2_REPLICA_PORT) {
    nodes.push({ 
      host: process.env.REDIS_2_REPLICA, 
      port: parseInt(process.env.REDIS_2_REPLICA_PORT) 
    });
  }
  if (process.env.REDIS_3_REPLICA && process.env.REDIS_3_REPLICA_PORT) {
    nodes.push({ 
      host: process.env.REDIS_3_REPLICA, 
      port: parseInt(process.env.REDIS_3_REPLICA_PORT) 
    });
  }
  if (process.env.REDIS_4_REPLICA && process.env.REDIS_4_REPLICA_PORT) {
    nodes.push({ 
      host: process.env.REDIS_4_REPLICA, 
      port: parseInt(process.env.REDIS_4_REPLICA_PORT) 
    });
  }

  return nodes;
};

const clusterNodes = buildClusterNodes();

if (clusterNodes.length === 0) {
  throw new Error('No Redis cluster nodes configured. Check environment variables.');
}

console.log('Socket Redis Cluster Nodes:', clusterNodes.map(node => `${node.host}:${node.port}`));

// 첫 번째 노드를 사용하여 단일 연결 생성 (Socket.IO Adapter용)
const firstNode = clusterNodes[0];

const socketStateClient = createClient({
  socket: {
    host: firstNode.host,
    port: firstNode.port,
  },
  password: process.env.REDIS_PASSWORD,
});

socketStateClient.on('error', (err) => {
  console.error('Socket Redis Cluster Error:', err);
});

socketStateClient.on('connect', () => {
  console.log(`Socket state Redis connected to ${firstNode.host}:${firstNode.port}`);
  console.log('Available cluster nodes:', clusterNodes.length);
});

socketStateClient.on('reconnecting', () => {
  console.log('Socket Redis cluster reconnecting...');
});

socketStateClient.on('ready', () => {
  console.log('Socket Redis cluster ready for operations');
});

module.exports = socketStateClient;
