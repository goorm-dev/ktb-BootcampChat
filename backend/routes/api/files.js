// backend/routes/api/files.js
const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const fileController = require('../../controllers/fileController');


// Presigned URL 생성
router.post('/presigned-url', auth, fileController.generatePresignedUrl);

// 파일 업로드 완료
router.patch('/:fileId/complete', auth, fileController.completeUpload);

// 파일 다운로드 (Presigned URL 사용)
router.get('/:fileId/download-url', auth, fileController.getDownloadUrl);


module.exports = router;