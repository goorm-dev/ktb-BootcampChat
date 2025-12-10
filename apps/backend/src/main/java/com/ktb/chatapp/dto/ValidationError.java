package com.ktb.chatapp.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 검증 에러 정보 DTO.
 * errors: [ { field: "email", message: "..." } ]
 */
@Schema(description = "유효성 검증 에러 상세 정보")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ValidationError {
    @Schema(description = "에러가 발생한 필드명", example = "email")
    private String field;

    @Schema(description = "에러 메시지", example = "올바른 이메일 형식이 아닙니다.")
    private String message;
}
