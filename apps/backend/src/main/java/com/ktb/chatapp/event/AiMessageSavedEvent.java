package com.ktb.chatapp.event;

import com.ktb.chatapp.model.AiType;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

/**
 * AI 메시지 완료 이벤트
 */
@Getter
public class AiMessageSavedEvent extends ApplicationEvent {
    
    private final String roomId;
    private final String content;
    private final AiType aiType;
    private final long startTime;
    private final String savedMessageId;
    
    public AiMessageSavedEvent(Object source, AiMessageCompleteEvent event, String savedMessageId) {
        super(source);
        this.roomId = event.getRoomId();
        this.content = event.getContent();
        this.aiType = event.getAiType();
        this.startTime = event.getStartTime();
        this.savedMessageId = savedMessageId;
    }
}
