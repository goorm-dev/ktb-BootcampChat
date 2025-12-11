import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import socketService from "../services/socket";
import { useAuth } from "../contexts/AuthContext";
import { useFileHandling } from "./useFileHandling";
import { useMessageHandling } from "./useMessageHandling";
import { useReactionHandling } from "./useReactionHandling";
import { useSocketHandling } from "./useSocketHandling";
import { useRoomHandling } from "./useRoomHandling";
import { Toast } from "../components/Toast";

const CLEANUP_REASONS = {
  DISCONNECT: "disconnect",
  MANUAL: "manual",
  RECONNECT: "reconnect",
  UNMOUNT: "unmount",
  ERROR: "error",
};

export const useChatRoom = () => {
  const router = useRouter();
  const { user: authUser, logout } = useAuth();
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState("checking");
  const [messageLoadError, setMessageLoadError] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

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
  const processedMessageIds = useRef(new Set());
  const loadMoreTimeoutRef = useRef(null);
  const incomingMessageBufferRef = useRef([]);
  const flushTimerRef = useRef(null);

  // Socket handling setup
  const {
    connected,
    socketRef,
    handleConnectionError,
    handleReconnect,
    setConnected,
  } = useSocketHandling(router);

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
    removeFilePreview,
  } = useMessageHandling(
    socketRef,
    currentUser,
    router,
    undefined,
    messages,
    loadingMessages,
    setLoadingMessages
  );

  // Cleanup 함수 수정
  const cleanup = useCallback(
    (reason = "MANUAL") => {
      if (!mountedRef.current || !router.query.room) return;

      try {
        // cleanup이 이미 진행 중인지 확인
        if (cleanupInProgressRef.current) {
          return;
        }

        cleanupInProgressRef.current = true;

        // Socket cleanup
        if (router.query.room && socketRef.current?.connected) {
          socketRef.current.emit("leaveRoom", router.query.room);
        }

        //항상 리스너는 하나만 실행되도록 그 전에 있던 것은 삭제합니다.
        if (socketRef.current) {
          socketRef.current.off("message");
          socketRef.current.off("previousMessages");
          socketRef.current.off("previousMessagesLoaded");
          socketRef.current.off("participantsUpdate");
          socketRef.current.off("messagesRead");
          socketRef.current.off("messageReactionUpdate");
          socketRef.current.off("session_ended");
          socketRef.current.off("error");
        }

        // Clear timeouts
        if (loadMoreTimeoutRef.current) {
          clearTimeout(loadMoreTimeoutRef.current);
          loadMoreTimeoutRef.current = null;
        }
        if (flushTimerRef.current) {
          clearTimeout(flushTimerRef.current);
          flushTimerRef.current = null;
        }
        incomingMessageBufferRef.current = [];

        // Reset refs
        processedMessageIds.current.clear();
        previousMessagesRef.current.clear();
        messageProcessingRef.current = false;

        // Reset states only if needed
        if (reason === "MANUAL" && mountedRef.current) {
          setError(null);
          setLoading(false);
          setLoadingMessages(false);
          setMessages([]);

          if (userRooms.current.size > 0) {
            userRooms.current.clear();
          }
        } else if (reason === "DISCONNECT" && mountedRef.current) {
          setError("채팅 연결이 끊어졌습니다. 재연결을 시도합니다.");
        }
      } catch (error) {
        if (mountedRef.current) {
          setError("채팅방 정리 중 오류가 발생했습니다.");
        }
      } finally {
        cleanupInProgressRef.current = false;
      }
    },
    [
      setMessages,
      setError,
      setLoading,
      setLoadingMessages,
      mountedRef,
      socketRef,
    ]
  );

  // Connection state utility
  const getConnectionState = useCallback(() => {
    if (!socketRef.current) return "disconnected";
    if (loading) return "connecting";
    if (error) return "error";
    return socketRef.current.connected ? "connected" : "disconnected";
  }, [loading, error, socketRef]);

  // Reaction handling hook
  const { handleReactionAdd, handleReactionRemove, handleReactionUpdate } =
    useReactionHandling(socketRef, currentUser, messages, setMessages);

  // 메시지 처리 유틸리티 함수
  const processMessages = useCallback(
    (loadedMessages, hasMore, isInitialLoad = false) => {
      try {
        if (!Array.isArray(loadedMessages)) {
          throw new Error("Invalid messages format");
        }

        setMessages((prev) => {
          // 중복 메시지 필터링 개선
          const newMessages = loadedMessages.filter((msg) => {
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
          allMessages.forEach((msg) => messageMap.set(msg._id, msg));
          return Array.from(messageMap.values());
        });

        // 메시지 로드 상태 업데이트
        if (isInitialLoad) {
          setHasMoreMessages(hasMore);
          initialLoadCompletedRef.current = true;
        } else {
          setHasMoreMessages(hasMore);
        }
      } catch (error) {
        throw error;
      }
    },
    [setMessages, setHasMoreMessages]
  );

  // Cleanup 함수 수정
  const setupEventListeners = useCallback(() => {
    if (!socketRef.current || !mountedRef.current) return;

    // 참가자 업데이트 이벤트
    socketRef.current.on("participantsUpdate", (participants) => {
      if (!mountedRef.current) return;
      setRoom((prev) => ({
        ...prev,
        participants: participants || [],
      }));
    });

    // 읽음 상태 업데이트 이벤트 (메시지 목록의 readers 배열 업데이트)
    socketRef.current.on(
      "messagesRead",
      ({ userId, messageIds, timestamp }) => {
        if (!mountedRef.current) return;

        setMessages((prev) =>
          prev.map((msg) => {
            // 해당 메시지가 읽음 처리된 메시지인지 확인
            if (messageIds.includes(msg._id)) {
              // 이미 읽은 사용자인지 확인
              const alreadyRead = msg.readers?.some(
                (reader) => reader.userId === userId || reader._id === userId
              );

              if (!alreadyRead) {
                return {
                  ...msg,
                  readers: [
                    ...(msg.readers || []),
                    { userId, readAt: timestamp || new Date() },
                  ],
                };
              }
            }
            return msg;
          })
        );
      }
    );

    // 메시지 이벤트
    socketRef.current.on("message", (message) => {
      if (!message || !mountedRef.current || !message._id) return;

      if (processedMessageIds.current.has(message._id)) {
        return;
      }

      processedMessageIds.current.add(message._id);

      incomingMessageBufferRef.current.push(message);

      if (!flushTimerRef.current) {
        flushTimerRef.current = setTimeout(() => {
          flushTimerRef.current = null;
          if (!incomingMessageBufferRef.current.length) return;

          const batch = incomingMessageBufferRef.current;
          incomingMessageBufferRef.current = [];

          setMessages((prev) => {
            const existingIds = new Set(prev.map((msg) => msg._id));
            const dedupedBatch = batch.filter(
              (msg) => !existingIds.has(msg._id)
            );
            return dedupedBatch.length ? [...prev, ...dedupedBatch] : prev;
          });
        }, 16); // 마이크로 배치로 리렌더 수 감소
      }
    });

    // 이전 메시지 이벤트 (previousMessages와 previousMessagesLoaded 둘 다 처리)
    const handlePreviousMessages = (response) => {
      if (!mountedRef.current || messageProcessingRef.current) return;

      try {
        messageProcessingRef.current = true;

        if (!response || typeof response !== "object") {
          throw new Error("Invalid response format");
        }

        const { messages: loadedMessages = [], hasMore } = response;
        const isInitialLoad = messages.length === 0;

        processMessages(loadedMessages, hasMore, isInitialLoad);
        setLoadingMessages(false);
      } catch (error) {
        setLoadingMessages(false);
        setError("메시지 처리 중 오류가 발생했습니다.");
        setHasMoreMessages(false);
      } finally {
        messageProcessingRef.current = false;
      }
    };

    socketRef.current.on("previousMessages", handlePreviousMessages);
    socketRef.current.on("previousMessagesLoaded", handlePreviousMessages);

    // 리액션 이벤트
    socketRef.current.on("messageReactionUpdate", (data) => {
      if (!mountedRef.current) return;
      handleReactionUpdate(data);
    });

    // 세션 이벤트
    socketRef.current.on("session_ended", () => {
      if (!mountedRef.current) return;
      cleanup();
      logout();
      router.replace("/?error=session_expired");
    });

    socketRef.current.on("error", (error) => {
      if (!mountedRef.current) return;
      console.error("Socket error:", error);

      // 금칙어 메시지 거부 처리
      if (error?.code === "MESSAGE_REJECTED") {
        Toast.error(
          error.message || "금칙어가 포함되어 메시지를 전송할 수 없습니다."
        );
        return;
      }

      setError(error.message || "채팅 연결에 문제가 발생했습니다.");
    });
  }, [
    processMessages,
    setHasMoreMessages,
    cleanup,
    handleReactionUpdate,
    setLoadingMessages,
    setError,
    logout,
  ]);

  // Room handling hook initialization
  const {
    setupRoom,
    joinRoom,
    loadInitialMessages,
    fetchRoomData,
    handleSessionError,
  } = useRoomHandling(
    socketRef,
    currentUser,
    mountedRef,
    router,
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
      setConnectionStatus("connected");
      setConnected(true);

      if (
        router.query.room &&
        !setupCompleteRef.current &&
        !initializingRef.current &&
        !isInitialized
      ) {
        socketInitializedRef.current = true;
        setupRoom().catch(() => {
          setError("채팅방 연결에 실패했습니다.");
        });
      }
    };

    const handleDisconnect = (reason) => {
      if (!mountedRef.current) return;
      setConnectionStatus("disconnected");
      socketInitializedRef.current = false;
      setupCompleteRef.current = false;
    };

    const handleError = (error) => {
      if (!mountedRef.current) return;
      setConnectionStatus("error");
      setError("채팅 서버와의 연결이 끊어졌습니다.");
    };

    const handleReconnecting = (attemptNumber) => {
      if (!mountedRef.current) return;
      setConnectionStatus("connecting");
    };

    //재 연결 성공 시 -> setupRoom
    const handleReconnectSuccess = () => {
      if (!mountedRef.current) return;
      setConnectionStatus("connected");
      setConnected(true);
      setError("");

      // 재연결 시 채팅방 재접속
      if (router.query.room) {
        cleanup(CLEANUP_REASONS.RECONNECT);
        setupRoom().catch(() => {
          setError("채팅방 재연결에 실패했습니다.");
        });
      }
    };

    socketRef.current.on("connect", handleConnect);
    socketRef.current.on("disconnect", handleDisconnect);
    socketRef.current.on("connect_error", handleError);
    socketRef.current.on("reconnecting", handleReconnecting);
    socketRef.current.on("reconnect", handleReconnectSuccess);

    setConnectionStatus(
      socketRef.current.connected ? "connected" : "disconnected"
    );

    return () => {
      if (socketRef.current) {
        socketRef.current.off("connect", handleConnect);
        socketRef.current.off("disconnect", handleDisconnect);
        socketRef.current.off("connect_error", handleError);
        socketRef.current.off("reconnecting", handleReconnecting);
        socketRef.current.off("reconnect", handleReconnectSuccess);
      }
    };
  }, [
    router.query.room,
    setupRoom,
    setConnected,
    currentUser,
    isInitialized,
    setError,
  ]);

  // Component initialization and cleanup
  useEffect(() => {
    const initializeChat = async () => {
      if (initializingRef.current) return;

      if (!authUser) {
        router.replace("/?redirect=" + router.asPath);
        return;
      }

      if (!currentUser) {
        setCurrentUser(authUser);
      }

      // 채팅방이 있을 때만 초기화 진행
      if (!isInitialized && router.query.room) {
        try {
          initializingRef.current = true;
          await setupRoom();
        } catch (error) {
          setError("채팅방 초기화에 실패했습니다.");
        } finally {
          initializingRef.current = false;
        }
      }
    };

    mountedRef.current = true;

    // 라우터 쿼리가 준비되면 초기화 진행
    if (router.query.room) {
      initializeChat();
    }

    const tokenCheckInterval = setInterval(() => {
      if (!mountedRef.current) return;

      if (!authUser) {
        clearInterval(tokenCheckInterval);
        router.replace("/?redirect=" + router.asPath);
      }
    }, 60000);

    return () => {
      mountedRef.current = false;
      clearInterval(tokenCheckInterval);

      if (loadMoreTimeoutRef.current) {
        clearTimeout(loadMoreTimeoutRef.current);
      }

      // Run cleanup only if socket is connected and room exists
      if (
        socketRef.current?.connected &&
        router.query.room &&
        !cleanupInProgressRef.current
      ) {
        cleanup(CLEANUP_REASONS.UNMOUNT);
      }
    };
  }, [
    router.query.room,
    cleanup,
    setupRoom,
    isInitialized,
    setError,
    authUser,
  ]);

  // Handle page refresh/close to ensure leaveRoom is called
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (socketRef.current?.connected && router.query.room) {
        socketRef.current.emit("leaveRoom", router.query.room);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [router.query.room]);

  // File handling hook
  const {
    fileInputRef,
    uploading: fileUploading,
    uploadProgress: fileUploadProgress,
    uploadError: fileUploadError,
    handleFileUpload,
    handleFileSelect,
    handleFileDrop,
    removeFilePreview: removeFile,
  } = useFileHandling(socketRef, currentUser, router);

  // Enter key handler
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleMessageSubmit(e);
      }
    },
    [handleMessageSubmit]
  );

  return {
    // State
    room,
    messages,
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
    hasMoreMessages,
    loadingMessages,

    // Refs
    fileInputRef,
    messageInputRef,
    socketRef,

    // Handlers
    handleMessageChange,
    handleMessageSubmit,
    handleEmojiToggle,
    handleKeyDown,
    handleConnectionError,
    handleReconnect,
    getFilteredParticipants,
    insertMention,
    removeFilePreview,
    handleReactionAdd,
    handleReactionRemove,
    handleLoadMore, // 페이징 핸들러 추가
    cleanup,

    // Setters
    setMessage,
    setShowEmojiPicker,
    setShowMentionList,
    setMentionFilter,
    setMentionIndex,
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
        loadInitialMessages(router.query.room);
      }
    }, [loadInitialMessages, router.query.room]),
  };
};

export default useChatRoom;
