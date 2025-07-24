// routes/admin.js
const express = require('express');
const router = express.Router();

router.get('/redis-health', async (req, res) => {
  console.log("레디스 헬스체크 요청");
    const redis = require('../../utils/redis/redisSessionCluster');
    const health = await redis.checkHealth(); // 내부에서 ping 등 수행
    res.json(health);
  });

  module.exports = router;