// backend/services/chatWorker.js
const amqp = require('amqplib');
const mongoose = require('mongoose');
const redisClient = require('../utils/redisClient');
const Message = require('../models/Message');
const { getSocketIO } = require('../sockets/chat');

require('dotenv').config();

async function startWorker() {
  await mongoose.connect(process.env.MONGO_URI);
  const conn = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
  const channel = await conn.createChannel();
  await channel.assertQueue('chat-messages', { durable: true });

  channel.consume('chat-messages', async (msg) => {
    if (msg !== null) {
      const messageData = JSON.parse(msg.content.toString());
      try {
        // 1. DB 저장
        const message = await Message.create(messageData);
        // 2. Redis 캐싱 (최근 100개 유지)
        const redisKey = `chat:room:${message.room}:messages`;
        await redisClient.lPush(redisKey, JSON.stringify(message));
        await redisClient.lTrim(redisKey, 0, 99);
        // 3. Socket.IO 브로드캐스트
        const io = getSocketIO();
        io.to(message.room).emit('message', message);
        channel.ack(msg);
      } catch (err) {
        console.error('[chatWorker] 메시지 처리 오류:', err);
        channel.nack(msg, false, false); // 실패한 메시지는 버림
      }
    }
  });
  console.log('[chatWorker] 메시지 워커가 시작되었습니다.');
}

startWorker().catch(err => {
  console.error('[chatWorker] 워커 시작 실패:', err);
  process.exit(1);
}); 