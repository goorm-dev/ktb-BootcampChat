const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema({
  // 기존 필드들 유지
  filename: {
    type: String,
    required: true,
    index: true,
    validate: {
      validator: function(v) {
        return /^[0-9]+_[a-f0-9]+\.[a-z0-9]+$/.test(v);
      },
      message: '올바르지 않은 파일명 형식입니다.'
    }
  },
  originalname: {
    type: String,
    required: true,
    set: function(name) {
      try {
        if (!name) return '';
        const sanitizedName = name.replace(/[\/\\]/g, '');
        return sanitizedName.normalize('NFC');
      } catch (error) {
        console.error('Filename sanitization error:', error);
        return name;
      }
    }
  },
  mimetype: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true,
    min: 0
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // S3 관련 새로운 필드들
  s3Key: {
    type: String,
    index: true
  },
  s3Location: String,
  storageType: {
    type: String,
    enum: ['local', 's3'],
    default: 'local'
  },
  path: {
    type: String,
    required: function() {
      return this.storageType === 'local';
    }
  },
  uploadDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  migratedToS3: {
    type: Boolean,
    default: false
  },
  migrationDate: Date
}, {
  timestamps: true,
  toJSON: { getters: true },
  toObject: { getters: true }
}, {
  timestamps: true,
  toJSON: { getters: true },
  toObject: { getters: true }
});

const PREVIEWABLE_MIMETYPES = new Set([
  // 이미지
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',

  // PDF
  'application/pdf',

  // 텍스트
  'text/plain',
  'text/csv',
  'text/html',

  // 문서
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);

FileSchema.methods.isPreviewable = function() {
  return PREVIEWABLE_MIMETYPES.has(this.mimetype);
};

FileSchema.methods.getContentDisposition = function(type = 'attachment') {
  const filename = encodeURIComponent(this.originalname);
  return `${type}; filename="${filename}"; filename*=UTF-8''${filename}`;
};

// 기존 인덱스 유지
FileSchema.index({ filename: 1, user: 1 }, { unique: true });

// S3 URL 생성 메서드 추가
FileSchema.methods.getFileUrl = function(type = 'download') {
  const s3Service = require('../services/s3Service');

  if (this.storageType === 's3') {
    if (type === 'download') {
      return s3Service.getSignedUrl(this.s3Key);
    } else {
      return s3Service.getCloudFrontUrl(this.s3Key) || s3Service.getSignedUrl(this.s3Key);
    }
  }

  return `/api/files/${type}/${encodeURIComponent(this.filename)}`;
};

// 파일 삭제 전 처리 수정
FileSchema.pre('remove', async function(next) {
  try {
    const s3Service = require('../services/s3Service');

    if (this.storageType === 'local' && this.path) {
      const fs = require('fs').promises;
      await fs.unlink(this.path);
    } else if (this.storageType === 's3' && this.s3Key) {
      await s3Service.deleteFile(this.s3Key);
    }
    next();
  } catch (error) {
    console.error('File removal error:', error);
    next(error);
  }
});

const File = mongoose.model('File', FileSchema);
module.exports = File;