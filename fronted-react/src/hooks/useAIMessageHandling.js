import { useState, useCallback } from 'react';
import { Toast } from '../components/Toast';

export const useAIMessageHandling = (
  socketRef,
  setMessages,
  isNearBottom,
  scrollToBottom
) => {
  const [streamingMessages, setStreamingMessages] = useState({});

  const handleAIMessageStart = useCallback((data) => {
    console.log('AI message stream started:', data.messageId);
    
    setStreamingMessages(prev => ({
      ...prev,
      [data.messageId]: {
        _id: data.messageId,
        type: 'ai',
        aiType: data.aiType,
        content: '',
        timestamp: new Date(data.timestamp),
        isStreaming: true
      }
    }));
    scrollToBottom();
  }, [scrollToBottom]);

  const handleAIMessageChunk = useCallback((data) => {
    if (!data.messageId) {
      console.warn('Received AI message chunk without messageId');
      return;
    }

    console.log('AI message chunk received:', {
      messageId: data.messageId,
      chunkLength: data.fullContent?.length,
      isCodeBlock: data.isCodeBlock
    });

    setStreamingMessages(prev => {
      // 해당 메시지 ID가 없는 경우 무시
      if (!prev[data.messageId]) {
        console.warn('No existing streaming message for chunk:', data.messageId);
        return prev;
      }

      return {
        ...prev,
        [data.messageId]: {
          ...prev[data.messageId],
          content: data.fullContent,
          isCodeBlock: data.isCodeBlock
        }
      };
    });

    if (isNearBottom) {
      scrollToBottom();
    }
  }, [isNearBottom, scrollToBottom]);

  const handleAIMessageComplete = useCallback((data) => {
    console.log('AI message stream completed:', data.messageId);

    setStreamingMessages(prev => {
      const { [data.messageId]: completed, ...rest } = prev;
      return rest;
    });

    setMessages(prev => [...prev, {
      _id: data._id,
      type: 'ai',
      aiType: data.aiType,
      content: data.content,
      timestamp: new Date(data.timestamp),
      isComplete: true
    }]);
    
    scrollToBottom();
  }, [setMessages, scrollToBottom]);

  const handleAIMessageError = useCallback((data) => {
    console.error('AI message error:', data);

    setStreamingMessages(prev => {
      const { [data.messageId]: failed, ...rest } = prev;
      return rest;
    });

    Toast.error(`AI 응답 오류: ${data.error}`);
  }, []);

  // Socket.IO 이벤트 리스너 설정 함수
  const setupAIMessageListeners = useCallback(() => {
    if (!socketRef.current) {
      console.warn('Cannot setup AI message listeners: socket not initialized');
      return;
    }

    const socket = socketRef.current;

    // 기존 리스너 제거
    socket.off('aiMessageStart')
          .off('aiMessageChunk')
          .off('aiMessageComplete')
          .off('aiMessageError');

    // 새 리스너 등록
    socket.on('aiMessageStart', handleAIMessageStart);
    socket.on('aiMessageChunk', handleAIMessageChunk);
    socket.on('aiMessageComplete', handleAIMessageComplete);
    socket.on('aiMessageError', handleAIMessageError);

    return () => {
      socket.off('aiMessageStart')
            .off('aiMessageChunk')
            .off('aiMessageComplete')
            .off('aiMessageError');
    };
  }, [
    socketRef,
    handleAIMessageStart,
    handleAIMessageChunk,
    handleAIMessageComplete,
    handleAIMessageError
  ]);

  // AI 메시지 전송 함수
  const sendAIMessage = useCallback(async (aiType, content) => {
    if (!socketRef.current?.connected) {
      throw new Error('Socket not connected');
    }

    try {
      console.log('Sending AI message:', { aiType, content });
      
      socketRef.current.emit('chatMessage', {
        type: 'ai',
        aiType,
        content: content.trim()
      });

    } catch (error) {
      console.error('Send AI message error:', error);
      Toast.error('AI 메시지 전송에 실패했습니다.');
      throw error;
    }
  }, [socketRef]);

  return {
    streamingMessages,
    setStreamingMessages,
    handleAIMessageStart,
    handleAIMessageChunk,
    handleAIMessageComplete,
    handleAIMessageError,
    setupAIMessageListeners,
    sendAIMessage
  };
};

export default useAIMessageHandling;
