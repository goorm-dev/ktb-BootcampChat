package com.ktb.chatapp.websocket.socketio;

import static com.ktb.chatapp.websocket.socketio.SocketIOEvents.AI_MESSAGE_CHUNK;
import static com.ktb.chatapp.websocket.socketio.SocketIOEvents.AI_MESSAGE_COMPLETE;
import static com.ktb.chatapp.websocket.socketio.SocketIOEvents.AI_MESSAGE_ERROR;
import static com.ktb.chatapp.websocket.socketio.SocketIOEvents.AI_MESSAGE_START;
import static com.ktb.chatapp.websocket.socketio.SocketIOEvents.ROOM_CREATED;
import static com.ktb.chatapp.websocket.socketio.SocketIOEvents.ROOM_UPDATE;

import com.corundumstudio.socketio.SocketIOServer;
import com.ktb.chatapp.event.AiMessageChunkEvent;
import com.ktb.chatapp.event.AiMessageErrorEvent;
import com.ktb.chatapp.event.AiMessageSavedEvent;
import com.ktb.chatapp.event.AiMessageStartEvent;
import com.ktb.chatapp.event.RoomCreatedEvent;
import com.ktb.chatapp.event.RoomUpdatedEvent;
import com.ktb.chatapp.event.SessionEndedEvent;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@ConditionalOnProperty(name = "socketio.enabled", havingValue = "true", matchIfMissing = true)
@RequiredArgsConstructor
public class SocketIOEventListener {

    private final SocketIOServer socketIOServer;

    @EventListener
    public void handleSessionEndedEvent(SessionEndedEvent event) {
        try {
            socketIOServer.getRoomOperations("user:" + event.getUserId())
                    .sendEvent("session_ended", Map.of(
                            "reason", event.getReason(),
                            "message", event.getMessage()
                    ));
            log.info("session_ended 이벤트 발송: userId={}, reason={}", event.getUserId(), event.getReason());
        } catch (Exception e) {
            log.error("session_ended 이벤트 발송 실패: userId={}", event.getUserId(), e);
        }
    }

    @EventListener
    public void handleRoomCreatedEvent(RoomCreatedEvent event) {
        try {
            socketIOServer.getRoomOperations("room-list").sendEvent(ROOM_CREATED, event.getRoomResponse());
            log.info("roomCreated 이벤트 발송: roomId={}", event.getRoomResponse().getId());
        } catch (Exception e) {
            log.error("roomCreated 이벤트 발송 실패", e);
        }
    }

    @EventListener
    public void handleRoomUpdatedEvent(RoomUpdatedEvent event) {
        try {
            socketIOServer.getRoomOperations(event.getRoomId()).sendEvent(ROOM_UPDATE, event.getRoomResponse());
            log.info("roomUpdate 이벤트 발송: roomId={}", event.getRoomId());
        } catch (Exception e) {
            log.error("roomUpdate 이벤트 발송 실패: roomId={}", event.getRoomId(), e);
        }
    }

    @EventListener
    public void handleAiMessageStartEvent(AiMessageStartEvent event) {
        try {
            Map<String, Object> data = Map.of(
                "messageId", event.getMessageId(),
                "aiType", event.getAiType(),
                "timestamp", event.getStartTime()
            );
            socketIOServer.getRoomOperations(event.getRoomId())
                    .sendEvent(AI_MESSAGE_START, data);
            log.info("aiMessageStart 이벤트 발송: roomId={}, messageId={}",
                    event.getRoomId(), event.getMessageId());
        } catch (Exception e) {
            log.error("aiMessageStart 이벤트 발송 실패: roomId={}", event.getRoomId(), e);
        }
    }

    @EventListener
    public void handleAiMessageChunkEvent(AiMessageChunkEvent event) {
        try {
            Map<String, Object> data = Map.of(
                "messageId", event.getMessageId(),
                "fullContent", event.getFullContent(),
                "isCodeBlock", event.isCodeBlock(),
                "isComplete", false
            );
            socketIOServer.getRoomOperations(event.getRoomId())
                    .sendEvent(AI_MESSAGE_CHUNK, data);
        } catch (Exception e) {
            log.error("aiMessageChunk 이벤트 발송 실패: roomId={}", event.getRoomId(), e);
        }
    }

    @EventListener
    public void handleAiMessageCompleteEvent(AiMessageSavedEvent event) {
        
        try {
            Map<String, Object> data = Map.of(
                "_id", event.getSavedMessageId(),
                "content", event.getContent(),
                "aiType", event.getAiType(),
                "timestamp", event.getStartTime()
            );
            socketIOServer.getRoomOperations(event.getRoomId())
                    .sendEvent(AI_MESSAGE_COMPLETE, data);
            log.info("aiMessageComplete 이벤트 발송: roomId={}, messageId={}",
                    event.getRoomId(), event.getSavedMessageId());
        } catch (Exception e) {
            log.error("aiMessageComplete 이벤트 발송 실패: roomId={}", event.getRoomId(), e);
        }
    }

    @EventListener
    public void handleAiMessageErrorEvent(AiMessageErrorEvent event) {
        try {
            Map<String, Object> data = Map.of(
                "messageId", event.getMessageId(),
                "error", event.getErrorMessage(),
                "aiType", event.getAiType()
            );
            socketIOServer.getRoomOperations(event.getRoomId())
                    .sendEvent(AI_MESSAGE_ERROR, data);
            log.error("aiMessageError 이벤트 발송: roomId={}, messageId={}, error={}",
                    event.getRoomId(), event.getMessageId(), event.getErrorMessage());
        } catch (Exception e) {
            log.error("aiMessageError 이벤트 발송 실패: roomId={}", event.getRoomId(), e);
        }
    }
}
