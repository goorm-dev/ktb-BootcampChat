// backend/middleware/auth.js

const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/keys');
const SessionService = require('../services/sessionService');

const auth = async (req, res, next) => {
  try {
    // 헤더 또는 쿼리 파라미터에서 토큰과 세션ID 가져오기
    const token = req.header('x-auth-token') || req.query.token;
    const sessionId = req.header('x-session-id') || req.query.sessionId;

    if (!token || !sessionId) {
      return res.status(401).json({
        success: false,
        message: '인증 토큰이 없습니다.'
      });
    }

    try {
      // 토큰 검증
      const decoded = jwt.verify(token, jwtSecret);
      req.user = decoded.user;

      // 세션 검증
      const validationResult = await SessionService.validateSession(decoded.user.id, sessionId);
      
      if (!validationResult.isValid) {
        return res.status(401).json({
          success: false,
          code: validationResult.error,
          message: validationResult.message
        });
      }

      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: '토큰이 만료되었습니다.'
        });
      }

      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: '유효하지 않은 토큰입니다.'
        });
      }

      throw err;
    }
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
};

module.exports = auth;
module.exports.authenticateToken = auth;