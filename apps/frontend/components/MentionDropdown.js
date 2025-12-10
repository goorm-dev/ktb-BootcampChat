import React, { useCallback, memo, useRef, useEffect } from 'react';
import { HStack, VStack, Text } from '@vapor-ui/core';
import CustomAvatar from './CustomAvatar';

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

  const handleKeyDown = useCallback((e, user) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(user);
    }
  }, [onSelect]);

  if (!participants?.length) return null;

  return (
    <div
      ref={dropdownRef}
      role="listbox"
      aria-label="멘션할 사용자 목록"
      className="rounded-xl overflow-hidden backdrop-blur-md"
      style={{
        width: '320px',
        maxHeight: '280px',
        overflowY: 'auto',
        background: 'rgba(30, 30, 30, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3)',
      }}
    >
      <div style={{ padding: '12px' }}>
        {participants.map((user, index) => {
            const isActive = index === activeIndex;

            return (
              <div
                key={user._id || user.id}
                ref={el => itemRefs.current[index] = el}
                role="option"
                aria-selected={isActive}
                tabIndex={0}
                onClick={() => onSelect(user)}
                onKeyDown={(e) => handleKeyDown(e, user)}
                onMouseEnter={() => onMouseEnter(index)}
                className="transition-all duration-200 cursor-pointer"
                style={{
                  padding: '10px 12px',
                  marginBottom: '4px',
                  borderRadius: '8px',
                  background: isActive
                    ? 'rgba(59, 130, 246, 0.15)'
                    : 'transparent',
                  border: isActive
                    ? '1px solid rgba(59, 130, 246, 0.4)'
                    : '1px solid transparent',
                  ...(isActive ? {
                    boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.2), 0 2px 8px rgba(59, 130, 246, 0.15)'
                  } : {})
                }}
                onMouseEnterCapture={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <HStack gap="$200" alignItems="center">
                  <CustomAvatar
                    user={user}
                    size="md"
                    showInitials
                  />

                  <VStack gap="$050" flex="1" minWidth="0">
                    <Text
                      typography="body2"
                      className="font-medium"
                      style={{
                        color: isActive ? '#93C5FD' : 'rgba(255, 255, 255, 0.9)',
                        fontSize: '14px'
                      }}
                    >
                      {user.name}
                    </Text>
                    {user.email && (
                      <Text
                        typography="body3"
                        className="truncate"
                        style={{
                          maxWidth: '200px',
                          color: isActive ? 'rgba(147, 197, 253, 0.7)' : 'rgba(255, 255, 255, 0.5)',
                          fontSize: '12px'
                        }}
                        title={user.email}
                      >
                        {user.email}
                      </Text>
                    )}
                  </VStack>
                </HStack>
              </div>
            );
          })}
      </div>
    </div>
  );
};

export default memo(MentionDropdown);