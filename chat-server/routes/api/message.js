const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const auth = require('../middleware/auth');

// 채팅방의 메시지 목록 조회
router.get('/rooms/:roomId/messages', auth, messageController.loadMessages);

module.exports = router;