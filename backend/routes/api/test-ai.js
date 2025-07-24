const express = require('express');
const router = express.Router();
const aiService = require('../../services/aiService');

// Test endpoint for AI responses
router.post('/smokinggun', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    console.log('Testing @smokinggun with message:', message);

    let responseContent = '';

    await aiService.generateResponse(message, 'smokinggun', {
      onStart: () => {
        console.log('AI generation started');
      },
      onChunk: (chunk) => {
        responseContent += chunk.currentChunk || '';
      },
      onComplete: (finalContent) => {
        console.log('AI generation completed');
        res.json({
          success: true,
          response: finalContent.content,
          aiType: 'smokinggun'
        });
      },
      onError: (error) => {
        console.error('AI generation error:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'AI generation failed'
        });
      }
    });

  } catch (error) {
    console.error('Test AI endpoint error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

module.exports = router;
