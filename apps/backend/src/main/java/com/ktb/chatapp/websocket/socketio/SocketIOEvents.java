package com.ktb.chatapp.websocket.socketio;

public final class SocketIOEvents {

    private SocketIOEvents() {
        // 유틸리티 클래스 - 인스턴스 생성 방지
        throw new AssertionError("Cannot instantiate SocketIOEvents");
    }

    // ============================================
    // Client → Server Events (수신 이벤트)
    // ============================================

    /**
     * 채팅 메시지 전송
     * Payload: { room, type, content, fileData }
     */
    public static final String CHAT_MESSAGE = "chatMessage";

    /**
     * 채팅방 입장
     * Payload: roomId (String)
     */
    public static final String JOIN_ROOM = "joinRoom";

    /**
     * 채팅방 퇴장
     * Payload: roomId (String)
     */
    public static final String LEAVE_ROOM = "leaveRoom";

    /**
     * 이전 메시지 로드 요청
     * Payload: { roomId, before }
     */
    public static final String FETCH_PREVIOUS_MESSAGES = "fetchPreviousMessages";

    /**
     * 메시지 읽음 처리
     * Payload: { roomId, messageIds }
     */
    public static final String MARK_MESSAGES_AS_READ = "markMessagesAsRead";

    /**
     * 메시지 리액션 추가/제거
     * Payload: { messageId, reaction, type }
     */
    public static final String MESSAGE_REACTION = "messageReaction";
    
    // ============================================
    // Server → Client Events (전송 이벤트)
    // ============================================

    /**
     * 새로운 메시지 브로드캐스트
     * Payload: MessageResponse
     */
    public static final String MESSAGE = "message";

    /**
     * 에러 알림
     * Payload: { code, message }
     */
    public static final String ERROR = "error";

    /**
     * 채팅방 입장 성공
     * Payload: JoinRoomSuccessResponse
     */
    public static final String JOIN_ROOM_SUCCESS = "joinRoomSuccess";

    /**
     * 채팅방 입장 실패
     * Payload: { message }
     */
    public static final String JOIN_ROOM_ERROR = "joinRoomError";

    /**
     * 이전 메시지 로드 완료
     * Payload: { messages, hasMore, oldestTimestamp }
     */
    public static final String PREVIOUS_MESSAGES_LOADED = "previousMessagesLoaded";

    /**
     * 메시지 로드 시작
     */
    public static final String MESSAGE_LOAD_START = "messageLoadStart";

    /**
     * 참가자 업데이트
     * Payload: List<UserDto>
     */
    public static final String PARTICIPANTS_UPDATE = "participantsUpdate";

    /**
     * 채팅방 생성 알림
     * Payload: RoomResponse
     */
    public static final String ROOM_CREATED = "roomCreated";

    /**
     * 채팅방 정보 업데이트
     * Payload: RoomResponse
     */
    public static final String ROOM_UPDATE = "roomUpdated";
    
    /**
     * 채팅방 정보 업데이트
     * Payload: roomId
     */
    public static final String ROOM_DELETED = "roomDeleted";
    
    /**
     * 사용자 퇴장 알림
     * Payload: { userId, name }
     */
    public static final String USER_LEFT = "userLeft";

    /**
     * 메시지 읽음 상태 업데이트
     * Payload: { userId, messageIds }
     */
    public static final String MESSAGES_READ = "messagesRead";

    /**
     * 메시지 리액션 업데이트
     * Payload: { messageId, reactions }
     */
    public static final String MESSAGE_REACTION_UPDATE = "messageReactionUpdate";

    /**
     * 중복 로그인 감지
     * Payload: { type, deviceInfo, ipAddress, timestamp }
     */
    public static final String DUPLICATE_LOGIN = "duplicate_login";

    /**
     * 세션 종료 알림
     * Payload: { reason, message }
     */
    public static final String SESSION_ENDED = "session_ended";


    // ============================================
    // AI Streaming Events
    // ============================================

    /**
     * AI 스트리밍 시작
     * Payload: { messageId, aiType, timestamp }
     */
    public static final String AI_MESSAGE_START = "aiMessageStart";

    /**
     * AI 스트리밍 청크
     * Payload: { messageId, currentChunk, fullContent, isCodeBlock, timestamp, aiType, isComplete }
     */
    public static final String AI_MESSAGE_CHUNK = "aiMessageChunk";

    /**
     * AI 스트리밍 완료
     * Payload: { messageId, _id, content, aiType, timestamp, isComplete, query, reactions }
     */
    public static final String AI_MESSAGE_COMPLETE = "aiMessageComplete";

    /**
     * AI 스트리밍 에러
     * Payload: { messageId, error, aiType }
     */
    public static final String AI_MESSAGE_ERROR = "aiMessageError";
}
