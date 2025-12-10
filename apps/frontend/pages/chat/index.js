import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { LockIcon, ErrorCircleIcon, NetworkIcon, RefreshOutlineIcon, GroupIcon, PlusCircleIcon } from '@vapor-ui/icons';
import { Button, Text, Badge, Callout, Box, VStack, HStack } from '@vapor-ui/core';
import * as Table from '@/components/Table';
import socketService from '@/services/socket';
import axiosInstance from '@/services/axios';
import { withAuth, useAuth } from '@/contexts/AuthContext';
import { Toast } from '@/components/Toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const CONNECTION_STATUS = {
  CHECKING: 'checking',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error'
};

const STATUS_CONFIG = {
  [CONNECTION_STATUS.CHECKING]: { label: "연결 확인 중...", color: "warning" },
  [CONNECTION_STATUS.CONNECTING]: { label: "연결 중...", color: "warning" },
  [CONNECTION_STATUS.CONNECTED]: { label: "연결됨", color: "success" },
  [CONNECTION_STATUS.DISCONNECTED]: { label: "연결 끊김", color: "danger" },
  [CONNECTION_STATUS.ERROR]: { label: "연결 오류", color: "danger" }
};

const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 5000,
  backoffFactor: 2,
  reconnectInterval: 30000
};

const SCROLL_THRESHOLD = 50;
const SCROLL_DEBOUNCE_DELAY = 150;
const INITIAL_PAGE_SIZE = 10;

const LoadingIndicator = ({ text }) => (
  <HStack gap="$200" justifyContent="center" alignItems="center">
    <div className="spinner-border spinner-border-sm" role="status">
      <span className="visually-hidden">Loading...</span>
    </div>
    <Text typography="body2">{text}</Text>
  </HStack>
);

const TableWrapper = ({ children, onScroll, loadingMore, hasMore, rooms }) => {
  const tableRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const lastScrollTime = useRef(Date.now());

  const handleScroll = useCallback((e) => {
    const now = Date.now();
    const container = e.target;

    // 마지막 스크롤 체크로부터 150ms가 지났는지 확인
    if (now - lastScrollTime.current >= SCROLL_DEBOUNCE_DELAY) {
      const { scrollHeight, scrollTop, clientHeight } = container;
      const distanceToBottom = scrollHeight - (scrollTop + clientHeight);

      if (distanceToBottom < SCROLL_THRESHOLD && !loadingMore && hasMore) {
        lastScrollTime.current = now; // 마지막 체크 시간 업데이트
        onScroll();
        return;
      }

      lastScrollTime.current = now;
    } else if (!scrollTimeoutRef.current) {
      // 디바운스 타이머 설정
      scrollTimeoutRef.current = setTimeout(() => {
        const { scrollHeight, scrollTop, clientHeight } = container;
        const distanceToBottom = scrollHeight - (scrollTop + clientHeight);

        if (distanceToBottom < SCROLL_THRESHOLD && !loadingMore && hasMore) {
          onScroll();
        }

        scrollTimeoutRef.current = null;
        lastScrollTime.current = Date.now();
      }, SCROLL_DEBOUNCE_DELAY);
    }
  }, [loadingMore, hasMore, onScroll]);

  useEffect(() => {
    const container = tableRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
    }

    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    };
  }, [handleScroll]);

  return (
    <div
      ref={tableRef}
      className="chat-rooms-table"
      style={{
        height: '430px',
        overflowY: 'auto',
        position: 'relative',
        borderRadius: '0.5rem',
        backgroundColor: 'var(--background-normal)',
        border: '1px solid var(--border-color)',
        scrollBehavior: 'smooth',
        WebkitOverflowScrolling: 'touch'
      }}
    >
      {children}
      {loadingMore && (
        <Box
          padding="$300"
          borderTop="1px solid var(--vapor-color-border-normal)"
        >
          <LoadingIndicator text="추가 채팅방을 불러오는 중..." />
        </Box>
      )}
      {!hasMore && rooms?.length > 0 && (
        <Box
          padding="$300"
          borderTop="1px solid var(--vapor-color-border-normal)"
          textAlign="center"
        >
          <Text typography="body2">
            모든 채팅방을 불러왔습니다.
          </Text>
        </Box>
      )}
    </div>
  );
};

function ChatRoomsComponent() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(CONNECTION_STATUS.CHECKING);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [sorting, setSorting] = useState([
    { id: 'createdAt', desc: true }
  ]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize] = useState(INITIAL_PAGE_SIZE);
  const [hasMore, setHasMore] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [joiningRoom, setJoiningRoom] = useState(false);

  // Refs
  const socketRef = useRef(null);
  const tableContainerRef = useRef(null);
  const connectionCheckTimerRef = useRef(null);
  const isLoadingRef = useRef(false);
  const previousRoomsRef = useRef([]);
  const lastLoadedPageRef = useRef(0);

  const getRetryDelay = useCallback((retryCount) => {
    const delay = RETRY_CONFIG.baseDelay *
      Math.pow(RETRY_CONFIG.backoffFactor, retryCount) *
      (1 + Math.random() * 0.1);
    return Math.min(delay, RETRY_CONFIG.maxDelay);
  }, []);

  const handleAuthError = useCallback(async (error, logout, refreshToken) => {
    try {
      if (error.response?.status === 401 || error.response?.data?.code === 'TOKEN_EXPIRED') {
        const refreshed = await refreshToken();
        if (refreshed) {
          return true;
        }
      }
      await logout();
      return false;
    } catch (error) {
      await logout();
      return false;
    }
  }, []);

  const handleFetchError = useCallback((error, isLoadingMore) => {
    let errorMessage = '채팅방 목록을 불러오는데 실패했습니다.';
    let errorType = 'danger';
    let showRetry = !isRetrying;

    // 인증 만료 에러 처리
    if (error.message === 'AUTH_EXPIRED') {
      errorMessage = '인증이 만료되었습니다. 다시 로그인해주세요.';
      errorType = 'danger';
      showRetry = false;

      if (!isLoadingMore) {
        setError({
          title: '인증 만료',
          message: errorMessage,
          type: errorType,
          showRetry
        });
      }

      setConnectionStatus(CONNECTION_STATUS.ERROR);
      return;
    }

    if (error.message === 'SERVER_UNREACHABLE') {
      errorMessage = '서버와 연결할 수 없습니다. 잠시 후 자동으로 재시도합니다.';
      errorType = 'warning';
      showRetry = true;

      if (!isLoadingMore && retryCount < RETRY_CONFIG.maxRetries) {
        const delay = getRetryDelay(retryCount);
        setRetryCount(prev => prev + 1);
        setTimeout(() => {
          setIsRetrying(true);
          fetchRooms(isLoadingMore);
        }, delay);
      }
    }

    if (!isLoadingMore) {
      setError({
        title: '채팅방 목록 로드 실패',
        message: errorMessage,
        type: errorType,
        showRetry
      });
    }

    setConnectionStatus(CONNECTION_STATUS.ERROR);
  }, [isRetrying, retryCount, getRetryDelay]);

  const attemptConnection = useCallback(async (retryAttempt = 0) => {
    try {
      setConnectionStatus(CONNECTION_STATUS.CONNECTING);

      const response = await axiosInstance.get('/api/health', {
        timeout: 5000,
        retries: 1
      });

      // 401 응답은 인증 만료를 의미
      if (response?.status === 401) {
        setConnectionStatus(CONNECTION_STATUS.ERROR);
        throw new Error('AUTH_EXPIRED');
      }

      const isConnected = response?.data?.status === 'ok' && response?.status === 200;

      if (isConnected) {
        setConnectionStatus(CONNECTION_STATUS.CONNECTED);
        setRetryCount(0);
        return true;
      }

      throw new Error('Server not ready');
    } catch (error) {
      // 401 에러는 인증 만료 - 재시도 없이 즉시 실패
      if (error.response?.status === 401 || error.message === 'AUTH_EXPIRED') {
        setConnectionStatus(CONNECTION_STATUS.ERROR);
        throw new Error('AUTH_EXPIRED');
      }

      if (!error.response && retryAttempt < RETRY_CONFIG.maxRetries) {
        const delay = getRetryDelay(retryAttempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        return attemptConnection(retryAttempt + 1);
      }

      setConnectionStatus(CONNECTION_STATUS.ERROR);
      throw new Error('SERVER_UNREACHABLE');
    }
  }, [getRetryDelay]);

  const fetchRooms = useCallback(async (isLoadingMore = false) => {
    if (!currentUser?.token || isLoadingRef.current) {
      return;
    }

    try {
      isLoadingRef.current = true;

      if (!isLoadingMore) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      await attemptConnection();

      const response = await axiosInstance.get('/api/rooms', {
        params: {
          page: isLoadingMore ? pageIndex : 0,
          pageSize,
          sortField: sorting[0]?.id,
          sortOrder: sorting[0]?.desc ? 'desc' : 'asc'
        }
      });

      if (!response?.data?.data) {
        throw new Error('INVALID_RESPONSE');
      }

      const { data, metadata } = response.data;

      setRooms(prev => {
        if (isLoadingMore) {
          const existingIds = new Set(prev.map(room => room._id));
          const newRooms = data.filter(room => !existingIds.has(room._id));
          return [...prev, ...newRooms];
        }
        return data;
      });

      setHasMore(data.length === pageSize && metadata.hasMore);

      if (isInitialLoad) {
        setIsInitialLoad(false);
      }

    } catch (error) {
      handleFetchError(error, isLoadingMore);
    } finally {
      if (!isLoadingMore) {
        setLoading(false);
      }
      setLoadingMore(false);
      isLoadingRef.current = false;
    }
  }, [
    currentUser,
    pageIndex,
    pageSize,
    sorting,
    isInitialLoad,
    attemptConnection,
    handleFetchError
  ]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore || isLoadingRef.current) {
      return;
    }

    try {
      setLoadingMore(true);
      isLoadingRef.current = true;

      const nextPage = Math.floor(rooms.length / pageSize);
      setPageIndex(nextPage);

      const response = await axiosInstance.get('/api/rooms', {
        params: {
          page: nextPage,
          pageSize,
          sortField: sorting[0]?.id,
          sortOrder: sorting[0]?.desc ? 'desc' : 'asc'
        }
      });

      if (response.data?.success) {
        const { data: newRooms, metadata } = response.data;

        setRooms(prev => {
          const existingIds = new Set(prev.map(room => room._id));
          const uniqueNewRooms = newRooms.filter(room => !existingIds.has(room._id));
          return [...prev, ...uniqueNewRooms];
        });

        setHasMore(newRooms.length === pageSize && metadata.hasMore);
      }
    } catch (error) {
      handleFetchError(error, true);
    } finally {
      setLoadingMore(false);
      isLoadingRef.current = false;
      Toast.info('추가 채팅방을 불러왔습니다.');
    }
  }, [loadingMore, hasMore, rooms.length, pageSize, sorting, handleFetchError]);

  // 페이지 인덱스 변경 시 데이터 로드
  useEffect(() => {
    if (pageIndex > 0) {
      fetchRooms(true);
    }
  }, [pageIndex, fetchRooms]);

  useEffect(() => {
    if (!currentUser) return;

    const initFetch = async () => {
      try {
        await fetchRooms(false);
      } catch (error) {
        setTimeout(() => {
          if (connectionStatus === CONNECTION_STATUS.CHECKING) {
            fetchRooms(false);
          }
        }, 3000);
      }
    };

    initFetch();

    connectionCheckTimerRef.current = setInterval(() => {
      if (connectionStatus === CONNECTION_STATUS.CHECKING) {
        attemptConnection();
      }
    }, 5000);

    return () => {
      if (connectionCheckTimerRef.current) {
        clearInterval(connectionCheckTimerRef.current);
      }
    };
  }, [currentUser, connectionStatus, attemptConnection, fetchRooms]);

  useEffect(() => {
    const handleOnline = () => {
      setConnectionStatus(CONNECTION_STATUS.CONNECTING);
      lastLoadedPageRef.current = 0;
      setPageIndex(0);
      fetchRooms(false);
    };

    const handleOffline = () => {
      setConnectionStatus(CONNECTION_STATUS.DISCONNECTED);
      setError({
        title: '네트워크 연결 끊김',
        message: '인터넷 연결을 확인해주세요.',
        type: 'danger'
      });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, [fetchRooms]);

  useEffect(() => {
    if (!currentUser?.token) return;

    let isSubscribed = true;

    const connectSocket = async () => {
      try {
        const socket = await socketService.connect({
          auth: {
            token: currentUser.token,
            sessionId: currentUser.sessionId
          }
        }).catch(err => {
          console.log('Socket connection error:', err);
          router.push('/_error');
        });

        if (!isSubscribed || !socket) return;

        socketRef.current = socket;

        const handlers = {
          connect: () => {
            setConnectionStatus(CONNECTION_STATUS.CONNECTED);
            socket.emit('joinRoomList');
          },
          disconnect: (reason) => {
            setConnectionStatus(CONNECTION_STATUS.DISCONNECTED);
          },
          error: (error) => {
            setConnectionStatus(CONNECTION_STATUS.ERROR);
          },
          roomCreated: (newRoom) => {
            setRooms(prev => {
              const updatedRooms = [newRoom, ...prev];
              previousRoomsRef.current = updatedRooms;
              return updatedRooms;
            });
          },
          roomDeleted: (roomId) => {
            setRooms(prev => {
              const updatedRooms = prev.filter(room => room._id !== roomId);
              previousRoomsRef.current = updatedRooms;
              return updatedRooms;
            });
          },
          roomUpdated: (updatedRoom) => {
            setRooms(prev => {
              const updatedRooms = prev.map(room =>
                room._id === updatedRoom._id ? updatedRoom : room
              );
              previousRoomsRef.current = updatedRooms;
              return updatedRooms;
            });
          }
        };

        Object.entries(handlers).forEach(([event, handler]) => {
          socket.on(event, handler);
        });

      } catch (error) {
        if (!isSubscribed) return;

        if (error.message?.includes('Authentication required') ||
            error.message?.includes('Invalid session')) {
          // Auth error will be handled by the useAuth context
        }

        setConnectionStatus(CONNECTION_STATUS.ERROR);
      }
    };

    connectSocket();

    return () => {
      isSubscribed = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [currentUser]);

  const handleJoinRoom = async (roomId) => {
    if (connectionStatus !== CONNECTION_STATUS.CONNECTED) {
      setError({
        title: '채팅방 입장 실패',
        message: '서버와 연결이 끊어져 있습니다.',
        type: 'danger'
      });
      return;
    }

    setJoiningRoom(true);

    try {
      const response = await axiosInstance.post(`/api/rooms/${roomId}/join`, {}, {
        timeout: 5000
      });

      if (response.data.success) {
        router.push(`/chat/${roomId}`);
      }
    } catch (error) {
      let errorMessage = '입장에 실패했습니다.';
      if (error.response?.status === 404) {
        errorMessage = '채팅방을 찾을 수 없습니다.';
      } else if (error.response?.status === 403) {
        errorMessage = '채팅방 입장 권한이 없습니다.';
      }

      setError({
        title: '채팅방 입장 실패',
        message: error.response?.data?.message || errorMessage,
        type: 'danger'
      });
    } finally {
      setJoiningRoom(false);
    }
  };

  const renderRoomsTable = () => {
    if (!rooms || rooms.length === 0) return null;

    return (
      <Table.Root style={{ width: '100%' }}>
        <Table.ColumnGroup>
          <Table.Column style={{ width: '40%' }} />
          <Table.Column style={{ width: '12%' }} />
          <Table.Column style={{ width: '12%' }} />
          <Table.Column style={{ width: '21%' }} />
          <Table.Column style={{ width: '15%' }} />
        </Table.ColumnGroup>

        <Table.Header>
          <Table.Row>
            <Table.Heading>채팅방</Table.Heading>
            <Table.Heading>참여자</Table.Heading>
            <Table.Heading>최근 메시지</Table.Heading>
            <Table.Heading>생성일</Table.Heading>
            <Table.Heading>액션</Table.Heading>
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {rooms.map((room) => (
            <Table.Row key={room._id}>
              <Table.Cell>
                <VStack gap="$050" alignItems="flex-start">
                  <Text style={{ fontWeight: 500 }}>
                    {room.name}
                  </Text>
                  {room.hasPassword && (
                    <HStack gap="$050" alignItems="center" color="$warning-100" >
                      <LockIcon size={16} />
                      <Text typography="body3" color="$warning-100">
                        비밀번호 필요
                      </Text>
                    </HStack>
                  )}
                </VStack>
              </Table.Cell>
              <Table.Cell>
                <HStack
                  gap="$050"
                  alignItems="center"
                >
                  <GroupIcon />
                  <Text typography="body2">
                    {room.participants?.length || 0}
                  </Text>
                </HStack>
              </Table.Cell>
              <Table.Cell>
                {room.recentMessageCount > 0 ? (
                  room.recentMessageCount
                ) : (
                  '-'
                )}
              </Table.Cell>
              <Table.Cell>
                <time dateTime={new Date(room.createdAt).toISOString()}>
                  {new Date(room.createdAt).toLocaleString('ko-KR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </time>
              </Table.Cell>
              <Table.Cell>
                <Button
                  colorPalette="primary"
                  // variant="outline"
                  size="md"
                  onClick={() => handleJoinRoom(room._id)}
                  disabled={connectionStatus !== CONNECTION_STATUS.CONNECTED}
                  data-testid={`join-chat-room-button`}
                >
                  입장
                </Button>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    );
  };


  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      padding="$300"
    >
      <VStack
        gap="$400"
        width="100%"
        maxWidth="1200px"
        padding="$400"
        borderRadius="$300"
        border="1px solid var(--vapor-color-border-normal)"
      >
        <VStack gap="$300" alignItems="center">
          <HStack gap="$300" alignItems="center" justifyContent="space-between" className="w-full">
            <Text typography="heading3">채팅방 목록</Text>
            <HStack gap="$200">
              <Badge colorPalette={STATUS_CONFIG[connectionStatus]?.color || 'danger'}>
                {STATUS_CONFIG[connectionStatus].label}
              </Badge>
              {(error || connectionStatus === CONNECTION_STATUS.ERROR) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    lastLoadedPageRef.current = 0;
                    setPageIndex(0);
                    fetchRooms(false);
                  }}
                  disabled={isRetrying}
                >
                  <RefreshOutlineIcon size={16} />
                  재연결
                </Button>
              )}
            </HStack>
          </HStack>
        </VStack>

        
        {error && (
          <Callout
            color={error.type === 'danger' ? 'danger' : error.type === 'warning' ? 'warning' : 'primary'}
          >
            <HStack gap="$200" alignItems="flex-start">
              {connectionStatus === CONNECTION_STATUS.ERROR ? (
                <NetworkIcon size={18} />
              ) : (
                <ErrorCircleIcon size={18} />
              )}
              <VStack gap="$150" alignItems="flex-start">
                <Text typography="subtitle2" style={{ fontWeight: 500 }}>{error.title}</Text>
                <Text typography="body2">{error.message}</Text>
                {error.showRetry && !isRetrying && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      lastLoadedPageRef.current = 0;
                      setPageIndex(0);
                      fetchRooms(false);
                    }}
                  >
                    다시 시도
                  </Button>
                )}
              </VStack>
            </HStack>
          </Callout>
        )}

        {loading ? (
          <Box padding="$400">
            <LoadingIndicator text="채팅방 목록을 불러오는 중..." />
          </Box>
        ) : rooms.length > 0 ? (
          <TableWrapper
            onScroll={handleLoadMore}
            loadingMore={loadingMore}
            hasMore={hasMore}
            rooms={rooms}
          >
            {renderRoomsTable()}
          </TableWrapper>
        ) : !error && (
          <VStack gap="$300" alignItems="center" padding="$400">
            <Text typography="body1">생성된 채팅방이 없습니다.</Text>
            <Button
              colorPalette="primary"
              onClick={() => router.push('/chat/new')}
              disabled={connectionStatus !== CONNECTION_STATUS.CONNECTED}
            >
              새 채팅방 만들기
            </Button>
          </VStack>
        )}
      </VStack>
    </Box>
  );
}

const ChatRooms = dynamic(() => Promise.resolve(ChatRoomsComponent), {
  ssr: false,
  loading: () => (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      padding="$300"
    >
      <VStack
        gap="$400"
        width="100%"
        maxWidth="1200px"
        padding="$400"
        borderRadius="$300"
        border="1px solid var(--vapor-color-border-normal)"
        backgroundColor="var(--vapor-color-surface-raised)"
      >
        <Text typography="heading3" textAlign="center">채팅방 목록</Text>
        <Box padding="$400">
          <LoadingIndicator text="로딩 중..." />
        </Box>
      </VStack>
    </Box>
  )
});

export default withAuth(ChatRooms);
