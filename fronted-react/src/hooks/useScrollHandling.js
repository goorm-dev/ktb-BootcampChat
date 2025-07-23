import { useState, useRef, useCallback, useEffect } from 'react';

export const useScrollHandling = (socketRef, roomId, messages = []) => {
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [initialScrollDone, setInitialScrollDone] = useState(false);
  const [isLoadingPreviousMessages, setIsLoadingPreviousMessages] = useState(false);

  const messagesEndRef = useRef(null);
  const previousScrollHeightRef = useRef(0);
  const previousScrollTopRef = useRef(0);
  const scrollPositionRef = useRef(0);
  const isLoadingRef = useRef(false);
  const lastMessageCountRef = useRef(messages?.length || 0);
  const scrollTimeoutRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const scrollRestorationRef = useRef(null);
  const loadMoreTriggeredRef = useRef(false);

  const logDebug = useCallback((action, data) => {
    console.debug(`[ScrollHandling] ${action}:`, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }, []);

  const checkScrollPosition = useCallback(() => {
    if (!messagesEndRef.current) return { isAtBottom: true, isAtTop: false };

    const container = messagesEndRef.current;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    const isAtBottom = distanceFromBottom < 100;
    const isAtTop = scrollTop < 30;

    return { isAtBottom, isAtTop, scrollTop, scrollHeight, clientHeight };
  }, []);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    // 과거 메시지 로딩 중에는 스크롤 하단 이동 방지
    if (isLoadingPreviousMessages) {
      return;
    }

    if (!messagesEndRef.current) return;

    requestAnimationFrame(() => {
      try {
        const container = messagesEndRef.current;
        if (!container) return;

        const { scrollHeight, clientHeight } = container;
        const maxScrollTop = scrollHeight - clientHeight;

        container.scrollTo({
          top: maxScrollTop,
          behavior: behavior === 'auto' ? 'auto' : 'smooth'
        });

        logDebug('scrollToBottom', {
          scrollHeight,
          clientHeight,
          maxScrollTop,
          behavior,
          isLoadingPrevious: isLoadingPreviousMessages
        });
      } catch (error) {
        console.error('Scroll error:', error);
      }
    });
  }, [isLoadingPreviousMessages, logDebug]);

  const tryLoadMoreMessages = useCallback(async () => {  
    if (!hasMoreMessages || loadingMessages || isLoadingRef.current || loadMoreTriggeredRef.current) {
      logDebug('loadMore prevented', {
        hasMoreMessages,
        loadingMessages,
        isLoading: isLoadingRef.current,
        loadMoreTriggered: loadMoreTriggeredRef.current
      });
      return;
    }

    try {
      if (!socketRef?.current?.connected) {
        throw new Error('Socket not connected');
      }
      
      const container = messagesEndRef.current;
      if (!container) return;
      
      // 이전 메시지 로딩 상태 설정
      setIsLoadingPreviousMessages(true);
      isLoadingRef.current = true;
      loadMoreTriggeredRef.current = true;
      
      // 현재 스크롤 위치와 높이 저장
      previousScrollHeightRef.current = container.scrollHeight;
      previousScrollTopRef.current = container.scrollTop;
      scrollPositionRef.current = container.scrollTop;

      setLoadingMessages(true);

      const firstMessage = messages?.[0];
      if (!firstMessage) {
        setHasMoreMessages(false);
        isLoadingRef.current = false;
        loadMoreTriggeredRef.current = false;
        setLoadingMessages(false);
        setIsLoadingPreviousMessages(false);
        return;
      }

      // Socket.IO 이벤트 emit 및 응답 대기
      const responsePromise = new Promise((resolve, reject) => {
        socketRef.current.emit('fetchPreviousMessages', {
          roomId: roomId,
          before: firstMessage.timestamp
        });

        socketRef.current.once('previousMessagesLoaded', (data) => {
          resolve(data);
        });

        socketRef.current.once('error', (error) => {
          setIsLoadingPreviousMessages(false);
          reject(error);
        });

        // 타임아웃 설정
        setTimeout(() => {
          setIsLoadingPreviousMessages(false);
          reject(new Error('Timeout loading messages'));
        }, 10000);
      });

      await responsePromise;

    } catch (error) {
      console.error('Load more error:', error);
      setIsLoadingPreviousMessages(false);
      isLoadingRef.current = false;
      loadMoreTriggeredRef.current = false;
      setLoadingMessages(false);
    }
  }, [
    hasMoreMessages,
    loadingMessages,
    messages,
    socketRef,
    roomId,
    setLoadingMessages
  ]);

  const handleScroll = useCallback(() => {
    console.log('Scroll event triggered'); // 스크롤 이벤트 확인용 로그

    if (!messagesEndRef.current) {
      console.log('No messagesEndRef');
      return;
    }

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      console.log('Scroll timeout triggered'); // 타임아웃 실행 확인

      const container = messagesEndRef.current;
      if (!container) {
        console.log('No container in timeout');
        return;
      }

      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - (scrollTop + clientHeight) < 100;
      const isAtTop = scrollTop < 30;

      console.log('Scroll position:', { // 스크롤 위치 확인
        scrollTop,
        scrollHeight,
        clientHeight,
        isAtTop,
        isAtBottom
      });

      setIsNearBottom(isAtBottom);

      if (isAtTop) {
        console.log('Is at top, checking conditions:', { // 조건 확인
          hasMoreMessages,
          loadingMessages,
          isLoading: isLoadingRef.current,
          loadMoreTriggered: loadMoreTriggeredRef.current
        });

        if (hasMoreMessages && !loadingMessages && !isLoadingRef.current && !loadMoreTriggeredRef.current) {
          console.log('Calling tryLoadMoreMessages'); // 함수 호출 확인
          tryLoadMoreMessages();
        }
      }
    }, 150);
  }, [hasMoreMessages, loadingMessages, tryLoadMoreMessages, logDebug]);
  
  // Handle new messages
  useEffect(() => {
    const currentMessageCount = messages?.length || 0;
    if (currentMessageCount > lastMessageCountRef.current && !isLoadingPreviousMessages) {
      if (isNearBottom) {
        scrollToBottom();
      }
      lastMessageCountRef.current = currentMessageCount;
    }
  }, [messages, isNearBottom, scrollToBottom, isLoadingPreviousMessages]);

  // Initial scroll setup
  useEffect(() => {
    if (!initialScrollDone && messages?.length > 0 && !isLoadingPreviousMessages) {
      scrollToBottom('auto');
      setInitialScrollDone(true);
      logDebug('initialScroll');
    }
  }, [messages?.length, initialScrollDone, scrollToBottom, isLoadingPreviousMessages, logDebug]);

  // Restore scroll position after loading more messages
  useEffect(() => {
    if (!loadingMessages && previousScrollHeightRef.current > 0) {
      if (scrollRestorationRef.current) {
        cancelAnimationFrame(scrollRestorationRef.current);
      }

      scrollRestorationRef.current = requestAnimationFrame(() => {
        try {
          const container = messagesEndRef.current;
          if (!container) return;

          const newScrollHeight = container.scrollHeight;
          const heightDiff = newScrollHeight - previousScrollHeightRef.current;
          const newScrollTop = previousScrollTopRef.current + heightDiff;
          
          logDebug('scroll restoration', {
            previousHeight: previousScrollHeightRef.current,
            newHeight: newScrollHeight,
            heightDiff,
            previousScrollTop: previousScrollTopRef.current,
            newScrollTop,
            isLoadingPrevious: isLoadingPreviousMessages
          });

          // isLoadingPreviousMessages가 true일 때만 스크롤 위치 복원
          if (isLoadingPreviousMessages) {
            const originalScrollBehavior = container.style.scrollBehavior;
            container.style.scrollBehavior = 'auto';
            container.scrollTop = newScrollTop;
            requestAnimationFrame(() => {
              container.style.scrollBehavior = originalScrollBehavior;
            });
          }

          // 상태 초기화
          previousScrollHeightRef.current = 0;
          previousScrollTopRef.current = 0;
          scrollPositionRef.current = newScrollTop;
          isLoadingRef.current = false;
          loadMoreTriggeredRef.current = false;
          
          // 모든 작업이 완료된 후 isLoadingPreviousMessages 상태 변경
          setTimeout(() => {
            setIsLoadingPreviousMessages(false);
          }, 100);

        } catch (error) {
          console.error('Scroll restoration error:', error);
          isLoadingRef.current = false;
          loadMoreTriggeredRef.current = false;
          setIsLoadingPreviousMessages(false);
        }
      });
    }
  }, [loadingMessages, logDebug]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (scrollRestorationRef.current) {
        cancelAnimationFrame(scrollRestorationRef.current);
      }
      isLoadingRef.current = false;
      loadMoreTriggeredRef.current = false;
      setIsLoadingPreviousMessages(false);
    };
  }, []);

  return {
    isNearBottom,
    hasMoreMessages,
    loadingMessages,
    initialScrollDone,
    messagesEndRef,
    scrollToBottom,
    handleScroll,
    tryLoadMoreMessages,
    checkScrollPosition,
    setHasMoreMessages,
    setLoadingMessages,
    setInitialScrollDone,
    setIsNearBottom,
    isLoadingPreviousMessages
  };
};

export default useScrollHandling;