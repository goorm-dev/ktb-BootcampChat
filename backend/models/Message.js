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
  // Detective game fields
  gameType: {
    type: String,
    enum: ['detective'],
    sparse: true
  },
  subType: {
    type: String,
    enum: ['game_start', 'investigation_areas', 'evidence_found', 'no_evidence', 'hints', 'evidence_list', 'rules', 'game_complete'],
    required: function() {
      return this.gameType && this.type === 'system';
    }
  },
  character: {
    type: String,
    enum: ['steve'],
    required: function() {
      return this.gameType === 'detective' && this.type === 'ai';
    }
  },
  mood: {
    type: String,
    enum: ['confident', 'nervous', 'angry', 'defensive', 'confused', 'defeated'],
    required: function() {
      return this.gameType === 'detective' && this.type === 'ai' && this.character === 'steve';
    }
  },
  pressure: {
    type: Number,
    min: 0,
    max: 100,
    required: function() {
      return this.gameType === 'detective' && this.type === 'ai' && this.character === 'steve';
    }
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: function() {
      return this.gameType === 'detective' && ['evidence_found', 'evidence_list', 'game_complete'].includes(this.subType);
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

// 🚀 MongoDB 인덱스 최적화
// 메시지 조회 최적화 인덱스
MessageSchema.index({ room: 1, timestamp: -1 }); // 채팅방별 시간순 조회
MessageSchema.index({ room: 1, isDeleted: 1, timestamp: -1 }); // 삭제되지 않은 메시지 조회
MessageSchema.index({ room: 1, type: 1, timestamp: -1 }); // 타입별 메시지 조회

// 사용자별 메시지 조회 인덱스
MessageSchema.index({ sender: 1, timestamp: -1 }); // 사용자가 보낸 메시지
MessageSchema.index({ sender: 1, room: 1 }); // 특정 채팅방에서 사용자 메시지
MessageSchema.index({ 'readers.userId': 1 }); // 읽음 상태 조회

// 검색 최적화 인덱스
MessageSchema.index({ content: 'text' }); // 메시지 내용 텍스트 검색
MessageSchema.index({ 
  room: 1, 
  content: 'text' 
}, { 
  background: true,
  name: 'message_search_idx'
}); // 채팅방별 메시지 검색

// 파일 메시지 조회 인덱스
MessageSchema.index({ room: 1, file: 1 }); // 채팅방별 파일 메시지
MessageSchema.index({ file: 1 }, { sparse: true }); // 파일별 메시지

// 성능 최적화 인덱스
MessageSchema.index({ 
  timestamp: -1 
}, { 
  partialFilterExpression: { isDeleted: false },
  name: 'active_messages_idx'
}); // 삭제되지 않은 메시지만

MessageSchema.index({
  room: 1,
  createdAt: -1
}, {
  background: true,
  name: 'room_messages_idx'
}); // 채팅방별 최신 메시지

// AI 메시지 조회 인덱스
MessageSchema.index({ 
  type: 1, 
  aiType: 1, 
  timestamp: -1 
}, { 
  sparse: true,
  name: 'ai_messages_idx'
}); // AI 메시지 타입별 조회

// Detective game 메시지 조회 인덱스
MessageSchema.index({
  gameType: 1,
  room: 1,
  timestamp: -1
}, {
  sparse: true,
  name: 'detective_game_idx'
}); // 탐정 게임 메시지 조회

// 읽음 상태 최적화 인덱스
MessageSchema.index({
  room: 1,
  'readers.userId': 1,
  timestamp: -1
}, {
  background: true,
  name: 'message_read_status_idx'
});

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