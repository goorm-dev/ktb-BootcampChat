// backend/controllers/fileController.js
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const File = require('../models/File');
const Message = require('../models/Message');
const Room = require('../models/Room');
const s3Service = require('../services/s3Service');
const { processFileForRAG } = require('../services/fileService');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const crypto = require('crypto');
const { uploadDir } = require('../middleware/upload');

const fsPromises = {
  writeFile: promisify(fs.writeFile),
  unlink: promisify(fs.unlink),
  access: promisify(fs.access),
  mkdir: promisify(fs.mkdir),
  rename: promisify(fs.rename)
};

const handleFileError = (error, res) => {
  console.error('File operation error:', error);

  if (error.code === 'ENOENT') {
    return res.status(404).json({
      success: false,
      message: '파일을 찾을 수 없습니다.'
    });
  }

  if (error.code === 'NoSuchKey') {
    return res.status(404).json({
      success: false,
      message: 'S3에서 파일을 찾을 수 없습니다.'
    });
  }

  if (error.code === 'AccessDenied') {
    return res.status(403).json({
      success: false,
      message: '파일에 접근할 권한이 없습니다.'
    });
  }

  res.status(500).json({
    success: false,
    message: '파일 처리 중 오류가 발생했습니다.',
    error: error.message
  });
};

// File upload function improvement
exports.uploadFile = async (req, res) => {
  let uploadedFile = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '파일이 선택되지 않았습니다.'
      });
    }

    // 파일 크기 검증 (예: 50MB 제한)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (req.file.size > maxSize) {
      throw new Error('파일 크기는 50MB를 초과할 수 없습니다.');
    }

    const safeFilename = generateSafeFilename(req.file.originalname);
    const s3Key = generateS3Key(req.user.id, safeFilename);

    // S3에 업로드 전 메타데이터 준비
    const metadata = {
      'original-name': encodeURIComponent(req.file.originalname),
      'content-type': req.file.mimetype,
      'user-id': req.user.id,
      'upload-date': new Date().toISOString()
    };

    // S3 업로드 시도
    const s3Location = await s3Service.uploadFile(req.file, s3Key, metadata);

    // DB에 파일 정보 저장
    uploadedFile = new File({
      filename: safeFilename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      user: req.user.id,
      storageType: 's3',
      s3Key: s3Key,
      s3Location: s3Location
    });

    await uploadedFile.save();

    // 임시 파일 정리
    if (req.file.path) {
      await fsPromises.unlink(req.file.path).catch(console.error);
    }

    // 성공 응답
    res.status(200).json({
      success: true,
      message: '파일 업로드 성공',
      file: {
        _id: uploadedFile._id,
        filename: uploadedFile.filename,
        originalname: uploadedFile.originalname,
        mimetype: uploadedFile.mimetype,
        size: uploadedFile.size,
        uploadDate: uploadedFile.uploadDate
      }
    });

  } catch (error) {
    // 에러 발생 시 정리 작업
    if (uploadedFile?._id) {
      await File.deleteOne({ _id: uploadedFile._id }).catch(console.error);
    }

    if (req.file?.path) {
      await fsPromises.unlink(req.file.path).catch(console.error);
    }

    handleFileError(error, res);
  }
};

// S3 키 생성 함수
const generateS3Key = (userId, filename) => {
  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
  return `uploads/${userId}/${datePrefix}/${filename}`;
};

exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '파일이 선택되지 않았습니다.'
      });
    }

    const safeFilename = generateSafeFilename(req.file.originalname);
    const s3Key = generateS3Key(req.user.id, safeFilename);

    // S3에 업로드
    const s3Location = await s3Service.uploadFile(req.file, s3Key);

    const file = new File({
      filename: safeFilename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      user: req.user.id,
      storageType: 's3',
      s3Key: s3Key,
      s3Location: s3Location
    });

    await file.save();

    // 임시 파일 삭제
    if (req.file.path) {
      await fsPromises.unlink(req.file.path);
    }

    res.status(200).json({
      success: true,
      message: '파일 업로드 성공',
      file: {
        _id: file._id,
        filename: file.filename,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        uploadDate: file.uploadDate
      }
    });

  } catch (error) {
    console.error('File upload error:', error);
    if (req.file?.path) {
      try {
        await fsPromises.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Failed to delete uploaded file:', unlinkError);
      }
    }
    res.status(500).json({
      success: false,
      message: '파일 업로드 중 오류가 발생했습니다.',
      error: error.message
    });
  }
};

exports.downloadFile = async (req, res) => {
  try {
    const file = await File.findOne({ filename: req.params.filename });
    if (!file) {
      return res.status(404).json({
        success: false,
        message: '파일을 찾을 수 없습니다.'
      });
    }

    // 권한 검증
    const message = await Message.findOne({ file: file._id });
    if (!message) {
      return res.status(404).json({
        success: false,
        message: '파일 메시지를 찾을 수 없습니다.'
      });
    }

    const room = await Room.findOne({
      _id: message.room,
      participants: req.user.id
    });

    if (!room) {
      return res.status(403).json({
        success: false,
        message: '파일에 접근할 권한이 없습니다.'
      });
    }

    if (file.storageType === 's3') {
      try {
        const command = new GetObjectCommand({
          Bucket: s3Service.bucket,
          Key: file.s3Key,
        });

        const response = await s3Service.client.send(command);

        // 헤더 설정
        res.set({
          'Content-Type': file.mimetype,
          'Content-Length': file.size,
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.originalname)}`,
          'Cache-Control': 'no-cache',
          'Content-Security-Policy': "default-src 'self'",
          'X-Content-Type-Options': 'nosniff'
        });

        // 스트림 파이핑
        response.Body.pipe(res);

      } catch (streamError) {
        console.error('Streaming error:', streamError);
        return res.status(500).json({
          success: false,
          message: '파일 스트리밍 중 오류가 발생했습니다.'
        });
      }
    } else {
      // 로컬 파일 처리
      const filePath = path.join(uploadDir, file.filename);
      if (!isPathSafe(filePath, uploadDir)) {
        return res.status(400).json({
          success: false,
          message: '잘못된 파일 경로입니다.'
        });
      }

      res.set({
        'Content-Type': file.mimetype,
        'Content-Length': file.size,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.originalname)}`,
        'Cache-Control': 'no-cache',
        'Content-Security-Policy': "default-src 'self'",
        'X-Content-Type-Options': 'nosniff'
      });

      const fileStream = fs.createReadStream(filePath);
      fileStream.on('error', (error) => {
        console.error('File streaming error:', error);
        if (!res.headersSent) {
          return res.status(500).json({
            success: false,
            message: '파일 스트리밍 중 오류가 발생했습니다.'
          });
        }
      });

      fileStream.pipe(res);
    }
  } catch (error) {
    handleFileError(error, res);
  }
};

exports.viewFile = async (req, res) => {
  try {
    const file = await File.findOne({ filename: req.params.filename });
    if (!file) {
      return res.status(404).json({
        success: false,
        message: '파일을 찾을 수 없습니다.'
      });
    }

    // 권한 검증
    const message = await Message.findOne({ file: file._id });
    if (!message) {
      return res.status(404).json({
        success: false,
        message: '파일 메시지를 찾을 수 없습니다.'
      });
    }

    const room = await Room.findOne({
      _id: message.room,
      participants: req.user.id
    });

    if (!room) {
      return res.status(403).json({
        success: false,
        message: '파일에 접근할 권한이 없습니다.'
      });
    }

    if (!file.isPreviewable()) {
      return res.status(415).json({
        success: false,
        message: '미리보기를 지원하지 않는 파일 형식입니다.'
      });
    }

    if (file.storageType === 's3') {
      // S3 파일 URL로 리다이렉트
      const signedUrl = await s3Service.getSignedUrl(file.s3Key);
      return res.redirect(signedUrl);
    } else {
      // 로컬 파일 스트리밍
      const filePath = path.join(uploadDir, file.filename);
      if (!isPathSafe(filePath, uploadDir)) {
        return res.status(400).json({
          success: false,
          message: '잘못된 파일 경로입니다.'
        });
      }

      const contentDisposition = file.getContentDisposition('inline');

      res.set({
        'Content-Type': file.mimetype,
        'Content-Disposition': contentDisposition,
        'Content-Length': file.size,
        'Cache-Control': 'public, max-age=31536000, immutable'
      });

      const fileStream = fs.createReadStream(filePath);
      fileStream.on('error', (error) => {
        console.error('File streaming error:', error);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: '파일 스트리밍 중 오류가 발생했습니다.'
          });
        }
      });

      fileStream.pipe(res);
    }
  } catch (error) {
    handleFileError(error, res);
  }
};

exports.deleteFile = async (req, res) => {
  try {
    const file = await File.findById(req.params.id);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: '파일을 찾을 수 없습니다.'
      });
    }

    if (file.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '파일을 삭제할 권한이 없습니다.'
      });
    }

    if (file.storageType === 's3') {
      // S3 파일 삭제
      await s3Service.deleteFile(file.s3Key);
    } else {
      // 로컬 파일 삭제
      const filePath = path.join(uploadDir, file.filename);
      if (!isPathSafe(filePath, uploadDir)) {
        return res.status(403).json({
          success: false,
          message: '잘못된 파일 경로입니다.'
        });
      }

      try {
        await fsPromises.access(filePath, fs.constants.W_OK);
        await fsPromises.unlink(filePath);
      } catch (unlinkError) {
        console.error('File deletion error:', unlinkError);
      }
    }

    await file.deleteOne();

    res.json({
      success: true,
      message: '파일이 삭제되었습니다.'
    });
  } catch (error) {
    console.error('File deletion error:', error);
    res.status(500).json({
      success: false,
      message: '파일 삭제 중 오류가 발생했습니다.',
      error: error.message
    });
  }
};

const isPathSafe = (filepath, directory) => {
  const resolvedPath = path.resolve(filepath);
  const resolvedDirectory = path.resolve(directory);
  return resolvedPath.startsWith(resolvedDirectory);
};

const generateSafeFilename = (originalFilename) => {
  const ext = path.extname(originalFilename || '').toLowerCase();
  const timestamp = Date.now();
  const randomBytes = crypto.randomBytes(8).toString('hex');
  return `${timestamp}_${randomBytes}${ext}`;
};