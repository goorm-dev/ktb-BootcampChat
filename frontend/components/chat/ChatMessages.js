// Enhanced ChatMessages.js with fixed scrolling and better detective mode support
import React, { useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { Text } from '@vapor-ui/core';
import { SystemMessage, FileMessage, UserMessage, AIMessage } from './Message';
import { DetectiveSystemMessage, DetectiveSteveMessage, DetectiveUserMessage } from './DetectiveMessage';

// Enhanced ScrollHandler class with better scroll management
class ScrollHandler {
  constructor(containerRef) {
    this.containerRef = containerRef;
    this.scrollHeightBeforeLoadRef = { current: 0 };
    this.scrollTopBeforeLoadRef = { current: 0 };
    this.isLoadingOldMessages = { current: false };
    this.isRestoringScroll = { current: false };
    this.isNearBottom = { current: true };
    this.scrollTimeoutRef = { current: null };
    this.scrollRestorationRef = { current: null };
    this.temporaryDisableScroll = { current: false };
    this.isLoadingRef = { current: false };
    this.loadMoreTriggeredRef = { current: false };
    this.lastScrollHeight = { current: 0 };
    this.lastScrollTop = { current: 0 };
    this.scrollLocked = { current: false };

    // Constants
    this.SCROLL_THRESHOLD = 30;
    this.SCROLL_DEBOUNCE_DELAY = 100;
    this.BOTTOM_THRESHOLD = 100;
  }

  logDebug(action, data) {
    console.debug(`[ScrollHandler] ${action}:`, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  // Improved scroll position detection
  updateScrollPosition() {
    const container = this.containerRef.current;
    if (!container) return null;

    const { scrollTop, scrollHeight, clientHeight } = container;

    // Update last known values
    this.lastScrollHeight.current = scrollHeight;
    this.lastScrollTop.current = scrollTop;

    // Calculate if near bottom with improved threshold
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    this.isNearBottom.current = distanceFromBottom < this.BOTTOM_THRESHOLD;

    const scrollInfo = {
      isAtTop: scrollTop < this.SCROLL_THRESHOLD,
      isAtBottom: this.isNearBottom.current,
      scrollTop,
      scrollHeight,
      clientHeight,
      distanceFromBottom
    };

    this.logDebug('updateScrollPosition', scrollInfo);
    return scrollInfo;
  }

  // Enhanced save scroll position
  saveScrollPosition() {
    const container = this.containerRef.current;
    if (!container) return;

    this.logDebug('saveScrollPosition', {
      scrollHeight: container.scrollHeight,
      scrollTop: container.scrollTop
    });

    this.scrollHeightBeforeLoadRef.current = container.scrollHeight;
    this.scrollTopBeforeLoadRef.current = container.scrollTop;
    this.isLoadingOldMessages.current = true;
  }

  // Improved loading state management
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
    this.scrollLocked.current = true;
    return true;
  }

  // Enhanced scroll position restoration
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

        // Use multiple frames to ensure scroll position is set
        requestAnimationFrame(() => {
          container.scrollTop = newScrollTop;
          requestAnimationFrame(() => {
            container.style.scrollBehavior = originalScrollBehavior;
            this.temporaryDisableScroll.current = false;
            this.isRestoringScroll.current = false;
            this.scrollLocked.current = false;
          });
        });
      } else {
        container.scrollTo({
          top: newScrollTop,
          behavior: 'smooth'
        });

        setTimeout(() => {
          this.temporaryDisableScroll.current = false;
          this.isRestoringScroll.current = false;
          this.scrollLocked.current = false;
        }, 500);
      }
    } finally {
      this.resetScrollState();
    }
  }

  // Reset scroll state
  resetScrollState() {
    this.scrollHeightBeforeLoadRef.current = 0;
    this.scrollTopBeforeLoadRef.current = 0;
    this.isLoadingOldMessages.current = false;
    this.isLoadingRef.current = false;
    this.loadMoreTriggeredRef.current = false;

    setTimeout(() => {
      this.isRestoringScroll.current = false;
      this.temporaryDisableScroll.current = false;
      this.scrollLocked.current = false;
    }, 100);
  }

  // Enhanced scroll to bottom
  scrollToBottom(behavior = 'smooth', force = false) {
    if (!force && (this.isLoadingOldMessages.current || this.isRestoringScroll.current || this.scrollLocked.current)) {
      return;
    }

    const container = this.containerRef.current;
    if (!container) return;

    // Use multiple animation frames for better reliability
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          const scrollHeight = container.scrollHeight;
          const height = container.clientHeight;
          const maxScrollTop = scrollHeight - height;

          if (behavior === 'auto') {
            container.style.scrollBehavior = 'auto';
            container.scrollTop = maxScrollTop;
            requestAnimationFrame(() => {
              container.style.scrollBehavior = '';
            });
          } else {
            container.scrollTo({
              top: maxScrollTop,
              behavior
            });
          }

          this.logDebug('scrollToBottom', {
            scrollHeight,
            height,
            maxScrollTop,
            behavior,
            force
          });
        } catch (error) {
          console.error('Scroll to bottom error:', error);
          container.scrollTop = container.scrollHeight;
        }
      });
    });
  }

  // Determine if should scroll to bottom for new message
  shouldScrollToBottom(newMessage, isMine) {
    if (this.isLoadingOldMessages.current || this.isRestoringScroll.current || this.scrollLocked.current) {
      return false;
    }

    // Always scroll for own messages
    if (isMine) return true;

    // Scroll if near bottom
    return this.isNearBottom.current;
  }

  // Enhanced scroll handling with better debouncing
  async handleScroll(event, options) {
    const {
      hasMoreMessages,
      loadingMessages,
      onLoadMore,
      onScrollPositionChange,
      onScroll
    } = options;

    if (this.temporaryDisableScroll.current || this.isRestoringScroll.current || this.scrollLocked.current) {
      this.logDebug('handleScroll skipped', {
        temporaryDisableScroll: this.temporaryDisableScroll.current,
        isRestoringScroll: this.isRestoringScroll.current,
        scrollLocked: this.scrollLocked.current
      });
      return;
    }

    const scrollInfo = this.updateScrollPosition();
    if (!scrollInfo) return;

    if (this.scrollTimeoutRef.current) {
      clearTimeout(this.scrollTimeoutRef.current);
    }

    this.scrollTimeoutRef.current = setTimeout(async () => {
      if (scrollInfo.isAtTop && hasMoreMessages && !loadingMessages && !this.isLoadingRef.current) {
        this.logDebug('handleScroll loadMore', {
          isAtTop: scrollInfo.isAtTop,
          hasMoreMessages,
          loadingMessages,
          isLoading: this.isLoadingRef.current
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

  // Cleanup
  cleanup() {
    if (this.scrollTimeoutRef.current) {
      clearTimeout(this.scrollTimeoutRef.current);
    }
    if (this.scrollRestorationRef.current) {
      cancelAnimationFrame(this.scrollRestorationRef.current);
    }
  }
}

// Loading indicator component
const LoadingIndicator = React.memo(({ text }) => (
  <div className="loading-messages" style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    gap: '8px'
  }}>
    <div className="spinner-border spinner-border-sm text-primary" role="status">
      <span className="visually-hidden">Loading...</span>
    </div>
    <span className="text-secondary text-sm">{text}</span>
  </div>
));
LoadingIndicator.displayName = 'LoadingIndicator';

// Message history end indicator
const MessageHistoryEnd = React.memo(() => (
  <div className="message-history-end" style={{
    textAlign: 'center',
    padding: '16px',
    color: '#6b7280',
    fontSize: '13px'
  }}>
    <span>더 이상 불러올 메시지가 없습니다.</span>
  </div>
));
MessageHistoryEnd.displayName = 'MessageHistoryEnd';

// Empty messages placeholder
const EmptyMessages = React.memo(() => (
  <div className="empty-messages" style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    textAlign: 'center'
  }}>
    <Text typography="body1" style={{ marginBottom: '8px' }}>
      아직 메시지가 없습니다.
    </Text>
    <Text typography="body2" color="neutral-weak">
      첫 메시지를 보내보세요!
    </Text>
  </div>
));
EmptyMessages.displayName = 'EmptyMessages';

// Main ChatMessages component
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
  const lastDetectiveModeRef = useRef(detectiveMode);

  const logDebug = useCallback((action, data) => {
    console.debug(`[ChatMessages] ${action}:`, {
      ...data,
      loadingMessages,
      hasMoreMessages,
      isLoadingOldMessages: scrollHandler.current.isLoadingOldMessages.current,
      messageCount: messages.length,
      timestamp: new Date().toISOString(),
      isInitialLoad: initialLoadRef.current,
      detectiveMode
    });
  }, [loadingMessages, hasMoreMessages, messages.length, detectiveMode]);

  // Check if message is mine
  const isMine = useCallback((msg) => {
    if (!msg?.sender || !currentUser?.id) return false;
    return (
      msg.sender._id === currentUser.id ||
      msg.sender.id === currentUser.id ||
      msg.sender === currentUser.id
    );
  }, [currentUser?.id]);

  // Handle scroll events
  const handleScroll = useCallback((event) => {
    scrollHandler.current.handleScroll(event, {
      hasMoreMessages,
      loadingMessages,
      onLoadMore,
      onScrollPositionChange,
      onScroll
    });
  }, [hasMoreMessages, loadingMessages, onLoadMore, onScrollPositionChange, onScroll]);

  // Handle detective mode changes
  useEffect(() => {
    if (detectiveMode !== lastDetectiveModeRef.current) {
      lastDetectiveModeRef.current = detectiveMode;

      // Scroll to bottom when entering/exiting detective mode
      setTimeout(() => {
        scrollHandler.current.scrollToBottom('smooth', true);
      }, 100);
    }
  }, [detectiveMode]);

  // Handle new messages
  useLayoutEffect(() => {
    const newMessageCount = messages.length;
    const hadNewMessages = newMessageCount > lastMessageCountRef.current;

    if (hadNewMessages) {
      const newMessages = messages.slice(lastMessageCountRef.current);
      const lastMessage = newMessages[newMessages.length - 1];

      const shouldScroll = scrollToBottomOnNewMessage &&
        scrollHandler.current.shouldScrollToBottom(lastMessage, isMine(lastMessage));

      logDebug('new messages received', {
        newCount: newMessages.length,
        shouldScroll,
        lastMessageType: lastMessage?.type,
        isMine: isMine(lastMessage)
      });

      if (shouldScroll) {
        // Use a slight delay to ensure DOM is updated
        setTimeout(() => {
          scrollHandler.current.scrollToBottom('smooth');
        }, 50);
      }

      lastMessageCountRef.current = newMessageCount;
    }
  }, [messages, scrollToBottomOnNewMessage, isMine, logDebug]);

  // Handle message loading completion
  useLayoutEffect(() => {
    if (!loadingMessages && scrollHandler.current.isLoadingOldMessages.current) {
      if (scrollHandler.current.scrollRestorationRef.current) {
        cancelAnimationFrame(scrollHandler.current.scrollRestorationRef.current);
      }

      // Use multiple animation frames for better reliability
      scrollHandler.current.scrollRestorationRef.current = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollHandler.current.restoreScrollPosition(true);
        });
      });
    }
  }, [loadingMessages]);

  // Handle streaming messages
  useEffect(() => {
    const streamingMessagesArray = Object.values(streamingMessages);
    if (streamingMessagesArray.length > 0) {
      const lastMessage = streamingMessagesArray[streamingMessagesArray.length - 1];

      if (lastMessage && scrollHandler.current.shouldScrollToBottom(lastMessage, isMine(lastMessage))) {
        scrollHandler.current.scrollToBottom('smooth');
      }
    }
  }, [streamingMessages, isMine]);

  // Initial scroll setup
  useLayoutEffect(() => {
    if (!initialScrollRef.current && messages.length > 0) {
      // Use a small delay to ensure all messages are rendered
      setTimeout(() => {
        scrollHandler.current.scrollToBottom('auto', true);
        initialScrollRef.current = true;
      }, 100);

      if (initialLoadRef.current) {
        setTimeout(() => {
          initialLoadRef.current = false;
        }, 1000);
      }
    }
  }, [messages.length]);

  // Set up scroll event listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Use passive listener for better performance
    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      scrollHandler.current.cleanup();
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  // Combine and sort all messages
  const allMessages = useMemo(() => {
    if (!Array.isArray(messages)) return [];

    const streamingArray = Object.values(streamingMessages || {});
    const combinedMessages = [...messages, ...streamingArray];

    return combinedMessages.sort((a, b) => {
      if (!a?.timestamp || !b?.timestamp) return 0;
      return new Date(a.timestamp) - new Date(b.timestamp);
    });
  }, [messages, streamingMessages]);

  // Render individual message
  const renderMessage = useCallback((msg, idx) => {
    if (!msg) {
      console.error('Message is null or undefined at index:', idx);
      return null;
    }

    const isLast = idx === allMessages.length - 1;
    const commonProps = {
      currentUser,
      room,
      onReactionAdd,
      onReactionRemove,
      socketRef
    };

    // Handle detective game messages
    if (detectiveMode || msg.gameType === 'detective') {
      if (msg.type === 'system') {
        return (
          <DetectiveSystemMessage
            key={msg._id || `msg-${idx}`}
            ref={isLast ? lastMessageRef : null}
            msg={msg}
            {...commonProps}
          />
        );
      } else if (msg.type === 'ai' && (msg.aiType === 'smokinggun' || msg.character === 'smokinggun')) {
        return (
          <DetectiveSteveMessage
            key={msg._id || `msg-${idx}`}
            ref={isLast ? lastMessageRef : null}
            msg={msg}
            {...commonProps}
          />
        );
      } else if (msg.sender && detectiveMode) {
        return (
          <DetectiveUserMessage
            key={msg._id || `msg-${idx}`}
            ref={isLast ? lastMessageRef : null}
            msg={msg}
            {...commonProps}
          />
        );
      }
    }

    // Handle regular messages
    const MessageComponent = {
      system: SystemMessage,
      file: FileMessage,
      ai: AIMessage
    }[msg.type] || UserMessage;

    if (!MessageComponent) {
      console.error('No message component found for type:', msg.type);
      return null;
    }

    return (
      <MessageComponent
        key={msg._id || `msg-${idx}`}
        ref={isLast ? lastMessageRef : null}
        {...commonProps}
        msg={msg}
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
      style={{
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '8px',
        scrollBehavior: 'smooth',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}
    >
      {/* Loading indicator at top */}
      {loadingMessages && <LoadingIndicator text="이전 메시지를 불러오는 중..." />}

      {/* History end indicator */}
      {!loadingMessages && !hasMoreMessages && messages.length > 0 && (
        <MessageHistoryEnd />
      )}

      {/* Messages or empty state */}
      {allMessages.length === 0 ? (
        <EmptyMessages />
      ) : (
        <div className="messages-container" style={{
          width: '100%',
          maxWidth: '800px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          {allMessages.map((msg, idx) => renderMessage(msg, idx))}
        </div>
      )}

      {/* Scroll anchor */}
      <div ref={messagesEndRef} style={{ height: '1px' }} />
    </div>
  );
};

ChatMessages.displayName = 'ChatMessages';

export default React.memo(ChatMessages);