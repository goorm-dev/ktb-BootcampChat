// hooks/useReactionHandling.js

import { useCallback, useState } from 'react';
import { Toast } from '../components/Toast';

export const useReactionHandling = (socketRef, currentUser, messages, setMessages) => {
  const [pendingReactions] = useState(new Map());

  const handleReactionAdd = useCallback(async (messageId, reaction) => {
    try {
      if (!socketRef.current?.connected) {
        throw new Error('Socket not connected');
      }

      // 낙관적 업데이트
      setMessages(prevMessages => 
        prevMessages.map(msg => {
          if (msg.id === messageId) {
            const currentReactions = msg.reactions || {};
            const currentUsers = currentReactions[reaction] || [];
            
            // 중복 추가 방지
            if (!currentUsers.includes(currentUser.id)) {
              return {
                ...msg,
                reactions: {
                  ...currentReactions,
                  [reaction]: [...currentUsers, currentUser.id]
                }
              };
            }
          }
          return msg;
        })
      );

      await socketRef.current.emit('messageReaction', {
        messageId,
        reaction,
        type: 'add'
      });

    } catch (error) {
      console.error('Add reaction error:', error);
      Toast.error('리액션 추가에 실패했습니다.');

      // 실패 시 롤백
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === messageId ? 
          { ...msg, reactions: messages.find(m => m.id === messageId)?.reactions || {} } : 
          msg
        )
      );
    }
  }, [socketRef, currentUser, messages, setMessages]);

  const handleReactionRemove = useCallback(async (messageId, reaction) => {
    try {
      if (!socketRef.current?.connected) {
        throw new Error('Socket not connected');
      }

      // 낙관적 업데이트
      setMessages(prevMessages => 
        prevMessages.map(msg => {
          if (msg.id === messageId) {
            const currentReactions = msg.reactions || {};
            const currentUsers = currentReactions[reaction] || [];
            return {
              ...msg,
              reactions: {
                ...currentReactions,
                [reaction]: currentUsers.filter(id => id !== currentUser.id)
              }
            };
          }
          return msg;
        })
      );

      await socketRef.current.emit('messageReaction', {
        messageId,
        reaction,
        type: 'remove'
      });

    } catch (error) {
      console.error('Remove reaction error:', error);
      Toast.error('리액션 제거에 실패했습니다.');

      // 실패 시 롤백
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === messageId ? 
          { ...msg, reactions: messages.find(m => m.id === messageId)?.reactions || {} } : 
          msg
        )
      );
    }
  }, [socketRef, currentUser, messages, setMessages]);

  const handleReactionUpdate = useCallback(({ messageId, reactions }) => {
    setMessages(prevMessages => 
      prevMessages.map(msg => 
        msg.id === messageId ? { ...msg, reactions } : msg
      )
    );
  }, [setMessages]);

  return {
    handleReactionAdd,
    handleReactionRemove,
    handleReactionUpdate
  };
};

export default useReactionHandling;