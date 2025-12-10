package com.ktb.chatapp.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

/**
 * AI 메시지 청크 이벤트
 */
@Getter
public class AiMessageChunkEvent extends ApplicationEvent {
    
    private final String roomId;
    private final String messageId;
    private final String fullContent;
    private final boolean isCodeBlock;
    
    public AiMessageChunkEvent(Object source, String roomId, String messageId,
                               String fullContent, boolean isCodeBlock) {
        super(source);
        this.roomId = roomId;
        this.messageId = messageId;
        this.fullContent = fullContent;
        this.isCodeBlock = isCodeBlock;
    }
}
