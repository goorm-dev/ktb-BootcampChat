package com.ktb.chatapp.dto;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * joinRoomSuccess 이벤트 응답 DTO.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JoinRoomSuccessResponse {
    private String roomId;
    private List<UserResponse> participants;
    private List<MessageResponse> messages;
    private boolean hasMore;
    private List<ActiveStreamResponse> activeStreams;
}
