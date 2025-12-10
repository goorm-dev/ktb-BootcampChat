package com.ktb.chatapp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FetchMessagesResponse {
    private List<MessageResponse> messages;
    private boolean hasMore;
    
    public long firstMessageTimestamp() {
        return messages.getFirst().getTimestamp();
    }
}
