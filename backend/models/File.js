const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema({
  filename: { 
    type: String, 
    required: true,
    index: true,
    // S3 키 기반으로 파일명 패턴 변경 (UUID 포함)
    validate: {
      validator: function(v) {
        return /^[0-9]+-[a-f0-9]+-[a-zA-Z0-9가-힣_-]+\.[a-z0-9]+$/.test(v);
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
        
        // 파일명에서 경로 구분자 제거
        const sanitizedName = name.replace(/[\/\\]/g, '');
        
        // 유니코드 정규화 (NFC)
        return sanitizedName.normalize('NFC');
      } catch (error) {
        console.error('Filename sanitization error:', error);
        return name;
      }
    },
    get: function(name) {
      try {
        if (!name) return '';
        
        // 유니코드 정규화된 형태로 반환
        return name.normalize('NFC');
      } catch (error) {
        console.error('Filename retrieval error:', error);
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
  path: { 
    type: String,
    required: true // S3 URL이 저장됨 (https://bucket.s3.region.amazonaws.com/key)
  },
  s3Key: {
    type: String,
    required: true, // S3 객체 키 (user-files/userId/filename)
    index: true
  },
  s3Bucket: {
    type: String,
    required: true,
    default: process.env.S3_BUCKET_NAME
  },
  uploadDate: { 
    type: Date, 
    default: Date.now,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { getters: true },
  toObject: { getters: true }
});

// 복합 인덱스 - S3 키와 사용자 기준으로 유니크
FileSchema.index({ s3Key: 1, user: 1 }, { unique: true });
FileSchema.index({ user: 1, uploadDate: -1 });
FileSchema.index({ user: 1, originalname: 'text', filename: 'text' });

// 파일 삭제 전 S3에서도 삭제
FileSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
  try {
    const AWS = require('aws-sdk');
    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION
    });

    if (this.s3Key && this.s3Bucket) {
      await s3.deleteObject({
        Bucket: this.s3Bucket,
        Key: this.s3Key
      }).promise();
      console.log(`S3 file deleted: ${this.s3Key}`);
    }
    next();
  } catch (error) {
    console.error('S3 file deletion error:', error);
    // S3 삭제 실패해도 DB 삭제는 진행 (파일이 이미 없을 수 있음)
    next();
  }
});

// 구버전 호환을 위한 remove 훅도 유지
FileSchema.pre('remove', async function(next) {
  try {
    const AWS = require('aws-sdk');
    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION
    });

    if (this.s3Key && this.s3Bucket) {
      await s3.deleteObject({
        Bucket: this.s3Bucket,
        Key: this.s3Key
      }).promise();
      console.log(`S3 file deleted: ${this.s3Key}`);
    }
    next();
  } catch (error) {
    console.error('S3 file deletion error:', error);
    next();
  }
});

// URL 안전한 파일명 생성을 위한 유틸리티 메서드
FileSchema.methods.getSafeFilename = function() {
  return this.filename;
};

// Content-Disposition 헤더를 위한 파일명 인코딩 메서드 (기존 로직 유지)
FileSchema.methods.getEncodedFilename = function() {
  try {
    const filename = this.originalname;
    if (!filename) return '';

    // RFC 5987에 따른 인코딩
    const encodedFilename = encodeURIComponent(filename)
      .replace(/'/g, "%27")
      .replace(/\(/g, "%28")
      .replace(/\)/g, "%29")
      .replace(/\*/g, "%2A");

    return {
      legacy: filename.replace(/[^\x20-\x7E]/g, ''), // ASCII only for legacy clients
      encoded: `UTF-8''${encodedFilename}` // RFC 5987 format
    };
  } catch (error) {
    console.error('Filename encoding error:', error);
    return {
      legacy: this.filename,
      encoded: this.filename
    };
  }
};

// S3 기반 파일 URL 생성 메서드 (API 엔드포인트 대신 S3 직접 URL 반환)
FileSchema.methods.getFileUrl = function(type = 'download') {
  if (type === 'direct') {
    return this.path; // S3 직접 URL
  }
  // API를 통한 pre-signed URL 생성 엔드포인트
  return `/api/files/${this._id}/${type}`;
};

// 다운로드용 Content-Disposition 헤더 생성 메서드 (기존 로직 유지)
FileSchema.methods.getContentDisposition = function(type = 'attachment') {
  const { legacy, encoded } = this.getEncodedFilename();
  return `${type}; filename="${legacy}"; filename*=${encoded}`;
};

// 파일 MIME 타입 검증 메서드 (기존 로직 확장)
FileSchema.methods.isPreviewable = function() {
  const previewableTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'video/mp4', 'video/webm', 'video/ogg',
    'audio/mpeg', 'audio/wav', 'audio/ogg',
    'application/pdf',
    'text/plain', 'text/html', 'text/css', 'text/javascript',
    'application/json'
  ];
  return previewableTypes.includes(this.mimetype);
};

// 파일 크기를 사람이 읽기 쉬운 형태로 변환
FileSchema.methods.getHumanReadableSize = function() {
  const bytes = this.size;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

// S3 pre-signed URL 생성 메서드
FileSchema.methods.generatePresignedUrl = function(operation = 'getObject', expiresIn = 3600) {
  const AWS = require('aws-sdk');
  const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
  });

  const params = {
    Bucket: this.s3Bucket,
    Key: this.s3Key,
    Expires: expiresIn
  };

  // 다운로드용 파라미터 추가
  if (operation === 'getObject') {
    params.ResponseContentDisposition = this.getContentDisposition('attachment');
  }

  return s3.getSignedUrl(operation, params);
};

// 파일 타입별 아이콘 반환 메서드
FileSchema.methods.getFileIcon = function() {
  const type = this.mimetype.toLowerCase();
  
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  if (type === 'application/pdf') return 'pdf';
  if (type.includes('word') || type.includes('document')) return 'document';
  if (type.includes('sheet') || type.includes('excel')) return 'spreadsheet';
  if (type.includes('presentation') || type.includes('powerpoint')) return 'presentation';
  if (type.startsWith('text/') || type === 'application/json') return 'text';
  if (type.includes('zip') || type.includes('rar') || type.includes('tar')) return 'archive';
  
  return 'file';
};

// S3 객체 메타데이터 업데이트 메서드
FileSchema.methods.updateS3Metadata = async function(metadata = {}) {
  try {
    const AWS = require('aws-sdk');
    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION
    });

    await s3.copyObject({
      Bucket: this.s3Bucket,
      CopySource: `${this.s3Bucket}/${this.s3Key}`,
      Key: this.s3Key,
      Metadata: {
        originalname: this.originalname,
        uploaddate: this.uploadDate.toISOString(),
        userid: this.user.toString(),
        ...metadata
      },
      MetadataDirective: 'REPLACE'
    }).promise();

    return true;
  } catch (error) {
    console.error('S3 metadata update error:', error);
    return false;
  }
};

module.exports = mongoose.model('File', FileSchema);