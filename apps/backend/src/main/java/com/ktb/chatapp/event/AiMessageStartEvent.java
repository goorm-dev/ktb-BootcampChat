package com.ktb.chatapp.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

/**
 * AI 메시지 스트리밍 시작 이벤트
 */
@Getter
public class AiMessageStartEvent extends ApplicationEvent {
    
    private final String roomId;
    private final String messageId;
    private final String aiType;
    private final long startTime;
    
    public AiMessageStartEvent(Object source, String roomId, String messageId, String aiType, long timestamp) {
        super(source);
        this.roomId = roomId;
        this.messageId = messageId;
        this.aiType = aiType;
        this.startTime = timestamp;
    }
}
