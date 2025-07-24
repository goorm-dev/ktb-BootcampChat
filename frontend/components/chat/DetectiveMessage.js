// Enhanced DetectiveMessage.js components
import React, { forwardRef } from 'react';
import { Badge } from '@vapor-ui/core';
import { Clock, Shield, AlertTriangle } from 'lucide-react';

// Detective System Message Component
export const DetectiveSystemMessage = forwardRef(({ msg, ...props }, ref) => {
  const isRulesMessage = msg.isDetectiveRules || msg.content.includes('탐정 게임이 시작되었습니다');
  
  return (
    <div ref={ref} className="detective-system-message" style={{
      padding: '16px',
      margin: '12px 0',
      backgroundColor: isRulesMessage ? '#fef3c7' : '#f3f4f6',
      border: `1px solid ${isRulesMessage ? '#f59e0b' : '#d1d5db'}`,
      borderRadius: '12px',
      borderLeft: `4px solid ${isRulesMessage ? '#f59e0b' : '#6b7280'}`
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: isRulesMessage ? '12px' : '8px'
      }}>
        <span style={{ fontSize: '18px' }}>
          {isRulesMessage ? '🕵️' : 'ℹ️'}
        </span>
        <strong style={{ 
          color: isRulesMessage ? '#92400e' : '#374151',
          fontSize: '14px'
        }}>
          {isRulesMessage ? '탐정 게임 시작' : '시스템'}
        </strong>
        <Badge 
          color={isRulesMessage ? 'warning' : 'secondary'}
          style={{ fontSize: '11px' }}
        >
          {new Date(msg.timestamp).toLocaleTimeString()}
        </Badge>
      </div>
      
      <div style={{
        color: isRulesMessage ? '#92400e' : '#4b5563',
        lineHeight: '1.6',
        fontSize: '14px',
        whiteSpace: 'pre-wrap'
      }}>
        {msg.content.split('\n').map((line, index) => {
          // Handle markdown-style formatting
          if (line.startsWith('**') && line.endsWith('**')) {
            return (
              <div key={index} style={{ 
                fontWeight: 'bold', 
                marginTop: index > 0 ? '8px' : '0',
                marginBottom: '4px'
              }}>
                {line.slice(2, -2)}
              </div>
            );
          }
          
          if (line.match(/^\d+[️⃣]/)) {
            return (
              <div key={index} style={{ 
                marginLeft: '16px', 
                marginTop: '4px',
                fontWeight: '500'
              }}>
                {line}
              </div>
            );
          }
          
          if (line.startsWith('**💡')) {
            return (
              <div key={index} style={{ 
                fontWeight: 'bold', 
                marginTop: '12px',
                marginBottom: '8px',
                color: isRulesMessage ? '#d97706' : '#374151'
              }}>
                {line.replace(/\*\*/g, '')}
              </div>
            );
          }
          
          if (line.startsWith('- ')) {
            return (
              <div key={index} style={{ 
                marginLeft: '16px', 
                marginTop: '2px'
              }}>
                • {line.slice(2)}
              </div>
            );
          }
          
          return line ? (
            <div key={index} style={{ marginTop: index > 0 ? '4px' : '0' }}>
              {line}
            </div>
          ) : (
            <div key={index} style={{ height: '8px' }} />
          );
        })}
      </div>
    </div>
  );
});

DetectiveSystemMessage.displayName = 'DetectiveSystemMessage';

// Detective Steve/Smokinggun Message Component
export const DetectiveSteveMessage = forwardRef(({ msg, currentUser, onReactionAdd, onReactionRemove, ...props }, ref) => {
  const getMoodColor = (mood) => {
    switch (mood) {
      case 'arrogant_introduction':
      case 'arrogant_evasion':
        return '#f59e0b';
      case 'defensive_technical':
      case 'technical_evasion':
        return '#3b82f6';
      case 'defeated_confession':
        return '#10b981';
      case 'blame_shifting':
        return '#8b5cf6';
      default:
        return '#6b7280';
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
      default:
        return '🤖';
    }
  };

  const isConfession = msg.metadata?.isConfession || msg.isConfession;
  const mood = msg.metadata?.mood || msg.mood;

  return (
    <div ref={ref} className="detective-steve-message" style={{
      padding: '16px',
      margin: '12px 0',
      backgroundColor: isConfession ? '#dcfce7' : '#f1f5f9',
      border: `1px solid ${isConfession ? '#10b981' : '#cbd5e1'}`,
      borderRadius: '12px',
      borderLeft: `4px solid ${isConfession ? '#10b981' : getMoodColor(mood)}`,
      position: 'relative'
    }}>
      {/* Character Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>🔫</span>
          <strong style={{ color: '#1f2937', fontSize: '15px' }}>
            @smokinggun
          </strong>
          {mood && (
            <Badge 
              style={{ 
                backgroundColor: getMoodColor(mood),
                color: 'white',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {getMoodIcon(mood)}
              {mood.replace(/_/g, ' ')}
            </Badge>
          )}
          {isConfession && (
            <Badge 
              color="success"
              style={{ fontSize: '11px' }}
            >
              🎯 자백!
            </Badge>
          )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={12} color="#6b7280" />
          <span style={{ fontSize: '11px', color: '#6b7280' }}>
            {new Date(msg.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Message Content */}
      <div style={{
        color: isConfession ? '#065f46' : '#374151',
        lineHeight: '1.6',
        fontSize: '14px',
        whiteSpace: 'pre-wrap',
        backgroundColor: isConfession ? '#f0fdf4' : 'white',
        padding: '12px',
        borderRadius: '8px',
        border: `1px solid ${isConfession ? '#bbf7d0' : '#e5e7eb'}`
      }}>
        {msg.content.split('\n').map((line, index) => {
          // Handle code blocks
          if (line.startsWith('```') && line.endsWith('```')) {
            const code = line.slice(3, -3);
            return (
              <div key={index} style={{
                backgroundColor: '#1f2937',
                color: '#f9fafb',
                padding: '8px 12px',
                borderRadius: '6px',
                fontFamily: 'Monaco, Consolas, monospace',
                fontSize: '12px',
                margin: '8px 0',
                overflow: 'auto'
              }}>
                {code}
              </div>
            );
          }
          
          // Handle inline code
          if (line.includes('`')) {
            const parts = line.split('`');
            return (
              <div key={index} style={{ marginTop: index > 0 ? '4px' : '0' }}>
                {parts.map((part, partIndex) => 
                  partIndex % 2 === 0 ? (
                    <span key={partIndex}>{part}</span>
                  ) : (
                    <code key={partIndex} style={{
                      backgroundColor: '#f3f4f6',
                      padding: '2px 4px',
                      borderRadius: '3px',
                      fontSize: '13px',
                      fontFamily: 'Monaco, Consolas, monospace'
                    }}>
                      {part}
                    </code>
                  )
                )}
              </div>
            );
          }
          
          return line ? (
            <div key={index} style={{ marginTop: index > 0 ? '4px' : '0' }}>
              {line}
            </div>
          ) : (
            <div key={index} style={{ height: '8px' }} />
          );
        })}
      </div>

      {/* Confession Special Effects */}
      {isConfession && (
        <div style={{
          position: 'absolute',
          top: '-8px',
          right: '-8px',
          background: 'linear-gradient(45deg, #10b981, #059669)',
          color: 'white',
          padding: '4px 8px',
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: 'bold',
          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
          animation: 'pulse 2s infinite'
        }}>
          🎉 SUCCESS!
        </div>
      )}

      {/* Evidence Analysis Indicator */}
      {msg.metadata?.evidenceAnalysis && (
        <div style={{
          marginTop: '12px',
          padding: '8px 12px',
          backgroundColor: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '6px',
          fontSize: '12px',
          color: '#92400e'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={14} />
            <span>증거 압박 수준: {msg.metadata.evidenceAnalysis.totalImpact || 0}%</span>
          </div>
        </div>
      )}
    </div>
  );
});

DetectiveSteveMessage.displayName = 'DetectiveSteveMessage';

// Detective User Message Component
export const DetectiveUserMessage = forwardRef(({ msg, currentUser, ...props }, ref) => {
  const isMine = msg.sender?._id === currentUser?.id || msg.sender?.id === currentUser?.id;
  
  return (
    <div ref={ref} className="detective-user-message" style={{
      padding: '12px 16px',
      margin: '8px 0',
      backgroundColor: isMine ? '#dbeafe' : '#f8fafc',
      border: `1px solid ${isMine ? '#3b82f6' : '#cbd5e1'}`,
      borderRadius: '12px',
      marginLeft: isMine ? '20%' : '0',
      marginRight: isMine ? '0' : '20%',
      borderBottomRightRadius: isMine ? '4px' : '12px',
      borderBottomLeftRadius: isMine ? '12px' : '4px'
    }}>
      {/* User Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>
            {isMine ? '🕵️' : '👤'}
          </span>
          <strong style={{ 
            color: isMine ? '#1e40af' : '#374151',
            fontSize: '14px'
          }}>
            {msg.sender?.name || '알 수 없음'}
            {isMine && ' (탐정)'}
          </strong>
        </div>
        
        <span style={{ fontSize: '11px', color: '#6b7280' }}>
          {new Date(msg.timestamp).toLocaleTimeString()}
        </span>
      </div>

      {/* Message Content */}
      <div style={{
        color: isMine ? '#1e40af' : '#374151',
        lineHeight: '1.5',
        fontSize: '14px',
        whiteSpace: 'pre-wrap'
      }}>
        {msg.content}
      </div>

      {/* Evidence Display */}
      {msg.evidence && msg.evidence.length > 0 && (
        <div style={{
          marginTop: '12px',
          padding: '8px 12px',
          backgroundColor: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '6px'
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 'bold',
            color: '#92400e',
            marginBottom: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <Shield size={12} />
            제시된 증거:
          </div>
          <ul style={{
            margin: '0',
            paddingLeft: '16px',
            fontSize: '12px',
            color: '#92400e'
          }}>
            {msg.evidence.map((evidence, index) => (
              <li key={index} style={{ marginTop: '2px' }}>
                {evidence}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
});

DetectiveUserMessage.displayName = 'DetectiveUserMessage';