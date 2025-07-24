const Message = require('../models/Message');
const Room = require('../models/Room');
const File = require('../models/File');

const messageController = {
  // 채팅방의 메시지 목록 조회
  async loadMessages(req, res) {
    try {
      const { roomId } = req.params;
      const { page = 1, limit = 10 } = req.query;
      const skip = (page - 1) * limit;

      // 채팅방 접근 권한 확인
      const room = await Room.findOne({
        _id: roomId,
        participants: req.user.id
      });

      if (!room) {
        return res.status(403).json({
          success: false,
          message: '채팅방에 접근할 권한이 없습니다.'
        })
        .lean();
      }

      // 메시지 조회
      const messages = await Message.find({
        room: roomId,
        isDeleted: false
      })
      .populate({path: 'sender', select: 'username profileImage', options: {lean: true}})
      .populate({path: 'file', select: 'filename originalname mimetype size', options: { lean: true }})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

      // 시간순으로 정렬 (클라이언트 표시용)
      messages.reverse();

      res.json({
        success: true,
        messages: messages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          hasMore: messages.length === parseInt(limit)
        }
      });

    } catch (error) {
      console.error('Load messages error:', error);
      res.status(500).json({
        success: false,
        message: '메시지 조회 중 오류가 발생했습니다.'
      });
    }
  }
};

module.exports = messageController;