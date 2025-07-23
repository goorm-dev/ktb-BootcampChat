const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  room: { 
    type: String, 
    required: [true, '채팅방 ID는 필수입니다.'],
    index: true
  },
  content: { 
    type: String,
    required: function() {
      return this.type !== 'file';
    },
    trim: true,
    maxlength: [10000, '메시지는 10000자를 초과할 수 없습니다.']
  },
  sender: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    index: true 
  },
  type: { 
    type: String, 
    enum: ['text', 'system', 'ai', 'file'], 
    default: 'text',
    index: true
  },
  file: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File',
    required: function() {
      return this.type === 'file';
    }
  },
  aiType: {
    type: String,
    enum: ['wayneAI', 'consultingAI'],
    required: function() { 
      return this.type === 'ai'; 
    }
  },
  mentions: [{ 
    type: String,
    trim: true
  }],
  timestamp: { 
    type: Date, 
    default: Date.now,
    index: true 
  },
  readers: [{
    userId: { 
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    readAt: { 
      type: Date,
      default: Date.now,
      required: true
    }
  }],
  reactions: {
    type: Map,
    of: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    default: new Map()
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    getters: true 
  },
  toObject: { 
    virtuals: true,
    getters: true 
  }
});

// 복합 인덱스 설정
MessageSchema.index({ room: 1, timestamp: -1 });
MessageSchema.index({ room: 1, isDeleted: 1 });
MessageSchema.index({ 'readers.userId': 1 });
MessageSchema.index({ sender: 1 });
MessageSchema.index({ type: 1 });
MessageSchema.index({ timestamp: -1 });
MessageSchema.index({ 'reactions.userId': 1 });

// 읽음 처리 Static 메소드 개선
MessageSchema.statics.markAsRead = async function(messageIds, userId) {
  if (!messageIds?.length || !userId) return;

  const bulkOps = messageIds.map(messageId => ({
    updateOne: {
      filter: {
        _id: messageId,
        isDeleted: false,
        'readers.userId': { $ne: userId }
      },
      update: {
        $push: {
          readers: {
            userId: new mongoose.Types.ObjectId(userId),
            readAt: new Date()
          }
        }
      }
    }
  }));

  try {
    const result = await this.bulkWrite(bulkOps, { ordered: false });
    return result.modifiedCount;
  } catch (error) {
    console.error('Mark as read error:', {
      error,
      messageIds,
      userId
    });
    throw error;
  }
};

// 리액션 처리 메소드 개선
MessageSchema.methods.addReaction = async function(emoji, userId) {
  try {
    if (!this.reactions) {
      this.reactions = new Map();
    }

    const userReactions = this.reactions.get(emoji) || [];
    if (!userReactions.includes(userId)) {
      userReactions.push(userId);
      this.reactions.set(emoji, userReactions);
      await this.save();
    }
    
    return this.reactions.get(emoji);
  } catch (error) {
    console.error('Add reaction error:', {
      error,
      messageId: this._id,
      emoji,
      userId
    });
    throw error;
  }
};

MessageSchema.methods.removeReaction = async function(emoji, userId) {
  try {
    if (!this.reactions || !this.reactions.has(emoji)) return;

    const userReactions = this.reactions.get(emoji) || [];
    const updatedReactions = userReactions.filter(id => 
      id.toString() !== userId.toString()
    );
    
    if (updatedReactions.length === 0) {
      this.reactions.delete(emoji);
    } else {
      this.reactions.set(emoji, updatedReactions);
    }
    
    await this.save();
    return this.reactions.get(emoji);
  } catch (error) {
    console.error('Remove reaction error:', {
      error,
      messageId: this._id,
      emoji,
      userId
    });
    throw error;
  }
};

// 메시지 소프트 삭제 메소드 추가
MessageSchema.methods.softDelete = async function() {
  this.isDeleted = true;
  await this.save();
};

// 메시지 삭제 전 후크 개선
MessageSchema.pre('remove', async function(next) {
  try {
    if (this.type === 'file' && this.file) {
      const File = mongoose.model('File');
      await File.findByIdAndDelete(this.file);
    }
    next();
  } catch (error) {
    console.error('Message pre-remove error:', {
      error,
      messageId: this._id,
      type: this.type
    });
    next(error);
  }
});

// 메시지 저장 전 후크 개선
MessageSchema.pre('save', function(next) {
  try {
    if (this.content && this.type !== 'file') {
      this.content = this.content.trim();
    }

    if (this.mentions?.length) {
      this.mentions = [...new Set(this.mentions)];
    }

    next();
  } catch (error) {
    console.error('Message pre-save error:', {
      error,
      messageId: this._id
    });
    next(error);
  }
});

// JSON 변환 메소드 개선
MessageSchema.methods.toJSON = function() {
  try {
    const obj = this.toObject();
    
    // 불필요한 필드 제거
    delete obj.__v;
    delete obj.updatedAt;
    delete obj.isDeleted;
    
    // reactions Map을 일반 객체로 변환
    if (obj.reactions) {
      obj.reactions = Object.fromEntries(obj.reactions);
    }

    return obj;
  } catch (error) {
    console.error('Message toJSON error:', {
      error,
      messageId: this._id
    });
    return {};
  }
};

const Message = mongoose.model('Message', MessageSchema);
module.exports = Message;