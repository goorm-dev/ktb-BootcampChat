package com.ktb.chatapp.dto;

import java.util.Map;
import java.util.Set;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MessageReactionResponse {
    private String messageId;
    private Map<String, Set<String>> reactions;
}
