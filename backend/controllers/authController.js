const User = require('../models/User');
const jwt = require('jsonwebtoken');
const redis = require('../utils/redisClient')
const { jwtSecret } = require('../config/keys');
const { nanoid } = require('nanoid');
const SessionService = require('../services/sessionService');

const authController = {
  async register(req, res) {
    try {
      console.log('Register request received:', req.body);

      const { name, email, password } = req.body;

      // Input validation
      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: '모든 필드를 입력해주세요.'
        });
      }

      if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        return res.status(400).json({
          success: false,
          message: '올바른 이메일 형식이 아닙니다.'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: '비밀번호는 6자 이상이어야 합니다.'
        });
      }
      
      // Check existing user
      const existingUser = await redis.hGetAll(`user:${email}`);
      if (!existingUser || Object.keys(existingUser).length !== 0) {
        return res.status(409).json({
          success: false,
          message: '이미 등록된 이메일입니다.'
        });
      }

      const id = Date.now();
      // Create user
      const user = {
        name,
        email,
        password,
        id
      };

      await redis.hSet(`user:${email}`, {
        name: name,
        email: email,
        password: password,
        id: id
      });

      await redis.hSet(`user:${id}`, {
        name: name,
        email: email,
        password: password,
        id: id
      })
      console.log('User created:', user.id);

      // Create session with metadata
      const sessionInfo = await SessionService.createSession(user.id, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        deviceInfo: req.headers['user-agent'],
        createdAt: Date.now()
      });
      
      if (!sessionInfo || !sessionInfo.sessionId) {
        throw new Error('Session creation failed');
      }

      // Generate token with additional claims
      const token = jwt.sign(
        { 
          user: { id: user.id, email: user.email },
          sessionId: sessionInfo.sessionId,
          iat: Math.floor(Date.now() / 1000)
        },
        jwtSecret,
        { 
          expiresIn: '24h',
          algorithm: 'HS256'
        }
      );

      res.status(201).json({
        success: true,
        message: '회원가입이 완료되었습니다.',
        token,
        sessionId: sessionInfo.sessionId,
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      });

    } catch (error) {
      console.error('Register error:', error);
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: '입력값이 올바르지 않습니다.',
          errors: Object.values(error.errors).map(err => err.message)
        });
      }
      
      res.status(500).json({
        success: false,
        message: '회원가입 처리 중 오류가 발생했습니다.'
      });
    }
  },

  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Input validation
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: '이메일과 비밀번호를 입력해주세요.'
        });
      }

      // 사용자 조회
      const user = await redis.hGetAll(`user:${email}`);
      if (!user || Object.keys(user).length === 0) {
        return res.status(401).json({
          success: false,
          message: '이메일 또는 비밀번호가 올바르지 않습니다.'
        });
      }

      // 비밀번호 확인
      if (user.password !== password) {
        return res.status(401).json({
          success: false,
          message: '이메일 또는 비밀번호가 올바르지 않습니다.'
        });
      }

      // 기존 세션 확인 시도
      let existingSession = null;
      try {
        existingSession = await SessionService.getActiveSession(user.id);
      } catch (sessionError) {
        console.error('Session check error:', sessionError);
      }

      if (existingSession) {
        const io = req.app.get('io');
        
        if (io) {
          try {
            // 중복 로그인 이벤트 발생 시 더 자세한 정보 제공
            io.to(existingSession.socketId).emit('duplicate_login', {
              type: 'new_login_attempt',
              deviceInfo: req.headers['user-agent'],
              ipAddress: req.ip,
              timestamp: Date.now(),
              location: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
              browser: req.headers['user-agent']
            });

            // Promise 기반의 응답 대기 로직 개선
            const response = await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error('DUPLICATE_LOGIN_TIMEOUT'));
              }, 60000); // 60초 타임아웃

              const cleanup = () => {
                clearTimeout(timeout);
                io.removeListener('force_login', handleForceLogin);
                io.removeListener('keep_existing_session', handleKeepSession);
              };

              const handleForceLogin = async (data) => {
                try {
                  if (data.token === existingSession.token) {
                    // 기존 세션 종료 및 소켓 연결 해제
                    await SessionService.removeSession(user.id, existingSession.sessionId);
                    io.to(existingSession.socketId).emit('session_terminated', {
                      reason: 'new_login',
                      message: '다른 기기에서 로그인하여 현재 세션이 종료되었습니다.'
                    });
                    resolve('force_login');
                  } else {
                    reject(new Error('INVALID_TOKEN'));
                  }
                } catch (error) {
                  reject(error);
                } finally {
                  cleanup();
                }
              };

              const handleKeepSession = () => {
                cleanup();
                resolve('keep_existing');
              };

              io.once('force_login', handleForceLogin);
              io.once('keep_existing_session', handleKeepSession);
            });

            // 응답에 따른 처리
            if (response === 'keep_existing') {
              return res.status(409).json({
                success: false,
                code: 'DUPLICATE_LOGIN_REJECTED',
                message: '기존 세션을 유지하도록 선택되었습니다.'
              });
            }

          } catch (error) {
            if (error.message === 'DUPLICATE_LOGIN_TIMEOUT') {
              return res.status(409).json({
                success: false,
                code: 'DUPLICATE_LOGIN_TIMEOUT',
                message: '중복 로그인 요청이 시간 초과되었습니다.'
              });
            }
            throw error;
          }
        } else {
          // Socket.IO 연결이 없는 경우 자동으로 기존 세션 종료
          await SessionService.removeAllUserSessions(user.id);
        }
      }

      // 새 세션 생성
      const sessionInfo = await SessionService.createSession(user.id, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        deviceInfo: req.headers['user-agent'],
        loginAt: Date.now(),
        browser: req.headers['user-agent'],
        platform: req.headers['sec-ch-ua-platform'],
        location: req.headers['x-forwarded-for'] || req.connection.remoteAddress
      });

      if (!sessionInfo || !sessionInfo.sessionId) {
        throw new Error('Session creation failed');
      }

      // JWT 토큰 생성
      const token = jwt.sign(
        { 
          user: { id: user.id, email: user.email },
          sessionId: sessionInfo.sessionId,
          iat: Math.floor(Date.now() / 1000)
        },
        jwtSecret,
        { 
          expiresIn: '24h',
          algorithm: 'HS256'
        }
      );

      // 응답 헤더 설정
      res.set({
        'Authorization': `Bearer ${token}`,
        'x-session-id': sessionInfo.sessionId
      });

      res.json({
        success: true,
        token,
        sessionId: sessionInfo.sessionId,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          profileImage: user.profileImage
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      
      if (error.message === 'INVALID_TOKEN') {
        return res.status(401).json({
          success: false,
          message: '인증 토큰이 유효하지 않습니다.'
        });
      }
      
      res.status(500).json({
        success: false,
        message: '로그인 처리 중 오류가 발생했습니다.',
        code: error.code || 'UNKNOWN_ERROR'
      });
    }
  },

  async logout(req, res) {
    try {
      const sessionId = req.header('x-session-id');
      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: '세션 정보가 없습니다.'
        });
      }

      await SessionService.removeSession(req.user.id, sessionId);

      // Socket.IO 클라이언트에 로그아웃 알림
      const io = req.app.get('io');
      if (io) {
        const socketId = await SessionService.getSocketId(req.user.id, sessionId);
        if (socketId) {
          io.to(socketId).emit('session_ended', {
            reason: 'logout',
            message: '로그아웃되었습니다.'
          });
        }
      }
      
      // 쿠키 및 헤더 정리
      res.clearCookie('token');
      res.clearCookie('sessionId');
      
      res.json({
        success: true,
        message: '로그아웃되었습니다.'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: '로그아웃 처리 중 오류가 발생했습니다.'
      });
    }
  },

  async verifyToken(req, res) {
    try {
      const token = req.header('x-auth-token');
      const sessionId = req.header('x-session-id');

      if (!token || !sessionId) {
        console.log('Missing token or sessionId:', { token: !!token, sessionId: !!sessionId });
        return res.status(401).json({
          success: false,
          message: '인증 정보가 제공되지 않았습니다.'
        });
      }

      // JWT 토큰 검증
      const decoded = jwt.verify(token, jwtSecret);

      if (!decoded?.user?.id || !decoded?.sessionId) {
        return res.status(401).json({
          success: false,
          message: '유효하지 않은 토큰입니다.'
        });
      }

      // 토큰의 sessionId와 헤더의 sessionId 일치 여부 확인
      if (decoded.sessionId !== sessionId) {
        return res.status(401).json({
          success: false,
          message: '세션 정보가 일치하지 않습니다.'
        });
      }

      // 사용자 정보 조회
      const user = await redis.hGetAll(`user:${decoded.user.email}`)
      if (!user || Object.keys(user).length === 0) {
        return res.status(404).json({
          success: false,
          message: '사용자를 찾을 수 없습니다.'
        });
      }

      // 세션 검증
      const validationResult = await SessionService.validateSession(user.id, sessionId);
      if (!validationResult.isValid) {
        console.log('Invalid session:', validationResult);
        return res.status(401).json({
          success: false,
          code: validationResult.error,
          message: validationResult.message
        });
      }

      // 세션 갱신
      await SessionService.refreshSession(user.id, sessionId);

      console.log('Token verification successful for user:', user.id);

      // 프로필 업데이트 필요 여부 확인
      if (validationResult.needsProfileRefresh) {
        res.set('X-Profile-Update-Required', 'true');
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          profileImage: user.profileImage
        }
      });

    } catch (error) {
      console.error('Token verification error:', error);

      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: '유효하지 않은 토큰입니다.'
        });
      }

      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: '토큰이 만료되었습니다.',
          code: 'TOKEN_EXPIRED'
        });
      }

      res.status(500).json({
        success: false,
        message: '토큰 검증 중 오류가 발생했습니다.'
      });
    }
  },

  async refreshToken(req, res) {
    try {
      const oldSessionId = req.header('x-session-id');
      if (!oldSessionId) {
        return res.status(400).json({
          success: false,
          message: '세션 정보가 없습니다.'
        });
      }

      const user = await redis.hGetAll(`user:${req.user.email}`);
      console.log('Redis user:', user);

      if (!user || Object.keys(user).length === 0) {
        return res.status(404).json({
          success: false,
          message: '사용자를 찾을 수 없습니다.'
        });
      }

      // 이전 세션 제거
      await SessionService.removeSession(user.id, oldSessionId);

      // 새 세션 생성
      const sessionInfo = await SessionService.createSession(user.id, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        deviceInfo: req.headers['user-agent'],
        refreshedAt: Date.now()
      });

      if (!sessionInfo || !sessionInfo.sessionId) {
        throw new Error('Failed to create new session');
      }

      // 새로운 JWT 토큰 생성
      const token = jwt.sign(
        { 
          user: { id: user.id, useEmail: user.email },
          sessionId: sessionInfo.sessionId,
          iat: Math.floor(Date.now() / 1000)
        },
        jwtSecret,
        { 
          expiresIn: '24h',
          algorithm: 'HS256'
        }
      );

      res.json({
        success: true,
        message: '토큰이 갱신되었습니다.',
        token,
        sessionId: sessionInfo.sessionId,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          profileImage: user.profileImage
        }
      });

    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({
        success: false,
        message: '토큰 갱신 중 오류가 발생했습니다.'
      });
    }
  }
};

module.exports = authController;