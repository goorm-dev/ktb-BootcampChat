package com.ktb.chatapp.event;

import com.ktb.chatapp.model.AiType;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

/**
 * AI 메시지 완료 이벤트
 */
@Getter
public class AiMessageCompleteEvent extends ApplicationEvent {
    
    private final String roomId;
    private final String messageId;
    private final String content;
    private final AiType aiType;
    private final long startTime;
    private final String query;
    private final long generationTime;
    
    public AiMessageCompleteEvent(Object source, String roomId, String messageId,
                                  String content, AiType aiType, long timestamp, String query,
                                  long generationTime) {
        super(source);
        this.roomId = roomId;
        this.messageId = messageId;
        this.content = content;
        this.aiType = aiType;
        this.startTime = timestamp;
        this.query = query;
        this.generationTime = generationTime;
    }
    
    public LocalDateTime getStartDateTime() {
        return LocalDateTime.ofInstant(
            Instant.ofEpochMilli(startTime),
            ZoneId.systemDefault()
        );
    }
}
