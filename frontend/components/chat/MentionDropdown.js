import React, { useCallback, memo, useRef, useEffect } from 'react';
import { Avatar } from '@vapor-ui/core';
import { getAIAvatarStyles, generateColorFromEmail, getContrastTextColor } from '../../utils/colorUtils';

const MentionDropdown = ({ 
  participants = [], 
  activeIndex = 0, 
  onSelect = () => {}, 
  onMouseEnter = () => {}
}) => {
  const dropdownRef = useRef(null);
  const itemRefs = useRef([]);

  // 활성 항목이 변경될 때마다 스크롤 조정
  useEffect(() => {
    if (!dropdownRef.current || !itemRefs.current[activeIndex]) return;

    const container = dropdownRef.current;
    const activeItem = itemRefs.current[activeIndex];
    
    // 활성 항목의 위치 계산
    const itemTop = activeItem.offsetTop;
    const itemBottom = itemTop + activeItem.offsetHeight;
    const containerTop = container.scrollTop;
    const containerBottom = containerTop + container.offsetHeight;

    // 활성 항목이 보이는 영역을 벗어났는지 확인
    if (itemTop < containerTop) {
      container.scrollTo({
        top: itemTop,
        behavior: 'smooth'
      });
    } else if (itemBottom > containerBottom) {
      container.scrollTo({
        top: itemBottom - container.offsetHeight,
        behavior: 'smooth'
      });
    }
  }, [activeIndex]);

  const getAvatarStyles = useCallback((user) => {
    if (!user) return {};

    if (user.isAI) {
      const aiStyles = getAIAvatarStyles(user.name);
      return {
        backgroundColor: aiStyles.backgroundColor,
        color: aiStyles.color,
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
      };
    }
    
    const backgroundColor = generateColorFromEmail(user.email);
    const color = getContrastTextColor(backgroundColor);
    return { 
      backgroundColor, 
      color,
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
    };
  }, []);

  const renderUserBadge = useCallback((user) => {
    if (user.isAI) {
      return (
        <span className="mention-badge ai">
          AI 어시스턴트
        </span>
      );
    }
    
    return (
      <span className="mention-badge user" title={user.email}>
        {user.email}
      </span>
    );
  }, []);

  const getAvatarContent = useCallback((user) => {
    if (user.isAI) {
      return user.name === 'wayneAI' ? 'W' : 'C';
    }
    return user.name.charAt(0).toUpperCase();
  }, []);

  const handleKeyDown = useCallback((e, user) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(user);
    }
  }, [onSelect]);

  if (!participants?.length) return null;

  return (
    <div 
      className="mention-dropdown" 
      role="listbox" 
      aria-label="멘션할 사용자 목록"
      ref={dropdownRef}
    >
      {participants.map((user, index) => (
        <div
          key={user.id || `ai-${user.name}`}
          ref={el => itemRefs.current[index] = el}
          role="option"
          aria-selected={index === activeIndex}
          tabIndex={0}
          className={`mention-item ${index === activeIndex ? 'active' : ''}`}
          onClick={() => onSelect(user)}
          onKeyDown={(e) => handleKeyDown(e, user)}
          onMouseEnter={() => onMouseEnter(index)}
        >
          <div className="mention-item-content">
            <Avatar.Root
              size="sm"
              style={{
                ...getAvatarStyles(user),
                flexShrink: 0
              }}
              aria-label={`${user.name}의 아바타`}
            >
              <Avatar.Fallback style={getAvatarStyles(user)}>
                {getAvatarContent(user)}
              </Avatar.Fallback>
            </Avatar.Root>
            
            <div className="mention-info">
              <span className="mention-name">
                {user.isAI ? (user.name === 'wayneAI' ? 'Wayne AI' : 'Consulting AI') : user.name}
              </span>
              {renderUserBadge(user)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default memo(MentionDropdown);