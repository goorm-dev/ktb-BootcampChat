const express = require('express');
const router = express.Router();
const detectiveGame = require('../../services/detectiveGame');
const { authenticateToken } = require('../../middleware/auth');

/**
 * Detective Game API Routes
 * Handles the cybercrime investigation minigame
 */

// Start a new detective game session
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.body;
    const userId = req.user.id;

    if (!roomId) {
      return res.status(400).json({
        success: false,
        message: 'Room ID is required'
      });
    }

    // Initialize new game session
    const gameState = detectiveGame.initializeGame(userId, roomId);

    res.json({
      success: true,
      message: 'Detective game started',
      gameState: {
        gameId: `detective_${userId}_${Date.now()}`,
        character: gameState.character,
        startTime: gameState.startTime,
        instructions: {
          objective: 'Interrogate 스모군 to get a confession',
          rules: [
            'You need to present TWO key pieces of evidence to make him confess:',
            '1. Evidence of force pushing directly to production',
            '2. Evidence of wiping logs to cover tracks',
            'Until then, he will deny everything and blame others'
          ],
          tips: [
            'He will try to deflect with technical jargon',
            'He loves to blame Jenkins, CI/CD, or other developers',
            'Be persistent and present specific evidence',
            'Address him using @smokinggun tag'
          ]
        }
      }
    });

  } catch (error) {
    console.error('Detective game start error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start detective game',
      error: error.message
    });
  }
});

// Send message to Steve (스모군) and get response
router.post('/interrogate', authenticateToken, async (req, res) => {
  try {
    const { message, evidence = [] } = req.body;
    const userId = req.user.id;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    // Check if game is active
    const gameState = detectiveGame.getGameState(userId);
    if (!gameState || !gameState.isActive) {
      return res.status(400).json({
        success: false,
        message: 'No active detective game found. Please start a new game first.'
      });
    }

    // Process the interrogation
    const response = await detectiveGame.processPlayerMessage(userId, message, evidence);

    if (!response.success) {
      return res.status(400).json(response);
    }

    res.json({
      success: true,
      characterResponse: response.response,
      mood: response.mood,
      gameEnded: response.gameEnded,
      isConfession: response.isConfession,
      character: response.characterName,
      metadata: {
        timestamp: new Date(),
        evidenceAnalyzed: evidence.length,
        gameStats: detectiveGame.getGameStats(userId)
      }
    });

  } catch (error) {
    console.error('Detective game interrogation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process interrogation',
      error: error.message
    });
  }
});

// Get current game state
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const gameState = detectiveGame.getGameState(userId);

    if (!gameState) {
      return res.json({
        success: true,
        hasActiveGame: false,
        message: 'No active detective game'
      });
    }

    const stats = detectiveGame.getGameStats(userId);

    res.json({
      success: true,
      hasActiveGame: gameState.isActive,
      gameState: {
        character: gameState.character,
        startTime: gameState.startTime,
        endTime: gameState.endTime,
        isActive: gameState.isActive,
        confessionTriggered: gameState.confessionTriggered,
        conversationLength: gameState.conversationHistory.length
      },
      stats
    });

  } catch (error) {
    console.error('Detective game status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get game status',
      error: error.message
    });
  }
});

// End current game session
router.post('/end', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const gameState = detectiveGame.endGame(userId);

    if (!gameState) {
      return res.status(400).json({
        success: false,
        message: 'No active game to end'
      });
    }

    const finalStats = detectiveGame.getGameStats(userId);

    res.json({
      success: true,
      message: 'Detective game ended',
      finalStats,
      gameResults: {
        confessionAchieved: gameState.confessionTriggered,
        duration: finalStats.duration,
        messagesExchanged: finalStats.messagesExchanged,
        performance: gameState.confessionTriggered ? 'SUCCESS' : 'INCOMPLETE'
      }
    });

  } catch (error) {
    console.error('Detective game end error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to end game',
      error: error.message
    });
  }
});

// Get conversation history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const gameState = detectiveGame.getGameState(userId);

    if (!gameState) {
      return res.status(404).json({
        success: false,
        message: 'No game found'
      });
    }

    res.json({
      success: true,
      conversation: gameState.conversationHistory,
      character: gameState.character,
      gameStats: detectiveGame.getGameStats(userId)
    });

  } catch (error) {
    console.error('Detective game history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get conversation history',
      error: error.message
    });
  }
});

// Get available evidence
router.get('/evidence', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const availableEvidence = detectiveGame.getAvailableEvidence(userId);

    res.json({
      success: true,
      evidence: availableEvidence
    });

  } catch (error) {
    console.error('Get evidence error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get evidence',
      error: error.message
    });
  }
});

// Investigate a specific area
router.post('/investigate', authenticateToken, async (req, res) => {
  try {
    const { area } = req.body;
    const userId = req.user.id;

    if (!area) {
      return res.status(400).json({
        success: false,
        message: 'Investigation area is required'
      });
    }

    const discoveredEvidence = detectiveGame.investigateArea(userId, area);

    res.json({
      success: true,
      area,
      discoveredEvidence,
      message: `${area} 영역 수사 완료. ${discoveredEvidence.length}개의 증거 발견.`
    });

  } catch (error) {
    console.error('Investigation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to investigate area',
      error: error.message
    });
  }
});

// Get investigation hints
router.get('/hints', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { category } = req.query;
    
    const hints = detectiveGame.getInvestigationHints(userId, category);

    res.json({
      success: true,
      hints,
      category: category || 'all'
    });

  } catch (error) {
    console.error('Get hints error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get hints',
      error: error.message
    });
  }
});

// Get game analytics
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const analytics = detectiveGame.getGameAnalytics();

    res.json({
      success: true,
      analytics
    });

  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get analytics',
      error: error.message
    });
  }
});

module.exports = router;
