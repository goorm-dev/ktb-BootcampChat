/**
 * Evidence Manager - Handles evidence discovery and analysis for the detective game
 */

class EvidenceManager {
  constructor() {
    // Available evidence that can be discovered
    this.evidenceDatabase = {
      // Force push evidence
      'git_force_push': {
        id: 'git_force_push',
        title: 'Git Force Push 기록',
        description: 'git push --force origin main 명령어 실행 기록이 발견됨',
        category: 'force_push',
        difficulty: 'medium',
        keywords: ['force push', 'git push --force', 'origin main'],
        discoveryHints: [
          'Git 히스토리를 자세히 살펴보세요',
          '프로덕션 브랜치의 커밋 로그를 확인해보세요',
          'force push 흔적이 있을 수 있습니다'
        ],
        impact: 50
      },
      
      'production_access_log': {
        id: 'production_access_log',
        title: '프로덕션 서버 직접 접근 기록',
        description: '스티브 계정으로 프로덕션 서버에 직접 SSH 접속한 기록',
        category: 'force_push',
        difficulty: 'hard',
        keywords: ['ssh production', '직접 접근', 'production server'],
        discoveryHints: [
          '서버 접근 로그를 확인해보세요',
          'SSH 연결 기록을 조사해보세요',
          '프로덕션 환경 접근 권한을 확인해보세요'
        ],
        impact: 40
      },

      'pipeline_bypass': {
        id: 'pipeline_bypass',
        title: 'CI/CD 파이프라인 우회 증거',
        description: 'Jenkins 파이프라인을 우회하여 직접 배포한 흔적',
        category: 'force_push',
        difficulty: 'easy',
        keywords: ['pipeline bypass', '파이프라인 우회', 'jenkins skip'],
        discoveryHints: [
          'Jenkins 빌드 로그를 확인해보세요',
          '배포 히스토리에서 이상한 점을 찾아보세요',
          'CI/CD 파이프라인 실행 기록을 조사해보세요'
        ],
        impact: 30
      },

      // Log deletion evidence
      'log_deletion_command': {
        id: 'log_deletion_command',
        title: '로그 삭제 명령어 실행 기록',
        description: 'rm -rf /var/log/application/*.log 명령어 실행 흔적',
        category: 'log_deletion',
        difficulty: 'medium',
        keywords: ['rm -rf', 'log delete', '로그 삭제', 'log removal'],
        discoveryHints: [
          '시스템 명령어 히스토리를 확인해보세요',
          '로그 파일의 타임스탬프를 조사해보세요',
          'bash history를 분석해보세요'
        ],
        impact: 50
      },

      'log_rotation_manipulation': {
        id: 'log_rotation_manipulation',
        title: '로그 로테이션 설정 조작',
        description: 'logrotate 설정을 변경하여 로그 자동 삭제 조작',
        category: 'log_deletion',
        difficulty: 'hard',
        keywords: ['logrotate', 'log rotation', '로그 로테이션'],
        discoveryHints: [
          '/etc/logrotate.d/ 설정 파일을 확인해보세요',
          '로그 로테이션 정책 변경 기록을 조사해보세요',
          'cron job 설정을 확인해보세요'
        ],
        impact: 40
      },

      'elasticsearch_index_deletion': {
        id: 'elasticsearch_index_deletion',
        title: 'Elasticsearch 인덱스 삭제',
        description: 'ELK 스택의 로그 인덱스가 의도적으로 삭제됨',
        category: 'log_deletion',
        difficulty: 'easy',
        keywords: ['elasticsearch', 'index delete', 'elk stack'],
        discoveryHints: [
          'Elasticsearch 클러스터 상태를 확인해보세요',
          '인덱스 삭제 API 호출 기록을 조사해보세요',
          'Kibana 대시보드에서 누락된 데이터를 찾아보세요'
        ],
        impact: 35
      },

      // Supporting evidence
      'suspicious_commit_time': {
        id: 'suspicious_commit_time',
        title: '의심스러운 커밋 시간',
        description: '새벽 3시 33분에 긴급 패치 커밋이 이루어짐',
        category: 'supporting',
        difficulty: 'easy',
        keywords: ['3:33 AM', '새벽 커밋', 'emergency patch'],
        discoveryHints: [
          'Git 커밋 타임스탬프를 확인해보세요',
          '근무 시간 외 활동을 조사해보세요'
        ],
        impact: 10
      },

      'admin_privilege_escalation': {
        id: 'admin_privilege_escalation',
        title: '관리자 권한 상승',
        description: '일시적으로 sudo 권한을 사용한 기록',
        category: 'supporting',
        difficulty: 'medium',
        keywords: ['sudo', 'privilege escalation', '권한 상승'],
        discoveryHints: [
          'sudo 사용 기록을 확인해보세요',
          '/var/log/auth.log를 조사해보세요'
        ],
        impact: 20
      }
    };

    // User evidence progress tracking
    this.userProgress = new Map(); // userId -> progressData
  }

  /**
   * Initialize evidence tracking for a user
   */
  initializeUserProgress(userId) {
    this.userProgress.set(userId, {
      discoveredEvidence: new Set(),
      presentedEvidence: new Set(),
      availableHints: new Map(),
      investigationLog: [],
      discoveryTimestamps: new Map()
    });
  }

  /**
   * Get all available evidence for discovery
   */
  getAllEvidence() {
    return Object.values(this.evidenceDatabase);
  }

  /**
   * Get evidence by category
   */
  getEvidenceByCategory(category) {
    return Object.values(this.evidenceDatabase)
      .filter(evidence => evidence.category === category);
  }

  /**
   * Search for evidence based on investigation keywords
   */
  searchEvidence(userId, searchTerms) {
    const userProgressData = this.userProgress.get(userId);
    if (!userProgressData) {
      this.initializeUserProgress(userId);
      return this.searchEvidence(userId, searchTerms);
    }

    const foundEvidence = [];
    const searchLower = searchTerms.toLowerCase();

    Object.values(this.evidenceDatabase).forEach(evidence => {
      // Check if evidence is already discovered
      if (userProgressData.discoveredEvidence.has(evidence.id)) {
        return;
      }

      // Check if search terms match evidence keywords
      const isMatch = evidence.keywords.some(keyword => 
        searchLower.includes(keyword.toLowerCase()) ||
        keyword.toLowerCase().includes(searchLower)
      );

      if (isMatch) {
        foundEvidence.push(this.discoverEvidence(userId, evidence.id));
      }
    });

    return foundEvidence;
  }

  /**
   * Discover a specific piece of evidence
   */
  discoverEvidence(userId, evidenceId) {
    const evidence = this.evidenceDatabase[evidenceId];
    if (!evidence) {
      throw new Error(`Evidence ${evidenceId} not found`);
    }

    const userProgressData = this.userProgress.get(userId);
    if (!userProgressData) {
      this.initializeUserProgress(userId);
      return this.discoverEvidence(userId, evidenceId);
    }

    // Mark as discovered
    userProgressData.discoveredEvidence.add(evidenceId);
    userProgressData.discoveryTimestamps.set(evidenceId, new Date());

    // Log the discovery
    userProgressData.investigationLog.push({
      action: 'discovered',
      evidenceId,
      timestamp: new Date(),
      description: `${evidence.title} 발견`
    });

    return {
      ...evidence,
      discovered: true,
      discoveryTime: new Date()
    };
  }

  /**
   * Present evidence in the game
   */
  presentEvidence(userId, evidenceIds) {
    const userProgressData = this.userProgress.get(userId);
    if (!userProgressData) {
      throw new Error('User progress not initialized');
    }

    const presentedEvidence = [];
    const validEvidenceIds = Array.isArray(evidenceIds) ? evidenceIds : [evidenceIds];

    validEvidenceIds.forEach(evidenceId => {
      if (userProgressData.discoveredEvidence.has(evidenceId)) {
        userProgressData.presentedEvidence.add(evidenceId);
        
        // Log the presentation
        userProgressData.investigationLog.push({
          action: 'presented',
          evidenceId,
          timestamp: new Date(),
          description: `${this.evidenceDatabase[evidenceId].title} 제시`
        });

        presentedEvidence.push(this.evidenceDatabase[evidenceId]);
      }
    });

    return presentedEvidence;
  }

  /**
   * Get hints for discovering evidence
   */
  getHints(userId, category = null, difficulty = null) {
    const userProgressData = this.userProgress.get(userId);
    if (!userProgressData) {
      this.initializeUserProgress(userId);
      return this.getHints(userId, category, difficulty);
    }

    const hints = [];
    
    Object.values(this.evidenceDatabase).forEach(evidence => {
      // Skip already discovered evidence
      if (userProgressData.discoveredEvidence.has(evidence.id)) {
        return;
      }

      // Filter by category if specified
      if (category && evidence.category !== category) {
        return;
      }

      // Filter by difficulty if specified
      if (difficulty && evidence.difficulty !== difficulty) {
        return;
      }

      // Add hints for this evidence
      evidence.discoveryHints.forEach(hint => {
        hints.push({
          evidenceId: evidence.id,
          category: evidence.category,
          difficulty: evidence.difficulty,
          hint: hint
        });
      });
    });

    return hints;
  }

  /**
   * Analyze presented evidence for confession triggers
   */
  analyzeEvidence(userId) {
    const userProgressData = this.userProgress.get(userId);
    if (!userProgressData) {
      return {
        hasForcePushEvidence: false,
        hasLogDeletionEvidence: false,
        totalImpact: 0,
        presentedEvidence: [],
        categories: {
          force_push: 0,
          log_deletion: 0,
          supporting: 0
        }
      };
    }

    const analysis = {
      hasForcePushEvidence: false,
      hasLogDeletionEvidence: false,
      totalImpact: 0,
      presentedEvidence: [],
      categories: {
        force_push: 0,
        log_deletion: 0,
        supporting: 0
      }
    };

    // Analyze presented evidence
    userProgressData.presentedEvidence.forEach(evidenceId => {
      const evidence = this.evidenceDatabase[evidenceId];
      if (evidence) {
        analysis.presentedEvidence.push(evidence);
        analysis.totalImpact += evidence.impact;
        analysis.categories[evidence.category] += evidence.impact;

        // Check for confession triggers
        if (evidence.category === 'force_push') {
          analysis.hasForcePushEvidence = true;
        }
        if (evidence.category === 'log_deletion') {
          analysis.hasLogDeletionEvidence = true;
        }
      }
    });

    return analysis;
  }

  /**
   * Get user's investigation progress
   */
  getUserProgress(userId) {
    const userProgressData = this.userProgress.get(userId);
    if (!userProgressData) {
      this.initializeUserProgress(userId);
      return this.getUserProgress(userId);
    }

    const totalEvidence = Object.keys(this.evidenceDatabase).length;
    const discoveredCount = userProgressData.discoveredEvidence.size;
    const presentedCount = userProgressData.presentedEvidence.size;

    return {
      totalEvidence,
      discoveredCount,
      presentedCount,
      discoveryRate: (discoveredCount / totalEvidence) * 100,
      investigationLog: userProgressData.investigationLog,
      discoveredEvidence: Array.from(userProgressData.discoveredEvidence)
        .map(id => this.evidenceDatabase[id]),
      presentedEvidence: Array.from(userProgressData.presentedEvidence)
        .map(id => this.evidenceDatabase[id])
    };
  }

  /**
   * Reset user progress
   */
  resetUserProgress(userId) {
    this.userProgress.delete(userId);
    this.initializeUserProgress(userId);
  }

  /**
   * Auto-discover evidence based on investigation actions
   */
  investigateArea(userId, area) {
    const investigations = {
      'git_logs': ['git_force_push', 'suspicious_commit_time'],
      'server_logs': ['production_access_log', 'admin_privilege_escalation'],
      'jenkins': ['pipeline_bypass'],
      'system_logs': ['log_deletion_command'],
      'elasticsearch': ['elasticsearch_index_deletion'],
      'config_files': ['log_rotation_manipulation']
    };

    const evidenceIds = investigations[area] || [];
    const discoveredEvidence = [];

    evidenceIds.forEach(evidenceId => {
      if (this.evidenceDatabase[evidenceId]) {
        discoveredEvidence.push(this.discoverEvidence(userId, evidenceId));
      }
    });

    return discoveredEvidence;
  }

  /**
   * Get investigation suggestions based on current progress
   */
  getInvestigationSuggestions(userId) {
    const userProgressData = this.userProgress.get(userId);
    if (!userProgressData) {
      return [];
    }

    const suggestions = [];
    const discovered = userProgressData.discoveredEvidence;

    // Suggest areas to investigate based on what's missing
    if (!Array.from(discovered).some(id => this.evidenceDatabase[id]?.category === 'force_push')) {
      suggestions.push({
        area: 'git_logs',
        priority: 'high',
        description: 'Git 로그와 커밋 히스토리를 자세히 조사해보세요',
        expectedEvidence: 'Force push 관련 증거를 찾을 수 있습니다'
      });
    }

    if (!Array.from(discovered).some(id => this.evidenceDatabase[id]?.category === 'log_deletion')) {
      suggestions.push({
        area: 'system_logs',
        priority: 'high',
        description: '시스템 로그와 명령어 히스토리를 조사해보세요',
        expectedEvidence: '로그 삭제 관련 증거를 찾을 수 있습니다'
      });
    }

    if (discovered.size < 3) {
      suggestions.push({
        area: 'server_logs',
        priority: 'medium',
        description: '서버 접근 로그를 확인해보세요',
        expectedEvidence: '추가적인 의심스러운 활동을 발견할 수 있습니다'
      });
    }

    return suggestions;
  }
}

module.exports = new EvidenceManager();
