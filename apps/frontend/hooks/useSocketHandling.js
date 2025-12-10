import { useState, useRef, useCallback, useEffect } from 'react';
import socketService from '../services/socket';
import { Toast } from '../components/Toast';

export const useSocketHandling = (router, maxRetries = 5) => { // 최대 재시도 횟수 증가
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const socketRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const reconnectIntervalRef = useRef(null);
  const connectionTimeoutRef = useRef(null);

  const cleanup = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    if (reconnectIntervalRef.current) {
      clearInterval(reconnectIntervalRef.current);
    }
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
    }
  }, []);

  const getRetryDelay = useCallback((retryAttempt) => {
    return Math.min(1000 * Math.pow(2, retryAttempt), 10000); // 최대 10초
  }, []);

  const handleConnectionError = useCallback(async (error, handleSessionError) => {
    setConnected(false);
    setIsReconnecting(true);
    
    try {
      if (error?.message?.includes('세션') || 
          error?.message?.includes('인증') || 
          error?.message?.includes('토큰')) {
        await handleSessionError?.();
        return;
      }

      if (retryCount < maxRetries) {
        const retryDelay = getRetryDelay(retryCount);

        cleanup();

        retryTimeoutRef.current = setTimeout(async () => {
          try {
            if (socketRef.current) {
              await socketRef.current.connect();
              setConnected(true);
              setIsReconnecting(false);
              setRetryCount(0);
              setError(null);
              
              // 재연결 성공 시 채팅방 재접속
              if (router?.query?.room) {
                socketRef.current.emit('joinRoom', router.query.room);
              }
            }
          } catch (retryError) {
            setRetryCount(prev => prev + 1);
            handleConnectionError(retryError, handleSessionError);
          }
        }, retryDelay);
      } else {
        setIsReconnecting(false);
        Toast.error('채팅 서버와 연결할 수 없습니다. 페이지를 새로고침해주세요.');
      }
    } catch (err) {
      setIsReconnecting(false);
    }
  }, [retryCount, maxRetries, cleanup, getRetryDelay, router?.query?.room]);

  const handleReconnect = useCallback(async (currentUser, handleSessionError) => {
    if (isReconnecting) return;

    try {
      if (!currentUser?.token || !currentUser?.sessionId) {
        throw new Error('Invalid user credentials');
      }

      setError(null);
      setRetryCount(0);
      setIsReconnecting(true);
      
      cleanup();
      
      if (socketRef.current) {
        socketRef.current.disconnect();
        setConnected(false);
      }

      const socket = await socketService.connect({
        auth: {
          token: currentUser.token,
          sessionId: currentUser.sessionId
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: maxRetries,
        reconnectionDelay: getRetryDelay(0),
        reconnectionDelayMax: 10000,
        timeout: 20000
      });

      socketRef.current = socket;
      
      // 연결 타임아웃 설정
      connectionTimeoutRef.current = setTimeout(() => {
        if (!socket.connected) {
          handleConnectionError(new Error('Connection timeout'), handleSessionError);
        }
      }, 20000);

      // 연결 이벤트 핸들러
      socket.on('connect', () => {
        setConnected(true);
        setIsReconnecting(false);
        cleanup();

        if (router?.query?.room) {
          socket.emit('joinRoom', router.query.room);
        }
      });

      socket.on('connect_error', (error) => {
        handleConnectionError(error, handleSessionError);
      });

      socket.on('disconnect', (reason) => {
        setConnected(false);

        if (reason === 'io server disconnect' || reason === 'io client disconnect') {
          return;
        }
        
        handleConnectionError(new Error(`Disconnected: ${reason}`), handleSessionError);
      });

    } catch (error) {
      setConnected(false);
      setIsReconnecting(false);
      
      if (error.message?.includes('세션') || 
          error.message?.includes('인증') || 
          error.message?.includes('토큰')) {
        await handleSessionError?.();
        return;
      }
      
      Toast.error('재연결에 실패했습니다.');
    }
  }, [isReconnecting, cleanup, getRetryDelay, maxRetries, router?.query?.room, handleConnectionError]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleConnect = () => {
      setConnected(true);
      setIsReconnecting(false);
      setRetryCount(0);
      setError(null);
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    setConnected(socket.connected);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socketRef.current]);

  // 네트워크 상태 모니터링
  useEffect(() => {
    const handleOnline = () => {
      if (!connected && !isReconnecting) {
        handleReconnect();
      }
    };

    const handleOffline = () => {
      setConnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [connected, isReconnecting, handleReconnect]);

  return {
    connected,
    error,
    socketRef,
    isReconnecting,
    setConnected,
    setError,
    handleConnectionError,
    handleReconnect,
    cleanup
  };
};

export default useSocketHandling;