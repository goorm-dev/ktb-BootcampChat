package com.ktb.chatapp.dto;

import com.fasterxml.jackson.annotation.JsonGetter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Schema(description = "채팅방 응답 정보")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomResponse {
    @Schema(description = "채팅방 ID", example = "60d5ec49f1b2c8b9e8c4f2a1")
    @JsonProperty("_id")
    private String id;

    @Schema(description = "채팅방 이름", example = "프로젝트 논의방")
    private String name;

    @Schema(description = "비밀번호 설정 여부", example = "false")
    private boolean hasPassword;

    @Schema(description = "채팅방 생성자 정보")
    private UserResponse creator;

    @Schema(description = "참여자 목록")
    private List<UserResponse> participants;

    @JsonIgnore
    private LocalDateTime createdAtDateTime;

    @Schema(description = "현재 사용자가 생성자인지 여부", example = "true")
    private boolean isCreator;

    @Schema(description = "최근 10분간 메시지 수", example = "23")
    private Integer recentMessageCount;

    @Schema(description = "참여자 수", example = "5")
    @JsonGetter("participantsCount")
    public int getParticipantsCount() {
        return participants != null ? participants.size() : 0;
    }

    @Schema(description = "채팅방 생성 시간 (ISO 8601 형식)", example = "2025-11-18T12:34:56.789Z")
    @JsonGetter("createdAt")
    public String getCreatedAt() {
        return createdAtDateTime
                .atZone(java.time.ZoneId.systemDefault())
                .toInstant()
                .toString();
    }
}
