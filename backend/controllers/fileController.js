const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const File = require('../models/File');
const path = require('path');
const Message = require('../models/Message');
const Room = require('../models/Room');
const { processFileForRAG } = require('../services/fileService');

const fs = require('fs');
const { promisify } = require('util');
const crypto = require('crypto');
const { uploadDir } = require('../middleware/upload');

// AWS S3 설정
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const UPLOAD_FOLDER = 'user-files';

const fsPromises = {
  writeFile: promisify(fs.writeFile),
  unlink: promisify(fs.unlink),
  access: promisify(fs.access),
  mkdir: promisify(fs.mkdir),
  rename: promisify(fs.rename)
};

const isPathSafe = (filepath, directory) => {
  const resolvedPath = path.resolve(filepath);
  const resolvedDirectory = path.resolve(directory);
  return resolvedPath.startsWith(resolvedDirectory);
};

const generateSafeFilename = (originalName) => {
  const timestamp = Date.now();
  const randomId = uuidv4().substring(0, 8);
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext)
    .replace(/[^a-zA-Z0-9가-힣]/g, '_')
    .substring(0, 50);
  return `${timestamp}-${randomId}-${baseName}${ext}`;
};

// 개선된 파일 정보 조회 함수
const getFileFromRequest = async (req) => {
  try {
    const filename = req.params.filename;
    const token = req.headers['x-auth-token'] || req.query.token;
    const sessionId = req.headers['x-session-id'] || req.query.sessionId;
    
    if (!filename) {
      throw new Error('Invalid filename');
    }

    if (!token || !sessionId) {
      throw new Error('Authentication required');
    }

    const filePath = path.join(uploadDir, filename);
    if (!isPathSafe(filePath, uploadDir)) {
      throw new Error('Invalid file path');
    }

    await fsPromises.access(filePath, fs.constants.R_OK);

    const file = await File.findOne({ filename: filename });
    if (!file) {
      throw new Error('File not found in database');
    }

    // 채팅방 권한 검증을 위한 메시지 조회
    const message = await Message.findOne({ file: file._id });
    if (!message) {
      throw new Error('File message not found');
    }

    // 사용자가 해당 채팅방의 참가자인지 확인
    const room = await Room.findOne({
      _id: message.room,
      participants: req.user.id
    });

    if (!room) {
      throw new Error('Unauthorized access');
    }

    return { file, filePath };
  } catch (error) {
    console.error('getFileFromRequest error:', {
      filename: req.params.filename,
      error: error.message
    });
    throw error;
  }
};

// Pre-signed URL 생성 (업로드용)
exports.getUploadPresignedUrl = async (req, res) => {
  try {
    const { fileName, fileType, fileSize } = req.body;

    // 파일 유효성 검사
    if (!fileName || !fileType || !fileSize) {
      return res.status(400).json({
        success: false,
        message: '파일명, 타입, 크기가 모두 필요합니다.'
      });
    }

    const maxSize = 100 * 1024 * 1024; // 100MB
    if (fileSize > maxSize) {
      return res.status(400).json({
        success: false,
        message: '파일 크기는 100MB를 초과할 수 없습니다.'
      });
    }

    // 허용된 파일 타입 체크 (필요에 따라 수정)
    const allowedTypes = [
      'image/', 'text/', 'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];

    const isAllowedType = allowedTypes.some(type => fileType.startsWith(type) || fileType === type);
    if (!isAllowedType) {
      return res.status(400).json({
        success: false,
        message: '지원하지 않는 파일 형식입니다.'
      });
    }

    // 안전한 파일명 생성
    const safeFilename = generateSafeFilename(fileName);
    const s3Key = `${UPLOAD_FOLDER}/${req.user.id}/${safeFilename}`;

    // Pre-signed URL 생성 파라미터
    const uploadParams = {
      Bucket: BUCKET_NAME,
      Key: s3Key,
      ContentType: fileType,
      Expires: 300 // 5분
    };

    // Pre-signed URL 생성
    const uploadUrl = s3.getSignedUrl('putObject', uploadParams);

    res.json({
      success: true,
      uploadUrl,
      s3Key,
      safeFilename,
      message: 'Pre-signed URL이 생성되었습니다.'
    });

  } catch (error) {
    console.error('Pre-signed URL generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Pre-signed URL 생성 중 오류가 발생했습니다.'
    });
  }
};

// 파일 업로드 완료 처리
exports.completeFileUpload = async (req, res) => {
  try {
    const { s3Key, originalName, mimetype, size, safeFilename } = req.body;

    if (!s3Key || !originalName || !mimetype || !size || !safeFilename) {
      return res.status(400).json({
        success: false,
        message: '필수 파일 정보가 누락되었습니다.'
      });
    }

    // S3에서 파일 존재 여부 확인
    try {
      await s3.headObject({
        Bucket: BUCKET_NAME,
        Key: s3Key
      }).promise();
    } catch (error) {
      if (error.code === 'NotFound') {
        return res.status(400).json({
          success: false,
          message: '업로드된 파일을 찾을 수 없습니다.'
        });
      }
      throw error;
    }

    // 파일 정보를 DB에 저장
    const fileUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
    
    const file = new File({
      filename: safeFilename,
      originalname: originalName,
      mimetype: mimetype,
      size: parseInt(size),
      user: req.user.id,
      path: fileUrl, // S3 URL을 path로 저장
      s3Key: s3Key   // S3 키 별도 저장 (삭제시 필요)
    });

    await file.save();

    res.status(200).json({
      success: true,
      message: '파일 업로드 성공',
      file: {
        _id: file._id,
        filename: file.filename,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        uploadDate: file.uploadDate,
        url: fileUrl
      }
    });

  } catch (error) {
    console.error('File upload completion error:', error);
    
    // 업로드 완료 처리 실패 시 S3에서 파일 삭제
    if (req.body.s3Key) {
      try {
        await s3.deleteObject({
          Bucket: BUCKET_NAME,
          Key: req.body.s3Key
        }).promise();
      } catch (deleteError) {
        console.error('S3 file cleanup error:', deleteError);
      }
    }

    res.status(500).json({
      success: false,
      message: '파일 업로드 완료 처리 중 오류가 발생했습니다.',
      error: error.message
    });
  }
};

// 파일 다운로드 (Pre-signed URL 생성)
exports.downloadFile = async (req, res) => {
  try {
    const { filename } = req.params;
    
    // 파일명으로 파일 찾기
    const file = await File.findOne({ 
      filename: filename, 
      user: req.user.id 
    });
    
    if (!file) {
      return res.status(404).json({
        success: false,
        message: '파일을 찾을 수 없습니다.'
      });
    }

    // 파일 접근 권한 확인 (필요에 따라 수정)
    if (file.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '파일에 접근할 권한이 없습니다.'
      });
    }

    // S3 파일 존재 여부 확인
    try {
      await s3.headObject({
        Bucket: BUCKET_NAME,
        Key: file.s3Key
      }).promise();
    } catch (error) {
      if (error.code === 'NotFound') {
        return res.status(404).json({
          success: false,
          message: '파일을 찾을 수 없습니다.'
        });
      }
      throw error;
    }

    // 다운로드용 Pre-signed URL 생성
    const downloadUrl = s3.getSignedUrl('getObject', {
      Bucket: BUCKET_NAME,
      Key: file.s3Key,
      Expires: 3600, // 1시간
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(file.originalname)}"`
    });

    res.json({
      success: true,
      downloadUrl,
      filename: file.originalname,
      message: '다운로드 URL이 생성되었습니다.'
    });

  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({
      success: false,
      message: '파일 다운로드 중 오류가 발생했습니다.'
    });
  }
};

// 파일 미리보기 (Pre-signed URL 생성)
exports.viewFile = async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    
    if (!file) {
      return res.status(404).json({
        success: false,
        message: '파일을 찾을 수 없습니다.'
      });
    }

    // 미리보기 가능한 파일 타입 확인
    const previewableTypes = ['image/', 'text/', 'application/pdf'];
    const isPreviewable = previewableTypes.some(type => file.mimetype.startsWith(type));
    
    if (!isPreviewable) {
      return res.status(415).json({
        success: false,
        message: '미리보기를 지원하지 않는 파일 형식입니다.'
      });
    }

    // 파일 접근 권한 확인 (필요에 따라 수정)
    if (file.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '파일에 접근할 권한이 없습니다.'
      });
    }

    // S3 파일 존재 여부 확인
    try {
      await s3.headObject({
        Bucket: BUCKET_NAME,
        Key: file.s3Key
      }).promise();
    } catch (error) {
      if (error.code === 'NotFound') {
        return res.status(404).json({
          success: false,
          message: '파일을 찾을 수 없습니다.'
        });
      }
      throw error;
    }

    // 미리보기용 Pre-signed URL 생성
    const viewUrl = s3.getSignedUrl('getObject', {
      Bucket: BUCKET_NAME,
      Key: file.s3Key,
      Expires: 3600, // 1시간
      ResponseContentDisposition: `inline; filename="${encodeURIComponent(file.originalname)}"`
    });

    res.json({
      success: true,
      viewUrl,
      filename: file.originalname,
      mimetype: file.mimetype,
      message: '미리보기 URL이 생성되었습니다.'
    });

  } catch (error) {
    console.error('File view error:', error);
    res.status(500).json({
      success: false,
      message: '파일 미리보기 중 오류가 발생했습니다.'
    });
  }
};

const handleFileStream = (fileStream, res) => {
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
};

const handleFileError = (error, res) => {
  console.error('File operation error:', {
    message: error.message,
    stack: error.stack
  });

  // 에러 상태 코드 및 메시지 매핑
  const errorResponses = {
    'Invalid filename': { status: 400, message: '잘못된 파일명입니다.' },
    'Authentication required': { status: 401, message: '인증이 필요합니다.' },
    'Invalid file path': { status: 400, message: '잘못된 파일 경로입니다.' },
    'File not found in database': { status: 404, message: '파일을 찾을 수 없습니다.' },
    'File message not found': { status: 404, message: '파일 메시지를 찾을 수 없습니다.' },
    'Unauthorized access': { status: 403, message: '파일에 접근할 권한이 없습니다.' },
    'ENOENT': { status: 404, message: '파일을 찾을 수 없습니다.' }
  };

  const errorResponse = errorResponses[error.message] || {
    status: 500,
    message: '파일 처리 중 오류가 발생했습니다.'
  };

  res.status(errorResponse.status).json({
    success: false,
    message: errorResponse.message
  });
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

    // S3에서 파일 삭제 (추가 필요)
    if (file.s3Key) {
      try {
        await s3.deleteObject({
          Bucket: BUCKET_NAME,
          Key: file.s3Key
        }).promise();
      } catch (error) {
        console.error('S3 file deletion error:', error);
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

// 사용자의 파일 목록 조회
exports.getUserFiles = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const skip = (page - 1) * limit;

    // 검색 조건
    const searchCondition = {
      user: req.user.id,
      ...(search && {
        $or: [
          { originalname: { $regex: search, $options: 'i' } },
          { filename: { $regex: search, $options: 'i' } }
        ]
      })
    };

    // 파일 목록 조회
    const files = await File.find(searchCondition)
      .select('filename originalname mimetype size uploadDate')
      .sort({ uploadDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // 전체 개수
    const total = await File.countDocuments(searchCondition);

    res.json({
      success: true,
      files,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: files.length,
        totalFiles: total
      }
    });

  } catch (error) {
    console.error('Get user files error:', error);
    res.status(500).json({
      success: false,
      message: '파일 목록 조회 중 오류가 발생했습니다.'
    });
  }
};

// 파일 정보 조회
exports.getFileInfo = async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    
    if (!file) {
      return res.status(404).json({
        success: false,
        message: '파일을 찾을 수 없습니다.'
      });
    }

    // 파일 접근 권한 확인 (필요에 따라 수정)
    if (file.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '파일에 접근할 권한이 없습니다.'
      });
    }

    res.json({
      success: true,
      file: {
        _id: file._id,
        filename: file.filename,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        uploadDate: file.uploadDate,
        url: file.path
      }
    });

  } catch (error) {
    console.error('Get file info error:', error);
    res.status(500).json({
      success: false,
      message: '파일 정보 조회 중 오류가 발생했습니다.'
    });
  }
};