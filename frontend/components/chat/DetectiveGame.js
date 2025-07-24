import React, { useState, useEffect, useRef } from 'react';
import { Button, Card, Form, Alert, Badge, Modal, Accordion } from 'react-bootstrap';
import { Send, FileText, Play, Square, Info, Search, Eye } from 'lucide-react';
import socket from '../../services/socket';

const DetectiveGame = ({ roomId, onGameEnd }) => {
  const [gameActive, setGameActive] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [evidence, setEvidence] = useState('');
  const [gameEnded, setGameEnded] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showEvidencePanel, setShowEvidencePanel] = useState(false);
  const [stats, setStats] = useState(null);
  const [discoveredEvidence, setDiscoveredEvidence] = useState([]);
  const [availableEvidence, setAvailableEvidence] = useState([]);
  const [investigationHints, setInvestigationHints] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Socket event listeners for detective game
    socket.on('detectiveGameStarted', handleGameStarted);
    socket.on('detectiveMessage', handleDetectiveMessage);
    socket.on('detectiveGameComplete', handleGameComplete);
    socket.on('detectiveGameEnded', handleGameEnded);
    socket.on('detectiveGameError', handleGameError);
    socket.on('detectiveStatus', handleDetectiveStatus);

    // Check for existing game on mount
    socket.emit('getDetectiveStatus');

    return () => {
      socket.off('detectiveGameStarted', handleGameStarted);
      socket.off('detectiveMessage', handleDetectiveMessage);
      socket.off('detectiveGameComplete', handleGameComplete);
      socket.off('detectiveGameEnded', handleGameEnded);
      socket.off('detectiveGameError', handleGameError);
      socket.off('detectiveStatus', handleDetectiveStatus);
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleGameStarted = (data) => {
    if (data.success) {
      setGameActive(true);
      setGameState(data.gameState);
      setMessages([]);
      setGameEnded(false);
      setShowInstructions(true);
    }
  };

  const handleDetectiveMessage = (data) => {
    setMessages(prev => [...prev, {
      id: Date.now(),
      character: data.character,
      message: data.message,
      mood: data.mood,
      timestamp: data.timestamp,
      isSystemMessage: data.isSystemMessage,
      isConfession: data.isConfession
    }]);

    // Update discovered evidence if any
    if (data.foundEvidence && data.foundEvidence.length > 0) {
      setDiscoveredEvidence(prev => [...prev, ...data.foundEvidence]);
    }

    // Update stats with enhanced information
    if (data.evidenceAnalysis) {
      setStats(prev => ({
        ...prev,
        evidenceAnalysis: data.evidenceAnalysis
      }));
    }

    if (data.gameEnded) {
      setGameEnded(true);
    }
  };

  const handleGameComplete = (data) => {
    setGameEnded(true);
    setStats(data.stats);
    setMessages(prev => [...prev, {
      id: Date.now(),
      character: 'System',
      message: data.finalMessage,
      mood: 'success',
      timestamp: new Date(),
      isSystemMessage: true,
      isGameEnd: true
    }]);
  };

  const handleGameEnded = (data) => {
    setGameActive(false);
    setGameEnded(true);
    setStats(data.finalStats);
  };

  const handleGameError = (data) => {
    console.error('Detective game error:', data.message);
    setMessages(prev => [...prev, {
      id: Date.now(),
      character: 'System',
      message: `오류: ${data.message}`,
      mood: 'error',
      timestamp: new Date(),
      isSystemMessage: true
    }]);
  };

  const handleDetectiveStatus = (data) => {
    if (data.hasActiveGame) {
      setGameActive(true);
      setGameState(data.gameState);
      setStats(data.stats);
    }
  };

  const startGame = () => {
    socket.emit('startDetectiveGame', { roomId });
  };

  const sendMessage = (e) => {
    e.preventDefault();
    
    if (!inputMessage.trim()) return;

    const evidenceList = evidence.trim() 
      ? evidence.split('\n').map(e => e.trim()).filter(e => e)
      : [];

    // Add player message to display
    setMessages(prev => [...prev, {
      id: Date.now(),
      character: 'Player',
      message: inputMessage,
      evidence: evidenceList,
      timestamp: new Date(),
      isPlayerMessage: true
    }]);

    // Send to server
    socket.emit('detectiveInterrogate', {
      message: inputMessage,
      evidence: evidenceList
    });

    setInputMessage('');
    setEvidence('');
  };

  const investigateArea = async (area) => {
    try {
      const response = await fetch('/api/detective/investigate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': localStorage.getItem('token'),
          'x-session-id': localStorage.getItem('sessionId')
        },
        body: JSON.stringify({ area })
      });

      const data = await response.json();
      if (data.success && data.discoveredEvidence.length > 0) {
        setDiscoveredEvidence(prev => [...prev, ...data.discoveredEvidence]);
        
        // Show investigation result message
        setMessages(prev => [...prev, {
          id: Date.now(),
          character: 'System',
          message: `🔍 ${data.message}`,
          mood: 'success',
          timestamp: new Date(),
          isSystemMessage: true,
          foundEvidence: data.discoveredEvidence
        }]);
      }
    } catch (error) {
      console.error('Investigation failed:', error);
    }
  };

  const getHints = async (category = null) => {
    try {
      const url = category ? `/api/detective/hints?category=${category}` : '/api/detective/hints';
      const response = await fetch(url, {
        headers: {
          'x-auth-token': localStorage.getItem('token'),
          'x-session-id': localStorage.getItem('sessionId')
        }
      });

      const data = await response.json();
      if (data.success) {
        setInvestigationHints(data.hints);
      }
    } catch (error) {
      console.error('Failed to get hints:', error);
    }
  };

  const endGame = () => {
    socket.emit('endDetectiveGame');
    if (onGameEnd) onGameEnd();
  };

  const getMoodBadgeColor = (mood) => {
    switch (mood) {
      case 'arrogant_introduction':
      case 'arrogant_evasion':
        return 'warning';
      case 'defensive_technical':
      case 'technical_evasion':
        return 'info';
      case 'defeated_confession':
        return 'success';
      case 'blame_shifting':
        return 'secondary';
      case 'error':
        return 'danger';
      default:
        return 'primary';
    }
  };

  const getMoodIcon = (mood) => {
    switch (mood) {
      case 'arrogant_introduction':
      case 'arrogant_evasion':
        return '😏';
      case 'defensive_technical':
        return '🤓';
      case 'technical_evasion':
        return '💻';
      case 'defeated_confession':
        return '😰';
      case 'blame_shifting':
        return '👉';
      case 'error':
        return '❌';
      case 'success':
        return '🎉';
      default:
        return '🤖';
    }
  };

  if (!gameActive && !gameEnded) {
    return (
      <Card className="detective-game-card">
        <Card.Header className="bg-dark text-white">
          <h5 className="mb-0">🕵️ 사이버 범죄 수사 미니게임</h5>
        </Card.Header>
        <Card.Body className="text-center">
          <h6>2030년 사이버 범죄 수사 게임</h6>
          <p className="text-muted">
            시스템 장애를 일으킨 AI 용의자 '스티브'를 심문하여 자백을 받아내세요!
            <br />
            <small>🤖 GPT-4 기반 동적 AI 캐릭터 + 증거 수집 시스템</small>
          </p>
          <Button 
            variant="primary" 
            onClick={startGame}
            className="mb-2"
          >
            <Play className="me-2" size={16} />
            게임 시작
          </Button>
          <Button 
            variant="outline-info" 
            size="sm"
            onClick={() => setShowInstructions(true)}
            className="ms-2"
          >
            <Info size={16} className="me-1" />
            게임 설명
          </Button>
        </Card.Body>
      </Card>
    );
  }

  return (
    <>
      <Card className="detective-game-card">
        <Card.Header className="bg-dark text-white d-flex justify-content-between align-items-center">
          <h5 className="mb-0">🕵️ 사이버 범죄 수사 진행중</h5>
          <div>
            <Button 
              variant="outline-light" 
              size="sm"
              onClick={() => setShowEvidencePanel(!showEvidencePanel)}
              className="me-2"
            >
              <Search size={16} />
              증거
            </Button>
            <Button 
              variant="outline-light" 
              size="sm"
              onClick={() => setShowInstructions(true)}
              className="me-2"
            >
              <Info size={16} />
            </Button>
            <Button 
              variant="outline-danger" 
              size="sm"
              onClick={endGame}
            >
              <Square size={16} />
              종료
            </Button>
          </div>
        </Card.Header>

        <Card.Body className="detective-messages" style={{ height: '400px', overflowY: 'auto' }}>
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`mb-3 ${msg.isPlayerMessage ? 'text-end' : 'text-start'}`}
            >
              <div className={`d-inline-block p-2 rounded ${
                msg.isPlayerMessage 
                  ? 'bg-primary text-white' 
                  : msg.isSystemMessage 
                    ? 'bg-light border'
                    : 'bg-secondary text-white'
              }`}>
                <div className="d-flex align-items-center mb-1">
                  <strong className="me-2">{msg.character}</strong>
                  {msg.mood && (
                    <Badge bg={getMoodBadgeColor(msg.mood)} className="me-2">
                      {getMoodIcon(msg.mood)} {msg.mood}
                    </Badge>
                  )}
                  {msg.isConfession && (
                    <Badge bg="success">🎯 자백!</Badge>
                  )}
                </div>
                
                <div className="message-content">
                  {msg.message.split('\n').map((line, index) => (
                    <div key={index}>{line}</div>
                  ))}
                </div>

                {msg.evidence && msg.evidence.length > 0 && (
                  <div className="mt-2">
                    <small className="text-muted">
                      <FileText size={12} className="me-1" />
                      제시된 증거:
                    </small>
                    <ul className="small mt-1 mb-0">
                      {msg.evidence.map((ev, index) => (
                        <li key={index}>{ev}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <small className="text-muted d-block mt-1">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </small>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </Card.Body>

        {!gameEnded && (
          <Card.Footer>
            <Form onSubmit={sendMessage}>
              <div className="mb-2">
                <Form.Control
                  as="textarea"
                  rows={2}
                  placeholder="@smokinggun 태그로 스모군을 심문하세요..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  disabled={gameEnded}
                />
              </div>
              
              <div className="mb-2">
                <Form.Control
                  as="textarea"
                  rows={2}
                  placeholder="증거를 입력하세요 (한 줄당 하나씩)"
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  disabled={gameEnded}
                />
                <Form.Text className="text-muted">
                  💡 힌트: force push와 로그 삭제 증거가 모두 필요합니다
                </Form.Text>
              </div>

              <div className="d-flex justify-content-between">
                <Button 
                  type="submit" 
                  variant="primary"
                  disabled={!inputMessage.trim() || gameEnded}
                >
                  <Send size={16} className="me-1" />
                  심문하기
                </Button>
                
                {stats && (
                  <small className="text-muted align-self-center">
                    메시지: {stats.messagesExchanged} | 
                    증거: {stats.evidencePresented} | 
                    소요시간: {Math.floor(stats.duration / 1000)}초
                  </small>
                )}
              </div>
            </Form>
          </Card.Footer>
        )}

        {gameEnded && (
          <Card.Footer className="bg-light">
            <Alert variant={stats?.confessionAchieved ? "success" : "warning"}>
              <h6>
                {stats?.confessionAchieved ? "🎉 수사 성공!" : "😔 수사 미완료"}
              </h6>
              <p className="mb-2">
                {stats?.confessionAchieved 
                  ? "축하합니다! 스모군의 자백을 받아냈습니다!" 
                  : "아직 충분한 증거를 찾지 못했습니다."}
              </p>
              {stats && (
                <div className="small">
                  <strong>최종 통계:</strong>
                  <ul className="mb-0 mt-1">
                    <li>소요 시간: {Math.floor(stats.duration / 1000)}초</li>
                    <li>주고받은 메시지: {stats.messagesExchanged}개</li>
                    <li>제시한 증거: {stats.evidencePresented}개</li>
                    <li>성과: {stats.performance}</li>
                  </ul>
                </div>
              )}
            </Alert>
            <Button variant="primary" onClick={startGame} className="me-2">
              다시 시작
            </Button>
            <Button variant="outline-secondary" onClick={endGame}>
              게임 종료
            </Button>
          </Card.Footer>
        )}
      </Card>

      {/* Evidence Discovery Panel */}
      <Modal show={showEvidencePanel} onHide={() => setShowEvidencePanel(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>🔍 증거 수집 패널</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="row">
            <div className="col-md-6">
              <h6>🕵️ 수사 구역</h6>
              <div className="d-grid gap-2">
                <Button variant="outline-primary" onClick={() => investigateArea('git_logs')}>
                  <FileText size={16} className="me-2" />
                  Git 로그 조사
                </Button>
                <Button variant="outline-primary" onClick={() => investigateArea('server_logs')}>
                  <FileText size={16} className="me-2" />
                  서버 로그 조사
                </Button>
                <Button variant="outline-primary" onClick={() => investigateArea('jenkins')}>
                  <FileText size={16} className="me-2" />
                  Jenkins 조사
                </Button>
                <Button variant="outline-primary" onClick={() => investigateArea('system_logs')}>
                  <FileText size={16} className="me-2" />
                  시스템 로그 조사
                </Button>
                <Button variant="outline-primary" onClick={() => investigateArea('elasticsearch')}>
                  <FileText size={16} className="me-2" />
                  Elasticsearch 조사
                </Button>
                <Button variant="outline-primary" onClick={() => investigateArea('config_files')}>
                  <FileText size={16} className="me-2" />
                  설정 파일 조사
                </Button>
              </div>
            </div>
            
            <div className="col-md-6">
              <h6>📝 발견된 증거 ({discoveredEvidence.length})</h6>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {discoveredEvidence.length === 0 ? (
                  <p className="text-muted">아직 발견된 증거가 없습니다.</p>
                ) : (
                  discoveredEvidence.map((evidence, index) => (
                    <Card key={index} className="mb-2" size="sm">
                      <Card.Body className="p-2">
                        <h6 className="mb-1">{evidence.title}</h6>
                        <p className="mb-1 small">{evidence.description}</p>
                        <Badge bg={evidence.category === 'force_push' ? 'danger' : 
                                  evidence.category === 'log_deletion' ? 'warning' : 'info'}>
                          {evidence.category}
                        </Badge>
                        <Badge bg="secondary" className="ms-1">
                          영향도: {evidence.impact}
                        </Badge>
                      </Card.Body>
                    </Card>
                  ))
                )}
              </div>
              
              {investigationHints.length > 0 && (
                <>
                  <h6 className="mt-3">💡 수사 힌트</h6>
                  <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    {investigationHints.slice(0, 3).map((hint, index) => (
                      <Alert key={index} variant="info" className="p-2 small">
                        {hint.hint}
                      </Alert>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          
          <div className="mt-3">
            <Button variant="outline-secondary" onClick={() => getHints()}>
              <Eye size={16} className="me-1" />
              힌트 새로고침
            </Button>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEvidencePanel(false)}>
            닫기
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Instructions Modal */}
      <Modal show={showInstructions} onHide={() => setShowInstructions(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>🕵️ 사이버 범죄 수사 게임 설명</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <h6>📖 게임 스토리</h6>
          <p>
            2030년, 소프트웨어 회사에서 치명적인 시스템 장애가 발생했습니다. 
            로그가 삭제되고, 파이프라인이 우회되었으며, 누군가 프로덕션에 직접 코드를 푸시했습니다. 
            여러 AI 용의자 중 하나가 범인이며, 당신은 진실을 밝혀내야 합니다.
          </p>

          <h6>🎯 목표</h6>
          <p>
            AI 용의자 <strong>'스티브'</strong>를 심문하여 자백을 받아내세요!
            <br />
            <small className="text-muted">🤖 OpenAI GPT-4 기반 동적 AI 캐릭터 + 증거 수집 시스템</small>
          </p>

          <h6>📋 게임 규칙</h6>
          <ul>
            <li>스티브는 회피적이고 거만한 개발자 성격입니다</li>
            <li>항상 <code>@smokinggun</code> 태그로 대화해야 합니다</li>
            <li>자백을 받으려면 <strong>두 가지 핵심 증거</strong>를 모두 제시해야 합니다:
              <ol>
                <li>프로덕션에 직접 force push한 증거</li>
                <li>로그를 삭제하여 흔적을 지운 증거</li>
              </ol>
            </li>
            <li>그 전까지는 Jenkins, Git, 다른 개발자들을 탓하며 부인할 것입니다</li>
          </ul>

          <h6>💡 공략 팁</h6>
          <ul>
            <li>기술적 전문용어로 회피하려 할 때 끈질기게 파고드세요</li>
            <li>구체적인 증거를 제시할수록 더 당황할 것입니다</li>
            <li>"force push", "git push --force", "로그 삭제", "log wipe" 등의 키워드가 중요합니다</li>
            <li>변명과 핑계를 구별하고 계속 압박하세요</li>
          </ul>

          <h6>🎮 조작 방법</h6>
          <ul>
            <li><strong>메시지 입력창:</strong> 스티브에게 질문이나 압박을 가하세요</li>
            <li><strong>증거 입력창:</strong> 발견한 증거를 한 줄씩 입력하세요</li>
            <li><strong>증거 패널:</strong> 여러 구역을 수사하여 체계적으로 증거를 수집하세요</li>
            <li><strong>힌트 시스템:</strong> 막힐 때는 힌트를 활용하세요</li>
            <li>두 가지 핵심 증거를 모두 제시하면 게임이 성공적으로 끝납니다</li>
          </ul>

          <h6>🔍 증거 수집 시스템</h6>
          <ul>
            <li><strong>Git 로그:</strong> force push 관련 증거를 찾을 수 있습니다</li>
            <li><strong>시스템 로그:</strong> 로그 삭제 관련 증거를 발견할 수 있습니다</li>
            <li><strong>서버 로그:</strong> 직접 접근 기록을 조사할 수 있습니다</li>
            <li><strong>Jenkins:</strong> 파이프라인 우회 증거를 찾을 수 있습니다</li>
            <li><strong>Elasticsearch:</strong> 로그 인덱스 조작 흔적을 찾을 수 있습니다</li>
            <li><strong>설정 파일:</strong> 로그 로테이션 조작 증거를 발견할 수 있습니다</li>
          </ul>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowInstructions(false)}>
            닫기
          </Button>
          {!gameActive && (
            <Button variant="primary" onClick={() => {
              setShowInstructions(false);
              startGame();
            }}>
              게임 시작하기
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default DetectiveGame;
