// backend/routes/api/files.js
const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const fileController = require('../../controllers/fileController');
const { upload, errorHandler } = require('../../middleware/upload');

// Pre-signed URL 생성 (업로드용)
router.post('/upload-url', auth, fileController.getUploadPresignedUrl);


// 파일 업로드 완료
router.post('/complete-upload', auth, fileController.completeFileUpload);


// 파일 다운로드 URL 생성
router.get('/:id/download', auth, fileController.downloadFile);

// 파일 미리보기 URL 생성
router.get('/:id/view', auth, fileController.viewFile);

// 파일 삭제
router.delete('/:id', auth, fileController.deleteFile);

// 사용자 파일 목록 조회
router.get('/', auth, fileController.getUserFiles);

// 파일 정보 조회
router.get('/:id', auth, fileController.getFileInfo);

module.exports = router;

