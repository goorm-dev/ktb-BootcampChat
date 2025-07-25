// backend/config/keys.js
require('dotenv').config();

module.exports = {
  mongoURI: process.env.MONGO_URI || 'mongodb://localhost:27017/kakaotech',
  jwtSecret: process.env.JWT_SECRET || 'fallback_jwt_secret_for_development',
  port: process.env.PORT || 8080,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Redis 설정 (선택사항)
  redisHost: process.env.REDIS_HOST,
  redisPassword: process.env.REDIS_PASSWORD,
  redisPort: process.env.REDIS_PORT,
  
  // OpenAI API (RAG 기능용)
  openaiApiKey: process.env.OPENAI_API_KEY,
  
  // 부하테스트 관련 설정
  enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING === 'true',
  dbConnectionPoolSize: parseInt(process.env.DB_CONNECTION_POOL_SIZE) || 10,
  
  // Pinecone 설정 (벡터 DB)
  pineconeKey: process.env.PINECONE_API_KEY,
  pineconeEnv: process.env.PINECONE_ENV,
  pineconeIndex: process.env.PINECONE_INDEX,
  pineconeIndex2: process.env.PINECONE_INDEX2,
};