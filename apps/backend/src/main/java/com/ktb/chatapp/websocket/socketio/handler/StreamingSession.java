package com.ktb.chatapp.websocket.socketio.handler;

import com.ktb.chatapp.model.AiType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Slf4j
public class StreamingSession {
    private String messageId;
    private String roomId;
    private String userId;
    private String aiType;
    private String query;
    private long timestamp;
    @Builder.Default
    private long lastUpdate = System.currentTimeMillis();
    @Builder.Default
    private String content = "";

    public AiType aiTypeEnum() {
        if (aiType == null) return null;

        var aiTypeEnum = switch (aiType.toLowerCase()) {
            case "wayneai" -> AiType.WAYNE_AI; // wayneAI는 GPT로 매핑
            case "consultingai" -> AiType.CONSULTING_AI; // consultingAI는 Claude로 매핑
            default -> null;
        };
        if (aiTypeEnum == null) {
            log.warn("Unknown AI type: {}", aiType);
        }
        return aiTypeEnum;
    }

    public void appendContent(String contentChunk) {
        content += contentChunk;
        lastUpdate = System.currentTimeMillis();
    }
    
    public long generationTimeMillis() {
        return System.currentTimeMillis() - timestamp;
    }
}
