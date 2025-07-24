const { nanoid } = require('nanoid');
const express = require('express');
const router = express.Router();
const redis = require('../../utils/redisClient');
const auth = require('../../middleware/auth');
const User = require('../../models/User');
const { rateLimit } = require('express-rate-limit');
let io;

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: {
    success: false,
    error: {
      message: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.',
      code: 'TOO_MANY_REQUESTS'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Socket.IO 초기화 함수
const initializeSocket = (socketIO) => { io = socketIO; };

// 서버 상태 확인 (MongoDB 의존 제거, Redis 응답 확인)
router.get('/health', async (req, res) => {
  try {
    // Redis PING으로 연결 체크
    let redisOk = false;
    let latency = null;
    try {
      const start = Date.now();
      await redis.set('healthcheck', 'ok', { ttl: 2 }); // 임시 값 기록
      redisOk = true;
      latency = Date.now() - start;
    } catch (e) {
      redisOk = false;
    }

    // 최근 roomId로부터 createdAt 찾기
    const roomIds = await redis.sMembers('rooms');
    let lastActivity = null;
    if (roomIds.length > 0) {
      // 가장 최근 roomId의 createdAt
      let latest = 0;
      for (const id of roomIds) {
        const room = await redis.hGetAll(`room:${id}`);
        if (room && Number(room.createdAt) > latest) {
          latest = Number(room.createdAt);
        }
      }
      lastActivity = latest ? new Date(latest) : null;
    }

    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.status(redisOk ? 200 : 503).json({
      success: redisOk,
      timestamp: new Date().toISOString(),
      services: {
        redis: {
          connected: redisOk,
          latency
        }
      },
      lastActivity
    });

  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      success: false,
      error: {
        message: '서비스 상태 확인에 실패했습니다.',
        code: 'HEALTH_CHECK_FAILED'
      }
    });
  }
});

// 채팅방 목록 조회 (페이징, Redis로 대체)
router.get('/', [limiter, auth], async (req, res) => {
  try {
    const page = Math.max(0, parseInt(req.query.page) || 0);
    const pageSize = Math.min(Math.max(1, parseInt(req.query.pageSize) || 10), 50);
    const skip = page * pageSize;

    // 소트 필드 및 필터링 옵션 (createdAt만 지원, 확장 가능)
    const sortField = req.query.sortField === 'createdAt' ? 'createdAt' : 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';

    const roomIds = await redis.sMembers('rooms');
    let rooms = [];
    for (const id of roomIds) {
      const room = await redis.hGetAll(`room:${id}`);
      if (room) {
        rooms.push({
          ...room,
          _id: id,
          participants: Array.isArray(room.participants) ? room.participants : JSON.parse(room.participants || '[]'),
          createdAt: room.createdAt ? new Date(Number(room.createdAt)) : new Date()
        });
      }
    }

    // 검색 필터 적용 (이름)
    if (req.query.search) {
      rooms = rooms.filter(r => r.name?.toLowerCase().includes(req.query.search.toLowerCase()));
    }

    // 정렬
    rooms.sort((a, b) => {
      if (sortOrder === 'asc') {
        return (a[sortField] || 0) - (b[sortField] || 0);
      } else {
        return (b[sortField] || 0) - (a[sortField] || 0);
      }
    });

    // 페이징
    const totalCount = rooms.length;
    const pagedRooms = rooms.slice(skip, skip + pageSize);

    // creator/participant 정보 User DB에서 가져오기
    const allUserIds = [
      ...new Set([
        ...pagedRooms.map(r => r.creator),
        ...pagedRooms.flatMap(r => r.participants)
      ])
    ];
    const userMap = {};
    if (allUserIds.length > 0) {
      const users = await Promise.all(
          allUserIds.map(id => redis.hGetAll(`user:${id}`))
      );
        allUserIds.forEach((id, idx) => {
        const u = users[idx];
        if (u && Object.keys(u).length > 0) {
          userMap[id] = u;
        }
      });
    }

    // 안전한 응답 데이터 구성
    const safeRooms = pagedRooms.map(room => {
      const creator = userMap[room.creator] || { _id: 'unknown', name: '알 수 없음', email: '' };
      const participants = Array.isArray(room.participants)
          ? room.participants.map(pid => userMap[pid] || { _id: pid, name: '알 수 없음', email: '' })
          : [];
      return {
        _id: room._id,
        name: room.name || '제목 없음',
        hasPassword: !!room.password,
        creator: {
          _id: creator._id,
          name: creator.name,
          email: creator.email
        },
        participants,
        participantsCount: participants.length,
        createdAt: room.createdAt,
        isCreator: creator._id === req.user.id
      };
    });

    const totalPages = Math.ceil(totalCount / pageSize);
    const hasMore = skip + pagedRooms.length < totalCount;

    res.set({
      'Cache-Control': 'private, max-age=10',
      'Last-Modified': new Date().toUTCString()
    });

    res.json({
      success: true,
      data: safeRooms,
      metadata: {
        total: totalCount,
        page,
        pageSize,
        totalPages,
        hasMore,
        currentCount: safeRooms.length,
        sort: {
          field: sortField,
          order: sortOrder
        }
      }
    });

  } catch (error) {
    console.error('방 목록 조회 에러:', error);
    res.status(500).json({
      success: false,
      error: {
        message: '채팅방 목록을 불러오는데 실패했습니다.',
        code: 'ROOMS_FETCH_ERROR',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
});

// 채팅방 생성
router.post('/', auth, async (req, res) => {
  try {
    const { name, password } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: '방 이름은 필수입니다.' });
    }
    const roomId = nanoid();
    const creatorId = req.user.id;
    const participants = [creatorId];

    // Redis에 방 정보 저장
    await redis.hSet(`room:${roomId}`, {
      name: name.trim(),
      creator: creatorId,
      participants: JSON.stringify(participants),
      password: password || '',
      createdAt: Date.now()
    });
    await redis.sAdd('rooms', roomId);

    const creator = await redis.hGetAll(`user:${creatorId}`);
    const participantUsers = await Promise.all(
        participants.map(id => redis.hGetAll(`user:${id}`))
    );

    if (io) {
      io.to('room-list').emit('roomCreated', {
        _id: roomId,
        name: name.trim(),
        creator: {
          _id: creator._id,
          name: creator.name,
          email: creator.email
        },
        participants: participantUsers.map(u => ({
          _id: u._id,
          name: u.name,
          email: u.email
        })),
        createdAt: Date.now(),
        password: undefined
      });
    }

    res.status(201).json({
      success: true,
      data: {
        _id: roomId,
        name: name.trim(),
        creator: {
          _id: creator._id,
          name: creator.name,
          email: creator.email
        },
        participants: participantUsers.map(u => ({
          _id: u._id,
          name: u.name,
          email: u.email
        })),
        createdAt: Date.now(),
        password: undefined
      }
    });
  } catch (error) {
    console.error('방 생성 에러:', error);
    res.status(500).json({
      success: false,
      message: '서버 에러가 발생했습니다.',
      error: error.message
    });
  }
});

// 특정 채팅방 조회 (Redis에서)
router.get('/:roomId', auth, async (req, res) => {
  try {
    const room = await redis.hGetAll(`room:${req.params.roomId}`);
    if (!room || Object.keys(room).length === 0) {
      return res.status(404).json({ success: false, message: '채팅방을 찾을 수 없습니다.' });
    }

    // 2. 참가자/생성자 정보 Redis에서 조회
    const creator = await redis.hGetAll(`user:${room.creator}`);

    const participantKeys = Array.isArray(room.participants)
        ? room.participants
        : JSON.parse(room.participants || '[]');

    const participants = await Promise.all(
        participantKeys.map(id => redis.hGetAll(`user:${id}`))
    );

    res.json({
      success: true,
      data: {
        _id: req.params.roomId,
        name: room.name,
        creator: {
          _id: creator._id,
          name: creator.name,
          email: creator.email
        },
        participants: participants
            .filter(u => u && Object.keys(u).length > 0)
            .map(u => ({
                _id: u._id,
              email: u.email,
              name: u.name
            })),
        createdAt: room.createdAt ? new Date(Number(room.createdAt)) : undefined,
        hasPassword: !!room.password,
        password: undefined
      }
    });
  } catch (error) {
    console.error('Room fetch error:', error);
    res.status(500).json({
      success: false,
      message: '채팅방 정보를 불러오는데 실패했습니다.'
    });
  }
});

// 채팅방 입장 (Redis 기반으로 변경)
router.post('/:roomId/join', auth, async (req, res) => {
  try {
    const { password } = req.body;
    const room = await redis.hGetAll(`room:${req.params.roomId}`);
    if (!room || Object.keys(room).length === 0) {
      return res.status(404).json({ success: false, message: '채팅방을 찾을 수 없습니다.' });
    }

    // 비밀번호 확인
    if (room.hasPassword) {
      const isPasswordValid = await room.checkPassword(password);
      if (!isPasswordValid) {
        return res.status(403).json({
          success: false,
          message: '비밀번호가 일치하지 않습니다.'
        });
      }

    }
    let participantIds = Array.isArray(room.participants)
        ? room.participants
        : JSON.parse(room.participants || '[]');
    if (!participantIds.includes(req.user.id)) {
      participantIds.push(req.user.id);
      await redis.hSet(`room:${req.params.roomId}`, {
        participants: JSON.stringify(participantIds)
      });
    }

    const creator = await redis.hGetAll(`user:${room.creator}`);

    const participants = await Promise.all(
        participantIds.map(id => redis.hGetAll(`user:${id}`))
    );

    if (io) {
      io.to(req.params.roomId).emit('roomUpdate', {
        _id: req.params.roomId,
        name: room.name,
        creator: {
          _id: creator._id,
          name: creator.name,
          email: creator.email
        },
        participants: participants
            .filter(u => u && Object.keys(u).length > 0)
            .map(u => ({
                _id: u._id,
              name: u.name,
              email: u.email
            })),
        createdAt: room.createdAt ? new Date(Number(room.createdAt)) : undefined,
        hasPassword: !!room.password,
        password: undefined
      });
    }

    res.json({
      success: true,
      data: {
        _id: req.params.roomId,
        name: room.name,
        creator: {
          _id: creator._id,
          name: creator.name,
          email: creator.email
        },
        participants: participants
            .filter(u => u && Object.keys(u).length > 0)
            .map(u => ({
              id: u.userId || u.email,
              name: u.name,
              email: u.email
            })),
        createdAt: room.createdAt ? new Date(Number(room.createdAt)) : undefined,
        hasPassword: !!room.password,
        password: undefined
      }
    });
  } catch (error) {
    console.error('방 입장 에러:', error);
    res.status(500).json({
      success: false,
      message: '서버 에러가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = {
  router,
  initializeSocket
};
