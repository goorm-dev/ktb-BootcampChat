import { useRef, useEffect, useCallback } from 'react';

/**
 * 채팅 메시지 자동 스크롤 훅
 * 
 * 특징:
 * - 내가 쓴 메시지: 무조건 최하단 스크롤
 * - 남이 쓴 메시지: 사용자가 하단 근처에 있을 때만 자동 스크롤
 * - 이전 메시지 로딩 시: 스크롤 위치 복원
 * 
 * @param {Array} messages - 메시지 배열
 * @param {string} currentUserId - 현재 사용자 ID
 * @param {boolean} isLoadingMessages - 이전 메시지 로딩 중 여부
 * @param {number} threshold - 자동 스크롤 임계값 (px, 기본 100)
 * @returns {Object} { containerRef, scrollToBottom, isNearBottom }
 */
export const useAutoScroll = (
  messages = [], 
  currentUserId = null, 
  isLoadingMessages = false,
  threshold = 100
) => {
  const containerRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const previousMessagesLengthRef = useRef(0);
  const isAutoScrollingRef = useRef(false);
  
  // 스크롤 복원을 위한 ref
  const previousScrollHeightRef = useRef(0);
  const previousScrollTopRef = useRef(0);
  const isRestoringRef = useRef(false);

  /**
   * 스크롤이 하단 근처에 있는지 확인
   */
  const checkIsNearBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return true;

    const { scrollHeight, scrollTop, clientHeight } = container;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);

    return distanceFromBottom <= threshold;
  }, [threshold]);

  /**
   * 최하단으로 스크롤
   */
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    const container = containerRef.current;
    if (!container) return;

    isAutoScrollingRef.current = true;

    container.scrollTo({
      top: container.scrollHeight,
      behavior
    });

    // 스크롤 완료 후 플래그 리셋
    setTimeout(() => {
      isAutoScrollingRef.current = false;
      isNearBottomRef.current = true;
    }, 300);
  }, []);

  /**
   * 스크롤 이벤트 핸들러 - 사용자가 스크롤할 때 위치 추적
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // 자동 스크롤 중이면 무시
      if (isAutoScrollingRef.current) return;

      isNearBottomRef.current = checkIsNearBottom();
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [checkIsNearBottom]);

  /**
   * 이전 메시지 로딩 시작 시 스크롤 위치 저장
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (isLoadingMessages && !isRestoringRef.current) {
      previousScrollHeightRef.current = container.scrollHeight;
      previousScrollTopRef.current = container.scrollTop;
      isRestoringRef.current = true;
    }
  }, [isLoadingMessages]);

  /**
   * 이전 메시지 로딩 완료 시 스크롤 위치 복원
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isRestoringRef.current || isLoadingMessages) return;

    const newScrollHeight = container.scrollHeight;
    const heightDifference = newScrollHeight - previousScrollHeightRef.current;

    if (heightDifference > 0) {
      container.scrollTop = previousScrollTopRef.current + heightDifference;
    }

    isRestoringRef.current = false;
  }, [messages, isLoadingMessages]);

  /**
   * 메시지 추가 시 자동 스크롤 로직
   */
  useEffect(() => {
    // 스크롤 복원 중이면 자동 스크롤 안함
    if (isRestoringRef.current || isLoadingMessages) {
      return;
    }

    // 메시지가 추가되지 않았으면 무시
    if (messages.length === 0 || messages.length === previousMessagesLengthRef.current) {
      return;
    }

    // 이전보다 메시지가 줄었으면 (초기화 등) 무시
    if (messages.length < previousMessagesLengthRef.current) {
      previousMessagesLengthRef.current = messages.length;
      return;
    }

    // 새로 추가된 메시지들 확인
    const newMessages = messages.slice(previousMessagesLengthRef.current);
    previousMessagesLengthRef.current = messages.length;

    // 새 메시지가 없으면 무시
    if (newMessages.length === 0) return;

    // 가장 최근 메시지 확인
    const latestMessage = newMessages[newMessages.length - 1];
    if (!latestMessage) return;

    // 메시지 발신자 확인
    const senderId = latestMessage.sender?._id || latestMessage.sender?.id || latestMessage.sender;
    const isMyMessage = senderId === currentUserId;

    // 자동 스크롤 조건 확인
    if (isMyMessage) {
      // 내가 쓴 메시지 → 무조건 스크롤
      scrollToBottom('smooth');
    } else if (isNearBottomRef.current) {
      // 남이 쓴 메시지 + 하단 근처에 있음 → 자동 스크롤
      scrollToBottom('smooth');
    } else {
      // 남이 쓴 메시지 + 상단에 있음 → 스크롤 안함
    }
  }, [messages, currentUserId, scrollToBottom, isLoadingMessages]);

  /**
   * 초기 로드 시 최하단으로 스크롤
   */
  useEffect(() => {
    if (messages.length > 0 && previousMessagesLengthRef.current === 0) {
      // 초기 로드는 즉시 스크롤 (애니메이션 없이)
      setTimeout(() => scrollToBottom('auto'), 100);
    }
  }, [messages.length, scrollToBottom]);

  return {
    containerRef,
    scrollToBottom,
    isNearBottom: () => isNearBottomRef.current
  };
};

export default useAutoScroll;
