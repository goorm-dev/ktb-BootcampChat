import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { LockIcon, ErrorCircleIcon, NetworkIcon, RefreshOutlineIcon, GroupIcon } from '@vapor-ui/icons';
import { Button, Card, Text, Badge, Callout, TextInput } from '@vapor-ui/core';
import { Flex, HStack, Stack, Box } from '../components/ui/Layout';
import { StyledTable, StyledTableHead, StyledTableBody, StyledTableRow, StyledTableHeader, StyledTableCell } from '../components/ui/StyledTable';
import socketService from '../services/socket';
import authService from '../services/authService';
import axiosInstance from '../services/axios';
import { withAuth } from '../middleware/withAuth';
import { Toast } from '../components/Toast';
import { Modal, ModalFooter, ModalBody, ModalHeader } from '../components/ui/Modal';


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
  <div className="loading-indicator">
    <div className="spinner-border spinner-border-sm me-3" role="status">
      <span className="visually-hidden">Loading...</span>
    </div>
    <Text typography="body3" foreground="secondary">{text}</Text>
  </div>
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

      console.log('Scroll check:', {
        scrollHeight,
        scrollTop,
        clientHeight,
        distanceToBottom,
        loadingMore,
        hasMore,
        timeSinceLastCheck: now - lastScrollTime.current
      });

      if (distanceToBottom < SCROLL_THRESHOLD && !loadingMore && hasMore) {
        console.log('Triggering load more...');
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

        console.log('Debounced scroll check:', {
          scrollHeight,
          scrollTop,
          clientHeight,
          distanceToBottom,
          loadingMore,
          hasMore
        });

        if (distanceToBottom < SCROLL_THRESHOLD && !loadingMore && hasMore) {
          console.log('Triggering load more (debounced)...');
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
        <div className="flex items-center justify-center gap-2 p-4 border-t border-gray-700">
          <LoadingIndicator text="추가 채팅방을 불러오는 중..." />
        </div>
      )}
      {!hasMore && rooms?.length > 0 && (
        <Flex justify="center" align="center" style={{ 
          padding: 'var(--vapor-space-300)', 
          borderTop: '1px solid var(--vapor-color-border)',
          width: '100%'
        }}>
          <Text typography="body2" color="secondary" style={{ textAlign: 'center' }}>
            모든 채팅방을 불러왔습니다.
          </Text>
        </Flex>
      )}
    </div>
  );
};

function ChatRoomsComponent() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [rooms, setRooms] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentUser] = useState(authService.getCurrentUser());
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

  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');

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

  const handleAuthError = useCallback(async (error) => {
    try {
      if (error.response?.status === 401 || error.response?.data?.code === 'TOKEN_EXPIRED') {
        const refreshed = await authService.refreshToken();
        if (refreshed) {
          return true;
        }
      }
      authService.logout();
      router.replace('/?error=session_expired');
      return false;
    } catch (error) {
      console.error('Auth error handling failed:', error);
      authService.logout();
      router.replace('/?error=auth_error');
      return false;
    }
  }, [router]);

  const handleFetchError = useCallback((error, isLoadingMore) => {
    let errorMessage = '채팅방 목록을 불러오는데 실패했습니다.';
    let errorType = 'danger';
    let showRetry = !isRetrying;

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

      const response = await axiosInstance.get('/health', {
        timeout: 5000,
        retries: 1
      });

      const isConnected = response?.data?.status === 'ok' && response?.status === 200;

      if (isConnected) {
        setConnectionStatus(CONNECTION_STATUS.CONNECTED);
        setRetryCount(0);
        return true;
      }

      throw new Error('Server not ready');
    } catch (error) {
      console.error(`Connection attempt ${retryAttempt + 1} failed:`, error);

      if (!error.response && retryAttempt < RETRY_CONFIG.maxRetries) {
        const delay = getRetryDelay(retryAttempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        return attemptConnection(retryAttempt + 1);
      }

      setConnectionStatus(CONNECTION_STATUS.ERROR);
      throw new Error('SERVER_UNREACHABLE');
    }
  }, [getRetryDelay]);

  const fetchRooms = useCallback(async (isLoadingMore = false, keyword= search) => {
    if (!currentUser?.token || isLoadingRef.current) {
      console.log('Fetch prevented:', { 
        hasToken: !!currentUser?.token, 
        isLoading: isLoadingRef.current 
      });
      return;
    }

    try {
      isLoadingRef.current = true;
      console.log('Fetching rooms:', { isLoadingMore, pageIndex });

      if (!isLoadingMore) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      await attemptConnection();

      console.log('📡 API 요청 시도: /api/rooms');
      console.log('🌐 axiosInstance baseURL:', axiosInstance.defaults.baseURL);
      console.log('🔐 현재 사용자 토큰:', currentUser?.token?.slice(0, 10));

      const response = await axiosInstance.get('/api/rooms', {
        params: {
          search: keyword,
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
      console.log('Fetched rooms:', { 
        count: data.length, 
        hasMore: metadata.hasMore 
      });

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
      console.error('Rooms fetch error:', error);
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
    handleFetchError,
      search
  ]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore || isLoadingRef.current) {
      console.log('Load more prevented:', {
        loadingMore,
        hasMore,
        isLoading: isLoadingRef.current
      });
      return;
    }

    try {
      console.log('Loading more rooms...');
      setLoadingMore(true);
      isLoadingRef.current = true;

      const nextPage = Math.floor(rooms.length / pageSize);
      console.log('Loading page:', nextPage);
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
        console.log('Loaded new rooms:', { 
          count: newRooms.length, 
          hasMore: metadata.hasMore 
        });
        
        setRooms(prev => {
          const existingIds = new Set(prev.map(room => room._id));
          const uniqueNewRooms = newRooms.filter(room => !existingIds.has(room._id));
          console.log('Unique new rooms:', uniqueNewRooms.length);
          return [...prev, ...uniqueNewRooms];
        });

        setHasMore(newRooms.length === pageSize && metadata.hasMore);
      }
    } catch (error) {
      console.error('Load more rooms error:', error);
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
        console.error('Initial fetch failed:', error);
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
      console.log('Network is online');
      setConnectionStatus(CONNECTION_STATUS.CONNECTING);
      lastLoadedPageRef.current = 0;
      setPageIndex(0);
      fetchRooms(false);
    };

    const handleOffline = () => {
      console.log('Network is offline');
      setConnectionStatus(CONNECTION_STATUS.DISCONNECTED);
      setError({
        title: '네트워크 연결 끊김',
        message: '인터넷 연결을 확인해주세요.',
        type: 'danger'
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
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
            console.log('Socket disconnected:', reason);
          },
          error: (error) => {
            console.error('Socket error:', error);
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
        console.error('Socket connection error:', error);
        if (!isSubscribed) return;
        
        if (error.message?.includes('Authentication required') || 
            error.message?.includes('Invalid session')) {
          handleAuthError({ response: { status: 401 } });
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
  }, [currentUser, handleAuthError]);

  const handleJoinRoom = (roomId, hasPassword) => {
    if (hasPassword) {
      setShowPasswordModal(true);
      setCurrentRoomId(roomId);
    } else {
      joinRoom(roomId);
    }
  }

  const joinRoom = async (roomId, password = null) => {
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
        const response = await axiosInstance.post(`/api/rooms/${roomId}/join`, {
          password
        }, {
          timeout: 5000
        });


        if (response?.data?.success) {
          router.push(`/chat?room=${roomId}`);
        }
      } catch (error) {
        console.error('Room join error:', error);

        let errorMessage = '입장에 실패했습니다.';
        if (error.response?.status === 404) {
          errorMessage = '채팅방을 찾을 수 없습니다.';
        } else if (error.response?.status === 403) {
          errorMessage = '채팅방 입장 권한이 없습니다.';
        } else if (error.response?.status === 401) {
          errorMessage = '비밀번호가 틀립니다.';
      setError({
        title: '비밀번호 오류',
        message: errorMessage,
        type: 'danger'
      });
      return;
        }

        setError({
          title: '채팅방 입장 실패',
          message: error.response?.data?.message || errorMessage,
          type: 'danger'
        });
      } finally {
        setJoiningRoom(false);
      }
    }



  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setCurrentRoomId(null);
    setPassword('');
  }

  const renderRoomsTable = () => {
    if (!rooms || rooms.length === 0) return null;
    
    return (
      <StyledTable>
        <StyledTableHead>
          <StyledTableRow>
            <StyledTableHeader width="45%">채팅방</StyledTableHeader>
            <StyledTableHeader width="15%">참여자</StyledTableHeader>
            <StyledTableHeader width="25%">생성일</StyledTableHeader>
            <StyledTableHeader width="15%">액션</StyledTableHeader>
          </StyledTableRow>
        </StyledTableHead>
        <StyledTableBody>
          {rooms.map((room) => (
            <StyledTableRow key={room._id}>
              <StyledTableCell>
                <Text typography="body1" style={{ fontWeight: 500, marginBottom: 'var(--vapor-space-050)' }}>{room.name}</Text>
                {room.hasPassword && (
                  <HStack gap="050" align="center">
                    <LockIcon size={16} style={{ color: 'var(--vapor-color-warning)' }} />
                    <Text typography="body1" style={{ color: 'var(--vapor-color-warning)' }}>비밀번호 필요</Text>
                  </HStack>
                )}
              </StyledTableCell>
              <StyledTableCell>
                <Badge color="primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--vapor-space-100)' }}>
                  <GroupIcon size={16} />
                  <Text typography="body1" style={{ color: 'inherit' }}>{room.participants?.length || 0}</Text>
                </Badge>
              </StyledTableCell>
              <StyledTableCell>
                <Text typography="body1" style={{ color: 'var(--vapor-color-text-muted)' }}>
                  {new Date(room.createdAt).toLocaleString('ko-KR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
              </StyledTableCell>
              <StyledTableCell>
                <Button
                  color="primary"
                  variant="outline"
                  size="md"
                  onClick={() => handleJoinRoom(room._id, room.hasPassword)}
                  disabled={connectionStatus !== CONNECTION_STATUS.CONNECTED}
                >
                  입장
                </Button>
              </StyledTableCell>
            </StyledTableRow>
          ))}
        </StyledTableBody>
      </StyledTable>
    );
  };


  return (
    <div className="auth-container">
      <Modal
        isOpen={showPasswordModal}
        onClose={() => closePasswordModal()}
        size="md"
        title="채팅방 비밀번호 입력"
      >
        <ModalBody>
          <TextInput.Root>
            <TextInput.Field
              style={{ width: '100%' }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  joinRoom(currentRoomId, password);
                }
              }}
              placeholder="비밀번호를 입력하세요"
              type="password"
              autoFocus
            />
          </TextInput.Root>
        </ModalBody>
        <ModalFooter>
          <Button type='button' variant="ghost" onClick={closePasswordModal}>
            닫기
          </Button>
          <Button
            type="submit"
            variant="fill"
            onClick={() => joinRoom(currentRoomId, password)}
          >
            입장
          </Button>
        </ModalFooter>
      </Modal>
      <Card.Root className="chat-rooms-card">
        
        <Card.Body className="card-body">
          <Stack gap="300" align="center">
            <Text typography="heading3">채팅방 목록</Text>

            <TextInput.Root>
              <TextInput.Field
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const keyword = e.currentTarget.value;
                      setSearch(keyword);      // 상태 반영
                      setPageIndex(0);
                      fetchRooms(false, keyword); // 직접 검색어 전달
                    }
                  }}
                  placeholder="채팅방 이름으로 검색"
                  style={{ width: '100%', maxWidth: '320px' }}
              />
            </TextInput.Root>

            <HStack gap="200">
              <Badge
                color={
                  STATUS_CONFIG[connectionStatus].color === 'success'
                    ? 'success'
                    : STATUS_CONFIG[connectionStatus].color === 'warning'
                    ? 'warning'
                    : 'danger'
                }
              >
                {STATUS_CONFIG[connectionStatus].label}
              </Badge>
              {(error || connectionStatus === CONNECTION_STATUS.ERROR) && (
                <Button
                  variant="outline"
                  color="secondary"
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
          </Stack>

          {error && (
            <Box mt="400">
              <Callout
                color={
                  error.type === 'danger'
                    ? 'danger'
                    : error.type === 'warning'
                    ? 'warning'
                    : 'primary'
                }
                className="mb-4"
              >
                <Flex align="flex-start" gap="200">
                  {connectionStatus === CONNECTION_STATUS.ERROR ? (
                    <NetworkIcon size={16} style={{ marginTop: '4px' }} />
                  ) : (
                    <ErrorCircleIcon size={16} style={{ marginTop: '4px' }} />
                  )}
                  <div>
                    <Text typography="subtitle2" style={{ fontWeight: 500 }}>
                      {error.title}
                    </Text>
                    <Text
                      typography="body2"
                      style={{ marginTop: 'var(--vapor-space-050)' }}
                    >
                      {error.message}
                    </Text>
                    {error.showRetry && !isRetrying && (
                      <Button
                        variant="outline"
                        color="secondary"
                        size="sm"
                        style={{ marginTop: 'var(--vapor-space-200)' }}
                        onClick={() => {
                          lastLoadedPageRef.current = 0;
                          setPageIndex(0);
                          fetchRooms(false);
                        }}
                      >
                        다시 시도
                      </Button>
                    )}
                  </div>
                </Flex>
              </Callout>
            </Box>
          )}

          {loading ? (
            <Box mt="400">
              <LoadingIndicator text="채팅방 목록을 불러오는 중..." />
            </Box>
          ) : rooms.length > 0 ? (
            <Box mt="400">
              <TableWrapper
                onScroll={handleLoadMore}
                loadingMore={loadingMore}
                hasMore={hasMore}
                rooms={rooms}
              >
                {renderRoomsTable()}
              </TableWrapper>
            </Box>
          ) : (
            !error && (
              <Box mt="400" style={{ textAlign: 'center' }}>
                <Text
                  typography="body1"
                  style={{ marginBottom: 'var(--vapor-space-400)' }}
                >
                  생성된 채팅방이 없습니다.
                </Text>
                <Button
                  color="primary"
                  onClick={() => router.push('/chat-rooms/new')}
                  disabled={connectionStatus !== CONNECTION_STATUS.CONNECTED}
                >
                  새 채팅방 만들기
                </Button>
              </Box>
            )
          )}
        </Card.Body>
      </Card.Root>

      {joiningRoom && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
        >
          <Stack align="center" gap="300">
            <div
              className="spinner-border spinner-border-lg text-primary"
              role="status"
            >
              <span className="visually-hidden">Loading...</span>
            </div>
            <Text typography="body1" style={{ color: 'white' }}>
              채팅방 입장 중...
            </Text>
          </Stack>
        </div>
      )}
    </div>
  );
}

const ChatRooms = dynamic(() => Promise.resolve(ChatRoomsComponent), {
  ssr: false,
  loading: () => (
    <div className="auth-container">
      <Card.Root className="chat-rooms-card">
        <Card.Body className="card-body">
          <Stack gap="300" align="center">
            <Text typography="heading3">채팅방 목록</Text>
          </Stack>
          <Box mt="400">
            <LoadingIndicator text="로딩 중..." />
          </Box>
        </Card.Body>
      </Card.Root>
    </div>
  )
});

export default withAuth(ChatRooms);