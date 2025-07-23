const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { encryptionKey, passwordSalt } = require('../config/keys');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, '이름은 필수 입력 항목입니다.'],
    trim: true,
    minlength: [2, '이름은 2자 이상이어야 합니다.']
  },
  email: {
    type: String,
    required: [true, '이메일은 필수 입력 항목입니다.'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      '올바른 이메일 형식이 아닙니다.'
    ]
  },
  encryptedEmail: {
    type: String,
    unique: true,
    sparse: true
  },
  password: {
    type: String,
    required: [true, '비밀번호는 필수 입력 항목입니다.'],
    minlength: [6, '비밀번호는 6자 이상이어야 합니다.'],
    select: false
  },
  profileImage: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActive: {
    type: Date,
    default: Date.now
  }
});

// 이메일 암호화 함수
function encryptEmail(email) {
  if (!email) return null;
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(encryptionKey, 'hex'), iv);
    let encrypted = cipher.update(email, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Email encryption error:', error);
    return null;
  }
}

// 비밀번호 해싱 및 이메일 암호화 미들웨어
UserSchema.pre('save', async function(next) {
  try {
    // 비밀번호 변경 시에만 해싱
    if (this.isModified('password')) {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }

    // 이메일 변경 시에만 암호화
    if (this.isModified('email')) {
      this.encryptedEmail = encryptEmail(this.email);
    }

    next();
  } catch (error) {
    next(error);
  }
});

// 비밀번호 비교 메서드
UserSchema.methods.matchPassword = async function(enteredPassword) {
  try {
    const user = await this.constructor.findById(this._id).select('+password');
    if (!user || !user.password) {
      return false;
    }
    return await bcrypt.compare(enteredPassword, user.password);
  } catch (error) {
    console.error('Password match error:', error);
    return false;
  }
};

// 토큰 생성 메서드
UserSchema.methods.generateVerificationToken = function() {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  return token;
};

// 활성 상태 업데이트 메서드
UserSchema.methods.updateLastActive = async function() {
  this.lastActive = new Date();
  return this.save();
};

// 사용자 정보 변경 메서드
UserSchema.methods.updateProfile = async function(updateData) {
  const allowedUpdates = ['name', 'profileImage'];
  const updates = {};

  Object.keys(updateData).forEach(key => {
    if (allowedUpdates.includes(key)) {
      updates[key] = updateData[key];
    }
  });

  Object.assign(this, updates);
  return this.save();
};

// 비밀번호 변경 메서드
UserSchema.methods.changePassword = async function(currentPassword, newPassword) {
  try {
    // 현재 비밀번호 확인
    const isMatch = await this.matchPassword(currentPassword);
    if (!isMatch) {
      throw new Error('현재 비밀번호가 일치하지 않습니다.');
    }

    // 새 비밀번호 설정
    this.password = newPassword;
    return this.save();
  } catch (error) {
    throw error;
  }
};

// 계정 삭제 메서드
UserSchema.methods.deleteAccount = async function() {
  try {
    // 연결된 데이터 삭제 로직 추가
    await this.constructor.deleteOne({ _id: this._id });
    return true;
  } catch (error) {
    throw error;
  }
};

// 이메일 복호화 메서드
UserSchema.methods.decryptEmail = function() {
  if (!this.encryptedEmail) return null;
  
  try {
    const [ivHex, encryptedHex] = this.encryptedEmail.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(encryptionKey, 'hex'), iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Email decryption error:', error);
    return null;
  }
};

// 인덱스 생성
UserSchema.index({ email: 1 });
UserSchema.index({ encryptedEmail: 1 }, { unique: true, sparse: true });
UserSchema.index({ createdAt: 1 });
UserSchema.index({ lastActive: 1 });

module.exports = mongoose.model('User', UserSchema);