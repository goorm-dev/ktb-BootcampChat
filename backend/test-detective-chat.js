const mongoose = require('mongoose');
const Message = require('./models/Message');
require('dotenv').config();

async function testDetectiveGameIntegration() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('🔗 Connected to MongoDB');

    // Test creating detective game messages
    const roomId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();

    // Test game start message
    const gameStartMessage = new Message({
      room: roomId,
      type: 'system',
      gameType: 'detective',
      subType: 'game_start',
      content: '탐정 게임이 시작되었습니다!',
      timestamp: new Date()
    });

    await gameStartMessage.save();
    console.log('✅ Game start message created:', gameStartMessage._id);

    // Test investigation areas message
    const areasMessage = new Message({
      room: roomId,
      type: 'system',
      gameType: 'detective',
      subType: 'investigation_areas',
      content: '수사 구역을 선택하여 증거를 찾으세요.',
      timestamp: new Date()
    });

    await areasMessage.save();
    console.log('✅ Investigation areas message created:', areasMessage._id);

    // Test evidence found message with data
    const evidenceMessage = new Message({
      room: roomId,
      type: 'system',
      gameType: 'detective',
      subType: 'evidence_found',
      content: 'Force Push 로그를 발견했습니다!',
      data: {
        id: 'forced_push_log',
        name: 'Force Push 로그',
        critical: true,
        area: 'Git 로그',
        description: '스티브가 오후 3:42에 production 브랜치에 강제 푸시를 실행한 기록이 발견되었습니다.',
        content: 'git log --oneline --graph\n* a1b2c3d (HEAD -> production) Emergency fix'
      },
      timestamp: new Date()
    });

    await evidenceMessage.save();
    console.log('✅ Evidence message created:', evidenceMessage._id);

    // Test Steve AI message
    const steveMessage = new Message({
      room: roomId,
      type: 'ai',
      gameType: 'detective',
      character: 'steve',
      content: '뭐? 나한테 뭘 묻는 거야? 난 아무것도 모른다구.',
      mood: 'defensive',
      pressure: 25,
      timestamp: new Date()
    });

    await steveMessage.save();
    console.log('✅ Steve message created:', steveMessage._id);

    // Test user detective message
    const userMessage = new Message({
      room: roomId,
      sender: userId,
      type: 'user',
      gameType: 'detective',
      content: '스티브, 너가 force push한 기록이 있어. 설명해봐.',
      timestamp: new Date()
    });

    await userMessage.save();
    console.log('✅ User detective message created:', userMessage._id);

    // Query detective game messages
    const detectiveMessages = await Message.find({
      room: roomId,
      gameType: 'detective'
    }).sort({ timestamp: 1 });

    console.log('\n🎮 Detective Game Messages:');
    detectiveMessages.forEach((msg, index) => {
      console.log(`${index + 1}. [${msg.type}${msg.subType ? ':' + msg.subType : ''}${msg.character ? ':' + msg.character : ''}] ${msg.content.substring(0, 50)}...`);
      if (msg.mood) console.log(`   Mood: ${msg.mood}, Pressure: ${msg.pressure}`);
      if (msg.data) console.log(`   Data: ${msg.data.name || 'Evidence data present'}`);
    });

    // Clean up test data
    await Message.deleteMany({ room: roomId });
    console.log('\n🧹 Test data cleaned up');

    console.log('\n✅ Detective game integration test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run test
testDetectiveGameIntegration();