import React, { useState } from 'react';
import { Badge, Button, Card, Text } from '@vapor-ui/core';
import { Flex, Box } from '../ui/Layout';
import { 
  Search, 
  FileText, 
  HelpCircle, 
  Eye, 
  AlertTriangle, 
  CheckCircle,
  Target,
  Zap,
  Clock,
  User
} from 'lucide-react';

const DetectiveSystemMessage = ({ msg, socketRef, room }) => {
  const [currentArea, setCurrentArea] = useState(null);
  const [isInvestigating, setIsInvestigating] = useState(false);

  const investigationAreas = [
    { id: 'git_logs', name: 'Git 로그', icon: FileText, description: '커밋 히스토리와 변경 사항' },
    { id: 'server_logs', name: '서버 로그', icon: AlertTriangle, description: '시스템 로그와 에러 기록' },
    { id: 'jenkins', name: 'Jenkins', icon: Target, description: 'CI/CD 파이프라인 기록' },
    { id: 'system_logs', name: '시스템 로그', icon: Eye, description: '운영체제 로그' },
    { id: 'elasticsearch', name: 'Elasticsearch', icon: Search, description: '검색 및 분석 로그' },
    { id: 'config_files', name: '설정 파일', icon: FileText, description: '시스템 설정 파일' }
  ];

  const handleInvestigate = async (areaId) => {
    if (isInvestigating) return;
    
    setIsInvestigating(true);
    setCurrentArea(areaId);
    
    if (socketRef.current) {
      socketRef.current.emit('detectiveInvestigate', {
        roomId: room._id,
        area: areaId
      });
    }
    
    setTimeout(() => setIsInvestigating(false), 2000);
  };

  const handleGetHints = () => {
    if (socketRef.current) {
      socketRef.current.emit('detectiveGetHints', {
        roomId: room._id
      });
    }
  };

  const handleGetEvidence = () => {
    if (socketRef.current) {
      socketRef.current.emit('detectiveGetEvidence', {
        roomId: room._id
      });
    }
  };

  const handleGetRules = () => {
    if (socketRef.current) {
      socketRef.current.emit('detectiveGetRules', {
        roomId: room._id
      });
    }
  };

  if (msg.subType === 'game_start') {
    return (
      <div className="message-bubble system-message detective-start">
        <Box style={{ padding: 'var(--vapor-space-300)' }}>
          <Flex align="center" gap="200" className="mb-3">
            <Target size={24} style={{ color: '#dc2626' }} />
            <Text typography="heading5" style={{ color: '#dc2626', fontWeight: 'bold' }}>
              🕵️ 탐정 수사 시작
            </Text>
          </Flex>
          
          <Text typography="body1" className="mb-3">
            <strong>사건:</strong> 2030년 사이버 보안 침해 사건<br/>
            <strong>용의자:</strong> 스티브 (개발자)<br/>
            <strong>혐의:</strong> 시스템 무단 조작 및 증거 인멸
          </Text>

          <Card.Root style={{ backgroundColor: '#f8f9fa', marginBottom: 'var(--vapor-space-300)' }}>
            <Card.Body style={{ padding: 'var(--vapor-space-200)' }}>
              <Text typography="body2" style={{ fontWeight: 'bold', marginBottom: 'var(--vapor-space-100)' }}>
                🎯 수사 목표
              </Text>
              <Text typography="body2">
                스티브로부터 자백을 받아내세요. 결정적 증거 2개가 모두 필요합니다:
                <br/>• <strong>Force Push 증거</strong> (Git 로그에서 발견)
                <br/>• <strong>로그 삭제 증거</strong> (서버/시스템 로그에서 발견)
              </Text>
            </Card.Body>
          </Card.Root>

          <Flex gap="200" wrap="wrap">
            <Button size="sm" variant="outline" onClick={handleGetRules}>
              <HelpCircle size={16} className="me-1" />
              게임 규칙
            </Button>
            <Button size="sm" variant="outline" onClick={handleGetHints}>
              <Zap size={16} className="me-1" />
              수사 힌트
            </Button>
            <Button size="sm" variant="outline" onClick={handleGetEvidence}>
              <FileText size={16} className="me-1" />
              증거 현황
            </Button>
          </Flex>

          <Text typography="body2" style={{ marginTop: 'var(--vapor-space-300)', fontStyle: 'italic', color: '#6b7280' }}>
            📝 아래 수사 구역을 클릭하여 증거를 수집하세요.
          </Text>
        </Box>
      </div>
    );
  }

  if (msg.subType === 'investigation_areas') {
    return (
      <div className="message-bubble system-message detective-areas">
        <Box style={{ padding: 'var(--vapor-space-300)' }}>
          <Flex align="center" gap="200" className="mb-3">
            <Search size={20} style={{ color: '#2563eb' }} />
            <Text typography="heading6" style={{ fontWeight: 'bold' }}>
              🔍 수사 구역
            </Text>
          </Flex>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--vapor-space-200)' }}>
            {investigationAreas.map((area) => {
              const Icon = area.icon;
              const isActive = currentArea === area.id;
              
              return (
                <Card.Root 
                  key={area.id}
                  style={{ 
                    cursor: 'pointer',
                    border: isActive ? '2px solid #2563eb' : '1px solid #e5e7eb',
                    backgroundColor: isActive ? '#eff6ff' : 'white',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => handleInvestigate(area.id)}
                >
                  <Card.Body style={{ padding: 'var(--vapor-space-200)' }}>
                    <Flex align="center" gap="200" className="mb-2">
                      <Icon size={18} style={{ color: isActive ? '#2563eb' : '#6b7280' }} />
                      <Text typography="body2" style={{ fontWeight: 'bold', color: isActive ? '#2563eb' : undefined }}>
                        {area.name}
                      </Text>
                      {isInvestigating && isActive && (
                        <div className="spinner-border spinner-border-sm text-primary" role="status">
                          <span className="visually-hidden">수사 중...</span>
                        </div>
                      )}
                    </Flex>
                    <Text typography="body3" style={{ color: '#6b7280' }}>
                      {area.description}
                    </Text>
                  </Card.Body>
                </Card.Root>
              );
            })}
          </div>
        </Box>
      </div>
    );
  }

  if (msg.subType === 'evidence_found') {
    const evidence = msg.data;
    return (
      <div className="message-bubble system-message detective-evidence">
        <Box style={{ padding: 'var(--vapor-space-300)' }}>
          <Flex align="center" gap="200" className="mb-3">
            <CheckCircle size={20} style={{ color: '#059669' }} />
            <Text typography="heading6" style={{ color: '#059669', fontWeight: 'bold' }}>
              🔍 증거 발견!
            </Text>
          </Flex>

          <Card.Root style={{ backgroundColor: evidence.critical ? '#fef2f2' : '#f0f9ff', border: evidence.critical ? '1px solid #fca5a5' : '1px solid #93c5fd' }}>
            <Card.Body style={{ padding: 'var(--vapor-space-300)' }}>
              <Flex justify="space-between" align="center" className="mb-2">
                <Text typography="body1" style={{ fontWeight: 'bold' }}>
                  {evidence.name}
                </Text>
                {evidence.critical && (
                  <Badge color="danger" size="sm">
                    결정적 증거
                  </Badge>
                )}
              </Flex>
              
              <Text typography="body2" className="mb-2">
                <strong>발견 위치:</strong> {evidence.area}
              </Text>
              
              <Text typography="body2" className="mb-3">
                {evidence.description}
              </Text>

              {evidence.content && (
                <Card.Root style={{ backgroundColor: '#f8f9fa' }}>
                  <Card.Body style={{ padding: 'var(--vapor-space-200)' }}>
                    <Text typography="body3" style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                      {evidence.content}
                    </Text>
                  </Card.Body>
                </Card.Root>
              )}
            </Card.Body>
          </Card.Root>

          <Text typography="body3" style={{ marginTop: 'var(--vapor-space-200)', fontStyle: 'italic', color: '#6b7280' }}>
            💡 이 증거를 스티브와의 심문에서 활용하세요!
          </Text>
        </Box>
      </div>
    );
  }

  // Default system message
  return (
    <div className="message-bubble system-message detective-info">
      <Box style={{ padding: 'var(--vapor-space-300)' }}>
        <Text typography="body2" style={{ whiteSpace: 'pre-wrap' }}>
          {msg.content}
        </Text>
      </Box>
    </div>
  );
};

const DetectiveSteveMessage = ({ msg }) => {
  const getMoodIcon = (mood) => {
    switch (mood) {
      case 'confident': return '😏';
      case 'nervous': return '😰';
      case 'angry': return '😠';
      case 'defensive': return '🛡️';
      case 'confused': return '🤔';
      case 'defeated': return '😔';
      default: return '💭';
    }
  };

  const getMoodColor = (mood) => {
    switch (mood) {
      case 'confident': return '#10b981';
      case 'nervous': return '#f59e0b';
      case 'angry': return '#ef4444';
      case 'defensive': return '#6366f1';
      case 'confused': return '#8b5cf6';
      case 'defeated': return '#6b7280';
      default: return '#374151';
    }
  };

  return (
    <div className="message-bubble ai-message detective-steve">
      <Box style={{ padding: 'var(--vapor-space-300)' }}>
        <Flex align="center" gap="200" className="mb-2">
          <User size={20} style={{ color: '#374151' }} />
          <Text typography="body2" style={{ fontWeight: 'bold' }}>
            스티브 (용의자)
          </Text>
          {msg.mood && (
            <Flex align="center" gap="100">
              <span style={{ fontSize: '16px' }}>{getMoodIcon(msg.mood)}</span>
              <Badge 
                size="sm" 
                style={{ 
                  backgroundColor: getMoodColor(msg.mood), 
                  color: 'white',
                  fontSize: '10px'
                }}
              >
                {msg.mood}
              </Badge>
            </Flex>
          )}
        </Flex>

        <Card.Root style={{ backgroundColor: '#f8f9fa', border: '1px solid #e9ecef' }}>
          <Card.Body style={{ padding: 'var(--vapor-space-300)' }}>
            <Text typography="body2" style={{ whiteSpace: 'pre-wrap' }}>
              {msg.content}
            </Text>
          </Card.Body>
        </Card.Root>

        {msg.pressure && (
          <Text typography="body3" style={{ marginTop: 'var(--vapor-space-200)', color: '#6b7280', fontStyle: 'italic' }}>
            압박 수준: {msg.pressure}/100
          </Text>
        )}
      </Box>
    </div>
  );
};

const DetectiveUserMessage = ({ msg, currentUser }) => {
  return (
    <div className="message-bubble user-message detective-user">
      <Box style={{ padding: 'var(--vapor-space-300)' }}>
        <Flex align="center" gap="200" className="mb-2">
          <User size={20} style={{ color: '#2563eb' }} />
          <Text typography="body2" style={{ fontWeight: 'bold', color: '#2563eb' }}>
            {currentUser?.name || '탐정'} (수사관)
          </Text>
          <Badge color="primary" size="sm">
            심문
          </Badge>
        </Flex>

        <Card.Root style={{ backgroundColor: '#eff6ff', border: '1px solid #93c5fd' }}>
          <Card.Body style={{ padding: 'var(--vapor-space-300)' }}>
            <Text typography="body2" style={{ whiteSpace: 'pre-wrap' }}>
              {msg.content}
            </Text>
          </Card.Body>
        </Card.Root>
      </Box>
    </div>
  );
};

export { DetectiveSystemMessage, DetectiveSteveMessage, DetectiveUserMessage };
