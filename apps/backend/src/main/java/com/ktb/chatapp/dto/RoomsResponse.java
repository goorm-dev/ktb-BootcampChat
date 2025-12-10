package com.ktb.chatapp.dto;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomsResponse {
    private boolean success = true;
    private List<RoomResponse> data;
    private PageMetadata metadata;
}
