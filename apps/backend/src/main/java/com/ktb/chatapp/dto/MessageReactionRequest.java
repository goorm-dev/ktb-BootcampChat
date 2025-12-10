package com.ktb.chatapp.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MessageReactionRequest {
    @NotBlank
    private String emoji;

    // WebSocket에서 사용하는 추가 필드들
    private String messageId;
    private String type; // "add" 또는 "remove"
    private String reaction; // emoji와 동일한 용도

    // 호환성을 위한 getter 메서드들
    public String getReaction() {
        return reaction != null ? reaction : emoji;
    }
}
