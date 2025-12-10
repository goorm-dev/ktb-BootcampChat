package com.ktb.chatapp.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Schema(description = "API 표준 응답 형식")
@JsonInclude(JsonInclude.Include.NON_NULL)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StandardResponse<T> {
    @Schema(description = "성공 여부", example = "true")
    private boolean success;

    @Schema(description = "응답 메시지", example = "요청이 성공적으로 처리되었습니다.")
    private String message;

    @Schema(description = "응답 데이터")
    private T data;

    @Schema(description = "유효성 검증 에러 목록 (검증 실패 시)")
    private List<ValidationError> errors;

    @Schema(description = "에러 코드", example = "VALIDATION_ERROR")
    private String code;

    @Schema(description = "스택 트레이스 (개발 환경에서만 제공)")
    private String stack;

    @Schema(description = "요청 경로", example = "/api/auth/login")
    private String path;

    @Schema(description = "추가 메타데이터")
    private Map<String, Object> meta;

    public static <T> StandardResponse<T> success(T data) {
        return StandardResponse.<T>builder()
                .success(true)
                .data(data)
                .build();
    }

    public static <T> StandardResponse<T> success(String message, T data) {
        return StandardResponse.<T>builder()
                .success(true)
                .message(message)
                .data(data)
                .build();
    }

    public static <T> StandardResponse<T> success(String message) {
        return StandardResponse.<T>builder()
                .success(true)
                .message(message)
                .build();
    }

    public static <T> StandardResponse<T> error(String message) {
        return StandardResponse.<T>builder()
                .success(false)
                .message(message)
                .build();
    }

    @Deprecated
    public static <T> StandardResponse<T> error(String message, Map<String, Object> details) {
        return StandardResponse.<T>builder()
                .success(false)
                .message(message)
                .meta(details)
                .build();
    }

    public static <T> StandardResponse<T> error(ApiErrorCode errorCode) {
        return StandardResponse.<T>builder()
                .success(false)
                .message(errorCode.getMessage())
                .code(errorCode.getCode())
                .build();
    }

    public static <T> StandardResponse<T> error(ApiErrorCode errorCode, String customMessage) {
        return StandardResponse.<T>builder()
                .success(false)
                .message(customMessage)
                .code(errorCode.getCode())
                .build();
    }

    public static <T> StandardResponse<T> error(ApiErrorCode errorCode, Map<String, Object> details) {
        return StandardResponse.<T>builder()
                .success(false)
                .message(errorCode.getMessage())
                .code(errorCode.getCode())
                .meta(details)
                .build();
    }

    public static <T> StandardResponse<T> validationError(List<ValidationError> errors) {
        return StandardResponse.<T>builder()
                .success(false)
                .errors(errors)
                .code(ApiErrorCode.VALIDATION_ERROR.getCode())
                .build();
    }

    public static <T> StandardResponse<T> validationError(String message, List<ValidationError> errors) {
        StandardResponse<T> response = validationError(errors);
        response.setMessage(message);
        return response;
    }
}
