import React, { useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { Text } from '@vapor-ui/core';
import { SystemMessage, FileMessage, UserMessage, AIMessage } from './Message';
import { DetectiveSystemMessage, DetectiveSteveMessage, DetectiveUserMessage } from './DetectiveMessage';

// ScrollHandler 클래스 정의
class ScrollHandler {
  constructor(containerRef) {
    // Refs
    this.containerRef = containerRef;
    this.scrollHeightBeforeLoadRef = { current: 0 };
    this.scrollTopBeforeLoadRef = { current: 0 };
    this.isLoadingOldMessages = { current: false };
    this.isRestoringScroll = { current: false };
    this.isNearBottom = { current: true };
    this.scrollTimeoutRef = { current: null };
    this.scrollRestorationRef = { current: null };
    this.temporaryDisableScroll = { current: false };
    this.scrollBehavior = { current: 'smooth' };
    this.isLoadingRef = { current: false };
    this.loadMoreTriggeredRef = { current: false };

    // Constants
    this.SCROLL_THRESHOLD = 30;
    this.SCROLL_DEBOUNCE_DELAY = 100;
  }

  logDebug(action, data) {
    console.debug(`[ScrollHandler] ${action}:`, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  saveScrollPosition() {
    const container = this.containerRef.current;
    if (!container) return;
    
    this.logDebug('saveScrollPosition', {
      scrollHeight: container.scrollHeight,
      scrollTop: container.scrollTop
    });
    
    // 이전 스크롤 위치와 높이 저장
    this.scrollHeightBeforeLoadRef.current = container.scrollHeight;
    this.scrollTopBeforeLoadRef.current = container.scrollTop;
    this.isLoadingOldMessages.current = true;
  }

  async startLoadingMessages() {
    if (this.isLoadingRef.current || this.loadMoreTriggeredRef.current) {
      this.logDebug('startLoadingMessages prevented', {
        isLoading: this.isLoadingRef.current,
        loadMoreTriggered: this.loadMoreTriggeredRef.current
      });
      return false;
    }

    this.saveScrollPosition();
    this.isLoadingRef.current = true;
    this.loadMoreTriggeredRef.current = true;
    return true;
  }

  restoreScrollPosition(immediate = true) {
    const container = this.containerRef.current;
    if (!container || !this.isLoadingOldMessages.current) return;

    try {
      this.isRestoringScroll.current = true;
      this.temporaryDisableScroll.current = true;

      const newScrollHeight = container.scrollHeight;
      const heightDifference = newScrollHeight - this.scrollHeightBeforeLoadRef.current;
      const newScrollTop = this.scrollTopBeforeLoadRef.current + heightDifference;

      this.logDebug('restoreScrollPosition', {
        newScrollHeight,
        heightDifference,
        newScrollTop,
        immediate
      });

      if (immediate) {
        const originalScrollBehavior = container.style.scrollBehavior;
        container.style.scrollBehavior = 'auto';
        container.scrollTop = newScrollTop;
        
        requestAnimationFrame(() => {
          container.style.scrollBehavior = originalScrollBehavior;
          this.temporaryDisableScroll.current = false;
          this.isRestoringScroll.current = false;
        });
      } else {
        container.scrollTo({
          top: newScrollTop,
          behavior: 'smooth'
        });
        this.temporaryDisableScroll.current = false;
        this.isRestoringScroll.current = false;
      }
    } finally {
      this.resetScrollState();
    }
  }

  resetScrollState() {
    this.scrollHeightBeforeLoadRef.current = 0;
    this.scrollTopBeforeLoadRef.current = 0;
    this.isLoadingOldMessages.current = false;
    this.isLoadingRef.current = false;
    this.loadMoreTriggeredRef.current = false;

    setTimeout(() => {
      this.isRestoringScroll.current = false;
      this.temporaryDisableScroll.current = false;
    }, 100);
  }

  shouldScrollToBottom(newMessage, isMine) {
    if (this.isLoadingOldMessages.current || this.isRestoringScroll.current) {
      return false;
    }
    return isMine || this.isNearBottom.current;
  }

  updateScrollPosition() {
    const container = this.containerRef.current;
    if (!container) return null;

    const { scrollTop, scrollHeight, clientHeight } = container;
    this.isNearBottom.current = (scrollHeight - scrollTop - clientHeight) < 100;

    const scrollInfo = {
      isAtTop: scrollTop < this.SCROLL_THRESHOLD,
      isAtBottom: this.isNearBottom.current,
      scrollTop,
      scrollHeight,
      clientHeight
    };

    this.logDebug('updateScrollPosition', scrollInfo);
    return scrollInfo;
  }

  async handleScroll(event, options) {
    const {
      hasMoreMessages,
      loadingMessages,
      onLoadMore,
      onScrollPositionChange,
      onScroll
    } = options;

    if (this.temporaryDisableScroll.current || this.isRestoringScroll.current) {
      this.logDebug('handleScroll skipped', {
        temporaryDisableScroll: this.temporaryDisableScroll.current,
        isRestoringScroll: this.isRestoringScroll.current
      });
      return;
    }

    const scrollInfo = this.updateScrollPosition();
    if (!scrollInfo) return;

    if (this.scrollTimeoutRef.current) {
      clearTimeout(this.scrollTimeoutRef.current);
    }

    this.scrollTimeoutRef.current = setTimeout(async () => {
      if (scrollInfo.isAtTop && hasMoreMessages && !loadingMessages) {
        this.logDebug('handleScroll loadMore', {
          isAtTop: scrollInfo.isAtTop,
          hasMoreMessages,
          loadingMessages
        });

        if (await this.startLoadingMessages()) {
          try {
            await onLoadMore();
          } catch (error) {
            console.error('Load more error:', error);
            this.resetScrollState();
          }
        }
      }

      onScrollPositionChange?.(scrollInfo);
      onScroll?.(scrollInfo);
    }, this.SCROLL_DEBOUNCE_DELAY);
  }

  scrollToBottom(behavior = 'smooth') {
    if (this.isLoadingOldMessages.current || this.isRestoringScroll.current) {
      return;
    }

    const container = this.containerRef.current;
    if (!container) return;

    requestAnimationFrame(() => {
      try {
        const scrollHeight = container.scrollHeight;
        const height = container.clientHeight;
        const maxScrollTop = scrollHeight - height;

        container.scrollTo({
          top: maxScrollTop,
          behavior
        });

        this.logDebug('scrollToBottom', {
          scrollHeight,
          height,
          maxScrollTop,
          behavior
        });
      } catch (error) {
        console.error('Scroll to bottom error:', error);
        container.scrollTop = container.scrollHeight;
      }
    });
  }

  cleanup() {
    if (this.scrollTimeoutRef.current) {
      clearTimeout(this.scrollTimeoutRef.current);
    }
    if (this.scrollRestorationRef.current) {
      cancelAnimationFrame(this.scrollRestorationRef.current);
    }
  }
}

const LoadingIndicator = React.memo(({ text }) => (
  <div className="loading-messages">
    <div className="spinner-border spinner-border-sm text-primary" role="status">
      <span className="visually-hidden">Loading...</span>
    </div>
    <span className="text-secondary text-sm">{text}</span>
  </div>
));
LoadingIndicator.displayName = 'LoadingIndicator';

const MessageHistoryEnd = React.memo(() => (
  <div className="message-history-end">
    <span className="text-secondary text-sm">더 이상 불러올 메시지가 없습니다.</span>
  </div>
));
MessageHistoryEnd.displayName = 'MessageHistoryEnd';

const EmptyMessages = React.memo(() => (
  <div className="empty-messages">
    <Text typography="body1">아직 메시지가 없습니다.</Text>
    <Text typography="body2" color="neutral-weak">첫 메시지를 보내보세요!</Text>
  </div>
));
EmptyMessages.displayName = 'EmptyMessages';

const ChatMessages = ({ 
  messages = [], 
  streamingMessages = {}, 
  currentUser = null,
  room = null,
  loadingMessages = false,
  hasMoreMessages = true,
  onScroll = () => {},
  onLoadMore = () => {},
  onReactionAdd = () => {},
  onReactionRemove = () => {},
  messagesEndRef,
  socketRef,
  scrollToBottomOnNewMessage = true,
  onScrollPositionChange = () => {},
  detectiveMode = false
}) => {
  const containerRef = useRef(null);
  const lastMessageRef = useRef(null);
  const initialScrollRef = useRef(false);
  const lastMessageCountRef = useRef(messages.length);
  const initialLoadRef = useRef(true);
  const loadingTimeoutRef = useRef(null);
  const scrollHandler = useRef(new ScrollHandler(containerRef));

  const logDebug = useCallback((action, data) => {
    console.debug(`[ChatMessages] ${action}:`, {
      ...data,
      loadingMessages,
      hasMoreMessages,
      isLoadingOldMessages: scrollHandler.current.isLoadingOldMessages.current,
      messageCount: messages.length,
      timestamp: new Date().toISOString(),
      isInitialLoad: initialLoadRef.current
    });
  }, [loadingMessages, hasMoreMessages, messages.length]);

  const isMine = useCallback((msg) => {
    if (!msg?.sender || !currentUser?.id) return false;
    return (
      msg.sender._id === currentUser.id || 
      msg.sender.id === currentUser.id ||
      msg.sender === currentUser.id
    );
  }, [currentUser?.id]);

  const handleScroll = useCallback((event) => {
    scrollHandler.current.handleScroll(event, {
      hasMoreMessages,
      loadingMessages,
      onLoadMore,
      onScrollPositionChange,
      onScroll
    });
  }, [hasMoreMessages, loadingMessages, onLoadMore, onScrollPositionChange, onScroll]);

  // 새 메시지 도착 시 스크롤 처리
  useLayoutEffect(() => {
    if (messages.length > lastMessageCountRef.current) {
      const newMessages = messages.slice(lastMessageCountRef.current);
      const lastMessage = newMessages[newMessages.length - 1];
      
      const shouldScroll = scrollToBottomOnNewMessage && 
        scrollHandler.current.shouldScrollToBottom(lastMessage, isMine(lastMessage));

      if (shouldScroll) {
        scrollHandler.current.scrollToBottom('smooth');
      }

      lastMessageCountRef.current = messages.length;
    }
  }, [messages, scrollToBottomOnNewMessage, isMine]);

  // 과거 메시지 로드 후 스크롤 위치 복원
  useLayoutEffect(() => {
    if (!loadingMessages && scrollHandler.current.isLoadingOldMessages.current) {
      if (scrollHandler.current.scrollRestorationRef.current) {
        cancelAnimationFrame(scrollHandler.current.scrollRestorationRef.current);
      }

      scrollHandler.current.scrollRestorationRef.current = requestAnimationFrame(() => {
        scrollHandler.current.restoreScrollPosition(true);
      });
    }
  }, [loadingMessages]);

  // 스트리밍 메시지 처리
  useEffect(() => {
    const streamingMessagesArray = Object.values(streamingMessages);
    if (streamingMessagesArray.length > 0) {
      const lastMessage = streamingMessagesArray[streamingMessagesArray.length - 1];
      
      if (lastMessage && scrollHandler.current.shouldScrollToBottom(lastMessage, isMine(lastMessage))) {
        scrollHandler.current.scrollToBottom('smooth');
      }
    }
  }, [streamingMessages, isMine]);

  // 초기 스크롤 설정
  useLayoutEffect(() => {
    if (!initialScrollRef.current && messages.length > 0) {
      scrollHandler.current.scrollToBottom('auto');
      initialScrollRef.current = true;
      
      if (initialLoadRef.current) {
        setTimeout(() => {
          initialLoadRef.current = false;
        }, 1000);
      }
    }
  }, [messages.length]);

  // 스크롤 이벤트 리스너 설정
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      scrollHandler.current.cleanup();
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  const allMessages = useMemo(() => {
    if (!Array.isArray(messages)) return [];
    
    const streamingArray = Object.values(streamingMessages || {});
    const combinedMessages = [...messages, ...streamingArray];

    return combinedMessages.sort((a, b) => {
      if (!a?.timestamp || !b?.timestamp) return 0;
      return new Date(a.timestamp) - new Date(b.timestamp);
    });
  }, [messages, streamingMessages]);

  const renderMessage = useCallback((msg, idx) => {
    if (!msg) return null;

    const isLast = idx === allMessages.length - 1;
    const commonProps = {
      key: msg._id || `msg-${idx}`,
      ref: isLast ? lastMessageRef : null,
      msg: msg,
      currentUser,
      room,
      onReactionAdd,
      onReactionRemove,
      socketRef,
    };

    if (detectiveMode && msg.type === 'detective') {
        switch (msg.subType) {
            case 'game_start':
            case 'investigation_areas':
            case 'evidence_found':
            case 'info':
                return <DetectiveSystemMessage {...commonProps} />;
            case 'steve_response':
                return <DetectiveSteveMessage {...commonProps} />;
            case 'user_interrogation':
                return <DetectiveUserMessage {...commonProps} />;
            default:
                return <DetectiveSystemMessage {...commonProps} />;
        }
    }

    const MessageComponent = {
      system: SystemMessage,
      file: FileMessage,
      ai: AIMessage,
    }[msg.type] || UserMessage;

    if (!MessageComponent) {
        return null;
    }

    return (
      <MessageComponent
        {...commonProps}
        content={msg.content}
        isMine={msg.type !== 'system' ? isMine(msg) : undefined}
        isStreaming={msg.type === 'ai' ? (msg.isStreaming || false) : undefined}
        messageRef={msg}
      />
    );
  }, [allMessages.length, currentUser, room, isMine, onReactionAdd, onReactionRemove, socketRef, detectiveMode]);

  return (
    <div 
      className="message-list" 
      ref={containerRef}
      role="log"
      aria-live="polite"
      aria-atomic="false"
    >
      {loadingMessages && <LoadingIndicator text="이전 메시지를 불러오는 중..." />}

      {!loadingMessages && !hasMoreMessages && messages.length > 0 && (
        <MessageHistoryEnd />
      )}

      {allMessages.length === 0 ? (
        <EmptyMessages />
      ) : (
        allMessages.map((msg, idx) => renderMessage(msg, idx))
      )}
    </div>
  );
};

ChatMessages.displayName = 'ChatMessages';

export default React.memo(ChatMessages);
