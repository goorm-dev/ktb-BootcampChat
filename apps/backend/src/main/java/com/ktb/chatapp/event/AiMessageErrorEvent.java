package com.ktb.chatapp.event;

import com.ktb.chatapp.model.AiType;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

/**
 * AI 메시지 오류 이벤트
 */
@Getter
public class AiMessageErrorEvent extends ApplicationEvent {
    
    private final String roomId;
    private final String messageId;
    private final String errorMessage;
    private final AiType aiType;
    
    public AiMessageErrorEvent(Object source, String roomId, String messageId,
                               String errorMessage, AiType aiType) {
        super(source);
        this.roomId = roomId;
        this.messageId = messageId;
        this.errorMessage = errorMessage;
        this.aiType = aiType;
    }
}
