// artillery/scenarios.js
process.env.TS_NODE_TRANSPILE_ONLY = 'true';
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  strict: false,
  noImplicitAny: false,
  module: 'commonjs'
});

require('ts-node/register');

const { TestHelpers } = require('../test/helpers/test-helpers');

// 메시징 플로우
async function messagingFlow(page, vuContext, events) {
  const helpers = new TestHelpers();
  
  try {
    console.log('Starting messaging flow...');
    
    const userId = vuContext.vuid || Math.floor(Math.random() * 10000);
    const userCreds = helpers.generateUserCredentials(userId);
    
    await page.goto('http://localhost:3000');
    await helpers.registerUser(page, userCreds);
    
    const roomName = await helpers.joinOrCreateRoom(page, 'LoadTest-Chat');
    
    // 메시지 전송
    for (let i = 0; i < 3; i++) {
      await helpers.sendMessage(page, `테스트 메시지 ${i + 1}`);
      await page.waitForTimeout(1000);
    }
    
    // 성공 메트릭
    if (events) {
      events.emit('counter', 'messaging.success', 1);
      events.emit('histogram', 'messaging.duration', Date.now() - vuContext.vars.$loopStartTime);
    }
    
  } catch (error) {
    console.error('Messaging flow error:', error);
    if (events) {
      events.emit('counter', 'messaging.error', 1);
    }
  }
}

// AI 대화 플로우
async function aiConversationFlow(page, vuContext, events) {
  const helpers = new TestHelpers();
  
  try {
    console.log('Starting AI conversation flow...');
    
    const userId = vuContext.vuid || Math.floor(Math.random() * 10000);
    const userCreds = helpers.getTestUser(userId % 70);
    
    await page.goto('http://localhost:3000');
    await helpers.registerUser(page, userCreds);
    
    const roomName = await helpers.joinOrCreateRoom(page, 'AI-Conversation');
    
    // AI 메시지
    await helpers.sendAIMessage(page, '안녕하세요!', 'wayneAI');
    await page.waitForTimeout(3000);
    
    if (events) {
      events.emit('counter', 'ai.conversation.success', 1);
    }
    
  } catch (error) {
    console.error('AI conversation error:', error);
    if (events) {
      events.emit('counter', 'ai.conversation.error', 1);
    }
  }
}

// 실시간 플로우
async function realtimeFlow(page, vuContext, events) {
  const helpers = new TestHelpers();
  
  try {
    console.log('Starting realtime flow...');
    
    const userId = vuContext.vuid || Math.floor(Math.random() * 10000);
    const userCreds = helpers.generateUserCredentials(userId + 20000);
    
    await page.goto('http://localhost:3000');
    await helpers.registerUser(page, userCreds);
    
    const roomName = await helpers.joinOrCreateRoom(page, 'Realtime-Test');
    
    // 빠른 메시지 전송
    for (let i = 0; i < 5; i++) {
      await helpers.sendMessage(page, `실시간 메시지 ${i + 1}`);
      await page.waitForTimeout(200);
    }
    
    if (events) {
      events.emit('counter', 'realtime.success', 1);
    }
    
  } catch (error) {
    console.error('Realtime flow error:', error);
    if (events) {
      events.emit('counter', 'realtime.error', 1);
    }
  }
}

// 파일 업로드 플로우  
async function fileUploadFlow(page, vuContext, events) {
  const helpers = new TestHelpers();
  
  try {
    console.log('Starting file upload flow...');
    
    const userId = vuContext.vuid || Math.floor(Math.random() * 10000);
    const userCreds = helpers.generateUserCredentials(userId + 10000);
    
    await page.goto('http://localhost:3000');
    await helpers.registerUser(page, userCreds);
    
    const roomName = await helpers.joinOrCreateRoom(page, 'File-Upload');
    
    // 간단한 메시지만 전송 (파일 업로드는 나중에)
    await helpers.sendMessage(page, '파일 공유 테스트');
    
    if (events) {
      events.emit('counter', 'fileupload.success', 1);
    }
    
  } catch (error) {
    console.error('File upload error:', error);
    if (events) {
      events.emit('counter', 'fileupload.error', 1);
    }
  }
}

module.exports = {
  messagingFlow,
  aiConversationFlow,
  realtimeFlow,
  fileUploadFlow
};