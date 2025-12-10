package com.ktb.chatapp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

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
