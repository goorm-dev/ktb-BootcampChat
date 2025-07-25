// utils/startup.js
const { checkClusterHealth } = require('./redis/clusterHealth');

const validateEnvironment = () => {
  const requiredEnvs = [
    'REDIS_1_HOST', 'REDIS_1_HOST_PORT',
    'REDIS_2_HOST', 'REDIS_2_HOST_PORT', 
    'REDIS_3_HOST', 'REDIS_3_HOST_PORT',
    'REDIS_4_HOST', 'REDIS_4_HOST_PORT',
    'REDIS_1_REPLICA', 'REDIS_1_REPLICA_PORT',
    'REDIS_2_REPLICA', 'REDIS_2_REPLICA_PORT',
    'REDIS_3_REPLICA', 'REDIS_3_REPLICA_PORT',
    'REDIS_4_REPLICA', 'REDIS_4_REPLICA_PORT'
  ];

  const missing = requiredEnvs.filter(env => !process.env[env]);
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing);
    process.exit(1);
  }

  console.log('✅ All Redis cluster environment variables are set');
};

const startupChecks = async () => {
  console.log('Starting server initialization...');
  
  // 환경변수 검증
  validateEnvironment();
  
  // Redis 클러스터 상태 확인
  const isHealthy = await checkClusterHealth();
  if (!isHealthy) {
    console.warn('⚠️  Redis cluster health check failed, but continuing startup...');
  }
  
  console.log('✅ Startup checks completed');
};

module.exports = { startupChecks };
