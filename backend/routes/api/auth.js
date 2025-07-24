// backend/routes/api/auth.js
const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const authController = require('../../controllers/authController');

// 상태 확인 라우트
router.get('/', (req, res) => {
  res.json({
    status: 'active',
    routes: {
      '/register': 'POST - 새 사용자 등록',
      '/login': 'POST - 사용자 로그인',
      '/logout': 'POST - 로그아웃 (인증 필요)',
      '/verify-token': 'GET - 토큰 검증',
      '/refresh-token': 'POST - 토큰 갱신 (인증 필요)'
    }
  });
});

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/verify-token', authController.verifyToken); // GET /verify-token 라우트 추가

// Protected routes
router.post('/logout', auth, authController.logout);
router.post('/refresh-token', auth, authController.refreshToken);

module.exports = router;