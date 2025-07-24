/**
 * Game State Tracker - Manages overall detective game state and suspect confessions
 */

class GameStateTracker {
  constructor() {
    // Global game state across all users
    this.globalState = {
      totalGamesPlayed: 0,
      totalConfessions: 0,
      averageGameDuration: 0,
      commonFailurePoints: new Map(),
      evidenceDiscoveryStats: new Map()
    };

    // Active game sessions
    this.activeSessions = new Map(); // userId -> gameSession

    // Suspect confession tracking
    this.suspectStates = {
      steve: {
        name: '스티브',
        totalInterrogations: 0,
        confessionRate: 0,
        commonEvasionTactics: [
          'Jenkins 시스템 탓하기',
          '기술적 전문용어로 혼란 유발',
          '다른 개발자들 책임 전가',
          '로그 로테이션 정상 작업이라고 주장'
        ],
        personality: {
          arrogance: 85,
          technical: 90,
          evasiveness: 80,
          defensiveness: 75
        },
        confessionHistory: []
      }
    };

    // Game progression tracking
    this.progressionMilestones = {
      'first_interaction': '첫 심문 시작',
      'evidence_discovered': '첫 증거 발견',
      'evidence_presented': '첫 증거 제시',
      'pressure_applied': '강한 압박 적용',
      'near_confession': '자백 직전 상태',
      'confession_achieved': '자백 성공',
      'game_completed': '게임 완료'
    };
  }

  /**
   * Start a new game session
   */
  startGameSession(userId, roomId, suspectName = 'steve') {
    const session = {
      userId,
      roomId,
      suspectName,
      startTime: new Date(),
      currentPhase: 'initialization',
      milestones: new Set(),
      interactions: [],
      evidenceTimeline: [],
      pressureLevel: 0,
      confessionTriggered: false,
      gameEnded: false,
      endTime: null,
      metadata: {
        totalMessages: 0,
        evidenceCount: 0,
        hintsUsed: 0,
        investigationAreas: new Set()
      }
    };

    this.activeSessions.set(userId, session);
    this.updateGlobalStats('game_started');
    this.markMilestone(userId, 'first_interaction');

    return session;
  }

  /**
   * Update game session with new interaction
   */
  updateSession(userId, updateData) {
    const session = this.activeSessions.get(userId);
    if (!session) {
      throw new Error('No active session found for user');
    }

    // Update session data
    Object.assign(session, updateData);

    // Track interaction
    if (updateData.interaction) {
      session.interactions.push({
        ...updateData.interaction,
        timestamp: new Date(),
        sequenceNumber: session.interactions.length + 1
      });
      session.metadata.totalMessages++;
    }

    // Track evidence presentation
    if (updateData.evidencePresented) {
      session.evidenceTimeline.push({
        evidence: updateData.evidencePresented,
        timestamp: new Date(),
        pressureLevel: session.pressureLevel
      });
      session.metadata.evidenceCount++;
      this.markMilestone(userId, 'evidence_presented');
    }

    // Update pressure level
    if (updateData.pressureLevel !== undefined) {
      session.pressureLevel = updateData.pressureLevel;
      
      if (session.pressureLevel > 50) {
        this.markMilestone(userId, 'pressure_applied');
      }
      if (session.pressureLevel > 80) {
        this.markMilestone(userId, 'near_confession');
      }
    }

    // Update phase
    if (updateData.phase) {
      session.currentPhase = updateData.phase;
    }

    return session;
  }

  /**
   * Mark a milestone as achieved
   */
  markMilestone(userId, milestone) {
    const session = this.activeSessions.get(userId);
    if (!session) return;

    if (!session.milestones.has(milestone)) {
      session.milestones.add(milestone);
      
      // Log milestone achievement
      session.interactions.push({
        type: 'milestone',
        milestone,
        description: this.progressionMilestones[milestone],
        timestamp: new Date(),
        sequenceNumber: session.interactions.length + 1
      });
    }
  }

  /**
   * Track suspect confession
   */
  recordConfession(userId, confessionData) {
    const session = this.activeSessions.get(userId);
    if (!session) {
      throw new Error('No active session found');
    }

    // Update session
    session.confessionTriggered = true;
    session.confessionData = {
      ...confessionData,
      timestamp: new Date(),
      evidencePresented: session.evidenceTimeline,
      totalPressure: session.pressureLevel,
      gameDuration: new Date() - session.startTime
    };

    // Update suspect state
    const suspect = this.suspectStates[session.suspectName];
    if (suspect) {
      suspect.confessionHistory.push({
        userId,
        timestamp: new Date(),
        duration: session.confessionData.gameDuration,
        evidenceCount: session.metadata.evidenceCount,
        pressureLevel: session.pressureLevel
      });
      
      suspect.totalInterrogations++;
      suspect.confessionRate = (suspect.confessionHistory.length / suspect.totalInterrogations) * 100;
    }

    // Mark milestones
    this.markMilestone(userId, 'confession_achieved');
    
    // Update global stats
    this.updateGlobalStats('confession_achieved');

    return session.confessionData;
  }

  /**
   * End game session
   */
  endGameSession(userId, endReason = 'player_ended') {
    const session = this.activeSessions.get(userId);
    if (!session) {
      return null;
    }

    // Finalize session
    session.gameEnded = true;
    session.endTime = new Date();
    session.endReason = endReason;
    session.finalStats = this.calculateSessionStats(session);

    // Mark completion milestone
    this.markMilestone(userId, 'game_completed');

    // Update global statistics
    this.updateGlobalStats('game_ended', session);

    // Archive session (remove from active sessions)
    this.activeSessions.delete(userId);

    return session;
  }

  /**
   * Calculate session statistics
   */
  calculateSessionStats(session) {
    const duration = session.endTime - session.startTime;
    const minutesDuration = Math.floor(duration / (1000 * 60));
    const secondsDuration = Math.floor((duration % (1000 * 60)) / 1000);

    return {
      duration: {
        total: duration,
        minutes: minutesDuration,
        seconds: secondsDuration,
        formatted: `${minutesDuration}분 ${secondsDuration}초`
      },
      interactions: {
        total: session.metadata.totalMessages,
        perMinute: session.metadata.totalMessages / (duration / (1000 * 60))
      },
      evidence: {
        discovered: session.metadata.evidenceCount,
        timeline: session.evidenceTimeline
      },
      milestones: {
        achieved: Array.from(session.milestones),
        count: session.milestones.size,
        progression: (session.milestones.size / Object.keys(this.progressionMilestones).length) * 100
      },
      performance: {
        pressureLevel: session.pressureLevel,
        confessionAchieved: session.confessionTriggered,
        efficiency: this.calculateEfficiency(session),
        rating: this.calculateRating(session)
      }
    };
  }

  /**
   * Calculate game efficiency score
   */
  calculateEfficiency(session) {
    const baseScore = 100;
    const duration = session.endTime - session.startTime;
    const targetDuration = 10 * 60 * 1000; // 10 minutes target
    
    let efficiency = baseScore;
    
    // Penalty for taking too long
    if (duration > targetDuration) {
      efficiency -= ((duration - targetDuration) / (1000 * 60)) * 5; // -5 per extra minute
    }
    
    // Bonus for confession
    if (session.confessionTriggered) {
      efficiency += 50;
    }
    
    // Penalty for excessive messages without progress
    const messageEfficiency = session.pressureLevel / session.metadata.totalMessages;
    if (messageEfficiency < 2) {
      efficiency -= 20;
    }
    
    return Math.max(0, Math.min(100, Math.round(efficiency)));
  }

  /**
   * Calculate performance rating
   */
  calculateRating(session) {
    const efficiency = this.calculateEfficiency(session);
    const milestonesRatio = session.milestones.size / Object.keys(this.progressionMilestones).length;
    
    if (session.confessionTriggered && efficiency > 80) {
      return 'S급 수사관';
    } else if (session.confessionTriggered && efficiency > 60) {
      return 'A급 수사관';
    } else if (session.confessionTriggered) {
      return 'B급 수사관';
    } else if (milestonesRatio > 0.7) {
      return 'C급 수사관';
    } else if (milestonesRatio > 0.4) {
      return 'D급 수사관';
    } else {
      return '견습 수사관';
    }
  }

  /**
   * Get current session data
   */
  getSession(userId) {
    return this.activeSessions.get(userId) || null;
  }

  /**
   * Get all suspect information
   */
  getSuspectInfo(suspectName = 'steve') {
    return this.suspectStates[suspectName] || null;
  }

  /**
   * Update global game statistics
   */
  updateGlobalStats(event, sessionData = null) {
    switch (event) {
      case 'game_started':
        this.globalState.totalGamesPlayed++;
        break;
        
      case 'confession_achieved':
        this.globalState.totalConfessions++;
        break;
        
      case 'game_ended':
        if (sessionData) {
          const duration = sessionData.endTime - sessionData.startTime;
          // Update average duration
          const totalDuration = this.globalState.averageGameDuration * (this.globalState.totalGamesPlayed - 1) + duration;
          this.globalState.averageGameDuration = totalDuration / this.globalState.totalGamesPlayed;
        }
        break;
    }
  }

  /**
   * Get game analytics
   */
  getGameAnalytics() {
    const steve = this.suspectStates.steve;
    
    return {
      global: {
        totalGames: this.globalState.totalGamesPlayed,
        confessionRate: this.globalState.totalGamesPlayed > 0 ? 
          (this.globalState.totalConfessions / this.globalState.totalGamesPlayed) * 100 : 0,
        averageDuration: Math.round(this.globalState.averageGameDuration / (1000 * 60)), // minutes
        activeSessions: this.activeSessions.size
      },
      suspects: {
        steve: {
          interrogations: steve.totalInterrogations,
          confessionRate: steve.confessionRate,
          personality: steve.personality,
          recentConfessions: steve.confessionHistory.slice(-5)
        }
      },
      trends: {
        commonEvasionTactics: steve.commonEvasionTactics,
        difficultySpots: Array.from(this.globalState.commonFailurePoints.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
      }
    };
  }

  /**
   * Get session timeline for replay/analysis
   */
  getSessionTimeline(userId) {
    const session = this.activeSessions.get(userId);
    if (!session) {
      return null;
    }

    return {
      sessionId: userId,
      suspect: session.suspectName,
      timeline: session.interactions.map(interaction => ({
        ...interaction,
        relativeTime: interaction.timestamp - session.startTime
      })),
      evidenceTimeline: session.evidenceTimeline,
      milestones: Array.from(session.milestones),
      currentPhase: session.currentPhase,
      stats: session.finalStats || this.calculateSessionStats({
        ...session,
        endTime: new Date()
      })
    };
  }

  /**
   * Export session data for analysis
   */
  exportSessionData(userId) {
    const session = this.activeSessions.get(userId);
    if (!session) {
      return null;
    }

    return {
      session,
      timeline: this.getSessionTimeline(userId),
      analytics: this.getGameAnalytics()
    };
  }

  /**
   * Reset all game state (for testing/admin)
   */
  resetAllState() {
    this.globalState = {
      totalGamesPlayed: 0,
      totalConfessions: 0,
      averageGameDuration: 0,
      commonFailurePoints: new Map(),
      evidenceDiscoveryStats: new Map()
    };
    
    this.activeSessions.clear();
    
    // Reset suspect states but keep personality
    Object.keys(this.suspectStates).forEach(suspectName => {
      const suspect = this.suspectStates[suspectName];
      suspect.totalInterrogations = 0;
      suspect.confessionRate = 0;
      suspect.confessionHistory = [];
    });
  }

  /**
   * Get session summary for UI display
   */
  getSessionSummary(userId) {
    const session = this.activeSessions.get(userId);
    if (!session) {
      return null;
    }

    const currentStats = this.calculateSessionStats({
      ...session,
      endTime: new Date()
    });

    return {
      active: true,
      suspect: session.suspectName,
      phase: session.currentPhase,
      duration: currentStats.duration.formatted,
      interactions: session.metadata.totalMessages,
      evidenceCount: session.metadata.evidenceCount,
      pressureLevel: session.pressureLevel,
      milestones: Array.from(session.milestones),
      confessionTriggered: session.confessionTriggered,
      efficiency: currentStats.performance.efficiency,
      rating: currentStats.performance.rating
    };
  }
}

module.exports = new GameStateTracker();
