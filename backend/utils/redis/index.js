// backend/utils/redis/index.js
// Redis 클라이언트들을 중앙에서 관리

const redisClient = require('./redisClient'); // 기존 단일 Redis (범용)
const redisSessionCluster = require('./redisSessionCluster'); // 세션 전용 클러스터
const redisChatCluster = require('./redisChatCluster'); // 채팅 전용 클러스터

module.exports = {
  // 기본 Redis (기존 코드 호환성)
  default: redisClient,
  
  // 용도별 클라이언트
  session: redisSessionCluster,
  chat: redisChatCluster,
  
  // 헬스 체크
  async checkHealth() {
    const results = {
      default: false,
      session: false,
      chat: false
    };

    try {
      // 기본 Redis 체크
      const defaultPing = await redisClient.ping();
      results.default = defaultPing === 'PONG';
    } catch (error) {
      console.error('Default Redis health check failed:', error);
    }

    try {
      // 세션 클러스터 체크
      const sessionPing = await redisSessionCluster.ping();
      results.session = sessionPing === 'PONG';
    } catch (error) {
      console.error('Session cluster health check failed:', error);
    }

    try {
      // 채팅 클러스터 체크
      const chatPing = await redisChatCluster.ping();
      results.chat = chatPing === 'PONG';
    } catch (error) {
      console.error('Chat cluster health check failed:', error);
    }

    return results;
  }
};