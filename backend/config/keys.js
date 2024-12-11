// backend/config/keys.js
require('dotenv').config();

module.exports = {
  mongoURI: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  redisHost: process.env.REDIS_HOST,
  redisPort: process.env.REDIS_PORT,
  openaiApiKey: process.env.OPENAI_API_KEY,
  vectorDbEndpoint: process.env.VECTOR_DB_ENDPOINT,
};