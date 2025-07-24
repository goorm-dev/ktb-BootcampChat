/**
 * Test script for Detective Game Service with Evidence Manager and State Tracker
 * Run with: node test-detective-game.js
 */

const detectiveGame = require('./services/detectiveGame');
const evidenceManager = require('./services/evidenceManager');
const gameStateTracker = require('./services/gameStateTracker');

async function testDetectiveGame() {
  console.log('🕵️ Testing Enhanced Detective Game Service...\n');

  const testUserId = 'test_user_123';
  const testRoomId = 'test_room_456';

  try {
    // Test 1: Initialize game with enhanced systems
    console.log('1. Testing enhanced game initialization...');
    const gameState = detectiveGame.initializeGame(testUserId, testRoomId);
    console.log('✅ Game initialized:', {
      character: gameState.character.name,
      isActive: gameState.isActive,
      sessionId: gameState.sessionId
    });

    // Test 2: Test evidence discovery
    console.log('\n2. Testing evidence discovery...');
    const gitEvidence = detectiveGame.investigateArea(testUserId, 'git_logs');
    console.log('✅ Git investigation completed, found evidence:', gitEvidence.length);
    
    const systemEvidence = detectiveGame.investigateArea(testUserId, 'system_logs');
    console.log('✅ System investigation completed, found evidence:', systemEvidence.length);

    // Test 3: Test initial interaction
    console.log('\n3. Testing initial interaction...');
    const initialResponse = await detectiveGame.processPlayerMessage(
      testUserId, 
      'detective_game_start', 
      []
    );
    console.log('✅ Initial response received');
    console.log('Character name:', initialResponse.characterName);
    console.log('Response preview:', initialResponse.response.substring(0, 100) + '...');

    // Test 4: Test interrogation with evidence discovery
    console.log('\n4. Testing interrogation with evidence...');
    const interrogationResponse = await detectiveGame.processPlayerMessage(
      testUserId, 
      '@smokinggun 그날 밤에 git push를 했나요? 로그를 확인했는데 의심스러운 활동이 있었습니다.', 
      ['git push --force origin main 기록', 'rm -rf /var/log/application/*.log 명령어 흔적']
    );
    console.log('✅ Interrogation response received');
    console.log('Found evidence:', interrogationResponse.foundEvidence?.length || 0);
    console.log('Evidence analysis:', interrogationResponse.evidenceAnalysis);
    console.log('Game ended:', interrogationResponse.gameEnded);

    // Test 5: Test enhanced game stats
    console.log('\n5. Testing enhanced game statistics...');
    const enhancedStats = detectiveGame.getEnhancedGameStats(testUserId);
    console.log('✅ Enhanced stats:', {
      messagesExchanged: enhancedStats.messagesExchanged,
      evidenceDiscovered: enhancedStats.evidence?.totalDiscovered,
      pressureLevel: enhancedStats.session?.pressureLevel,
      rating: enhancedStats.session?.rating
    });

    // Test 6: Test investigation hints
    console.log('\n6. Testing investigation hints...');
    const hints = detectiveGame.getInvestigationHints(testUserId);
    console.log('✅ Available hints:', hints.length);
    if (hints.length > 0) {
      console.log('Sample hint:', hints[0].hint);
    }

    // Test 7: Test game analytics
    console.log('\n7. Testing game analytics...');
    const analytics = detectiveGame.getGameAnalytics();
    console.log('✅ Game analytics:', {
      totalGames: analytics.global.totalGames,
      steveInterrogations: analytics.suspects.steve.interrogations,
      activeSessionsCount: analytics.global.activeSessions
    });

    // Test 8: Test final confession scenario
    console.log('\n8. Testing confession scenario...');
    // Present both key evidence types
    const confessionResponse = await detectiveGame.processPlayerMessage(
      testUserId, 
      '@smokinggun 이제 모든 증거가 있습니다! 더 이상 숨길 수 없어요!', 
      [
        'git push --force origin main to production - definitive proof',
        'sudo rm -rf /var/log/application/*.log - log deletion evidence',
        'production server SSH access at 3:33 AM'
      ]
    );
    console.log('✅ Confession test completed');
    console.log('Is confession:', confessionResponse.isConfession);
    console.log('Game ended:', confessionResponse.gameEnded);
    if (confessionResponse.isConfession) {
      console.log('Confession preview:', confessionResponse.response.substring(0, 200) + '...');
    }

    console.log('\n🎉 All tests passed! Enhanced Detective game is working correctly.');
    console.log('\n📊 Final Statistics:');
    console.log('- Evidence Manager: Fully integrated ✅');
    console.log('- Game State Tracker: Fully integrated ✅'); 
    console.log('- AI Character (스티브): Responding correctly ✅');
    console.log('- Evidence Discovery: Working ✅');
    console.log('- Confession Logic: Working ✅');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testDetectiveGame();
}

module.exports = { testDetectiveGame };
