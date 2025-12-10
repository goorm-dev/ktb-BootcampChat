package com.ktb.chatapp.websocket.socketio.ai;

import com.ktb.chatapp.dto.MessageContent;
import com.ktb.chatapp.event.AiMessageCompleteEvent;
import com.ktb.chatapp.event.AiMessageSavedEvent;
import com.ktb.chatapp.event.AiMessageStartEvent;
import com.ktb.chatapp.model.AiType;
import com.ktb.chatapp.model.Message;
import com.ktb.chatapp.model.MessageType;
import com.ktb.chatapp.repository.MessageRepository;
import com.ktb.chatapp.websocket.socketio.handler.StreamingSession;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

/**
 * AI 서비스 구현체
 * Spring AI ChatClient를 사용한 스트리밍 응답 생성
 */
@Slf4j
@Service
@ConditionalOnProperty(name = "socketio.enabled", havingValue = "true", matchIfMissing = true)
public class AiService {

    private final ChatClient chatClient;
    private final ApplicationEventPublisher eventPublisher;
    private final MessageRepository messageRepository;

    public AiService(
            ChatClient.Builder chatClientBuilder,
            ApplicationEventPublisher eventPublisher,
            MessageRepository messageRepository) {
        this.chatClient = chatClientBuilder.build();
        this.eventPublisher = eventPublisher;
        this.messageRepository = messageRepository;
    }

    public void handleAIMentions(String roomId, String userId, MessageContent messageContent) {
        for (String aiType : messageContent.aiMentions()) {
            String query = messageContent.getQueryWithoutMention(aiType);
            startStreaming(roomId, userId, aiType, query);
        }
    }

    private void startStreaming(String roomId, String userId, String aiType, String query) {
        
        // AI 스트리밍 세션 생성 - messageId는 타입과 타임스탬프 조합
        var timestamp = System.currentTimeMillis();
        String messageId = aiType + "-" + timestamp;

        log.info("AI response started - messageId: {}, room: {}, aiType: {}, query: {}",
            messageId, roomId, aiType, query);
        
        // AI 스트리밍 시작 이벤트 발행
        eventPublisher.publishEvent(new AiMessageStartEvent(
            this, roomId, messageId, aiType, timestamp
        ));
        
        // 스트리밍 세션 초기화
        StreamingSession session = StreamingSession.builder()
            .messageId(messageId)
            .roomId(roomId)
            .userId(userId)
            .aiType(aiType)
            .timestamp(timestamp)
            .query(query)
            .build();
        
        
        streamResponse(session)
                .subscribe(new AiStreamHandler(session, eventPublisher));
    }

    Flux<ChunkData> streamResponse(StreamingSession session) {
        return Flux.defer(() -> {
            AiType aiType = session.aiTypeEnum();
            String query = session.getQuery();
            if (aiType == null) {
                return Flux.error(new IllegalArgumentException("Unknown AI persona"));
            }

            Flux<String> contentStream = chatClient.prompt()
                    .system(aiType.getSystemPrompt())
                    .user(query)
                    .stream()
                    .content();

            AtomicBoolean codeBlockState = new AtomicBoolean(false);

            return contentStream
                    .filter(chunk -> chunk != null && !chunk.isBlank())
                    .map(chunk -> ChunkData.from(chunk).updateCodeBlockState(codeBlockState))
                    .doOnSubscribe(subscription -> log.info(
                            "Starting AI streaming response - aiType: {}, query: {}",
                            aiType, query))
                    .doOnError(error -> log.error("Streaming error received from Spring AI", error));
        });
    }

    @EventListener
    public void onAiMessageCompleteEvent(AiMessageCompleteEvent event) {
        try {
            // 메시지 저장
            Message savedMessage = messageRepository.save(getMessage(event));
            log.info("AI message saved - messageId: {}, savedId: {}, roomId: {}",
                event.getMessageId(), savedMessage.getId(), event.getRoomId());

            // savedMessageId를 포함한 새로운 이벤트 발행
            eventPublisher.publishEvent(new AiMessageSavedEvent(
                this, event, savedMessage.getId()
            ));
        } catch (Exception e) {
            log.error("Failed to save AI message - messageId: {}, roomId: {}",
                event.getMessageId(), event.getRoomId(), e);
        }
    }
    
    private Message getMessage(AiMessageCompleteEvent event) {
        Message aiMessage = new Message();
        aiMessage.setRoomId(event.getRoomId());
        aiMessage.setContent(event.getContent());
        aiMessage.setType(MessageType.ai);
        aiMessage.setAiType(event.getAiType());
        aiMessage.setTimestamp(event.getStartDateTime());
        
        Map<String, Object> metadata = Map.of(
                "query", event.getQuery(),
                "generationTime", event.getGenerationTime()
        );
        aiMessage.setMetadata(metadata);
        return aiMessage;
    }
}
