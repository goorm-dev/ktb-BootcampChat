// Quick test for smokinggun AI
const aiService = require('./services/aiService');

async function testSmokinggun() {
  console.log('Testing @smokinggun AI...');
  
  try {
    const query = "hello";
    console.log('Sending query:', query);
    
    await aiService.generateResponse(query, 'smokinggun', {
      onStart: () => {
        console.log('✅ AI generation started');
      },
      onChunk: (chunk) => {
        console.log('📝 Chunk:', chunk.currentChunk);
      },
      onComplete: (finalContent) => {
        console.log('✅ Final response:', finalContent.content);
        console.log('Response length:', finalContent.content?.length);
        process.exit(0);
      },
      onError: (error) => {
        console.error('❌ AI error:', error);
        process.exit(1);
      }
    });
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testSmokinggun();
