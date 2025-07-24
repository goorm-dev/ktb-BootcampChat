import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import authService from '../services/authService';
import socketService from '../services/socket';
import { useFileHandling } from './useFileHandling';
import { useMessageHandling } from './useMessageHandling';
import { useReactionHandling } from './useReactionHandling';
import { useAIMessageHandling } from './useAIMessageHandling';
import { useScrollHandling } from './useScrollHandling';
import { useSocketHandling } from './useSocketHandling';
import { useRoomHandling } from './useRoomHandling';
import { Toast } from '../components/Toast';
import { useNavigate, useLocation } from 'react-router-dom';

const CLEANUP_REASONS = {
  DISCONNECT: 'disconnect',
  MANUAL: 'manual',
  RECONNECT: 'reconnect',
  UNMOUNT: 'unmount',
  ERROR: 'error'
};

export const useChatRoom = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const roomId = query.get('room');
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [messageLoadError, setMessageLoadError] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Refs
  const messageInputRef = useRef(null);
  const messageLoadAttemptRef = useRef(0);
  const mountedRef = useRef(true);
  const initializingRef = useRef(false);
  const setupCompleteRef = useRef(false);
  const socketInitializedRef = useRef(false);
  const cleanupInProgressRef = useRef(false);
  const cleanupCountRef = useRef(0);
  const userRooms = useRef(new Map());
  const previousMessagesRef = useRef(new Set());
  const messageProcessingRef = useRef(false);
  const initialLoadCompletedRef = useRef(false);
  const scrollPositionRef = useRef(0);
  const processedMessageIds = useRef(new Set());
  const loadMoreTimeoutRef = useRef(null);
  const previousScrollHeightRef = useRef(0);
  const isLoadingRef = useRef(false);
  const loadMoreTriggeredRef = useRef(false);

  // Socket handling setup
  const {
    connected,
    socketRef,
    handleConnectionError,
    handleReconnect,
    setConnected
  } = useSocketHandling(roomId);

  // Scroll handling hook
  const {
    isNearBottom,
    hasMoreMessages,
    loadingMessages,
    messagesEndRef,
    scrollToBottom,
    handleScroll,
    setHasMoreMessages,
    setLoadingMessages
  } = useScrollHandling(socketRef, roomId, messages);  
  
  // AI Message handling hook
  const {
    streamingMessages,
    setStreamingMessages,
    handleAIMessageStart,
    handleAIMessageChunk,
    handleAIMessageComplete,
    handleAIMessageError,
    setupAIMessageListeners
  } = useAIMessageHandling(
    socketRef,
    setMessages,
    isNearBottom,
    scrollToBottom
  );

  // Message handling hook
  const {
    message,
    showEmojiPicker,
    showMentionList,
    mentionFilter,
    mentionIndex,
    filePreview,
    uploading,
    uploadProgress,
    uploadError,
    setMessage,
    setShowEmojiPicker,
    setShowMentionList,
    setMentionFilter,
    setMentionIndex,
    setFilePreview,
    handleMessageChange,
    handleMessageSubmit,
    handleLoadMore,
    handleEmojiToggle,
    getFilteredParticipants,
    insertMention,
    removeFilePreview
  } = useMessageHandling(socketRef, currentUser, roomId);

  // Cleanup 함수 수정
  const cleanup = useCallback((reason = 'MANUAL') => {
    if (!mountedRef.current || !roomId) return;

    try {
      // cleanup이 이미 진행 중인지 확인
      if (cleanupInProgressRef.current) {
        console.log('[Chat] Cleanup already in progress, skipping...');
        return;
      }

      cleanupInProgressRef.current = true;
      console.log(`[Chat] Starting cleanup (reason: ${reason})`);

      // Socket cleanup
      if (reason !== 'UNMOUNT' && roomId && socketRef.current?.connected) {
        console.log('[Chat] Emitting leaveRoom event');
        socketRef.current.emit('leaveRoom', roomId);
      }

      if (socketRef.current && reason !== 'RECONNECT') {
        console.log('[Chat] Cleaning up socket listeners...');
        socketRef.current.off('message');
        socketRef.current.off('previousMessages');
        socketRef.current.off('previousMessagesLoaded');
        socketRef.current.off('participantsUpdate');
        socketRef.current.off('aiMessageStart');
        socketRef.current.off('aiMessageChunk');
        socketRef.current.off('aiMessageComplete');
        socketRef.current.off('aiMessageError');
        socketRef.current.off('messageReactionUpdate');
        socketRef.current.off('session_ended');
        socketRef.current.off('error');
      }

      // Clear timeouts
      if (loadMoreTimeoutRef.current) {
        clearTimeout(loadMoreTimeoutRef.current);
        loadMoreTimeoutRef.current = null;
      }

      // Reset refs
      processedMessageIds.current.clear();
      previousMessagesRef.current.clear();
      messageProcessingRef.current = false;

      // Reset states only if needed
      if (reason === 'MANUAL' && mountedRef.current) {
        setStreamingMessages({});
        setError(null);
        setLoading(false);
        setLoadingMessages(false);
        setMessages([]);
        
        if (userRooms.current.size > 0) {
          userRooms.current.clear();
        }
      } else if (reason === 'DISCONNECT' && mountedRef.current) {
        setError('채팅 연결이 끊어졌습니다. 재연결을 시도합니다.');
      }

      console.log(`[Chat] Cleanup completed (reason: ${reason})`);

    } catch (error) {
      console.error('[Chat] Cleanup error:', error);
      if (mountedRef.current) {
        setError('채팅방 정리 중 오류가 발생했습니다.');
      }
    } finally {
      cleanupInProgressRef.current = false;
    }
  }, [
    setMessages, 
    setStreamingMessages, 
    setError, 
    setLoading, 
    setLoadingMessages, 
    mountedRef,
    socketRef,
    roomId
  ]);
  
  // Connection state utility
  const getConnectionState = useCallback(() => {
    if (!socketRef.current) return 'disconnected';
    if (loading) return 'connecting';
    if (error) return 'error';
    return socketRef.current.connected ? 'connected' : 'disconnected';
  }, [loading, error, socketRef]);

  // Reaction handling hook
  const {
    handleReactionAdd,
    handleReactionRemove,
    handleReactionUpdate
  } = useReactionHandling(socketRef, currentUser, messages, setMessages);

  // 메시지 처리 유틸리티 함수
  const processMessages = useCallback((loadedMessages, hasMore, isInitialLoad = false) => {
    try {
      if (!Array.isArray(loadedMessages)) {
        throw new Error('Invalid messages format');
      }

      setMessages(prev => {
        // 중복 메시지 필터링 개선
        const newMessages = loadedMessages.filter(msg => {
          if (!msg._id) return false;
          if (processedMessageIds.current.has(msg._id)) return false;
          processedMessageIds.current.add(msg._id);
          return true;
        });

        // 기존 메시지와 새 메시지 결합 및 정렬
        const allMessages = [...prev, ...newMessages].sort((a, b) => {
          return new Date(a.timestamp || 0) - new Date(b.timestamp || 0);
        });

        // 중복 제거 (가장 최근 메시지 유지)
        const messageMap = new Map();
        allMessages.forEach(msg => messageMap.set(msg._id, msg));
        return Array.from(messageMap.values());
      });

      // 메시지 로드 상태 업데이트
      if (isInitialLoad) {
        setHasMoreMessages(hasMore);
        initialLoadCompletedRef.current = true;
        if (isNearBottom) {
          requestAnimationFrame(() => scrollToBottom('auto'));
        }
      } else {
        setHasMoreMessages(hasMore);
      }

    } catch (error) {
      console.error('Message processing error:', error);
      throw error;
    }
  }, [setMessages, setHasMoreMessages, isNearBottom, scrollToBottom]);

  // 이전 메시지 로드 함수
  const loadPreviousMessages = useCallback(async () => {
    if (!socketRef.current?.connected || loadingMessages) {
      console.warn('Cannot load messages: Socket not connected or already loading');
      return;
    }

    try {
      setLoadingMessages(true);
      const firstMessageTimestamp = messages[0]?.timestamp;

      if (loadMoreTimeoutRef.current) {
        clearTimeout(loadMoreTimeoutRef.current);
      }

      const responsePromise = new Promise((resolve, reject) => {
        socketRef.current.emit('fetchPreviousMessages', {
          roomId: roomId,
          before: firstMessageTimestamp
        });

        socketRef.current.once('previousMessagesLoaded', resolve);
        socketRef.current.once('error', reject);
      });

      const timeoutPromise = new Promise((_, reject) => {
        loadMoreTimeoutRef.current = setTimeout(() => {
          reject(new Error('Message loading timed out'));
        }, 10000);
      });

      const response = await Promise.race([responsePromise, timeoutPromise]);

      if (response.messages) {
        processMessages(response.messages, response.hasMore, false);
      }

    } catch (error) {
      console.error('Load previous messages error:', error);
      Toast.error('이전 메시지를 불러오는데 실패했습니다.');
      setHasMoreMessages(false);
    } finally {
      setLoadingMessages(false);
      if (loadMoreTimeoutRef.current) {
        clearTimeout(loadMoreTimeoutRef.current);
      }
    }
  }, [socketRef, roomId, loadingMessages, messages, processMessages, setHasMoreMessages]);

  // Event listeners setup
  const setupEventListeners = useCallback(() => {
    if (!socketRef.current || !mountedRef.current) return;

    console.log('Setting up event listeners...');


    // 참가자 업데이트 이벤트
    socketRef.current.on('participantsUpdate', (participants) => {
      if (!mountedRef.current) return;
      console.log('Participants updated:', participants);
      setRoom(prev => ({
        ...prev,
        participants: participants || []
      }));
    });

    // 메시지 이벤트
    socketRef.current.on('message', message => {
      if (!message || !mountedRef.current || messageProcessingRef.current || !message._id) return;
      
      if (processedMessageIds.current.has(message._id)) {
        return;
      }

      console.log('Received message:', message);
      processedMessageIds.current.add(message._id);

      setMessages(prev => {
        if (prev.some(msg => msg._id === message._id)) {
          return prev;
        }
        return [...prev, message];
      });

      if (isNearBottom) {
        scrollToBottom();
      }
    });

    socketRef.current.on('messageUpdated', (updatedMessage) => {
      if (!mountedRef.current || !updatedMessage?._id) return;
      console.log('Received message update:', updatedMessage);
      setMessages(prev =>
        prev.map(msg =>
          msg._id === updatedMessage._id ? { ...msg, ...updatedMessage } : msg
        )
      );
      // 처리된 메시지 ID에 추가하여 중복을 방지합니다.
      processedMessageIds.current.add(updatedMessage._id);
    });




    // 이전 메시지 이벤트
    socketRef.current.on('previousMessages', (response) => {
      if (!mountedRef.current || messageProcessingRef.current) return;
      
      try {
        messageProcessingRef.current = true;
        console.log('Previous messages response:', response);

        if (!response || typeof response !== 'object') {
          throw new Error('Invalid response format');
        }

        const { messages: loadedMessages = [], hasMore } = response;
        const isInitialLoad = messages.length === 0;

        processMessages(loadedMessages, hasMore, isInitialLoad);
        setLoadingMessages(false);

      } catch (error) {
        console.error('Error processing messages:', error);
        setLoadingMessages(false);
        setError('메시지 처리 중 오류가 발생했습니다.');
        setHasMoreMessages(false);
      } finally {
        messageProcessingRef.current = false;
      }
    });

    setupAIMessageListeners();

    // 리액션 이벤트
    socketRef.current.on('messageReactionUpdate', (data) => {
      if (!mountedRef.current) return;
      handleReactionUpdate(data);
    });

    // 세션 이벤트
    socketRef.current.on('session_ended', () => {
      if (!mountedRef.current) return;
      cleanup();
      authService.logout();
      navigate('/?error=session_expired', { replace: true });
    });

    socketRef.current.on('error', (error) => {
      if (!mountedRef.current) return;
      console.error('Socket error:', error);
      setError(error.message || '채팅 연결에 문제가 발생했습니다.');
    });

  }, [isNearBottom, scrollToBottom, messages.length, processMessages, setupAIMessageListeners, setHasMoreMessages, cleanup, navigate, handleReactionUpdate, setLoadingMessages, setError]);

  // Room handling hook initialization
  const {
    setupRoom,
    joinRoom,
    loadInitialMessages,
    fetchRoomData,
    handleSessionError
  } = useRoomHandling(
    socketRef,
    currentUser,
    mountedRef,
    roomId,
    setRoom,
    setError,
    setMessages,
    setHasMoreMessages,
    setLoadingMessages,
    setLoading,
    setupEventListeners,
    cleanup,
    loading,
    setIsInitialized,
    initializingRef,
    setupCompleteRef,
    userRooms.current,
    processMessages
  );

  // Socket connection monitoring
  useEffect(() => {
    if (!socketRef.current || !currentUser) return;

    const handleConnect = () => {
      if (!mountedRef.current) return;
      console.log('Socket connected successfully');
      setConnectionStatus('connected');
      setConnected(true);
      
      if (roomId && !setupCompleteRef.current && 
          !initializingRef.current && !isInitialized) {
        socketInitializedRef.current = true;
        setupRoom().catch(error => {
          console.error('Setup room error:', error);
          setError('채팅방 연결에 실패했습니다.');
        });
      }
    };

    const handleDisconnect = (reason) => {
      if (!mountedRef.current) return;
      console.log('Socket disconnected:', reason);
      setConnectionStatus('disconnected');
      socketInitializedRef.current = false;
      setupCompleteRef.current = false;
    };

    const handleError = (error) => {
      if (!mountedRef.current) return;
      console.error('Socket connection error:', error);
      setConnectionStatus('error');
      setError('채팅 서버와의 연결이 끊어졌습니다.');
    };

    const handleReconnecting = (attemptNumber) => {
      if (!mountedRef.current) return;
      console.log(`Reconnection attempt ${attemptNumber}`);
      setConnectionStatus('connecting');
    };

    const handleReconnectSuccess = () => {
      if (!mountedRef.current) return;
      console.log('Reconnected successfully');
      setConnectionStatus('connected');
      setConnected(true);
      setError('');
      
      // 재연결 시 채팅방 재접속
      if (roomId) {
        setupRoom().catch(error => {
          console.error('Room reconnection error:', error);
          setError('채팅방 재연결에 실패했습니다.');
        });
      }
    };

    socketRef.current.on('connect', handleConnect);
    socketRef.current.on('disconnect', handleDisconnect);
    socketRef.current.on('connect_error', handleError);
    socketRef.current.on('reconnecting', handleReconnecting);
    socketRef.current.on('reconnect', handleReconnectSuccess);

    setConnectionStatus(socketRef.current.connected ? 'connected' : 'disconnected');

    return () => {
      if (socketRef.current) {
        socketRef.current.off('connect', handleConnect);
        socketRef.current.off('disconnect', handleDisconnect);
        socketRef.current.off('connect_error', handleError);
        socketRef.current.off('reconnecting', handleReconnecting);
        socketRef.current.off('reconnect', handleReconnectSuccess);
      }
    };
  }, [roomId, setupRoom, setConnected, currentUser, isInitialized, setError]);

  // Component initialization and cleanup
  useEffect(() => {
    const initializeChat = async () => {
      if (initializingRef.current) return;
      
      const user = authService.getCurrentUser();
      if (!user) {
        navigate('/?redirect=' + location.pathname + location.search, { replace: true });
        return;
      }

      if (!currentUser) {
        setCurrentUser(user);
      }

      // 채팅방이 있을 때만 초기화 진행
      if (!isInitialized && roomId) {
        try {
          initializingRef.current = true;
          console.log('Initializing chat room...');
          await setupRoom();
        } catch (error) {
          console.error('Chat initialization error:', error);
          setError('채팅방 초기화에 실패했습니다.');
        } finally {
          initializingRef.current = false;
        }
      }
    };

    mountedRef.current = true;
    
    // 라우터 쿼리가 준비되면 초기화 진행
    if (roomId) {
      initializeChat();
    }

    const tokenCheckInterval = setInterval(() => {
      if (!mountedRef.current) return;
      
      const user = authService.getCurrentUser();
      if (!user) {
        clearInterval(tokenCheckInterval);
        navigate('/?redirect=' + location.pathname + location.search, { replace: true });
      }
    }, 60000);

    return () => {
      console.log('[Chat] Component unmounting...');
      mountedRef.current = false;
      clearInterval(tokenCheckInterval);
      
      if (loadMoreTimeoutRef.current) {
        clearTimeout(loadMoreTimeoutRef.current);
      }

      // Run cleanup only if socket is connected and room exists
      if (socketRef.current?.connected && roomId && !cleanupInProgressRef.current) {
        cleanup(CLEANUP_REASONS.UNMOUNT);
      }
    };
  }, [navigate, cleanup, setupRoom, currentUser, isInitialized, roomId, setError]);

  // File handling hook
  const {
    fileInputRef,
    uploading: fileUploading,
    uploadProgress: fileUploadProgress,
    uploadError: fileUploadError,
    handleFileUpload,
    handleFileSelect,
    handleFileDrop,
    removeFilePreview: removeFile
  } = useFileHandling(socketRef, currentUser, { roomId, navigate, location });

  // Enter key handler
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleMessageSubmit(e);
    }
  }, [handleMessageSubmit]);

  return {
    // State
    room,
    messages,
    streamingMessages,
    error,
    loading,
    connected,
    currentUser,
    message,
    showEmojiPicker,
    showMentionList,
    mentionFilter,
    mentionIndex,
    filePreview,
    uploading,
    uploadProgress,
    uploadError,
    isNearBottom,
    hasMoreMessages,
    loadingMessages,
    
    // Refs
    fileInputRef,
    messageInputRef,
    messagesEndRef,
    socketRef,
    
    // Handlers
    handleMessageChange,
    handleMessageSubmit,
    handleEmojiToggle,
    handleKeyDown,
    handleScroll,
    handleLoadMore: loadPreviousMessages,
    handleConnectionError,
    handleReconnect,
    getFilteredParticipants,
    insertMention,
    scrollToBottom,
    removeFilePreview,
    handleReactionAdd,
    handleReactionRemove,
    cleanup,
    
    // Setters
    setMessage,
    setShowEmojiPicker,
    setShowMentionList,
    setMentionFilter,
    setMentionIndex,
    setStreamingMessages,
    setError,
    
    // Status
    connectionStatus: getConnectionState(),
    messageLoadError,
    
    // Retry handler
    retryMessageLoad: useCallback(() => {
      if (mountedRef.current) {
        messageLoadAttemptRef.current = 0;
        previousMessagesRef.current.clear();
        processedMessageIds.current.clear();
        initialLoadCompletedRef.current = false;
        loadInitialMessages(roomId);
      }
    }, [loadInitialMessages, roomId])
  };
};

export default useChatRoom;