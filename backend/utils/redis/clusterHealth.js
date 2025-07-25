// utils/redis/clusterHealth.js
const socketStateClient = require('./socketCluster');

// 클러스터 상태 확인
const checkClusterHealth = async () => {
  try {
    if (!socketStateClient.isOpen) {
      await socketStateClient.connect();
    }
    
    // 각 노드별 상태 확인
    const clusterNodes = [
      `${process.env.REDIS_1_HOST}:${process.env.REDIS_1_HOST_PORT}`,
      `${process.env.REDIS_2_HOST}:${process.env.REDIS_2_HOST_PORT}`,
      `${process.env.REDIS_3_HOST}:${process.env.REDIS_3_HOST_PORT}`,
      `${process.env.REDIS_4_HOST}:${process.env.REDIS_4_HOST_PORT}`,
      `${process.env.REDIS_1_REPLICA}:${process.env.REDIS_1_REPLICA_PORT}`,
      `${process.env.REDIS_2_REPLICA}:${process.env.REDIS_2_REPLICA_PORT}`,
      `${process.env.REDIS_3_REPLICA}:${process.env.REDIS_3_REPLICA_PORT}`,
      `${process.env.REDIS_4_REPLICA}:${process.env.REDIS_4_REPLICA_PORT}`
    ];

    console.log('Cluster Health Check:');
    console.log('Available nodes:', clusterNodes);
    
    // 간단한 테스트 명령
    await socketStateClient.set('health_check', 'ok');
    const result = await socketStateClient.get('health_check');
    await socketStateClient.del('health_check');
    
    if (result === 'ok') {
      console.log('✅ Redis cluster is healthy');
      return true;
    } else {
      console.log('❌ Redis cluster health check failed');
      return false;
    }
  } catch (error) {
    console.error('❌ Redis cluster health check error:', error.message);
    return false;
  }
};

module.exports = { checkClusterHealth };
