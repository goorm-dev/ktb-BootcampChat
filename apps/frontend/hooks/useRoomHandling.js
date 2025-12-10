import { useRef, useEffect, useCallback } from 'react';
import socketService from '../services/socket';
import { useAuth } from '../contexts/AuthContext';
import { Toast } from '../components/Toast';

export const useRoomHandling = (
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
  userRooms,
  processMessages
) => {
  const { user, refreshToken, logout } = useAuth();
  const setupPromiseRef = useRef(null);
  const setupTimeoutRef = useRef(null);
  const joinTimeoutRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const socketReconnectAttempts = useRef(0);
  const messageRetryCountRef = useRef(0);
  const MAX_SOCKET_RECONNECT_ATTEMPTS = 3;
  const MAX_MESSAGE_RETRY_ATTEMPTS = 3;
  const MESSAGE_TIMEOUT = 10000;
  const MESSAGE_RETRY_DELAY = 2000;

  const clearAllTimeouts = useCallback(() => {
    if (setupTimeoutRef.current) {
      clearTimeout(setupTimeoutRef.current);
      setupTimeoutRef.current = null;
    }
    if (joinTimeoutRef.current) {
      clearTimeout(joinTimeoutRef.current);
      joinTimeoutRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const handleSessionError = async () => {
    try {
      if (!user) {
        throw new Error('No user session found');
      }

      await refreshToken();
      if (mountedRef.current) {
        return true;
      }
    } catch (error) {
    }

    if (mountedRef.current) {
      await logout();
      router.replace('/?redirect=' + router.asPath);
    }
    return false;
  };

  const setupSocket = useCallback(async () => {
    try {
      if (!user?.token || !user?.sessionId) {
        throw new Error('Invalid authentication state');
      }

      if (socketRef.current?.connected) {
        return socketRef.current;
      }

      if (socketRef.current) {
        const currentSocket = socketRef.current;

        if (userRooms?.get(currentSocket.id)) {
          await new Promise((resolve) => {
            currentSocket.emit('leaveRoom', userRooms.get(currentSocket.id));
            setTimeout(resolve, 1000);
          });
          userRooms.delete(currentSocket.id);
        }

        currentSocket.disconnect();
        currentSocket.removeAllListeners();
        socketRef.current = null;

        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      const socket = await socketService.connect({
        auth: {
          token: user.token,
          sessionId: user.sessionId
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: MAX_SOCKET_RECONNECT_ATTEMPTS,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 3000,
        timeout: 10000,
        pingTimeout: 10000,
        pingInterval: 8000,
        forceNew: true,
        autoConnect: true
      });

      return new Promise((resolve, reject) => {
        let socketConnected = false;
        const connectionTimeout = setTimeout(() => {
          if (!socketConnected) {
            cleanup();
            reject(new Error('Socket connection timeout'));
          }
        }, 10000);

        const handleConnect = () => {
          if (!socketConnected) {
            socketConnected = true;
            clearTimeout(connectionTimeout);
            socket.removeListener('connect_error', handleError);
            socket.removeListener('error', handleError);
            socketReconnectAttempts.current = 0;
            resolve(socket);
          }
        };

        const handleError = (error) => {
          if (!socketConnected) {
            socketConnected = true;
            clearTimeout(connectionTimeout);
            reject(error);
          }
        };

        if (socket.connected) {
          handleConnect();
          return;
        }

        socket.once('connect', handleConnect);
        socket.once('connect_error', handleError);
        socket.once('error', handleError);
      });

    } catch (error) {
      if (error.message === 'Invalid authentication state') {
        router.replace('/?error=auth_required');
      }
      throw error;
    }
  }, [userRooms, cleanup, router]);

  const fetchRoomData = useCallback(async (roomId) => {
    try {
      if (!user?.token || !user?.sessionId) {
        await handleSessionError();
        throw new Error('인증 정보가 유효하지 않습니다.');
      }

      if (!roomId || !mountedRef.current) {
        throw new Error('채팅방 정보가 올바르지 않습니다.');
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/rooms/${roomId}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'x-auth-token': user.token,
            'x-session-id': user.sessionId
          },
          credentials: 'include'
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          const refreshed = await handleSessionError();
          if (refreshed && mountedRef.current) {
            return fetchRoomData(roomId);
          }
          throw new Error('인증이 만료되었습니다.');
        }
        throw new Error('채팅방 정보를 불러오는데 실패했습니다.');
      }

      const data = await response.json();
      if (!data.success || !data.data) {
        throw new Error('채팅방 데이터가 올바르지 않습니다.');
      }

      return data.data;
    } catch (error) {
      throw error;
    }
  }, [mountedRef, handleSessionError]);

  const joinRoom = useCallback(async (roomId) => {
    if (!roomId || !mountedRef.current) {
      throw new Error('잘못된 채팅방 정보입니다.');
    }

    const socket = socketRef.current;
    if (!socket?.connected) {
      throw new Error('Socket not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('채팅방 입장 시간이 초과되었습니다.'));
      }, 10000);

      const handleSuccess = (data) => {
        clearTimeout(timeout);
        userRooms?.set(socket.id, roomId);
        socket.off('joinRoomError', handleError);
        socket.off('error', handleError);
        resolve(data);
      };

      const handleError = (error) => {
        clearTimeout(timeout);
        socket.off('joinRoomSuccess', handleSuccess);
        socket.off('error', handleError);
        reject(error);
      };

      socket.once('joinRoomSuccess', handleSuccess);
      socket.once('joinRoomError', handleError);
      socket.once('error', handleError);

      socket.emit('joinRoom', roomId);
    });
  }, [socketRef, mountedRef, userRooms]);

  const loadInitialMessages = useCallback(async (roomId) => {
    const loadMessagesWithRetry = async (retryCount = 0) => {
      return new Promise((resolve, reject) => {
        if (!socketRef.current?.connected) {
          reject(new Error('Socket not connected'));
          return;
        }

        let timeoutId;
        const cleanup = () => {
          if (timeoutId) clearTimeout(timeoutId);
          socketRef.current?.off('previousMessagesLoaded', handleSuccess);
          socketRef.current?.off('error', handleError);
        };

        const handleSuccess = (response) => {
          cleanup();
          
          if (!response || !Array.isArray(response.messages)) {
            if (retryCount < MAX_MESSAGE_RETRY_ATTEMPTS) {
              setTimeout(() => {
                loadMessagesWithRetry(retryCount + 1)
                  .then(resolve)
                  .catch(reject);
              }, MESSAGE_RETRY_DELAY);
            } else {
              reject(new Error('잘못된 메시지 응답 형식입니다.'));
            }
            return;
          }

          processMessages(response.messages, response.hasMore, true);
          resolve(response);
        };

        const handleError = (error) => {
          cleanup();
          if (retryCount < MAX_MESSAGE_RETRY_ATTEMPTS) {
            setTimeout(() => {
              loadMessagesWithRetry(retryCount + 1)
                .then(resolve)
                .catch(reject);
            }, MESSAGE_RETRY_DELAY);
          } else {
            reject(error);
          }
        };

        const handleTimeout = () => {
          cleanup();
          if (retryCount < MAX_MESSAGE_RETRY_ATTEMPTS) {
            setTimeout(() => {
              loadMessagesWithRetry(retryCount + 1)
                .then(resolve)
                .catch(reject);
            }, MESSAGE_RETRY_DELAY);
          } else {
            reject(new Error('메시지 로딩 시간이 초과되었습니다.'));
          }
        };

        socketRef.current.once('previousMessagesLoaded', handleSuccess);
        socketRef.current.once('error', handleError);
        timeoutId = setTimeout(handleTimeout, MESSAGE_TIMEOUT);

        socketRef.current.emit('fetchPreviousMessages', {
          roomId,
          limit: 30
        });
      });
    };

    try {
      return await loadMessagesWithRetry();
    } catch (error) {
      if (!socketRef.current?.connected) {
        await setupSocket();
        return loadMessagesWithRetry();
      }
      throw error;
    }
  }, [socketRef, processMessages, setupSocket]);

  const setupRoom = useCallback(async () => {
    if (setupPromiseRef.current) {
      return setupPromiseRef.current;
    }

    setupPromiseRef.current = (async () => {
      try {
        initializingRef.current = true;
        setLoading(true);
        setError(null);
        messageRetryCountRef.current = 0;

        // 1. Socket Setup
        socketRef.current = await setupSocket()
          .catch((error) => {
            console.log('Socket setup error:', error);
            router.push('/_error');
          });

        // 2. Fetch Room Data
        const roomData = await fetchRoomData(router.query.room);
        
        // Ensure current user is included in participants for display
        if (currentUser && roomData.participants) {
          const isUserInParticipants = roomData.participants.some(p =>
            p._id === currentUser.id || p.id === currentUser.id
          );
          
          if (!isUserInParticipants) {
            roomData.participants = [
              ...roomData.participants,
              {
                _id: currentUser.id,
                id: currentUser.id,
                name: currentUser.name,
                email: currentUser.email
              }
            ];
          }
        }
        
        setRoom(roomData);

        // 3. Setup Event Listeners
        if (mountedRef.current) {
          setupEventListeners();
        }

        // 4. Join Room and Load Messages
        if (mountedRef.current && socketRef.current?.connected) {
          await joinRoom(router.query.room);

          await loadInitialMessages(router.query.room);
        }

        if (mountedRef.current) {
          setupCompleteRef.current = true;
          setIsInitialized(true);
        }

      } catch (error) {
        
        if (mountedRef.current) {
          const errorMessage = error.message.includes('시간 초과') ?
            '채팅방 연결 시간이 초과되었습니다.' :
            error.message || '채팅방 연결에 실패했습니다.';
            
          setError(errorMessage);
          cleanup();

          if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
          }
        }

        throw error;
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          initializingRef.current = false;
        }
        
        clearAllTimeouts();
        setupPromiseRef.current = null;
      }
    })();

    return setupPromiseRef.current;
  }, [
    router.query.room,
    socketRef,
    mountedRef,
    setupSocket,
    fetchRoomData,
    joinRoom,
    loadInitialMessages,
    cleanup,
    setupEventListeners,
    setError,
    setRoom,
    setLoading,
    setIsInitialized,
    initializingRef,
    setupCompleteRef,
    clearAllTimeouts
  ]);

  useEffect(() => {
    return () => {
      clearAllTimeouts();
      setupPromiseRef.current = null;
      initializingRef.current = false;
      setupCompleteRef.current = false;
      socketReconnectAttempts.current = 0;
      messageRetryCountRef.current = 0;

      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [clearAllTimeouts]);

  useEffect(() => {
    const handleOnline = () => {
      if (!setupCompleteRef.current && mountedRef.current) {
        setupRoom().catch(() => {});
      }
    };

    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [setupRoom]);

  return {
    setupRoom,
    joinRoom,
    loadInitialMessages,
    fetchRoomData,
    handleSessionError
  };
};

export default useRoomHandling;
