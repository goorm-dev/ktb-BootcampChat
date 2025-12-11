import { useState, useCallback, useRef } from 'react';
import { Toast } from '../components/Toast';
import fileService from '../services/fileService';

export const useMessageHandling = (socketRef, currentUser, router, handleSessionError, messages = [], loadingMessages = false, setLoadingMessages) => {
    const [message, setMessage] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showMentionList, setShowMentionList] = useState(false);
    const [mentionFilter, setMentionFilter] = useState('');
    const [mentionIndex, setMentionIndex] = useState(0);
    const [filePreview, setFilePreview] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadError, setUploadError] = useState(null);
    const sendLockRef = useRef(false);

    const handleMessageChange = useCallback((e) => {
        const newValue = e.target.value;
        setMessage(newValue);

        const cursorPosition = e.target.selectionStart;
        const textBeforeCursor = newValue.slice(0, cursorPosition);
        const atSymbolIndex = textBeforeCursor.lastIndexOf('@');

        if (atSymbolIndex !== -1) {
            const mentionText = textBeforeCursor.slice(atSymbolIndex + 1);
            if (!mentionText.includes(' ')) {
                setMentionFilter(mentionText.toLowerCase());
                setShowMentionList(true);
                setMentionIndex(0);
                return;
            }
        }

        setShowMentionList(false);
    }, []);

    const handleLoadMore = useCallback(() => {
        if (!socketRef.current?.connected) {
            return;
        }

        if (loadingMessages) {
            return;
        }

        // 가장 오래된 메시지의 타임스탬프 찾기
        const sortedMessages = [...messages].sort(
            (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );
        const oldestMessage = sortedMessages[0];
        const beforeTimestamp = oldestMessage?.timestamp;

        if (!beforeTimestamp) {
            return;
        }

        setLoadingMessages(true);

        // Socket.IO 이벤트만 발행 - 응답은 useChatRoom의 previousMessages 이벤트 핸들러에서 처리
        socketRef.current.emit('fetchPreviousMessages', {
            roomId: router?.query?.room,
            before: beforeTimestamp,
            limit: 30
        });
    }, [socketRef, router?.query?.room, loadingMessages, messages, setLoadingMessages]);

    const handleMessageSubmit = useCallback(async (messageData) => {
        if (sendLockRef.current) {
            return;
        }
        sendLockRef.current = true;
        setTimeout(() => {
            sendLockRef.current = false;
        }, 200);

        if (!socketRef.current?.connected || !currentUser) {
            Toast.error('채팅 서버와 연결이 끊어졌습니다.');
            return;
        }

        const roomId = router?.query?.room;
        if (!roomId) {
            Toast.error('채팅방 정보를 찾을 수 없습니다.');
            return;
        }

        try {
            console.debug('[emit chatMessage]', {
                room: roomId,
                type: messageData.type,
                content: messageData.content,
                hasFile: messageData.type === 'file'
            });

            if (messageData.type === 'file') {
                setUploading(true);
                setUploadError(null);
                setUploadProgress(0);

                const uploadResponse = await fileService.uploadFile(
                    messageData.fileData.file,
                    (progress) => setUploadProgress(progress),
                    currentUser.token,
                    currentUser.sessionId
                );

                if (!uploadResponse.success) {
                    throw new Error(uploadResponse.message || '파일 업로드에 실패했습니다.');
                }

                socketRef.current.emit('chatMessage', {
                    room: roomId,
                    type: 'file',
                    content: messageData.content || '',
                    fileData: {
                        _id: uploadResponse.data.file._id,
                        filename: uploadResponse.data.file.filename,
                        originalname: uploadResponse.data.file.originalname,
                        mimetype: uploadResponse.data.file.mimetype,
                        size: uploadResponse.data.file.size
                    }
                });

                setFilePreview(null);
                setMessage('');
                setUploading(false);
                setUploadProgress(0);

            } else if (messageData.content?.trim()) {
                socketRef.current.emit('chatMessage', {
                    room: roomId,
                    type: 'text',
                    content: messageData.content.trim()
                });

                setMessage('');
            }

            setShowEmojiPicker(false);
            setShowMentionList(false);

        } catch (error) {
            if (error.message?.includes('세션') ||
                error.message?.includes('인증') ||
                error.message?.includes('토큰')) {
                await handleSessionError();
                return;
            }

            Toast.error(error.message || '메시지 전송 중 오류가 발생했습니다.');
            if (messageData.type === 'file') {
                setUploadError(error.message);
                setUploading(false);
            }
        }
    }, [currentUser, router, handleSessionError, socketRef]);

    const handleEmojiToggle = useCallback(() => {
        setShowEmojiPicker(prev => !prev);
    }, []);

    const getFilteredParticipants = useCallback((room) => {
        if (!room?.participants) return [];

        return room.participants.filter(user =>
            user.name.toLowerCase().includes(mentionFilter) ||
            user.email.toLowerCase().includes(mentionFilter)
        );
    }, [mentionFilter]);

    const insertMention = useCallback((messageInputRef, user) => {
        if (!messageInputRef?.current) return;

        const cursorPosition = messageInputRef.current.selectionStart;
        const textBeforeCursor = message.slice(0, cursorPosition);
        const atSymbolIndex = textBeforeCursor.lastIndexOf('@');

        if (atSymbolIndex !== -1) {
            const textBeforeAt = message.slice(0, atSymbolIndex);
            const newMessage =
                textBeforeAt +
                `@${user.name} ` +
                message.slice(cursorPosition);

            setMessage(newMessage);
            setShowMentionList(false);

            setTimeout(() => {
                const newPosition = atSymbolIndex + user.name.length + 2;
                messageInputRef.current.focus();
                messageInputRef.current.setSelectionRange(newPosition, newPosition);
            }, 0);
        }
    }, [message]);

    const removeFilePreview = useCallback(() => {
        setFilePreview(null);
        setUploadError(null);
        setUploadProgress(0);
    }, []);

    return {
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
        handleEmojiToggle,
        handleLoadMore,
        getFilteredParticipants,
        insertMention,
        removeFilePreview
    };
};

export default useMessageHandling;
