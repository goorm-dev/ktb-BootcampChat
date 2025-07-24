// backend/routes/api/files.js
const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const fileController = require('../../controllers/fileController');
const { upload, errorHandler } = require('../../middleware/upload');

// 파일 업로드
router.post('/upload',
  auth,
  upload.single('file'),
  errorHandler,
  fileController.uploadFile
);

// 파일 다운로드
router.get('/download/:filename',
  auth,
  fileController.downloadFile
);

// 파일 보기 (미리보기용)
router.get('/view/:filename',
  auth,
  fileController.viewFile
);

// 파일 삭제
router.delete('/:id',
  auth,
  fileController.deleteFile
);

// presigned 발급
router.post("/presigned-url",
  auth,
  fileController.getPresignedUrl
);

// s3 업로드 후 메타데이터 받기
router.post('/complete-upload',
    auth,
    fileController.uploadFile
)

module.exports = router;