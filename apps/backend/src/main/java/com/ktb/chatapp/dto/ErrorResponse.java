package com.ktb.chatapp.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Schema(description = "에러 응답")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ErrorResponse {
    @Schema(description = "성공 여부 (항상 false)", example = "false")
    private boolean success;

    @Schema(description = "에러 메시지", example = "채팅방 목록을 불러오는데 실패했습니다.")
    private String message;

    @Schema(description = "에러 상세 정보 (개발 환경에서만 제공)")
    private Map<String, Object> error;

    public ErrorResponse(boolean success, String message) {
        this.success = success;
        this.message = message;
    }
}
