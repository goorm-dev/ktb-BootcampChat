const Message = require('../models/Message');
const Room = require('../models/Room');
const User = require('../models/User');
const File = require('../models/File');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/keys');
const redis = require('../utils/redisClient');
const SessionService = require('../services/sessionService');
const aiService = require('../services/aiService').default;
const amqp = require('amqplib');
let mqChannel = null;
async function getMQChannel() {
  if (!mqChannel) {
    const conn = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    mqChannel = await conn.createChannel();
    await mqChannel.assertQueue('chat-messages', { durable: true });
  }
  return mqChannel;
}

let ioInstance = null;

function setSocketIO(io) {
  ioInstance = io;
  const connectedUsers = new Map();
  const streamingSessions = new Map();
  const userRooms = new Map();
  const messageQueues = new Map();
  const messageLoadRetries = new Map();
  const BATCH_SIZE = 30;  // 한 번에 로드할 메시지 수
  const LOAD_DELAY = 300; // 메시지 로드 딜레이 (ms)
  const MAX_RETRIES = 3;  // 최대 재시도 횟수
  const MESSAGE_LOAD_TIMEOUT = 10000; // 메시지 로드 타임아웃 (10초)
  const RETRY_DELAY = 2000; // 재시도 간격 (2초)
  const DUPLICATE_LOGIN_TIMEOUT = 10000; // 중복 로그인 타임아웃 (10초)

  // 로깅 유틸리티 함수
  const logDebug = (action, data) => {
    console.debug(`[Socket.IO] ${action}:`, {
      ...data,
      timestamp: new Date().toISOString()
    });
  };

  // 메시지 일괄 로드 함수 개선
  const loadMessages = async (socket, roomId, before, limit = BATCH_SIZE) => {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Message loading timed out'));
      }, MESSAGE_LOAD_TIMEOUT);
    });

    try {
      // 쿼리 구성
      const query = { room: roomId };
      if (before) {
        query.timestamp = { $lt: new Date(before) };
      }

      // 메시지 로드 with profileImage
      const messages = await Promise.race([
        Message.find(query)
          .populate('sender', 'name email profileImage')
          .populate({
            path: 'file',
            select: 'filename originalname mimetype size'
          })
          .sort({ timestamp: -1 })
          .limit(limit + 1)
          .lean(),
        timeoutPromise
      ]);

      // 결과 처리
      const hasMore = messages.length > limit;
      const resultMessages = messages.slice(0, limit);
      const sortedMessages = resultMessages.sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      );

      // 읽음 상태 비동기 업데이트
      if (sortedMessages.length > 0 && socket.user) {
        const messageIds = sortedMessages.map(msg => msg._id);
        Message.updateMany(
          {
            _id: { $in: messageIds },
            'readers.userId': { $ne: socket.user.id }
          },
          {
            $push: {
              readers: {
                userId: socket.user.id,
                readAt: new Date()
              }
            }
          }
        ).exec().catch(error => {
          console.error('Read status update error:', error);
        });
      }

      return {
        messages: sortedMessages,
        hasMore,
        oldestTimestamp: sortedMessages[0]?.timestamp || null
      };
    } catch (error) {
      if (error.message === 'Message loading timed out') {
        logDebug('message load timeout', {
          roomId,
          before,
          limit
        });
      } else {
        console.error('Load messages error:', {
          error: error.message,
          stack: error.stack,
          roomId,
          before,
          limit
        });
      }
      throw error;
    }
  };

  // 재시도 로직을 포함한 메시지 로드 함수
  const loadMessagesWithRetry = async (socket, roomId, before, retryCount = 0) => {
    const retryKey = `${roomId}:${socket.user.id}`;
    
    try {
      if (messageLoadRetries.get(retryKey) >= MAX_RETRIES) {
        throw new Error('최대 재시도 횟수를 초과했습니다.');
      }

      const result = await loadMessages(socket, roomId, before);
      messageLoadRetries.delete(retryKey);
      return result;

    } catch (error) {
      const currentRetries = messageLoadRetries.get(retryKey) || 0;
      
      if (currentRetries < MAX_RETRIES) {
        messageLoadRetries.set(retryKey, currentRetries + 1);
        const delay = Math.min(RETRY_DELAY * Math.pow(2, currentRetries), 10000);
        
        logDebug('retrying message load', {
          roomId,
          retryCount: currentRetries + 1,
          delay
        });

        await new Promise(resolve => setTimeout(resolve, delay));
        return loadMessagesWithRetry(socket, roomId, before, currentRetries + 1);
      }

      messageLoadRetries.delete(retryKey);
      throw error;
    }
  };

  // 중복 로그인 처리 함수
  const handleDuplicateLogin = async (existingSocket, newSocket) => {
    try {
      // 기존 연결에 중복 로그인 알림
      existingSocket.emit('duplicate_login', {
        type: 'new_login_attempt',
        deviceInfo: newSocket.handshake.headers['user-agent'],
        ipAddress: newSocket.handshake.address,
        timestamp: Date.now()
      });

      // 타임아웃 설정
      return new Promise((resolve) => {
        setTimeout(async () => {
          try {
            // 기존 세션 종료
            existingSocket.emit('session_ended', {
              reason: 'duplicate_login',
              message: '다른 기기에서 로그인하여 현재 세션이 종료되었습니다.'
            });

            // 기존 연결 종료
            existingSocket.disconnect(true);
            resolve();
          } catch (error) {
            console.error('Error during session termination:', error);
            resolve();
          }
        }, DUPLICATE_LOGIN_TIMEOUT);
      });
    } catch (error) {
      console.error('Duplicate login handling error:', error);
      throw error;
    }
  };

  // 미들웨어: 소켓 연결 시 인증 처리
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      const sessionId = socket.handshake.auth.sessionId;

      if (!token || !sessionId) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, jwtSecret);
      if (!decoded?.user?.id) {
        return next(new Error('Invalid token'));
      }

      // 이미 연결된 사용자인지 확인
      const existingSocketId = connectedUsers.get(decoded.user.id);
      if (existingSocketId) {
        const existingSocket = io.sockets.sockets.get(existingSocketId);
        if (existingSocket) {
          // 중복 로그인 처리
          await handleDuplicateLogin(existingSocket, socket);
        }
      }

      const validationResult = await SessionService.validateSession(decoded.user.id, sessionId);
      if (!validationResult.isValid) {
        console.error('Session validation failed:', validationResult);
        return next(new Error(validationResult.message || 'Invalid session'));
      }

      const user = await redis.hGetAll(`user:${decoded.user.email}`)
      if (!user || Object.keys(user).length === 0) {
        return next(new Error('User not found'));
      }

      socket.user = {
        id: user.id.toString(),
        name: user.name,
        email: user.email,
        sessionId: sessionId,
        profileImage: user.profileImage
      };

      await SessionService.updateLastActivity(decoded.user.id);
      next();

    } catch (error) {
      console.error('Socket authentication error:', error);
      
      if (error.name === 'TokenExpiredError') {
        return next(new Error('Token expired'));
      }
      
      if (error.name === 'JsonWebTokenError') {
        return next(new Error('Invalid token'));
      }
      
      next(new Error('Authentication failed'));
    }
  });
  
  io.on('connection', (socket) => {
    logDebug('socket connected', {
      socketId: socket.id,
      userId: socket.user?.id,
      userName: socket.user?.name
    });

    if (socket.user) {
      // 이전 연결이 있는지 확인
      const previousSocketId = connectedUsers.get(socket.user.id);
      if (previousSocketId && previousSocketId !== socket.id) {
        const previousSocket = io.sockets.sockets.get(previousSocketId);
        if (previousSocket) {
          // 이전 연결에 중복 로그인 알림
          previousSocket.emit('duplicate_login', {
            type: 'new_login_attempt',
            deviceInfo: socket.handshake.headers['user-agent'],
            ipAddress: socket.handshake.address,
            timestamp: Date.now()
          });

          // 이전 연결 종료 처리
          setTimeout(() => {
            previousSocket.emit('session_ended', {
              reason: 'duplicate_login',
              message: '다른 기기에서 로그인하여 현재 세션이 종료되었습니다.'
            });
            previousSocket.disconnect(true);
          }, DUPLICATE_LOGIN_TIMEOUT);
        }
      }
      
      // 새로운 연결 정보 저장
      connectedUsers.set(socket.user.id, socket.id);
    }

    // 이전 메시지 로딩 처리 개선
    socket.on('fetchPreviousMessages', async ({ roomId, before }) => {
      const queueKey = `${roomId}:${socket.user.id}`;

      try {
        if (!socket.user) {
          throw new Error('Unauthorized');
        }

        // [1] 권한 체크: 방 참가자인지 redis에서 검사
        const room = await redis.hGetAll(`room:${roomId}`);
        if (!room) {
          throw new Error('채팅방이 존재하지 않습니다.');
        }
        const participants = Array.isArray(room.participants)
            ? room.participants
            : JSON.parse(room.participants || '[]');
        if (!participants.includes(socket.user.id)) {
          throw new Error('채팅방 접근 권한이 없습니다.');
        }

        // [2] 중복 로딩 방지
        if (messageQueues.get(queueKey)) {
          logDebug('message load skipped - already loading', { roomId, userId: socket.user.id });
          return;
        }
        messageQueues.set(queueKey, true);
        socket.emit('messageLoadStart');

        // [3] 메시지 로딩 (before = timestamp, 없으면 최신부터)
        // 메시지 list: chat:messages:{roomId} ← ["{msgObj1}", "{msgObj2}", ...]
        // 역순(최신이 뒤)에 저장되어 있다고 가정

        // 페이지네이션 파라미터
        const PAGE_SIZE = 30;
        const messagesKey = `chat:messages:${roomId}`;

        // 모든 메시지 목록 가져오기 (리스트 길이)
        const totalMessages = await redis.lLen(messagesKey);

        let start, end;
        if (!before) {
          // 최신 메시지
          end = totalMessages - 1;
          start = Math.max(0, end - PAGE_SIZE + 1);
        } else {
          // before보다 이전의 메시지 slice
          // Redis에 메시지를 시간 역순으로 저장했다면 beforeTimestamp보다 작은 메시지 index 계산 필요
          // → 모든 메시지 fetch 후 필터링 or timestamp index를 따로 관리해야 효율적 (여기선 단순화)
          const allMessages = await redis.lRange(messagesKey, 0, totalMessages - 1);
          let idx = allMessages.findIndex(msgStr => {
            try {
              const msg = JSON.parse(msgStr);
              return msg && msg.timestamp === before;
            } catch {
              return false;
            }
          });
          if (idx === -1) idx = allMessages.length;
          end = idx - 1;
          start = Math.max(0, end - PAGE_SIZE + 1);
        }

        // 메시지 slice 로딩
        const messageStrings = await redis.lRange(messagesKey, start, end);
        const messages = messageStrings
            .map(s => {
              try { return JSON.parse(s); } catch { return null; }
            })
            .filter(m => m);

        // 정방향 정렬
        messages.sort((a, b) => a.timestamp - b.timestamp);

        const oldestTimestamp = messages.length > 0 ? messages[0].timestamp : null;
        const hasMore = start > 0;

        logDebug('previous messages loaded', {
          roomId,
          messageCount: messages.length,
          hasMore,
          oldestTimestamp
        });

        socket.emit('previousMessagesLoaded', {
          messages,
          hasMore,
          oldestTimestamp
        });

      } catch (error) {
        console.error('Fetch previous messages error:', error);
        socket.emit('error', {
          type: 'LOAD_ERROR',
          message: error.message || '이전 메시지를 불러오는 중 오류가 발생했습니다.'
        });
      } finally {
        setTimeout(() => {
          messageQueues.delete(queueKey);
        }, LOAD_DELAY);
      }
    });
    
    // 채팅방 입장 처리 개선
    socket.on('joinRoom', async (roomId) => {
      try {
        if (!socket.user) throw new Error('Unauthorized');

        // 1. 이미 해당 방에 참여 중인지 확인 (userRooms Map 사용)
        const currentRoom = userRooms.get(socket.user.id);
        if (currentRoom === roomId) {
          logDebug('already in room', { userId: socket.user.id, roomId });
          socket.emit('joinRoomSuccess', { roomId });
          return;
        }

        // 2. 기존 방에서 나가기
        if (currentRoom) {
          logDebug('leaving current room', { userId: socket.user.id, roomId: currentRoom });
          socket.leave(currentRoom);
          userRooms.delete(socket.user.id);

          socket.to(currentRoom).emit('userLeft', {
            userId: socket.user.id,
            name: socket.user.name
          });

          // Redis에서도 participants 업데이트
          let prevRoom = await redis.hGetAll(`room:${currentRoom}`);
          if (prevRoom && prevRoom.participants) {
            let prevList = JSON.parse(prevRoom.participants);
            prevList = prevList.filter(id => id !== socket.user.id);
            await redis.hSet(`room:${currentRoom}`, { participants: JSON.stringify(prevList) });
          }
        }

        // 3. Redis에서 방 정보와 참가자 업데이트
        const room = await redis.hGetAll(`room:${roomId}`);
        if (!room) throw new Error('채팅방을 찾을 수 없습니다.');

        let participants = Array.isArray(room.participants)
            ? room.participants
            : JSON.parse(room.participants || '[]');
        if (!participants.includes(socket.user.id)) {
          participants.push(socket.user.id);
          await redis.hSet(`room:${roomId}`, { participants: JSON.stringify(participants) });
        }

        socket.join(roomId);
        userRooms.set(socket.user.id, roomId);

        const participantArr = await Promise.all(
            participants.map(async pid => {
              const u = await redis.hGetAll(`user:${pid}`);
              return u && Object.keys(u).length > 0
                  ? { id: u.userId || pid, name: u.name, email: u.email, profileImage: u.profileImage || '' }
                  : { id: pid, name: '알 수 없음', email: '', profileImage: '' };
            })
        );

        // 5. 입장 메시지 Redis에 저장
        const joinMessage = {
          room: roomId,
          content: `${socket.user.name}님이 입장하였습니다.`,
          type: 'system',
          timestamp: Date.now()
        };
        await redis.rPush(`chat:messages:${roomId}`, JSON.stringify(joinMessage));

        // 6. 초기 메시지 로드 (이전 방식의 loadMessages를 Redis 기반으로 대체)
        const PAGE_SIZE = 30;
        const total = await redis.lLen(`chat:messages:${roomId}`);
        const start = Math.max(0, total - PAGE_SIZE);
        const end = total - 1;
        const msgStrs = await redis.lRange(`chat:messages:${roomId}`, start, end);
        const messages = msgStrs.map(s => {
          try { return JSON.parse(s); } catch { return null; }
        }).filter(Boolean);
        const oldestTimestamp = messages.length > 0 ? messages[0].timestamp : null;
        const hasMore = start > 0;

        // 7. 활성 스트리밍 메시지 (로직 동일)
        const activeStreams = Array.from(streamingSessions.values())
            .filter(session => session.room === roomId)
            .map(session => ({
              _id: session.messageId,
              type: 'ai',
              aiType: session.aiType,
              content: session.content,
              timestamp: session.timestamp,
              isStreaming: true
            }));

        // 8. 이벤트 발송
        socket.emit('joinRoomSuccess', {
          roomId,
          participants: participantArr,
          messages,
          hasMore,
          oldestTimestamp,
          activeStreams
        });

        io.to(roomId).emit('message', joinMessage);
        io.to(roomId).emit('participantsUpdate', participantArr);

        logDebug('user joined room', {
          userId: socket.user.id,
          roomId,
          messageCount: messages.length,
          hasMore
        });

      } catch (error) {
        console.error('Join room error:', error);
        socket.emit('joinRoomError', {
          message: error.message || '채팅방 입장에 실패했습니다.'
        });
      }
    });
    
    // 메시지 전송 처리
    socket.on('chatMessage', async (messageData) => {
      try {
        if (!socket.user) throw new Error('Unauthorized');
        if (!messageData) throw new Error('메시지 데이터가 없습니다.');

        const { room, type, content, fileData } = messageData;
        if (!room) throw new Error('채팅방 정보가 없습니다.');

        // 1. 채팅방 권한 체크 (Redis)
        const chatRoom = await redis.hGetAll(`room:${room}`);
        if (!chatRoom) throw new Error('채팅방이 존재하지 않습니다.');
        const participants = Array.isArray(chatRoom.participants)
            ? chatRoom.participants
            : JSON.parse(chatRoom.participants || '[]');
        if (!participants.includes(socket.user.id)) {
          throw new Error('채팅방 접근 권한이 없습니다.');
        }

        // 2. 세션 유효성 확인 (세션 서비스 유지)
        const sessionValidation = await SessionService.validateSession(
            socket.user.id,
            socket.user.sessionId
        );
        if (!sessionValidation.isValid) {
          throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.');
        }

        // 3. AI 멘션 추출
        const aiMentions = extractAIMentions(content);

        logDebug('message received', {
          type, room,
          userId: socket.user.id,
          hasFileData: !!fileData,
          hasAIMentions: aiMentions.length
        });

        // 4. 메시지 오브젝트 생성 및 저장
        let messageObj;
        switch (type) {
          case 'file': {
            if (!fileData || !fileData._id) {
              throw new Error('파일 데이터가 올바르지 않습니다.');
            }

            // 파일 정보: DB 사용시 유지, 파일 메타만 Redis 저장하려면 별도 처리
            let fileMeta = null;
            if (File && File.findOne) {
              const file = await File.findOne({
                _id: fileData._id,
                user: socket.user.id
              });
              if (!file) throw new Error('파일을 찾을 수 없거나 접근 권한이 없습니다.');
              fileMeta = {
                _id: file._id,
                filename: file.filename,
                originalname: file.originalname,
                mimetype: file.mimetype,
                size: file.size
              };
            } else {
              // File 모델이 없으면 fileMeta를 fileData에서 받아오기
              fileMeta = fileData;
            }

            messageObj = {
              room,
              sender: {
                _id: socket.user.id,
                name: socket.user.name,
                email: socket.user.email,
                profileImage: socket.user.profileImage
              },
              type: 'file',
              file: fileMeta,
              content: content || '',
              timestamp: Date.now(),
              reactions: {},
              metadata: fileMeta
            };
            break;
          }

          case 'text': {
            const messageContent = content?.trim() || messageData.msg?.trim();
            if (!messageContent) return;

            messageObj = {
              room,
              sender: {
                _id: socket.user.id,
                name: socket.user.name,
                email: socket.user.email,
                profileImage: socket.user.profileImage
              },
              content: messageContent,
              type: 'text',
              timestamp: Date.now(),
              reactions: {}
            };
            break;
          }

          default:
            throw new Error('지원하지 않는 메시지 타입입니다.');
        }

        // 5. 메시지 Redis에 저장 (append)
        await redis.rPush(`chat:messages:${room}`, JSON.stringify(messageObj));

        // 6. 메시지 브로드캐스트
        io.to(room).emit('message', messageObj);

        // 7. AI 멘션 응답 처리
        if (aiMentions.length > 0) {
          for (const ai of aiMentions) {
            const query = content.replace(new RegExp(`@${ai}\\b`, 'g'), '').trim();
            await handleAIResponse(io, room, ai, query);
          }
        }

        // 8. 세션 활동 갱신
        await SessionService.updateLastActivity(socket.user.id);

        logDebug('message processed', {
          type: messageObj.type,
          room
        });

      } catch (error) {
        console.error('Message handling error:', error);
        socket.emit('error', {
          code: error.code || 'MESSAGE_ERROR',
          message: error.message || '메시지 전송 중 오류가 발생했습니다.'
        });
      }
    });

    // 채팅방 퇴장 처리
    socket.on('leaveRoom', async (roomId) => {
      try {
        if (!socket.user) {
          throw new Error('Unauthorized');
        }

        // 실제로 해당 방에 참여 중인지 먼저 확인 (메모리 관리 userRooms)
        const currentRoom = userRooms?.get(socket.user.id);
        if (!currentRoom || currentRoom !== roomId) {
          console.log(`User ${socket.user.id} is not in room ${roomId}`);
          return;
        }

        // Redis에서 권한 및 참가자 확인
        const room = await redis.hGetAll(`room:${roomId}`);
        if (!room) {
          console.log(`Room ${roomId} not found`);
          return;
        }
        let participants = Array.isArray(room.participants)
            ? room.participants
            : JSON.parse(room.participants || '[]');

        if (!participants.includes(socket.user.id)) {
          console.log(`User ${socket.user.id} has no access to room ${roomId}`);
          return;
        }

        socket.leave(roomId);
        userRooms.delete(socket.user.id);

        // 퇴장 메시지 생성 및 Redis 저장
        const leaveMessage = {
          room: roomId,
          content: `${socket.user.name}님이 퇴장하였습니다.`,
          type: 'system',
          timestamp: Date.now()
        };
        await redis.rPush(`chat:messages:${roomId}`, JSON.stringify(leaveMessage));

        // 참가자 목록에서 유저 제거
        participants = participants.filter(id => id !== socket.user.id);
        await redis.hSet(`room:${roomId}`, { participants: JSON.stringify(participants) });

        const participantArr = await Promise.all(
            participants.map(async pid => {
              const u = await redis.hGetAll(`user:${pid}`);
              return u && Object.keys(u).length > 0
                  ? { id: u.userId || pid, name: u.name, email: u.email, profileImage: u.profileImage || '' }
                  : { id: pid, name: '알 수 없음', email: '', profileImage: '' };
            })
        );

        // 스트리밍 세션/메시지 큐 등 정리
        for (const [messageId, session] of streamingSessions.entries()) {
          if (session.room === roomId && session.userId === socket.user.id) {
            streamingSessions.delete(messageId);
          }
        }

        const queueKey = `${roomId}:${socket.user.id}`;
        messageQueues.delete(queueKey);
        messageLoadRetries.delete(queueKey);

        // 이벤트 발송
        io.to(roomId).emit('message', leaveMessage);
        io.to(roomId).emit('participantsUpdate', participantArr);

        console.log(`User ${socket.user.id} left room ${roomId} successfully`);

      } catch (error) {
        console.error('Leave room error:', error);
        socket.emit('error', {
          message: error.message || '채팅방 퇴장 중 오류가 발생했습니다.'
        });
      }
    });

    // 연결 해제 처리
    socket.on('disconnect', async (reason) => {
      if (!socket.user) return;

      try {
        // 해당 사용자의 현재 활성 연결인 경우에만 정리
        if (connectedUsers.get(socket.user.id) === socket.id) {
          connectedUsers.delete(socket.user.id);
        }

        // 메모리 상 room info/세션/큐 모두 정리
        const roomId = userRooms.get(socket.user.id);
        userRooms.delete(socket.user.id);

        // 메시지 큐 정리
        const userQueues = Array.from(messageQueues.keys())
            .filter(key => key.endsWith(`:${socket.user.id}`));
        userQueues.forEach(key => {
          messageQueues.delete(key);
          messageLoadRetries.delete(key);
        });

        // 스트리밍 세션 정리
        for (const [messageId, session] of streamingSessions.entries()) {
          if (session.userId === socket.user.id) {
            streamingSessions.delete(messageId);
          }
        }

        // 현재 방에서 자동 퇴장 처리 (MongoDB → Redis로 변경)
        if (roomId) {
          // 다른 디바이스로 인한 연결 종료가 아닌 경우에만 처리
          if (reason !== 'client namespace disconnect' && reason !== 'duplicate_login') {
            // 1. 참가자 목록에서 제거
            const room = await redis.hGetAll(`room:${roomId}`);
            if (room) {
              let participants = Array.isArray(room.participants)
                  ? room.participants
                  : JSON.parse(room.participants || '[]');
              participants = participants.filter(id => id !== socket.user.id);
              await redis.hSet(`room:${roomId}`, { participants: JSON.stringify(participants) });

              // 2. 퇴장 메시지 생성 및 Redis에 저장
              const leaveMessage = {
                room: roomId,
                content: `${socket.user.name}님이 연결이 끊어졌습니다.`,
                type: 'system',
                timestamp: Date.now()
              };
              await redis.rPush(`chat:messages:${roomId}`, JSON.stringify(leaveMessage));

              const participantArr = await Promise.all(
                  participants.map(async pid => {
                    const u = await redis.hGetAll(`user:${pid}`);
                    return u && Object.keys(u).length > 0
                        ? { id: u.userId || pid, name: u.name, email: u.email, profileImage: u.profileImage || '' }
                        : { id: pid, name: '알 수 없음', email: '', profileImage: '' };
                  })
              );

              // 4. 소켓 이벤트 전파
              io.to(roomId).emit('message', leaveMessage);
              io.to(roomId).emit('participantsUpdate', participantArr);
            }
          }
        }

        logDebug('user disconnected', {
          reason,
          userId: socket.user.id,
          socketId: socket.id,
          lastRoom: roomId
        });

      } catch (error) {
        console.error('Disconnect handling error:', error);
      }
    });

    // 세션 종료 또는 로그아웃 처리
    socket.on('force_login', async ({ token }) => {
      try {
        if (!socket.user) return;

        // 강제 로그아웃을 요청한 클라이언트의 세션 정보 확인
        const decoded = jwt.verify(token, jwtSecret);
        if (!decoded?.user?.id || decoded.user.id !== socket.user.id) {
          throw new Error('Invalid token');
        }

        // 세션 종료 처리
        socket.emit('session_ended', {
          reason: 'force_logout',
          message: '다른 기기에서 로그인하여 현재 세션이 종료되었습니다.'
        });

        // 연결 종료
        socket.disconnect(true);

      } catch (error) {
        console.error('Force login error:', error);
        socket.emit('error', {
          message: '세션 종료 중 오류가 발생했습니다.'
        });
      }
    });

    // 메시지 읽음 상태 처리
    socket.on('markMessagesAsRead', async ({ roomId, messageIds }) => {
      try {
        if (!socket.user) {
          throw new Error('Unauthorized');
        }

        if (!Array.isArray(messageIds) || messageIds.length === 0) {
          return;
        }

        // 읽음 상태 업데이트
        await Message.updateMany(
          {
            _id: { $in: messageIds },
            room: roomId,
            'readers.userId': { $ne: socket.user.id }
          },
          {
            $push: {
              readers: {
                userId: socket.user.id,
                readAt: new Date()
              }
            }
          }
        );

        // 모든 인스턴스에 읽음 상태 브로드캐스트
        io.to(roomId).emit('messagesRead', {
          userId: socket.user.id,
          messageIds
        });

      } catch (error) {
        console.error('Mark messages as read error:', error);
        socket.emit('error', {
          message: '읽음 상태 업데이트 중 오류가 발생했습니다.'
        });
      }
    });

    // 리액션 처리
    socket.on('messageReaction', async ({ messageId, reaction, type }) => {
      try {
        if (!socket.user) {
          throw new Error('Unauthorized');
        }

        const message = await Message.findById(messageId);
        if (!message) {
          throw new Error('메시지를 찾을 수 없습니다.');
        }

        // 리액션 추가/제거
        if (type === 'add') {
          await message.addReaction(reaction, socket.user.id);
        } else if (type === 'remove') {
          await message.removeReaction(reaction, socket.user.id);
        }

        // 업데이트된 리액션 정보 브로드캐스트
        io.to(message.room).emit('messageReactionUpdate', {
          messageId,
          reactions: message.reactions
        });

      } catch (error) {
        console.error('Message reaction error:', error);
        socket.emit('error', {
          message: error.message || '리액션 처리 중 오류가 발생했습니다.'
        });
      }
    });
  });

  // AI 멘션 추출 함수
  function extractAIMentions(content) {
    if (!content) return [];
    
    const aiTypes = ['wayneAI', 'consultingAI'];
    const mentions = new Set();
    const mentionRegex = /@(wayneAI|consultingAI)\b/g;
    let match;
    
    while ((match = mentionRegex.exec(content)) !== null) {
      if (aiTypes.includes(match[1])) {
        mentions.add(match[1]);
      }
    }
    
    return Array.from(mentions);
  }

  // AI 응답 처리 함수 개선
  async function handleAIResponse(io, room, aiName, query) {
    const messageId = `${aiName}-${Date.now()}`;
    let accumulatedContent = '';
    const timestamp = new Date();

    // 스트리밍 세션 초기화
    streamingSessions.set(messageId, {
      room,
      aiType: aiName,
      content: '',
      messageId,
      timestamp,
      lastUpdate: Date.now(),
      reactions: {}
    });
    
    logDebug('AI response started', {
      messageId,
      aiType: aiName,
      room,
      query
    });

    // 초기 상태 전송
    io.to(room).emit('aiMessageStart', {
      messageId,
      aiType: aiName,
      timestamp
    });

    try {
      // AI 응답 생성 및 스트리밍
      await aiService.generateResponse(query, aiName, {
        onStart: () => {
          logDebug('AI generation started', {
            messageId,
            aiType: aiName
          });
        },
        onChunk: async (chunk) => {
          accumulatedContent += chunk.currentChunk || '';
          
          const session = streamingSessions.get(messageId);
          if (session) {
            session.content = accumulatedContent;
            session.lastUpdate = Date.now();
          }

          io.to(room).emit('aiMessageChunk', {
            messageId,
            currentChunk: chunk.currentChunk,
            fullContent: accumulatedContent,
            isCodeBlock: chunk.isCodeBlock,
            timestamp: new Date(),
            aiType: aiName,
            isComplete: false
          });
        },
        onComplete: async (finalContent) => {
          // 스트리밍 세션 정리
          streamingSessions.delete(messageId);

          // AI 메시지 저장
          const aiMessage = await Message.create({
            room,
            content: finalContent.content,
            type: 'ai',
            aiType: aiName,
            timestamp: new Date(),
            reactions: {},
            metadata: {
              query,
              generationTime: Date.now() - timestamp,
              completionTokens: finalContent.completionTokens,
              totalTokens: finalContent.totalTokens
            }
          });

          // 완료 메시지 전송
          io.to(room).emit('aiMessageComplete', {
            messageId,
            _id: aiMessage._id,
            content: finalContent.content,
            aiType: aiName,
            timestamp: new Date(),
            isComplete: true,
            query,
            reactions: {}
          });

          logDebug('AI response completed', {
            messageId,
            aiType: aiName,
            contentLength: finalContent.content.length,
            generationTime: Date.now() - timestamp
          });
        },
        onError: (error) => {
          streamingSessions.delete(messageId);
          console.error('AI response error:', error);
          
          io.to(room).emit('aiMessageError', {
            messageId,
            error: error.message || 'AI 응답 생성 중 오류가 발생했습니다.',
            aiType: aiName
          });

          logDebug('AI response error', {
            messageId,
            aiType: aiName,
            error: error.message
          });
        }
      });
    } catch (error) {
      streamingSessions.delete(messageId);
      console.error('AI service error:', error);
      
      io.to(room).emit('aiMessageError', {
        messageId,
        error: error.message || 'AI 서비스 오류가 발생했습니다.',
        aiType: aiName
      });

      logDebug('AI service error', {
        messageId,
        aiType: aiName,
        error: error.message
      });
    }
  }

  return io;
}

function getSocketIO() {
  if (!ioInstance) throw new Error('Socket.IO 인스턴스가 설정되지 않았습니다.');
  return ioInstance;
}

module.exports = {
  setSocketIO,
  getSocketIO
};