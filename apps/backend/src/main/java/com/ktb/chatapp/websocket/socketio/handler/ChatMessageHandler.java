package com.ktb.chatapp.websocket.socketio.handler;

import com.corundumstudio.socketio.SocketIOClient;
import com.corundumstudio.socketio.SocketIOServer;
import com.corundumstudio.socketio.annotation.OnEvent;
import com.ktb.chatapp.dto.ChatMessageRequest;
import com.ktb.chatapp.dto.FileResponse;
import com.ktb.chatapp.dto.MessageContent;
import com.ktb.chatapp.dto.MessageResponse;
import com.ktb.chatapp.dto.UserResponse;
import com.ktb.chatapp.model.*;
import com.ktb.chatapp.repository.FileRepository;
import com.ktb.chatapp.repository.MessageRepository;
import com.ktb.chatapp.repository.RoomRepository;
import com.ktb.chatapp.repository.UserRepository;
import com.ktb.chatapp.util.BannedWordChecker;
import com.ktb.chatapp.websocket.socketio.ai.AiService;
import com.ktb.chatapp.service.SessionService;
import com.ktb.chatapp.service.SessionValidationResult;
import com.ktb.chatapp.service.RateLimitService;
import com.ktb.chatapp.service.RateLimitCheckResult;
import com.ktb.chatapp.websocket.socketio.SocketUser;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import static com.ktb.chatapp.websocket.socketio.SocketIOEvents.*;

@Slf4j
@Component
@ConditionalOnProperty(name = "socketio.enabled", havingValue = "true", matchIfMissing = true)
@RequiredArgsConstructor
public class ChatMessageHandler {
    private final SocketIOServer socketIOServer;
    private final MessageRepository messageRepository;
    private final RoomRepository roomRepository;
    private final UserRepository userRepository;
    private final FileRepository fileRepository;
    private final AiService aiService;
    private final SessionService sessionService;
    private final BannedWordChecker bannedWordChecker;
    private final RateLimitService rateLimitService;
    private final MeterRegistry meterRegistry;
    
    @OnEvent(CHAT_MESSAGE)
    public void handleChatMessage(SocketIOClient client, ChatMessageRequest data) {
        Timer.Sample timerSample = Timer.start(meterRegistry);

        if (data == null) {
            recordError("null_data");
            client.sendEvent(ERROR, Map.of(
                    "code", "MESSAGE_ERROR",
                    "message", "메시지 데이터가 없습니다."
            ));
            timerSample.stop(createTimer("error", "null_data"));
            return;
        }

        var socketUser = (SocketUser) client.get("user");

        if (socketUser == null) {
            recordError("session_null");
            client.sendEvent(ERROR, Map.of(
                    "code", "SESSION_EXPIRED",
                    "message", "세션이 만료되었습니다. 다시 로그인해주세요."
            ));
            timerSample.stop(createTimer("error", "session_null"));
            return;
        }

        SessionValidationResult validation =
                sessionService.validateSession(socketUser.id(), socketUser.authSessionId());
        if (!validation.isValid()) {
            recordError("session_expired");
            client.sendEvent(ERROR, Map.of(
                    "code", "SESSION_EXPIRED",
                    "message", "세션이 만료되었습니다. 다시 로그인해주세요."
            ));
            timerSample.stop(createTimer("error", "session_expired"));
            return;
        }

        // Rate limit check
        RateLimitCheckResult rateLimitResult =
                rateLimitService.checkRateLimit(socketUser.id(), 10000, Duration.ofMinutes(1));
        if (!rateLimitResult.allowed()) {
            recordError("rate_limit_exceeded");
            Counter.builder("socketio.messages.rate_limit")
                    .description("Socket.IO rate limit exceeded count")
                    .register(meterRegistry)
                    .increment();
            client.sendEvent(ERROR, Map.of(
                    "code", "RATE_LIMIT_EXCEEDED",
                    "message", "메시지 전송 횟수 제한을 초과했습니다. 잠시 후 다시 시도해주세요.",
                    "retryAfter", rateLimitResult.retryAfterSeconds()
            ));
            log.warn("Rate limit exceeded for user: {}, retryAfter: {}s",
                    socketUser.id(), rateLimitResult.retryAfterSeconds());
            timerSample.stop(createTimer("error", "rate_limit"));
            return;
        }
        
        try {
            User sender = userRepository.findById(socketUser.id()).orElse(null);
            if (sender == null) {
                recordError("user_not_found");
                client.sendEvent(ERROR, Map.of(
                    "code", "MESSAGE_ERROR",
                    "message", "User not found"
                ));
                timerSample.stop(createTimer("error", "user_not_found"));
                return;
            }

            String roomId = data.getRoom();
            Room room = roomRepository.findById(roomId).orElse(null);
            if (room == null || !room.getParticipantIds().contains(socketUser.id())) {
                recordError("room_access_denied");
                client.sendEvent(ERROR, Map.of(
                    "code", "MESSAGE_ERROR",
                    "message", "채팅방 접근 권한이 없습니다."
                ));
                timerSample.stop(createTimer("error", "room_access_denied"));
                return;
            }

            MessageContent messageContent = data.getParsedContent();

            log.debug("Message received - type: {}, room: {}, userId: {}, hasFileData: {}",
                data.getMessageType(), roomId, socketUser.id(), data.hasFileData());

            if (bannedWordChecker.containsBannedWord(messageContent.getTrimmedContent())) {
                recordError("banned_word");
                client.sendEvent(ERROR, Map.of(
                        "code", "MESSAGE_REJECTED",
                        "message", "금칙어가 포함된 메시지는 전송할 수 없습니다."
                ));
                timerSample.stop(createTimer("error", "banned_word"));
                return;
            }

            String messageType = data.getMessageType();
            Message message = switch (messageType) {
                case "file" -> handleFileMessage(roomId, socketUser.id(), messageContent, data.getFileData());
                case "text" -> handleTextMessage(roomId, socketUser.id(), messageContent);
                default -> throw new IllegalArgumentException("Unsupported message type: " + messageType);
            };

            if (message == null) {
                log.warn("Empty message - ignoring. room: {}, userId: {}, messageType: {}", roomId, socketUser.id(), messageType);
                timerSample.stop(createTimer("ignored", messageType));
                return;
            }

            Message savedMessage = messageRepository.save(message);

            socketIOServer.getRoomOperations(roomId)
                    .sendEvent(MESSAGE, createMessageResponse(savedMessage, sender));

            // AI 멘션 처리
            aiService.handleAIMentions(roomId, socketUser.id(), messageContent);

            sessionService.updateLastActivity(socketUser.id());

            // Record success metrics
            recordMessageSuccess(messageType);
            timerSample.stop(createTimer("success", messageType));

            log.debug("Message processed - messageId: {}, type: {}, room: {}",
                savedMessage.getId(), savedMessage.getType(), roomId);

        } catch (Exception e) {
            recordError("exception");
            log.error("Message handling error", e);
            client.sendEvent(ERROR, Map.of(
                "code", "MESSAGE_ERROR",
                "message", e.getMessage() != null ? e.getMessage() : "메시지 전송 중 오류가 발생했습니다."
            ));
            timerSample.stop(createTimer("error", "exception"));
        }
    }

    private Message handleFileMessage(String roomId, String userId, MessageContent messageContent, Map<String, Object> fileData) {
        if (fileData == null || fileData.get("_id") == null) {
            throw new IllegalArgumentException("파일 데이터가 올바르지 않습니다.");
        }

        String fileId = (String) fileData.get("_id");
        File file = fileRepository.findById(fileId).orElse(null);

        if (file == null || !file.getUser().equals(userId)) {
            throw new IllegalStateException("파일을 찾을 수 없거나 접근 권한이 없습니다.");
        }

        Message message = new Message();
        message.setRoomId(roomId);
        message.setSenderId(userId);
        message.setType(MessageType.file);
        message.setFileId(fileId);
        message.setContent(messageContent.getTrimmedContent());
        message.setTimestamp(LocalDateTime.now());
        message.setMentions(messageContent.aiMentions());
        
        // 메타데이터는 Map<String, Object>
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("fileType", file.getMimetype());
        metadata.put("fileSize", file.getSize());
        metadata.put("originalName", file.getOriginalname());
        message.setMetadata(metadata);

        return message;
    }

    private Message handleTextMessage(String roomId, String userId, MessageContent messageContent) {
        if (messageContent.isEmpty()) {
            return null; // 빈 메시지는 무시
        }

        Message message = new Message();
        message.setRoomId(roomId);
        message.setSenderId(userId);
        message.setContent(messageContent.getTrimmedContent());
        message.setType(MessageType.text);
        message.setTimestamp(LocalDateTime.now());
        message.setMentions(messageContent.aiMentions());

        return message;
    }

    private MessageResponse createMessageResponse(Message message, User sender) {
        var messageResponse = new MessageResponse();
        messageResponse.setId(message.getId());
        messageResponse.setRoomId(message.getRoomId());
        messageResponse.setContent(message.getContent());
        messageResponse.setType(message.getType());
        messageResponse.setTimestamp(message.toTimestampMillis());
        messageResponse.setReactions(message.getReactions() != null ? message.getReactions() : Collections.emptyMap());
        messageResponse.setSender(UserResponse.from(sender));
        messageResponse.setMetadata(message.getMetadata());

        if (message.getFileId() != null) {
            fileRepository.findById(message.getFileId())
                    .ifPresent(file -> messageResponse.setFile(FileResponse.from(file)));
        }

        return messageResponse;
    }

    // Metrics helper methods
    private Timer createTimer(String status, String messageType) {
        return Timer.builder("socketio.messages.processing.time")
                .description("Socket.IO message processing time")
                .tag("status", status)
                .tag("message_type", messageType)
                .register(meterRegistry);
    }

    private void recordMessageSuccess(String messageType) {
        Counter.builder("socketio.messages.total")
                .description("Total Socket.IO messages processed")
                .tag("status", "success")
                .tag("message_type", messageType)
                .register(meterRegistry)
                .increment();
    }

    private void recordError(String errorType) {
        Counter.builder("socketio.messages.errors")
                .description("Socket.IO message processing errors")
                .tag("error_type", errorType)
                .register(meterRegistry)
                .increment();
    }
}
