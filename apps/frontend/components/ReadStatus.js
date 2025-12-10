import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { ConfirmOutlineIcon } from '@vapor-ui/icons';
import { Text, HStack } from '@vapor-ui/core';

const ReadStatus = ({ 
  messageType = 'text',
  participants = [],
  readers = [],
  className = '',
  socketRef = null,
  messageId = null,
  messageRef = null, // 메시지 요소의 ref 추가
  currentUserId = null // 현재 사용자 ID 추가
}) => {
  const [hasMarkedAsRead, setHasMarkedAsRead] = useState(false);
  const statusRef = useRef(null);
  const observerRef = useRef(null);

  // 읽지 않은 참여자 명단 생성 
  const unreadParticipants = useMemo(() => {
    if (messageType === 'system') return [];
    
    return participants.filter(participant => 
      !readers.some(reader => 
        reader.userId === participant._id || 
        reader.userId === participant.id
      )
    );
  }, [participants, readers, messageType]);

  // 읽지 않은 참여자 수 계산
  const unreadCount = useMemo(() => {
    if (messageType === 'system') {
      return 0;
    }
    return unreadParticipants.length;
  }, [unreadParticipants.length, messageType]);

  // 메시지를 읽음으로 표시하는 함수
  const markMessageAsRead = useCallback(async () => {
    if (!messageId || !currentUserId || hasMarkedAsRead || 
        messageType === 'system' || !socketRef?.current) {
      return;
    }

    try {
      // Socket.IO를 통해 서버에 읽음 상태 전송
      socketRef.current.emit('markMessagesAsRead', {
        messageIds: [messageId]
      });

      setHasMarkedAsRead(true);

    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }, [messageId, currentUserId, hasMarkedAsRead, messageType, socketRef]);

  // Intersection Observer 설정
  useEffect(() => {
    if (!messageRef?.current || !currentUserId || hasMarkedAsRead || messageType === 'system') {
      return;
    }

    // 이미 읽은 메시지인지 확인
    const isAlreadyRead = readers.some(reader => 
      reader.userId === currentUserId
    );

    if (isAlreadyRead) {
      setHasMarkedAsRead(true);
      return;
    }

    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.5 // 메시지의 50%가 보여야 읽음으로 처리
    };

    const handleIntersect = (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !hasMarkedAsRead) {
          markMessageAsRead();
        }
      });
    };

    observerRef.current = new IntersectionObserver(handleIntersect, observerOptions);
    observerRef.current.observe(messageRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [messageRef, currentUserId, hasMarkedAsRead, messageType, readers, markMessageAsRead]);

  // 시스템 메시지는 읽음 상태 표시 안 함
  if (messageType === 'system') {
    return null;
  }

  // 모두 읽은 경우
  if (unreadCount === 0) {
    return (
      <HStack
        className={className}
        ref={statusRef}
        gap="$050"
        alignItems="center"
        role="status"
        aria-label="모든 참여자가 메시지를 읽었습니다"
        data-testid="read-status-all-read"
      >
        <HStack alignItems="center">
          <ConfirmOutlineIcon size={12} className='text-v-success-100' />
          <ConfirmOutlineIcon size={12} className='-ml-1.5 text-v-success-100' />
        </HStack>
        <Text typography="subtitle2" className="text-v-hint-200">모두 읽음</Text>
      </HStack>
    );
  }

  // 읽지 않은 사람이 있는 경우
  return (
    <HStack
      className={className}
      ref={statusRef}
      gap="$050"
      alignItems="center"
      role="status"
      aria-label={`${unreadCount}명이 메시지를 읽지 않았습니다`}
      data-testid="read-status-unread"
    >
      <ConfirmOutlineIcon size={12} className="text-v-hint-200" />
      {unreadCount > 0 && (
        <Text typography="subtitle2" className="text-v-hint-200">
          {unreadCount}명 안 읽음
        </Text>
      )}
    </HStack>
  );
};

export default ReadStatus;