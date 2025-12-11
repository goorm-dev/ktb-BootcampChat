import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { LockIcon, ErrorCircleIcon, NetworkIcon, RefreshOutlineIcon, GroupIcon } from '@vapor-ui/icons';
import { Button, Text, Badge, Callout, Box, VStack, HStack } from '@vapor-ui/core';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import * as Table from '@/components/Table';
import axiosInstance from '@/services/axios';
import { withAuth, useAuth } from '@/contexts/AuthContext';

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

//ChatRoomsComponent
function ChatRoomsComponent() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(CONNECTION_STATUS.CHECKING);
  const [sorting] = useState([
    { id: 'createdAt', desc: true }
  ]);
  const [joiningRoom, setJoiningRoom] = useState(false);

  const getRetryDelay = useCallback((retryCount) => {
    const delay = RETRY_CONFIG.baseDelay *
      Math.pow(RETRY_CONFIG.backoffFactor, retryCount) *
      (1 + Math.random() * 0.1);
    return Math.min(delay, RETRY_CONFIG.maxDelay);
  }, []);

  const attemptConnection = useCallback(async (retryAttempt = 0) => {
    try {
      if (connectionStatus === CONNECTION_STATUS.CONNECTED) {
        return true;
      }
      setConnectionStatus(prev =>
        prev === CONNECTION_STATUS.CONNECTED ? prev : CONNECTION_STATUS.CONNECTING
      );

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
  }, [connectionStatus, getRetryDelay]);

  const roomsQueryKey = useMemo(
    () => ['chat-rooms', sorting[0]?.id, sorting[0]?.desc],
    [sorting]
  );

  const {
    data,
    error: roomsError,
    isLoading,
    isFetching,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    refetch,
    status
  } = useInfiniteQuery({
    queryKey: roomsQueryKey,
    queryFn: async ({ pageParam = 0 }) => {
      await attemptConnection();

      const response = await axiosInstance.get('/api/rooms', {
        params: {
          page: pageParam,
          pageSize: INITIAL_PAGE_SIZE,
          sortField: sorting[0]?.id,
          sortOrder: sorting[0]?.desc ? 'desc' : 'asc'
        }
      });

      if (!response?.data?.data) {
        throw new Error('INVALID_RESPONSE');
      }

      const { data: roomData, metadata } = response.data;

      return {
        rooms: roomData,
        metadata,
        page: pageParam
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      if (!lastPage?.metadata?.hasMore) return undefined;
      return (lastPage.page ?? 0) + 1;
    },
    enabled: !!currentUser?.token,
    retry: RETRY_CONFIG.maxRetries,
    retryDelay: getRetryDelay,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000
  });

  const rooms = useMemo(() => {
    if (!data?.pages) return [];
    const roomMap = new Map();

    data.pages.forEach((page) => {
      (page.rooms || []).forEach((room) => {
        if (!roomMap.has(room._id)) {
          roomMap.set(room._id, room);
        }
      });
    });

    return Array.from(roomMap.values());
  }, [data]);

  const hasMore = Boolean(hasNextPage);
  const isInitialLoading = isLoading && !data;

  const handleLoadMore = useCallback(() => {
    if (!hasMore || isFetchingNextPage) {
      return;
    }
    fetchNextPage();
  }, [fetchNextPage, hasMore, isFetchingNextPage]);

  const handleRetryFetch = useCallback(() => {
    if (!currentUser?.token) return;
    setError(null);
    setConnectionStatus(CONNECTION_STATUS.CONNECTING);
    queryClient.resetQueries({ queryKey: roomsQueryKey });
    refetch();
  }, [currentUser, queryClient, roomsQueryKey, refetch]);

  useEffect(() => {
    if (status === 'pending') {
      setConnectionStatus(CONNECTION_STATUS.CONNECTING);
    }
  }, [status]);

  useEffect(() => {
    if (!roomsError) {
      if (data) {
        setError(null);
        setConnectionStatus(CONNECTION_STATUS.CONNECTED);
      }
      return;
    }

    const isAuthExpired = roomsError?.response?.status === 401 ||
      roomsError?.message === 'AUTH_EXPIRED' ||
      roomsError?.code === 'AUTH_EXPIRED' ||
      roomsError?.status === 401;
    const isNetworkError = roomsError?.isNetworkError || roomsError?.code === 'NETWORK_ERROR';

    const message = roomsError?.message === 'INVALID_RESPONSE'
      ? '채팅방 응답 형식이 올바르지 않습니다.'
      : roomsError?.message === 'SERVER_UNREACHABLE'
        ? '서버와 연결할 수 없습니다. 잠시 후 다시 시도해주세요.'
        : roomsError?.message || '채팅방 목록을 불러오는데 실패했습니다.';

    setError({
      title: isAuthExpired ? '인증 만료' : '채팅방 목록 로드 실패',
      message,
      type: isAuthExpired ? 'danger' : isNetworkError ? 'warning' : 'danger',
      showRetry: !isAuthExpired
    });
    setConnectionStatus(CONNECTION_STATUS.ERROR);
  }, [roomsError, data]);

  useEffect(() => {
    if (!currentUser?.token) return;
    setConnectionStatus(CONNECTION_STATUS.CONNECTING);
    refetch();
  }, [currentUser, refetch]);

  useEffect(() => {
    const handleOnline = () => {
      setConnectionStatus(CONNECTION_STATUS.CONNECTING);
      queryClient.resetQueries({ queryKey: roomsQueryKey });
      refetch();
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
  }, [queryClient, roomsQueryKey, refetch]);

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
                  disabled={connectionStatus !== CONNECTION_STATUS.CONNECTED || joiningRoom}
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
                  onClick={handleRetryFetch}
                  disabled={isFetching}
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
                {error.showRetry && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetryFetch}
                    disabled={isFetching}
                  >
                    다시 시도
                  </Button>
                )}
              </VStack>
            </HStack>
          </Callout>
        )}

        {isInitialLoading ? (
          <Box padding="$400">
            <LoadingIndicator text="채팅방 목록을 불러오는 중..." />
          </Box>
        ) : rooms.length > 0 ? (
          <TableWrapper
            onScroll={handleLoadMore}
            loadingMore={isFetchingNextPage}
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
