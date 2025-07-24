// Improved backend/sockets/chat.js with enhanced detective game support
const Message = require('../models/Message');
const Room = require('../models/Room');
const User = require('../models/User');
const File = require('../models/File');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/keys');
const redisClient = require('../utils/redisClient');
const SessionService = require('../services/sessionService');
const audioService = require('../services/audioService');
const aiService = require('../services/aiService');
const detectiveGame = require('../services/detectiveGame');

module.exports = function(io) {
  const connectedUsers = new Map();
  const streamingSessions = new Map();
  const userRooms = new Map();
  const messageQueues = new Map();
  const messageLoadRetries = new Map();

  // Detective game room state tracking
  const detectiveGameStates = new Map(); // roomId -> { userId, startTime, isActive }

  const BATCH_SIZE = 30;
  const LOAD_DELAY = 300;
  const MAX_RETRIES = 3;
  const MESSAGE_LOAD_TIMEOUT = 10000;
  const RETRY_DELAY = 2000;
  const DUPLICATE_LOGIN_TIMEOUT = 10000;

  // Logging utility function
  const logDebug = (action, data) => {
    console.debug(`[Socket.IO] ${action}:`, {
      ...data,
      timestamp: new Date().toISOString()
    });
  };

  // Enhanced message loading function
  const loadMessages = async (socket, roomId, before, limit = BATCH_SIZE) => {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Message loading timed out'));
      }, MESSAGE_LOAD_TIMEOUT);
    });

    try {
      const query = { room: roomId };
      if (before) {
        query.timestamp = { $lt: new Date(before) };
      }

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

      const hasMore = messages.length > limit;
      const resultMessages = messages.slice(0, limit);
      const sortedMessages = resultMessages.sort((a, b) =>
        new Date(a.timestamp) - new Date(b.timestamp)
      );

      // Update read status asynchronously
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

  // Message loading with retry logic
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

  // Duplicate login handling
  const handleDuplicateLogin = async (existingSocket, newSocket) => {
    try {
      existingSocket.emit('duplicate_login', {
        type: 'new_login_attempt',
        deviceInfo: newSocket.handshake.headers['user-agent'],
        ipAddress: newSocket.handshake.address,
        timestamp: Date.now()
      });

      return new Promise((resolve) => {
        setTimeout(async () => {
          try {
            existingSocket.emit('session_ended', {
              reason: 'duplicate_login',
              message: '다른 기기에서 로그인하여 현재 세션이 종료되었습니다.'
            });

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

  // Authentication middleware
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

      // Check for existing connection
      const existingSocketId = connectedUsers.get(decoded.user.id);
      if (existingSocketId) {
        const existingSocket = io.sockets.sockets.get(existingSocketId);
        if (existingSocket) {
          await handleDuplicateLogin(existingSocket, socket);
        }
      }

      const validationResult = await SessionService.validateSession(decoded.user.id, sessionId);
      if (!validationResult.isValid) {
        console.error('Session validation failed:', validationResult);
        return next(new Error(validationResult.message || 'Invalid session'));
      }

      const user = await User.findById(decoded.user.id);
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = {
        id: user._id.toString(),
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
      const previousSocketId = connectedUsers.get(socket.user.id);
      if (previousSocketId && previousSocketId !== socket.id) {
        const previousSocket = io.sockets.sockets.get(previousSocketId);
        if (previousSocket) {
          previousSocket.emit('duplicate_login', {
            type: 'new_login_attempt',
            deviceInfo: socket.handshake.headers['user-agent'],
            ipAddress: socket.handshake.address,
            timestamp: Date.now()
          });

          setTimeout(() => {
            previousSocket.emit('session_ended', {
              reason: 'duplicate_login',
              message: '다른 기기에서 로그인하여 현재 세션이 종료되었습니다.'
            });
            previousSocket.disconnect(true);
          }, DUPLICATE_LOGIN_TIMEOUT);
        }
      }

      connectedUsers.set(socket.user.id, socket.id);
    }

    // Previous message fetching
    socket.on('fetchPreviousMessages', async ({ roomId, before }) => {
      const queueKey = `${roomId}:${socket.user.id}`;

      try {
        if (!socket.user) {
          throw new Error('Unauthorized');
        }

        const room = await Room.findOne({
          _id: roomId,
          participants: socket.user.id
        });

        if (!room) {
          throw new Error('채팅방 접근 권한이 없습니다.');
        }

        if (messageQueues.get(queueKey)) {
          logDebug('message load skipped - already loading', {
            roomId,
            userId: socket.user.id
          });
          return;
        }

        messageQueues.set(queueKey, true);
        socket.emit('messageLoadStart');

        const result = await loadMessagesWithRetry(socket, roomId, before);

        logDebug('previous messages loaded', {
          roomId,
          messageCount: result.messages.length,
          hasMore: result.hasMore,
          oldestTimestamp: result.oldestTimestamp
        });

        socket.emit('previousMessagesLoaded', result);

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

    // Room joining
    socket.on('joinRoom', async (roomId) => {
      try {
        if (!socket.user) {
          throw new Error('Unauthorized');
        }

        const currentRoom = userRooms.get(socket.user.id);
        if (currentRoom === roomId) {
          logDebug('already in room', {
            userId: socket.user.id,
            roomId
          });
          socket.emit('joinRoomSuccess', { roomId });
          return;
        }

        if (currentRoom) {
          logDebug('leaving current room', {
            userId: socket.user.id,
            roomId: currentRoom
          });
          socket.leave(currentRoom);
          userRooms.delete(socket.user.id);

          socket.to(currentRoom).emit('userLeft', {
            userId: socket.user.id,
            name: socket.user.name
          });
        }

        const room = await Room.findByIdAndUpdate(
          roomId,
          { $addToSet: { participants: socket.user.id } },
          {
            new: true,
            runValidators: true
          }
        ).populate('participants', 'name email profileImage');

        if (!room) {
          throw new Error('채팅방을 찾을 수 없습니다.');
        }

        socket.join(roomId);
        userRooms.set(socket.user.id, roomId);

        // Create join message (but it will be filtered in detective mode)
        const joinMessage = new Message({
          room: roomId,
          content: `${socket.user.name}님이 입장하였습니다.`,
          type: 'system',
          timestamp: new Date()
        });

        await joinMessage.save();

        // Load initial messages
        const messageLoadResult = await loadMessages(socket, roomId);
        const { messages, hasMore, oldestTimestamp } = messageLoadResult;

        // Get active streaming messages
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

        // Send join success with detective game state
        const detectiveState = detectiveGameStates.get(roomId);

        socket.emit('joinRoomSuccess', {
          roomId,
          participants: room.participants,
          messages,
          hasMore,
          oldestTimestamp,
          activeStreams,
          detectiveGameState: detectiveState ? {
            isActive: detectiveState.isActive,
            userId: detectiveState.userId,
            startTime: detectiveState.startTime
          } : null
        });

        io.to(roomId).emit('message', joinMessage);
        io.to(roomId).emit('participantsUpdate', room.participants);

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

    // Enhanced Detective Game Events

    // Start detective game with room-based restrictions
    socket.on('startDetectiveGame', async ({ roomId }) => {
      try {
        if (!socket.user) {
          throw new Error('Unauthorized');
        }

        // Check if another user is already playing in this room
        const existingGameState = detectiveGameStates.get(roomId);
        if (existingGameState && existingGameState.isActive && existingGameState.userId !== socket.user.id) {
          socket.emit('detectiveGameError', {
            message: '다른 사용자가 이미 이 채팅방에서 탐정 게임을 플레이 중입니다.'
          });
          return;
        }

        // Initialize game
        const gameState = detectiveGame.initializeGame(socket.user.id, roomId);

        // Set room detective game state
        detectiveGameStates.set(roomId, {
          userId: socket.user.id,
          startTime: new Date(),
          isActive: true,
          gameState: gameState
        });

        // Join detective game room
        socket.join(`detective_${roomId}`);

        // Send initial game state
        socket.emit('detectiveGameStarted', {
          success: true,
          gameState: {
            character: gameState.character,
            startTime: gameState.startTime,
            instructions: {
              objective: '스모군을 심문하여 자백을 받아내세요',
              rules: [
                '자백을 받으려면 두 가지 핵심 증거를 모두 제시해야 합니다:',
                '1. 프로덕션에 직접 force push한 증거',
                '2. 로그를 삭제하여 흔적을 지운 증거',
                '그 전까지는 모든 것을 부인하고 다른 사람을 탓할 것입니다'
              ],
              tips: [
                '기술적 전문용어로 회피하려 할 것입니다',
                'Jenkins, CI/CD, 다른 개발자들을 탓하는 것을 좋아합니다',
                '끈질기게 구체적인 증거를 제시하세요',
                '@smokinggun 태그로 대화해야 합니다'
              ]
            }
          }
        });

        // Send initial character message
        const initialResponse = await detectiveGame.processPlayerMessage(
          socket.user.id,
          'detective_game_start',
          []
        );

        // Create AI message with @smokinggun as sender
        const detectiveAIMessage = new Message({
          room: roomId,
          content: initialResponse.response,
          type: 'ai',
          aiType: 'smokinggun',
          timestamp: new Date(),
          reactions: {},
          sender: null, // AI messages don't have human senders
          gameType: 'detective',
          metadata: {
            character: 'smokinggun',
            mood: initialResponse.mood,
            isGameMessage: true
          }
        });

        await detectiveAIMessage.save();

        // Broadcast to room participants
        io.to(roomId).emit('message', detectiveAIMessage);

        logDebug('detective game started', {
          userId: socket.user.id,
          roomId
        });

      } catch (error) {
        console.error('Start detective game error:', error);
        socket.emit('detectiveGameError', {
          message: error.message || '탐정 게임 시작 중 오류가 발생했습니다.'
        });
      }
    });

    // Send message to detective character
    socket.on('detectiveInterrogate', async ({ roomId, message, evidence = [] }) => {
      try {
        if (!socket.user) {
          throw new Error('Unauthorized');
        }

        if (!message || typeof message !== 'string') {
          throw new Error('메시지가 필요합니다.');
        }

        // Verify this user has an active detective game in this room
        const gameState = detectiveGameStates.get(roomId);
        if (!gameState || !gameState.isActive || gameState.userId !== socket.user.id) {
          throw new Error('활성화된 탐정 게임이 없습니다.');
        }

        // Process the interrogation
        const response = await detectiveGame.processPlayerMessage(
          socket.user.id,
          message,
          evidence
        );

        if (!response.success) {
          socket.emit('detectiveGameError', {
            message: response.error || '심문 처리 중 오류가 발생했습니다.'
          });
          return;
        }

        // Create and save AI response message
        const detectiveAIMessage = new Message({
          room: roomId,
          content: response.response,
          type: 'ai',
          aiType: 'smokinggun',
          timestamp: new Date(),
          reactions: {},
          sender: null,
          gameType: 'detective',
          metadata: {
            character: 'smokinggun',
            mood: response.mood,
            isGameMessage: true,
            isConfession: response.isConfession
          }
        });

        await detectiveAIMessage.save();

        // Broadcast AI response to room
        io.to(roomId).emit('message', detectiveAIMessage);

        // If game ended with confession, send completion event and cleanup
        if (response.gameEnded && response.isConfession) {
          const stats = detectiveGame.getGameStats(socket.user.id);

          socket.emit('detectiveGameComplete', {
            success: true,
            confessionAchieved: true,
            stats,
            finalMessage: '축하합니다! 스모군의 자백을 받아냈습니다!'
          });

          // Clean up room state
          detectiveGameStates.delete(roomId);

          // Notify room that detective game ended
          io.to(roomId).emit('detectiveGameEnded', {
            userId: socket.user.id,
            reason: 'confession_achieved'
          });
        }

        logDebug('detective interrogation processed', {
          userId: socket.user.id,
          messageLength: message.length,
          evidenceCount: evidence.length,
          gameEnded: response.gameEnded
        });

      } catch (error) {
        console.error('Detective interrogation error:', error);
        socket.emit('detectiveGameError', {
          message: error.message || '심문 중 오류가 발생했습니다.'
        });
      }
    });

    // Get detective game status
    socket.on('getDetectiveStatus', async ({ roomId }) => {
      try {
        if (!socket.user) {
          throw new Error('Unauthorized');
        }

        const gameState = detectiveGame.getGameState(socket.user.id);
        const stats = detectiveGame.getGameStats(socket.user.id);
        const roomGameState = detectiveGameStates.get(roomId);

        socket.emit('detectiveStatus', {
          hasActiveGame: gameState ? gameState.isActive : false,
          gameState: gameState ? {
            character: gameState.character,
            startTime: gameState.startTime,
            isActive: gameState.isActive,
            confessionTriggered: gameState.confessionTriggered
          } : null,
          stats,
          roomDetectiveState: roomGameState ? {
            isActive: roomGameState.isActive,
            userId: roomGameState.userId,
            canJoin: roomGameState.userId === socket.user.id
          } : null
        });

      } catch (error) {
        console.error('Get detective status error:', error);
        socket.emit('detectiveGameError', {
          message: '게임 상태 확인 중 오류가 발생했습니다.'
        });
      }
    });

    // End detective game
    socket.on('endDetectiveGame', async () => {
      try {
        if (!socket.user) {
          throw new Error('Unauthorized');
        }

        const gameState = detectiveGame.endGame(socket.user.id);
        const finalStats = detectiveGame.getGameStats(socket.user.id);

        // Find and clean up room state
        for (const [roomId, roomGameState] of detectiveGameStates.entries()) {
          if (roomGameState.userId === socket.user.id) {
            detectiveGameStates.delete(roomId);

            // Notify room that detective game ended
            io.to(roomId).emit('detectiveGameEnded', {
              userId: socket.user.id,
              reason: 'player_ended'
            });
            break;
          }
        }

        socket.emit('detectiveGameEnded', {
          success: true,
          finalStats,
          confessionAchieved: gameState ? gameState.confessionTriggered : false
        });

        logDebug('detective game ended', {
          userId: socket.user.id,
          confessionAchieved: gameState ? gameState.confessionTriggered : false
        });

      } catch (error) {
        console.error('End detective game error:', error);
        socket.emit('detectiveGameError', {
          message: '게임 종료 중 오류가 발생했습니다.'
        });
      }
    });

    // Regular chat message handling
    socket.on('chatMessage', async (messageData) => {
      try {
        if (!socket.user) {
          throw new Error('Unauthorized');
        }

        if (!messageData) {
          throw new Error('메시지 데이터가 없습니다.');
        }

        const { room, type, content, fileData } = messageData;

        if (!room) {
          throw new Error('채팅방 정보가 없습니다.');
        }

        const chatRoom = await Room.findOne({
          _id: room,
          participants: socket.user.id
        });

        if (!chatRoom) {
          throw new Error('채팅방 접근 권한이 없습니다.');
        }

        const sessionValidation = await SessionService.validateSession(
          socket.user.id,
          socket.user.sessionId
        );

        if (!sessionValidation.isValid) {
          throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.');
        }

        // Check for AI mentions
        const aiMentions = extractAIMentions(content);
        let message;

        logDebug('message received', {
          type,
          room,
          userId: socket.user.id,
          hasFileData: !!fileData,
          hasAIMentions: aiMentions.length
        });

        // Handle different message types
        switch (type) {
          case 'file':
            if (!fileData || !fileData._id) {
              throw new Error('파일 데이터가 올바르지 않습니다.');
            }

            const file = await File.findOne({
              _id: fileData._id,
              user: socket.user.id
            });

            if (!file) {
              throw new Error('파일을 찾을 수 없거나 접근 권한이 없습니다.');
            }

            message = new Message({
              room,
              sender: socket.user.id,
              type: 'file',
              file: file._id,
              content: content || '',
              timestamp: new Date(),
              reactions: {},
              metadata: {
                fileType: file.mimetype,
                fileSize: file.size,
                originalName: file.originalname
              }
            });
            break;

          case 'text':
            const messageContent = content?.trim() || messageData.msg?.trim();
            if (!messageContent) {
              return;
            }

            message = new Message({
              room,
              sender: socket.user.id,
              content: messageContent,
              type: 'text',
              timestamp: new Date(),
              reactions: {}
            });
            break;

          default:
            throw new Error('지원하지 않는 메시지 타입입니다.');
        }

        await message.save();
        await message.populate([
          { path: 'sender', select: 'name email profileImage' },
          { path: 'file', select: 'filename originalname mimetype size' }
        ]);

        io.to(room).emit('message', message);

        // Handle AI mentions (but not @smokinggun during detective game)
        if (aiMentions.length > 0) {
          for (const ai of aiMentions) {
            // Skip @smokinggun if detective game is active in this room
            const roomGameState = detectiveGameStates.get(room);
            if (ai === 'smokinggun' && roomGameState && roomGameState.isActive) {
              continue; // Detective game handles @smokinggun mentions
            }

            const query = content.replace(new RegExp(`@${ai}\\b`, 'g'), '').trim();
            await handleAIResponse(io, room, ai, query);
          }
        }

        await SessionService.updateLastActivity(socket.user.id);

        logDebug('message processed', {
          messageId: message._id,
          type: message.type,
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

    // Room leaving
    socket.on('leaveRoom', async (roomId) => {
      try {
        if (!socket.user) {
          throw new Error('Unauthorized');
        }

        const currentRoom = userRooms?.get(socket.user.id);
        if (!currentRoom || currentRoom !== roomId) {
          console.log(`User ${socket.user.id} is not in room ${roomId}`);
          return;
        }

        const room = await Room.findOne({
          _id: roomId,
          participants: socket.user.id
        }).select('participants').lean();

        if (!room) {
          console.log(`Room ${roomId} not found or user has no access`);
          return;
        }

        socket.leave(roomId);
        userRooms.delete(socket.user.id);

        // End detective game if user was playing
        const roomGameState = detectiveGameStates.get(roomId);
        if (roomGameState && roomGameState.userId === socket.user.id) {
          detectiveGame.endGame(socket.user.id);
          detectiveGameStates.delete(roomId);

          io.to(roomId).emit('detectiveGameEnded', {
            userId: socket.user.id,
            reason: 'player_left'
          });
        }

        // Create leave message
        const leaveMessage = await Message.create({
          room: roomId,
          content: `${socket.user.name}님이 퇴장하였습니다.`,
          type: 'system',
          timestamp: new Date()
        });

        // Update participants
        const updatedRoom = await Room.findByIdAndUpdate(
          roomId,
          { $pull: { participants: socket.user.id } },
          {
            new: true,
            runValidators: true
          }
        ).populate('participants', 'name email profileImage');

        if (!updatedRoom) {
          console.log(`Room ${roomId} not found during update`);
          return;
        }

        // Clean up streaming sessions
        for (const [messageId, session] of streamingSessions.entries()) {
          if (session.room === roomId && session.userId === socket.user.id) {
            streamingSessions.delete(messageId);
          }
        }

        // Clean up message queues
        const queueKey = `${roomId}:${socket.user.id}`;
        messageQueues.delete(queueKey);
        messageLoadRetries.delete(queueKey);

        // Send events
        io.to(roomId).emit('message', leaveMessage);
        io.to(roomId).emit('participantsUpdate', updatedRoom.participants);

        console.log(`User ${socket.user.id} left room ${roomId} successfully`);

      } catch (error) {
        console.error('Leave room error:', error);
        socket.emit('error', {
          message: error.message || '채팅방 퇴장 중 오류가 발생했습니다.'
        });
      }
    });

    // Disconnect handling
    socket.on('disconnect', async (reason) => {
      if (!socket.user) return;

      try {
        if (connectedUsers.get(socket.user.id) === socket.id) {
          connectedUsers.delete(socket.user.id);
        }

        const roomId = userRooms.get(socket.user.id);
        userRooms.delete(socket.user.id);

        // End detective game if user was playing
        for (const [gameRoomId, roomGameState] of detectiveGameStates.entries()) {
          if (roomGameState.userId === socket.user.id) {
            detectiveGame.endGame(socket.user.id);
            detectiveGameStates.delete(gameRoomId);

            io.to(gameRoomId).emit('detectiveGameEnded', {
              userId: socket.user.id,
              reason: 'player_disconnected'
            });
            break;
          }
        }

        // Clean up message queues
        const userQueues = Array.from(messageQueues.keys())
          .filter(key => key.endsWith(`:${socket.user.id}`));
        userQueues.forEach(key => {
          messageQueues.delete(key);
          messageLoadRetries.delete(key);
        });

        // Clean up streaming sessions
        for (const [messageId, session] of streamingSessions.entries()) {
          if (session.userId === socket.user.id) {
            streamingSessions.delete(messageId);
          }
        }

        // Handle room leave on disconnect
        if (roomId) {
          if (reason !== 'client namespace disconnect' && reason !== 'duplicate_login') {
            const leaveMessage = await Message.create({
              room: roomId,
              content: `${socket.user.name}님이 연결이 끊어졌습니다.`,
              type: 'system',
              timestamp: new Date()
            });

            const updatedRoom = await Room.findByIdAndUpdate(
              roomId,
              { $pull: { participants: socket.user.id } },
              {
                new: true,
                runValidators: true
              }
            ).populate('participants', 'name email profileImage');

            if (updatedRoom) {
              io.to(roomId).emit('message', leaveMessage);
              io.to(roomId).emit('participantsUpdate', updatedRoom.participants);
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

    // Force login handling
    socket.on('force_login', async ({ token }) => {
      try {
        if (!socket.user) return;

        const decoded = jwt.verify(token, jwtSecret);
        if (!decoded?.user?.id || decoded.user.id !== socket.user.id) {
          throw new Error('Invalid token');
        }

        socket.emit('session_ended', {
          reason: 'force_logout',
          message: '다른 기기에서 로그인하여 현재 세션이 종료되었습니다.'
        });

        socket.disconnect(true);

      } catch (error) {
        console.error('Force login error:', error);
        socket.emit('error', {
          message: '세션 종료 중 오류가 발생했습니다.'
        });
      }
    });

    // Message reading status
    socket.on('markMessagesAsRead', async ({ roomId, messageIds }) => {
      try {
        if (!socket.user) {
          throw new Error('Unauthorized');
        }

        if (!Array.isArray(messageIds) || messageIds.length === 0) {
          return;
        }

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

        socket.to(roomId).emit('messagesRead', {
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

    // Message reactions
    socket.on('messageReaction', async ({ messageId, reaction, type }) => {
      try {
        if (!socket.user) {
          throw new Error('Unauthorized');
        }

        const message = await Message.findById(messageId);
        if (!message) {
          throw new Error('메시지를 찾을 수 없습니다.');
        }

        if (type === 'add') {
          await message.addReaction(reaction, socket.user.id);
        } else if (type === 'remove') {
          await message.removeReaction(reaction, socket.user.id);
        }

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

    // Audio transcription support
    socket.on('audioChunk', async ({ audioData, sessionId, sequence, roomId }) => {
      try {
        if (!socket.user) {
          throw new Error('Unauthorized');
        }

        if (!audioData || !sessionId) {
          throw new Error('Audio data and session ID are required');
        }

        const audioBuffer = Buffer.from(audioData, 'base64');
        const partialTranscription = await audioService.processAudioChunk(audioBuffer, sessionId);

        if (partialTranscription && partialTranscription.trim()) {
          socket.emit('transcriptionChunk', {
            sessionId,
            sequence,
            transcription: partialTranscription,
            isPartial: true,
            timestamp: new Date()
          });

          logDebug('audio chunk processed', {
            sessionId,
            sequence,
            transcriptionLength: partialTranscription.length,
            userId: socket.user.id
          });
        }

      } catch (error) {
        console.error('Audio chunk processing error:', error);
        socket.emit('transcriptionError', {
          sessionId: sessionId || 'unknown',
          error: error.message || 'Audio transcription failed'
        });
      }
    });

    socket.on('audioComplete', async ({ sessionId, roomId }) => {
      try {
        if (!socket.user) {
          throw new Error('Unauthorized');
        }

        if (!sessionId) {
          throw new Error('Session ID is required');
        }

        socket.emit('transcriptionComplete', {
          sessionId,
          timestamp: new Date()
        });

        logDebug('audio transcription completed', {
          sessionId,
          userId: socket.user.id,
          roomId
        });

      } catch (error) {
        console.error('Audio completion error:', error);
        socket.emit('transcriptionError', {
          sessionId: sessionId || 'unknown',
          error: error.message || 'Audio completion failed'
        });
      }
    });

    // TTS requests
    socket.on('requestTTS', async ({ messageId, text, aiType }) => {
      try {
        if (!socket.user) {
          throw new Error('Unauthorized');
        }

        if (!text || !messageId) {
          throw new Error('Message ID and text are required');
        }

        logDebug('TTS requested', {
          messageId,
          aiType,
          textLength: text.length,
          userId: socket.user.id
        });

        const audioBuffer = await audioService.textToSpeech(text, aiType || 'default');
        const audioBase64 = audioBuffer.toString('base64');

        socket.emit('ttsReady', {
          messageId,
          audioData: audioBase64,
          format: 'mp3',
          voice: audioService.getVoiceForAI(aiType),
          timestamp: new Date()
        });

        logDebug('TTS generated', {
          messageId,
          aiType,
          audioSize: audioBuffer.length,
          userId: socket.user.id
        });

      } catch (error) {
        console.error('TTS generation error:', error);
        socket.emit('ttsError', {
          messageId: messageId || 'unknown',
          error: error.message || 'TTS generation failed'
        });
      }
    });
  });

  // AI mention extraction function
  function extractAIMentions(content) {
    if (!content) return [];

    const aiTypes = ['wayneAI', 'consultingAI', 'smokinggun'];
    const mentions = new Set();
    const mentionRegex = /@(wayneAI|consultingAI|smokinggun)\b/g;
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      if (aiTypes.includes(match[1])) {
        mentions.add(match[1]);
      }
    }

    return Array.from(mentions);
  }

  // Enhanced AI response handling
  async function handleAIResponse(io, room, aiName, query) {
    const messageId = `${aiName}-${Date.now()}`;
    let accumulatedContent = '';
    const timestamp = new Date();

    // Initialize streaming session
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

    // Send initial state
    io.to(room).emit('aiMessageStart', {
      messageId,
      aiType: aiName,
      timestamp
    });

    try {
      // Generate and stream AI response
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
          // Clean up streaming session
          streamingSessions.delete(messageId);

          // Save AI message
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

          // Send completion message
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
};