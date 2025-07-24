// Debug script to test detective game functionality
require('dotenv').config();
const detectiveGame = require('./services/detectiveGame');

async function testDetectiveGame() {
    console.log('Testing Detective Game...');
    
    // Test OpenAI API key
    console.log('OpenAI API Key:', process.env.OPENAI_API_KEY ? 'Set' : 'Not Set');
    
    try {
        // Initialize game
        console.log('1. Initializing game...');
        const gameState = detectiveGame.initializeGame('test-user', 'test-room');
        console.log('Game initialized:', !!gameState);
        
        // Process test message
        console.log('2. Processing test message...');
        const response = await detectiveGame.processPlayerMessage('test-user', '@smokinggun 안녕하세요', []);
        
        console.log('3. Response received:');
        console.log('- Success:', response.success);
        console.log('- Response length:', response.response?.length || 0);
        console.log('- Response preview:', response.response?.substring(0, 100) + '...');
        console.log('- Mood:', response.mood);
        
    } catch (error) {
        console.error('Error testing detective game:', error);
        console.error('Stack:', error.stack);
    }
}

testDetectiveGame();
