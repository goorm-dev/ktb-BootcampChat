import React from 'react';
import dynamic from 'next/dynamic';
import { Box, VStack, HStack, Button, Text, Callout, Card } from '@vapor-ui/core';
import { ErrorCircleOutlineIcon, NetworkIcon } from '@vapor-ui/icons';
import { withAuth } from '../../contexts/AuthContext';
import { useChatRoom } from '../../hooks/useChatRoom';
import ChatMessages from '@/components/ChatMessages';
import ChatInput from '@/components/ChatInput';
import ChatRoomInfo from '@/components/ChatRoomInfo';

const ChatPage = () => {
  const {
    room,
    messages,
    streamingMessages,
    connected,
    connectionStatus,
    messageLoadError,
    retryMessageLoad,
    currentUser,
    message,
    showEmojiPicker,
    showMentionList,
    mentionFilter,
    mentionIndex,
    filePreview,
    fileInputRef,
    messageInputRef,
    socketRef,
    handleMessageChange,
    handleMessageSubmit,
    handleEmojiToggle,
    setMessage,
    setShowEmojiPicker,
    setShowMentionList,
    setMentionFilter,
    setMentionIndex,
    handleKeyDown,
    removeFilePreview,
    getFilteredParticipants,
    insertMention,
    loading,
    error,
    handleReactionAdd,
    handleReactionRemove,
    loadingMessages,
    hasMoreMessages,
    handleLoadMore // 페이징 핸들러 추가
  } = useChatRoom();


  const renderLoadingState = () => (
    <div className="chat-container">
      <Card.Root className="chat-room-card">
        <Card.Body style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box style={{ textAlign: 'center', marginTop: 'var(--vapor-space-500)' }}>
            <div className="spinner-border mb-4" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <br/>
            <Text typography="heading5">채팅방 연결 중...</Text>
          </Box>
        </Card.Body>
      </Card.Root>
    </div>
  );

  const renderErrorState = () => (
    <div className="chat-container">
      <Card.Root className="chat-room-card">
        <Card.Body style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Box style={{ marginBottom: 'var(--vapor-space-400)' }}>
            <Callout color="danger">
              <HStack alignItems="center" gap="$200">
                <ErrorCircleOutlineIcon className="w-5 h-5" />
                <Text>
                  {error || '채팅방을 불러오는데 실패했습니다.'}
                </Text>
              </HStack>
            </Callout>
          </Box>
          <Button
            onClick={() => window.location.reload()}
          >
            다시 시도
          </Button>
        </Card.Body>
      </Card.Root>
    </div>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <div className="d-flex align-items-center justify-content-center p-4">
          <div className="spinner-border spinner-border-sm me-2" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <span>채팅방 연결 중...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="d-flex flex-column align-items-center justify-content-center p-4">
          <Callout color="danger" className="mb-4 d-flex align-items-center">
            <ErrorCircleOutlineIcon className="w-5 h-5 me-2" />
            <span>{error}</span>
          </Callout>
          <Button onClick={() => window.location.reload()}>
            다시 시도
          </Button>
        </div>
      );
    }

    if (connectionStatus === 'disconnected') {
      return (
        <Box style={{ margin: 'var(--vapor-space-400)' }}>
          <Callout color="warning" className="d-flex align-items-center">
            <NetworkIcon className="w-5 h-5 me-2" />
            <span>연결이 끊어졌습니다. 재연결을 시도합니다...</span>
          </Callout>
        </Box>
      );
    }

    if (messageLoadError) {
      return (
        <div className="d-flex flex-column align-items-center justify-content-center p-4">
          <Callout color="danger" className="mb-4 d-flex align-items-center">
            <ErrorCircleOutlineIcon className="w-5 h-5 me-2" />
            <span>메시지 로딩 중 오류가 발생했습니다.</span>
          </Callout>
          <Button onClick={retryMessageLoad}>
            메시지 다시 로드
          </Button>
        </div>
      );
    }

    return (
      <ChatMessages
        messages={messages}
        streamingMessages={streamingMessages}
        currentUser={currentUser}
        room={room}
        onReactionAdd={handleReactionAdd}
        onReactionRemove={handleReactionRemove}
        loadingMessages={loadingMessages}
        hasMoreMessages={hasMoreMessages}
        onLoadMore={handleLoadMore}
        socketRef={socketRef}
      />
    );
  };

  if (loading || !room) {
    return renderLoadingState();
  }

  if (error) {
    return renderErrorState();
  }

  return (
    <VStack
      gap="$0"
      // width="100%"
      // maxWidth="1200px"
      height="calc(100vh - 80px"
      margin="0 auto"
      style={{
        backgroundColor: 'var(--vapor-color-surface-normal)'
      }}
    >
      {/* 채팅방 정보 (참여자 목록 및 연결 상태) */}
      <ChatRoomInfo
        room={room}
        connectionStatus={connectionStatus}
      />

      {/* 메시지 영역 */}
      <VStack
        className="flex-1"
        overflow="hidden"
        minHeight="0"
      >
        {renderContent()}
      </VStack>

      {/* 입력 영역 */}
      <ChatInput
        message={message}
        onMessageChange={handleMessageChange}
        onSubmit={handleMessageSubmit}
        onEmojiToggle={handleEmojiToggle}
        fileInputRef={fileInputRef}
        messageInputRef={messageInputRef}
        filePreview={filePreview}
        disabled={connectionStatus !== 'connected'}
        uploading={false}
        showEmojiPicker={showEmojiPicker}
        showMentionList={showMentionList}
        mentionFilter={mentionFilter}
        mentionIndex={mentionIndex}
        getFilteredParticipants={getFilteredParticipants}
        setMessage={setMessage}
        setShowEmojiPicker={setShowEmojiPicker}
        setShowMentionList={setShowMentionList}
        setMentionFilter={setMentionFilter}
        setMentionIndex={setMentionIndex}
        room={room}
        onMentionSelect={(user) => {
          insertMention(user);
          setShowMentionList(false);
        }}
        onFileRemove={removeFilePreview}
      />
    </VStack>
  );
};

const ChatPageWithAuth = withAuth(ChatPage);

export default dynamic(() => Promise.resolve(ChatPageWithAuth), {
  ssr: false
});
