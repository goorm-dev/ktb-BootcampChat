const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// S3 Presigned URL 방식에 맞는 새로운 스키마
const FileSchema = new Schema({
  originalName: {
    type: String,
    required: true,
  },
  mimeType: {
    type: String,
    required: true,
  },
  size: {
    type: Number,
    required: true,
  },
  // 'user' 대신 'uploader'를 사용합니다.
  uploader: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  room: {
    type: Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
  },
  // 'filename' 대신 's3Key'를 고유 키로 사용합니다.
  s3Key: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  },
  url: {
      type: String,
  },
}, { timestamps: true });

// 채팅방 ID 기반 조회를 위한 인덱스
FileSchema.index({ room: 1, createdAt: -1 });

// 기존의 복합 인덱스와 불필요한 메서드들은 모두 제거합니다.

module.exports = mongoose.model('File', FileSchema);
