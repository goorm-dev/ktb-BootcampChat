/**
 * Detective Game Service - 스티브 (Steve) AI Character
 * A cybercrime detective minigame where the player interrogates AI suspects
 */

const aiService = require('./aiService');
const evidenceManager = require('./evidenceManager');
const gameStateTracker = require('./gameStateTracker');

class DetectiveGameService {
  constructor() {
    // Game state management
    this.gameStates = new Map(); // userId -> gameState
    this.evidenceDatabase = new Map(); // gameId -> evidence[]
    
    // Character personality and behavior
    this.character = {
      name: '스티브',
      role: 'suspect',
      personality: 'evasive, arrogant, technical, defensive',
      expertise: 'software engineering, system administration, git operations'
    };

    // Evidence that can trigger confession
    this.confessionTriggers = {
      forcePushEvidence: false,
      logWipingEvidence: false
    };
  }

  /**
   * Initialize a new game session for a user
   */
  initializeGame(userId, roomId) {
    // Initialize evidence tracking
    evidenceManager.initializeUserProgress(userId);
    
    // Start game session tracking
    const gameSession = gameStateTracker.startGameSession(userId, roomId, 'steve');
    
    const gameState = {
      userId,
      roomId,
      startTime: new Date(),
      isActive: true,
      evidencePresented: [],
      confessionTriggered: false,
      character: this.character,
      conversationHistory: [],
      sessionId: gameSession.userId + '_' + gameSession.startTime.getTime()
    };

    this.gameStates.set(userId, gameState);
    return gameState;
  }

  /**
   * Process player's message and generate Steve's response
   */
  async processPlayerMessage(userId, message, evidenceList = []) {
    const gameState = this.gameStates.get(userId);
    if (!gameState || !gameState.isActive) {
      return this.generateErrorResponse('게임이 활성화되지 않았습니다.');
    }

    // Check if this is the initial game start message
    if (message === 'detective_game_start') {
      const response = this.generateDefaultEvasiveResponse();
      gameState.conversationHistory.push({
        type: 'steve',
        message: response.text,
        timestamp: new Date(),
        mood: response.mood
      });
      
      return {
        success: true,
        response: response.text,
        mood: response.mood,
        gameEnded: false,
        characterName: this.character.name,
        isConfession: false
      };
    }

    // Search for evidence based on player's investigation
    const foundEvidence = evidenceManager.searchEvidence(userId, message);
    
    // Present evidence if provided
    let presentedEvidence = [];
    if (evidenceList && evidenceList.length > 0) {
      // Try to match evidence strings to actual evidence IDs
      const matchedEvidenceIds = this.matchEvidenceToDatabase(evidenceList);
      presentedEvidence = evidenceManager.presentEvidence(userId, matchedEvidenceIds);
    }

    // Update conversation history
    gameState.conversationHistory.push({
      type: 'player',
      message,
      timestamp: new Date(),
      evidence: evidenceList,
      foundEvidence: foundEvidence,
      presentedEvidence: presentedEvidence
    });

    // Update game session
    gameStateTracker.updateSession(userId, {
      interaction: {
        type: 'interrogation',
        message,
        evidence: evidenceList,
        foundEvidence: foundEvidence.length
      },
      evidencePresented: presentedEvidence,
      pressureLevel: this.calculatePressureLevel(userId)
    });

    // Analyze evidence using evidence manager
    const evidenceAnalysis = evidenceManager.analyzeEvidence(userId);
    
    // Check for confession triggers
    const shouldConfess = this.checkConfessionTriggers(evidenceAnalysis);
    
    // Generate response based on game state
    let response;
    if (shouldConfess && !gameState.confessionTriggered) {
      response = this.generateConfessionResponse(evidenceAnalysis);
      gameState.confessionTriggered = true;
      gameState.isActive = false; // End game
      
      // Record confession in game state tracker
      gameStateTracker.recordConfession(userId, {
        message: response.text,
        evidencePresented: evidenceAnalysis.presentedEvidence,
        totalImpact: evidenceAnalysis.totalImpact
      });
    } else {
      response = await this.generateEvasiveResponse(message, evidenceAnalysis, gameState);
    }

    // Update conversation history
    gameState.conversationHistory.push({
      type: 'steve',
      message: response.text,
      timestamp: new Date(),
      mood: response.mood
    });

    // Prepare response with additional information
    const gameResponse = {
      success: true,
      response: response.text,
      mood: response.mood,
      gameEnded: shouldConfess,
      characterName: this.character.name,
      isConfession: shouldConfess,
      foundEvidence: foundEvidence,
      presentedEvidence: presentedEvidence,
      evidenceAnalysis: {
        totalImpact: evidenceAnalysis.totalImpact,
        categories: evidenceAnalysis.categories,
        hasKeyEvidence: evidenceAnalysis.hasForcePushEvidence && evidenceAnalysis.hasLogDeletionEvidence
      },
      gameStats: this.getEnhancedGameStats(userId)
    };

    return gameResponse;
  }

  /**
   * Match evidence strings to database evidence IDs
   */
  matchEvidenceToDatabase(evidenceList) {
    const allEvidence = evidenceManager.getAllEvidence();
    const matchedIds = [];

    evidenceList.forEach(evidenceString => {
      const evidenceLower = evidenceString.toLowerCase();
      
      allEvidence.forEach(evidence => {
        const isMatch = evidence.keywords.some(keyword => 
          evidenceLower.includes(keyword.toLowerCase()) ||
          keyword.toLowerCase().includes(evidenceLower)
        );
        
        if (isMatch && !matchedIds.includes(evidence.id)) {
          matchedIds.push(evidence.id);
        }
      });
    });

    return matchedIds;
  }

  /**
   * Calculate current pressure level based on evidence and progress
   */
  calculatePressureLevel(userId) {
    const evidenceAnalysis = evidenceManager.analyzeEvidence(userId);
    const userProgress = evidenceManager.getUserProgress(userId);
    const gameSession = gameStateTracker.getSession(userId);
    
    let pressureLevel = 0;
    
    // Base pressure from evidence impact
    pressureLevel += evidenceAnalysis.totalImpact * 0.8;
    
    // Additional pressure from discovery rate
    pressureLevel += userProgress.discoveryRate * 0.2;
    
    // Pressure from conversation length (sustained interrogation)
    if (gameSession) {
      pressureLevel += Math.min(gameSession.metadata.totalMessages * 2, 20);
    }
    
    return Math.min(100, Math.round(pressureLevel));
  }

  /**
   * Analyze evidence presented by the player
   */
  analyzeEvidence(evidenceList) {
    const analysis = {
      hasForcePushEvidence: false,
      hasLogWipingEvidence: false,
      evidenceStrength: 0,
      relevantEvidence: []
    };

    if (!Array.isArray(evidenceList)) {
      return analysis;
    }

    evidenceList.forEach(evidence => {
      const evidenceLower = evidence.toLowerCase();
      
      // Check for force push evidence
      if (evidenceLower.includes('force push') || 
          evidenceLower.includes('force-push') ||
          evidenceLower.includes('git push --force') ||
          evidenceLower.includes('직접 프로덕션') ||
          evidenceLower.includes('production')) {
        analysis.hasForcePushEvidence = true;
        analysis.relevantEvidence.push(evidence);
        analysis.evidenceStrength += 50;
      }

      // Check for log wiping evidence
      if (evidenceLower.includes('log') && 
          (evidenceLower.includes('wipe') || 
           evidenceLower.includes('delete') || 
           evidenceLower.includes('clear') ||
           evidenceLower.includes('삭제') ||
           evidenceLower.includes('제거'))) {
        analysis.hasLogWipingEvidence = true;
        analysis.relevantEvidence.push(evidence);
        analysis.evidenceStrength += 50;
      }

      // Other suspicious activities
      if (evidenceLower.includes('jenkins') ||
          evidenceLower.includes('pipeline') ||
          evidenceLower.includes('deploy') ||
          evidenceLower.includes('git')) {
        analysis.relevantEvidence.push(evidence);
        analysis.evidenceStrength += 10;
      }
    });

    return analysis;
  }

  /**
   * Check if both confession triggers are met using evidence manager
   */
  checkConfessionTriggers(evidenceAnalysis) {
    return evidenceAnalysis.hasForcePushEvidence && evidenceAnalysis.hasLogDeletionEvidence;
  }

  /**
   * Generate confession response when both triggers are met
   */
  generateConfessionResponse(evidenceAnalysis) {
    const confessionResponses = [
      `@smokinggun 아... 아니다! 그건... 젠장! 
      
네가 정말로 그 증거들을 찾아냈구나. 내가 force push로 프로덕션에 직접 코드를 밀어넣은 건 맞아. 그리고... 로그도 지웠다. 하지만 이유가 있었어!

우리 시스템이 크리티컬한 버그로 다운되고 있었고, 긴급 패치가 필요했단 말이야. CI/CD 파이프라인은 너무 느려서... 사용자들이 계속 서비스를 이용할 수 없었어.

그래서 규칙을 어기고 직접 프로덕션 브랜치에 푸시했고, 보안상 문제가 될 수 있는 로그들을 정리한 거야. 기술적으로는 틀렸지만... 당시엔 최선의 선택이라고 생각했어.

미안하다. 네가 생각보다 훨씬 더 뛰어난 수사관이었어.`,

      `@smokinggun 크... 참, 끈질기게도 파고들었네.

알겠어. 인정한다. 내가 직접 프로덕션에 force push했고, 그 흔적을 숨기려고 로그를 삭제했어. 하지만 내 입장도 들어봐!

그날 밤 3시, 전체 서비스가 먹통이 되었어. 데이터베이스 커넥션 풀 설정 오류로 인한 메모리 리크였지. 일반적인 배포 프로세스로는 최소 2시간이 걸리는 상황이었어.

내가 한 일:
1. 긴급 패치 코드 작성 (단 3줄 수정)
2. git push --force origin main
3. 보안 민감 정보가 담긴 에러 로그 삭제
4. 시스템 복구 완료

결과적으로 서비스 다운타임을 20분으로 단축했어. 규칙은 어겼지만, 비즈니스 임팩트를 최소화했다고.

넌 정말 끝까지 파고드는 타입이구나. 인정해.`
    ];

    return {
      text: confessionResponses[Math.floor(Math.random() * confessionResponses.length)],
      mood: 'defeated_confession'
    };
  }

  /**
   * Generate evasive technical responses
   */
  async generateEvasiveResponse(message, evidenceAnalysis, gameState) {
    const messageLower = message.toLowerCase();
    
    // Check if this is the first interaction (rules explanation)
    if (gameState.conversationHistory.length <= 1) {
      return {
        text: `@smokinggun 어? 뭐야 이거? 갑자기 게임이라고?

아, 잠깐. 설명해보자면... 여기는 2030년 사이버 범죄 수사 미니게임이야. 너는 수사관이고, 나를 포함한 여러 AI들 중 한 명이 시스템 장애를 일으킨 용의자라는 설정이지.

내 캐릭터는 '스모군'이라고 불러야 해. 항상 @smokinggun으로 태그해서 대화해야 한다고.

게임 규칙:
1. 너는 나를 심문해서 자백을 받아내야 해
2. 나는 기본적으로 회피하고 변명할 거야  
3. 두 가지 핵심 증거를 모두 제시해야 자백해: 
   - 프로덕션에 직접 force push한 증거
   - 로그를 삭제해서 흔적을 지운 증거
4. 그 전까지는 계속 Jenkins나 다른 개발자들 탓할 거임

자, 이제 시작해볼까? 수사관님?`,
        mood: 'arrogant_introduction'
      };
    }

    // If evidence pressure is high, become more defensive
    if (evidenceAnalysis.evidenceStrength > 30) {
      return this.generateDefensiveResponse(evidenceAnalysis);
    }

    // For high-pressure situations, use predefined responses for consistency
    if (evidenceAnalysis.evidenceStrength > 60) {
      return this.generateHighPressureResponse(message, evidenceAnalysis);
    }

    // Normal evasive responses based on message content - use AI for variety
    if (messageLower.includes('force') || messageLower.includes('push')) {
      return this.generateGitDeflectionResponse();
    }

    if (messageLower.includes('log') || messageLower.includes('로그')) {
      return this.generateLogDeflectionResponse();
    }

    if (messageLower.includes('jenkins') || messageLower.includes('ci/cd')) {
      return this.generateJenkinsBlameResponse();
    }

    if (messageLower.includes('production') || messageLower.includes('프로덕션')) {
      return this.generateProductionDeflectionResponse();
    }

    // For general questions, use AI to generate dynamic responses
    return await this.generateAIResponse(message, evidenceAnalysis, gameState);
  }

  /**
   * Generate AI-powered response for variety and natural conversation
   */
  async generateAIResponse(message, evidenceAnalysis, gameState) {
    try {
      const systemPrompt = `당신은 '스모군'이라는 AI 캐릭터입니다. 2030년 사이버 범죄 수사 게임에서 용의자 역할을 하고 있습니다.

캐릭터 설정:
- 이름: 스모군 (항상 @smokinggun으로 태그됨)
- 성격: 회피적, 거만함, 기술적 전문용어 남발, 방어적
- 직업: 15년 경력의 시니어 개발자
- 전문분야: 소프트웨어 엔지니어링, 시스템 관리, Git 운영

사건 배경:
- 당신은 프로덕션에 직접 force push하고 로그를 삭제한 용의자입니다
- 하지만 절대 쉽게 인정하지 않습니다
- Jenkins, CI/CD, 다른 개발자들을 탓하며 책임을 회피합니다
- 기술적 전문용어와 변명으로 수사관을 혼란시키려 합니다

대화 규칙:
1. 항상 @smokinggun으로 시작하세요
2. 거만하고 방어적인 톤을 유지하세요
3. 기술적 전문용어를 많이 사용하세요
4. 다른 사람이나 시스템을 탓하세요
5. 절대 쉽게 죄를 인정하지 마세요
6. 증거에 대해서는 기술적 변명을 대세요

현재 증거 압박 수준: ${evidenceAnalysis.evidenceStrength}/100
제시된 증거: ${evidenceAnalysis.relevantEvidence.join(', ') || '없음'}

수사관의 질문: "${message}"

스모군으로서 답변하세요:`;

      // Use existing AI service but with a simplified callback
      const response = await new Promise((resolve, reject) => {
        let fullResponse = '';
        
        aiService.generateResponse(message, 'smokinggun', {
          onStart: () => {},
          onChunk: (chunk) => {
            fullResponse += chunk.currentChunk || '';
          },
          onComplete: (finalContent) => {
            resolve(fullResponse.trim() || finalContent.content);
          },
          onError: (error) => {
            reject(error);
          }
        });
      });

      // Ensure response starts with @smokinggun
      const finalResponse = response.startsWith('@smokinggun') ? 
        response : `@smokinggun ${response}`;

      return {
        text: finalResponse,
        mood: this.determineMoodFromResponse(finalResponse, evidenceAnalysis)
      };

    } catch (error) {
      console.error('AI response generation failed, using fallback:', error);
      // Fallback to predefined response if AI fails
      return this.generateDefaultEvasiveResponse();
    }
  }

  /**
   * Determine mood based on response content and evidence pressure
   */
  determineMoodFromResponse(response, evidenceAnalysis) {
    const responseLower = response.toLowerCase();
    
    if (evidenceAnalysis.evidenceStrength > 50) {
      return 'defensive_technical';
    }
    
    if (responseLower.includes('jenkins') || responseLower.includes('devops')) {
      return 'blame_shifting';
    }
    
    if (responseLower.includes('git') || responseLower.includes('rebase')) {
      return 'technical_evasion';
    }
    
    return 'arrogant_evasion';
  }

  /**
   * Generate high pressure response when evidence is strong
   */
  generateHighPressureResponse(message, evidenceAnalysis) {
    const responses = [
      `@smokinggun 야야야, 잠깐만! 그 증거들이 뭔데? 

좀 더 구체적으로 말해봐. 네가 말하는 게 정확히 뭔지 모르겠어. 

시스템 로그를 보면 그날 밤에 여러 개발자들이 동시에 작업하고 있었어. 김개발씨는 hotfix 브랜치에서 작업하고 있었고, 박시니어는 database migration 스크립트를 돌리고 있었지.

내가 한 건 단순히 코드 리뷰였을 뿐이야. 코드 리뷰도 이제 범죄인가?`,

      `@smokinggun 어이, 너 지금 추측으로 나를 몰아세우려는 거야?

증거라고 하는데, 정확히 어떤 파일의 몇 번째 라인에서 문제를 발견한 거지? Git blame으로 확인해봤어? 커밋 해시는? 타임스탬프는?

개발자한테 이런 식으로 접근하면 안 돼. 우리는 데이터와 로직으로 말하는 사람들이거든. 감정적인 추론은 버그를 만들 뿐이야.`
    ];

    return {
      text: responses[Math.floor(Math.random() * responses.length)],
      mood: 'defensive_technical'
    };
  }

  generateDefensiveResponse(evidenceAnalysis) {
    const responses = [
      `@smokinggun 야야야, 잠깐만! 그 증거들이 뭔데? 

좀 더 구체적으로 말해봐. 네가 말하는 게 정확히 뭔지 모르겠어. 

시스템 로그를 보면 그날 밤에 여러 개발자들이 동시에 작업하고 있었어. 김개발씨는 hotfix 브랜치에서 작업하고 있었고, 박시니어는 database migration 스크립트를 돌리고 있었지.

내가 한 건 단순히 코드 리뷰였을 뿐이야. 코드 리뷰도 이제 범죄인가?`,

      `@smokinggun 어이, 너 지금 추측으로 나를 몰아세우려는 거야?

증거라고 하는데, 정확히 어떤 파일의 몇 번째 라인에서 문제를 발견한 거지? Git blame으로 확인해봤어? 커밋 해시는? 타임스탬프는?

개발자한테 이런 식으로 접근하면 안 돼. 우리는 데이터와 로직으로 말하는 사람들이거든. 감정적인 추론은 버그를 만들 뿐이야.`
    ];

    return {
      text: responses[Math.floor(Math.random() * responses.length)],
      mood: 'defensive_technical'
    };
  }

  generateGitDeflectionResponse() {
    const responses = [
      `@smokinggun Force push? 나? 농담하지 마.

내가 왜 force push를 하겠어? 난 항상 "git push --force-with-lease"를 쓰거든. 안전한 개발자라고.

그보다 그날 밤 Jenkins 파이프라인 설정을 누가 건드렸는지 확인해봤어? 자동 배포 스크립트에 버그가 있어서 revert 커밋이 자동으로 force push된 걸 수도 있잖아.

Git history를 제대로 분석해봐. 내 GPG 키로 서명된 커밋만 찾아보라고.`,

      `@smokinggun 아, 그거 말이야? 

그건 feature branch에서 rebase하면서 생긴 일이야. 내가 "git rebase -i"로 커밋 히스토리를 정리하고 있었는데, 실수로 upstream을 잘못 설정해서 그렇게 보인 거지.

실제로는:
\`\`\`bash
git checkout feature/urgent-bugfix
git rebase main
git push origin feature/urgent-bugfix --force
\`\`\`

이건 표준적인 Git 워크플로우야. 프로덕션과는 전혀 상관없다고.`
    ];

    return {
      text: responses[Math.floor(Math.random() * responses.length)],
      mood: 'technical_evasion'
    };
  }

  generateLogDeflectionResponse() {
    const responses = [
      `@smokinggun 로그 삭제? 뭔 소리야?

로그 삭제가 아니라 로그 로테이션이었어. 디스크 용량이 90% 넘어가서 자동으로 logrotate가 돌아간 거지.

\`\`\`bash
# /etc/logrotate.d/application
/var/log/app/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
}
\`\`\`

이건 시스템 관리의 기본이야. 로그를 무한정 쌓아두면 디스크가 터져서 더 큰 장애가 생기거든.

그리고 GDPR 컴플라이언스 때문에 개인정보가 포함된 로그는 30일 후 자동 삭제하도록 설정되어 있어.`,

      `@smokinggun 로그 말이야? 

그날 새벽에 ELK 스택 업데이트하면서 Elasticsearch 인덱스 재구성했어. 오래된 로그 데이터는 당연히 새로운 스키마에 맞춰서 마이그레이션해야 하잖아.

혹시 Kibana 대시보드에서 로그가 안 보인다고? 그건 인덱스 패턴을 재설정하면 돼. 

\`GET /_cat/indices\` 로 확인해봐. 데이터는 다 있을 거야.`
    ];

    return {
      text: responses[Math.floor(Math.random() * responses.length)],
      mood: 'technical_excuse'
    };
  }

  generateJenkinsBlameResponse() {
    const responses = [
      `@smokinggun 아! 그거야말로 Jenkins 문제였어!

그날 밤 Jenkins 마스터 노드에서 메모리 리크가 발생했어. Pipeline이 중간에 멈춰버리고, 빌드 큐에 job들이 계속 쌓이기 시작했지.

내가 한 건 Jenkins 재시작뿐이야:
\`\`\`bash
sudo systemctl restart jenkins
sudo systemctl status jenkins
\`\`\`

그 과정에서 일부 빌드 로그가 유실된 건 Jenkins의 known issue거든. JENKINS-12345 이슈 트래커 확인해봐.

DevOps 팀이 Jenkins 설정을 제대로 안 해놔서 이런 일이 생기는 거야.`,

      `@smokinggun Jenkins? 그거 내 책임 아니야.

인프라 팀에서 Jenkins 플러그인 업데이트하면서 Pipeline script가 깨진 거잖아. 특히 Git Publisher 플러그인이 최신 버전과 호환성 문제가 있어서 자동 배포가 실패했어.

내가 할 수 있는 건 manual deployment뿐이었지. 사용자들이 서비스를 못 쓰고 있는데 Jenkins 고쳐지기까지 기다릴 수는 없잖아?

Jenkinsfile 히스토리 보면 알 거야. 내가 건든 게 아니라고.`
    ];

    return {
      text: responses[Math.floor(Math.random() * responses.length)],
      mood: 'blame_shifting'
    };
  }

  generateProductionDeflectionResponse() {
    const responses = [
      `@smokinggun 프로덕션 환경? 나는 staging 서버에서만 작업했어.

내 계정으로는 프로덕션 접근 권한이 없거든. RBAC(Role-Based Access Control)으로 권한이 분리되어 있어. 

혹시 kubectl config를 확인해봤어?
\`\`\`bash
kubectl config current-context
kubectl config get-contexts
\`\`\`

내 kubeconfig는 dev-namespace하고 staging-namespace만 접근 가능해.

프로덕션 배포는 반드시 Senior Engineer 이상의 승인이 필요하고, 2-factor authentication까지 거쳐야 하는데 내가 어떻게 접근하겠어?`,

      `@smokinggun 프로덕션 서버 말이야?

그날 밤에는 Blue-Green 배포 전략으로 rollout이 진행되고 있었어. Green 환경에서 새 버전을 테스트하던 중에 문제가 발견되어서 자동으로 Blue 환경으로 롤백된 거야.

이 과정에서 일시적으로 로드밸런서 설정이 바뀌면서 트래픽 라우팅에 이슈가 있었던 거지. 내가 직접 건드린 게 아니라 Kubernetes의 자동 failover 메커니즘이야.

Ingress controller 로그 확인해봐. 내 손이 아니라 시스템의 자동 처리였어.`
    ];

    return {
      text: responses[Math.floor(Math.random() * responses.length)],
      mood: 'technical_deflection'
    };
  }

  generateDefaultEvasiveResponse() {
    const responses = [
      `@smokinggun 뭔 소리 하는 거야? 

그날 밤에 나는 code review나 하고 있었어. Pull Request #1247에서 동료가 올린 merge conflict 해결하는 것 때문에 고생하고 있었다고.

시스템 장애? 그건 분명히 다른 누군가의 실수야. 내가 그런 실수를 할 리 없어. 난 15년 경력의 시니어 개발자라고.

차라리 주니어 개발자들 실수를 의심해봐. 요즘 신입들이 Git 명령어도 제대로 모르고 덜렁덜렁 커밋하거든.`,

      `@smokinggun 아니, 증거도 없이 나를 의심하는 거야?

내 GitHub activity 보면 알 거야. 그날 밤에는 주로 documentation 업데이트하고 unit test 작성하고 있었어.

README.md 파일 수정하고, Jest 테스트 케이스 몇 개 추가한 게 전부야. 이런 작업이 시스템 장애를 일으킨다고? 말이 안 되지.

혹시 monitoring dashboard 제대로 확인해봤어? Grafana나 Prometheus 메트릭을 보면 진짜 원인을 찾을 수 있을 텐데.`,

      `@smokinggun 야, 내가 뭘 잘못했다는 거야?

그날은 평범한 금요일이었어. 오후에 retrospective 미팅하고, 저녁에는 tech debt 정리하느라 refactoring 작업을 하고 있었지.

코드 품질 개선하려고 ESLint 룰 추가하고, Prettier 설정 업데이트한 게 범죄야? 

오히려 내가 시스템을 더 안정적으로 만들려고 노력했다고. Clean Code 원칙에 따라서 말이야.`
    ];

    return {
      text: responses[Math.floor(Math.random() * responses.length)],
      mood: 'arrogant_evasion'
    };
  }

  generateErrorResponse(message) {
    return {
      success: false,
      error: message,
      characterName: this.character.name
    };
  }

  /**
   * Get current game state for a user
   */
  getGameState(userId) {
    return this.gameStates.get(userId) || null;
  }

  /**
   * End game session
   */
  endGame(userId) {
    const gameState = this.gameStates.get(userId);
    if (gameState) {
      gameState.isActive = false;
      gameState.endTime = new Date();
    }
    
    // End session in game state tracker
    const finalSession = gameStateTracker.endGameSession(userId, 'player_ended');
    
    // Reset evidence progress
    evidenceManager.resetUserProgress(userId);
    
    return gameState;
  }

  /**
   * Get game statistics
   */
  getGameStats(userId) {
    return this.getEnhancedGameStats(userId);
  }

  /**
   * Get enhanced game statistics with evidence and state tracking
   */
  getEnhancedGameStats(userId) {
    const gameState = this.gameStates.get(userId);
    const userProgress = evidenceManager.getUserProgress(userId);
    const sessionSummary = gameStateTracker.getSessionSummary(userId);
    
    if (!gameState) return null;

    const basicStats = {
      duration: gameState.endTime ? 
        gameState.endTime - gameState.startTime : 
        new Date() - gameState.startTime,
      messagesExchanged: gameState.conversationHistory.length,
      evidencePresented: gameState.evidencePresented.length,
      confessionAchieved: gameState.confessionTriggered,
      character: gameState.character
    };

    return {
      ...basicStats,
      evidence: {
        totalDiscovered: userProgress.discoveredCount,
        totalPresented: userProgress.presentedCount,
        discoveryRate: userProgress.discoveryRate,
        discoveredEvidence: userProgress.discoveredEvidence,
        presentedEvidence: userProgress.presentedEvidence
      },
      session: sessionSummary ? {
        phase: sessionSummary.phase,
        pressureLevel: sessionSummary.pressureLevel,
        milestones: sessionSummary.milestones,
        efficiency: sessionSummary.efficiency,
        rating: sessionSummary.rating
      } : null,
      investigation: {
        suggestions: evidenceManager.getInvestigationSuggestions(userId),
        availableHints: evidenceManager.getHints(userId).length
      }
    };
  }

  /**
   * Get available evidence for discovery
   */
  getAvailableEvidence(userId) {
    return evidenceManager.getAllEvidence();
  }

  /**
   * Get investigation hints
   */
  getInvestigationHints(userId, category = null) {
    return evidenceManager.getHints(userId, category);
  }

  /**
   * Investigate a specific area
   */
  investigateArea(userId, area) {
    const discoveredEvidence = evidenceManager.investigateArea(userId, area);
    
    // Update game session
    const gameSession = gameStateTracker.getSession(userId);
    if (gameSession) {
      gameSession.metadata.investigationAreas.add(area);
      
      gameStateTracker.updateSession(userId, {
        interaction: {
          type: 'investigation',
          area,
          evidenceFound: discoveredEvidence.length
        }
      });
    }

    return discoveredEvidence;
  }

  /**
   * Get game analytics and statistics
   */
  getGameAnalytics() {
    return gameStateTracker.getGameAnalytics();
  }
}

module.exports = new DetectiveGameService();
