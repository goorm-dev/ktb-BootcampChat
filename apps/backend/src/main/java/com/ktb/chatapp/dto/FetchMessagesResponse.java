package com.ktb.chatapp.dto;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

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
