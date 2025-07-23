import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { LikeIcon, CopyIcon } from '@vapor-ui/icons';
import { Button, IconButton } from '@vapor-ui/core';
import EmojiPicker from '../EmojiPicker';
import { Toast } from '../../Toast';

const MessageActions = ({ 
  messageId,
  messageContent,
  reactions,
  currentUserId,
  onReactionAdd,
  onReactionRemove,
  isMine = false,
  room = null
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [tooltipStates, setTooltipStates] = useState({});
  const [leftOffset, setLeftOffset] = useState(0);
  const emojiPickerRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const containerRef = useRef(null);
  const reactionRefs = useRef({});
  const rafId = useRef(null);

  const handleClickOutside = useCallback((event) => {
    const isClickInsideEmojiPicker = emojiPickerRef.current?.contains(event.target);
    const isClickOnEmojiButton = emojiButtonRef.current?.contains(event.target);

    if (!isClickInsideEmojiPicker && !isClickOnEmojiButton) {
      setShowEmojiPicker(false);
    }
  }, []);

  useEffect(() => {
    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker, handleClickOutside]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(messageContent);
      Toast.success('메시지가 클립보드에 복사되었습니다.');
    } catch (error) {
      console.error('Copy failed:', error);
      Toast.error('메시지 복사에 실패했습니다.');
    }
  }, [messageContent]);

  const handleReactionSelect = useCallback((emoji) => {
    try {
      const emojiChar = emoji.native || emoji;
      const hasReacted = reactions?.[emojiChar]?.includes(currentUserId);

      if (hasReacted) {
        onReactionRemove?.(messageId, emojiChar);
      } else {
        onReactionAdd?.(messageId, emojiChar);
      }
      setShowEmojiPicker(false);
    } catch (error) {
      console.error('Reaction handling error:', error);
    }
  }, [messageId, reactions, currentUserId, onReactionAdd, onReactionRemove]);

  const toggleTooltip = useCallback((emoji) => {
    setTooltipStates(prev => ({
      ...prev,
      [emoji]: !prev[emoji]
    }));
  }, []);

  const getReactionTooltip = useCallback((emoji, userIds) => {
    if (!userIds || !room?.participants) {
      return '';
    }

    // room.participants가 배열인지 확인
    if (!Array.isArray(room.participants)) {
      console.warn('room.participants is not an array:', room.participants);
      return '';
    }

    // 사용자 ID들을 문자열로 변환하여 비교하기 위한 Map 생성
    const participantMap = new Map(
      room.participants.map(p => [
        String(p._id || p.id), 
        p.name
      ])
    );

    const reactionUsers = userIds.map(userId => {
      const userIdStr = String(userId);
      
      // 현재 사용자인 경우
      if (userIdStr === String(currentUserId)) {
        return '나';
      }
      
      // 참여자 목록에서 해당 사용자 찾기
      const userName = participantMap.get(userIdStr);
      return userName || '알 수 없는 사용자';
    });

    // 중복 제거 및 정렬
    const uniqueUsers = [...new Set(reactionUsers)].sort((a, b) => {
      if (a === '나') return -1;
      if (b === '나') return 1;
      return a.localeCompare(b);
    });

    return uniqueUsers.join(', ');
  }, [currentUserId, room]);

  const renderReactions = useCallback(() => {
    if (!reactions || Object.keys(reactions).length === 0) {
      return null;
    }

    return (
      <div className="message-reactions">
        {Object.entries(reactions).map(([emoji, users]) => {
          const reactionId = `reaction-${messageId}-${emoji}`;
          
          if (!reactionRefs.current[emoji]) {
            reactionRefs.current[emoji] = React.createRef();
          }

          const tooltipContent = getReactionTooltip(emoji, users);

          return (
            <React.Fragment key={emoji}>
              <Button
                ref={reactionRefs.current[emoji]}
                id={reactionId}
                size="sm"
                variant={users.includes(currentUserId) ? 'solid' : 'outline'}
                color={users.includes(currentUserId) ? 'primary' : 'secondary'}
                className="reaction-badge"
                onClick={() => handleReactionSelect(emoji)}
                onMouseEnter={() => toggleTooltip(emoji)}
                onMouseLeave={() => toggleTooltip(emoji)}
                data-bs-toggle="tooltip"
                data-bs-placement="top"
                title={tooltipContent}
              >
                <span className="reaction-emoji">{emoji}</span>
                <span className="reaction-count">{users.length}</span>
              </Button>
            </React.Fragment>
          );
        })}
      </div>
    );
  }, [reactions, messageId, currentUserId, tooltipStates, handleReactionSelect, toggleTooltip, getReactionTooltip]);

  const toggleEmojiPicker = useCallback((e) => {    
    e.stopPropagation();
    setShowEmojiPicker(prev => !prev);
  }, []);

  // Calculate emoji picker position
  const getEmojiPickerPosition = useCallback(() => {
    if (!emojiButtonRef.current) return { top: 0, left: 0 };
    
    const buttonRect = emojiButtonRef.current.getBoundingClientRect();
    const pickerHeight = 350; // Approximate height
    const pickerWidth = 350; // Approximate width
    const buttonHeight = buttonRect.height;
    
    // Position above the left edge of the emoji button with gap
    let top = buttonRect.top - pickerHeight - 15; // 15px gap above button
    let left = buttonRect.left; // Align with left edge of button
    
    // If not enough space above, show below the button
    if (top < 10) {
      top = buttonRect.bottom + 15; // 15px gap below button
    }
    
    // Ensure picker doesn't go off the right edge
    if (left + pickerWidth > window.innerWidth) {
      left = window.innerWidth - pickerWidth - 10;
    }
    
    // Ensure picker doesn't go off the left edge
    if (left < 10) {
      left = 10;
    }
    
    return { top, left };
  }, []);

  return (
    <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`} ref={containerRef}>
      {renderReactions()}
      
      <div className={`message-actions-wrapper ${isMine ? 'mine' : ''}`}>
        <div className="message-actions" style={{ display: 'flex', alignItems: 'center', gap: 'var(--vapor-space-100)' }}>
          <div style={{ position: 'relative' }}>
            <IconButton
              ref={emojiButtonRef}
              size="sm"
              variant="outline"
              onClick={toggleEmojiPicker}
              aria-label="리액션 추가"
            >
              <LikeIcon size={16} />
            </IconButton>

            {showEmojiPicker && typeof window !== 'undefined' && ReactDOM.createPortal(
              <div 
                ref={emojiPickerRef}
                style={{
                  position: 'fixed',
                  ...getEmojiPickerPosition(),
                  zIndex: 9999
                }}
                onClick={e => e.stopPropagation()}
              >
                <div className="emoji-picker-container" style={{
                  backgroundColor: 'var(--vapor-color-normal)',
                  borderRadius: 'var(--vapor-radius-lg)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  border: '1px solid var(--vapor-color-border)'
                }}>
                  <EmojiPicker 
                    onSelect={handleReactionSelect}
                    emojiSize={20}
                    perLine={8}
                    theme="light"
                  />
                </div>
              </div>,
              document.body
            )}
          </div>
          <IconButton
            size="sm"
            variant="outline"
            onClick={handleCopy}
            aria-label="메시지 복사"
          >
            <CopyIcon size={16} />
          </IconButton>
        </div>
      </div>
    </div>
  );
};

MessageActions.defaultProps = {
  messageId: '',
  messageContent: '',
  reactions: {},
  currentUserId: null,
  onReactionAdd: () => {},
  onReactionRemove: () => {},
  isMine: false,
  room: null
};

export default React.memo(MessageActions);