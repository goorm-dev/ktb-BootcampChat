package com.ktb.chatapp.dto;

import org.springframework.http.HttpStatus;

/**
 * API 에러 코드 및 HTTP 상태 코드 체계.
 */
public enum ApiErrorCode {
    // 인증/인가 관련 (4xx)
    UNAUTHORIZED("UNAUTHORIZED", "인증이 필요합니다.", HttpStatus.UNAUTHORIZED),
    INVALID_TOKEN("INVALID_TOKEN", "유효하지 않은 토큰입니다.", HttpStatus.UNAUTHORIZED),
    TOKEN_EXPIRED("TOKEN_EXPIRED", "토큰이 만료되었습니다.", HttpStatus.UNAUTHORIZED),
    FORBIDDEN("FORBIDDEN", "권한이 없습니다.", HttpStatus.FORBIDDEN),

    // 유효성 검증 관련 (4xx)
    VALIDATION_ERROR("VALIDATION_ERROR", "입력값이 유효하지 않습니다.", HttpStatus.BAD_REQUEST),
    MISSING_REQUIRED_FIELD("MISSING_REQUIRED_FIELD", "필수 필드가 누락되었습니다.", HttpStatus.BAD_REQUEST),
    INVALID_EMAIL_FORMAT("INVALID_EMAIL_FORMAT", "올바른 이메일 형식이 아닙니다.", HttpStatus.BAD_REQUEST),
    INVALID_PASSWORD_FORMAT("INVALID_PASSWORD_FORMAT", "비밀번호 형식이 올바르지 않습니다.", HttpStatus.BAD_REQUEST),

    // 리소스 관련 (4xx)
    RESOURCE_NOT_FOUND("RESOURCE_NOT_FOUND", "요청한 리소스를 찾을 수 없습니다.", HttpStatus.NOT_FOUND),
    USER_NOT_FOUND("USER_NOT_FOUND", "사용자를 찾을 수 없습니다.", HttpStatus.NOT_FOUND),
    ROOM_NOT_FOUND("ROOM_NOT_FOUND", "채팅방을 찾을 수 없습니다.", HttpStatus.NOT_FOUND),
    MESSAGE_NOT_FOUND("MESSAGE_NOT_FOUND", "메시지를 찾을 수 없습니다.", HttpStatus.NOT_FOUND),
    FILE_NOT_FOUND("FILE_NOT_FOUND", "파일을 찾을 수 없습니다.", HttpStatus.NOT_FOUND),

    // 중복/충돌 관련 (4xx)
    DUPLICATE_EMAIL("DUPLICATE_EMAIL", "이미 등록된 이메일입니다.", HttpStatus.CONFLICT),
    DUPLICATE_ROOM_NAME("DUPLICATE_ROOM_NAME", "이미 존재하는 채팅방 이름입니다.", HttpStatus.CONFLICT),
    ALREADY_MEMBER("ALREADY_MEMBER", "이미 참여중인 채팅방입니다.", HttpStatus.CONFLICT),

    // 비즈니스 로직 관련 (4xx)
    WRONG_PASSWORD("WRONG_PASSWORD", "비밀번호가 올바르지 않습니다.", HttpStatus.UNAUTHORIZED),
    ROOM_PASSWORD_REQUIRED("ROOM_PASSWORD_REQUIRED", "채팅방 비밀번호가 필요합니다.", HttpStatus.UNAUTHORIZED),
    ROOM_FULL("ROOM_FULL", "채팅방이 가득 찼습니다.", HttpStatus.BAD_REQUEST),
    NOT_ROOM_MEMBER("NOT_ROOM_MEMBER", "채팅방 참여자가 아닙니다.", HttpStatus.FORBIDDEN),
    NOT_ROOM_CREATOR("NOT_ROOM_CREATOR", "채팅방 생성자가 아닙니다.", HttpStatus.FORBIDDEN),

    // 파일 관련 (4xx)
    FILE_TOO_LARGE("FILE_TOO_LARGE", "파일 크기는 5MB를 초과할 수 없습니다.", HttpStatus.PAYLOAD_TOO_LARGE),
    INVALID_FILE_TYPE("INVALID_FILE_TYPE", "지원하지 않는 파일 형식입니다.", HttpStatus.BAD_REQUEST),
    FILE_UPLOAD_FAILED("FILE_UPLOAD_FAILED", "파일 업로드에 실패했습니다.", HttpStatus.BAD_REQUEST),

    // 속도 제한 관련 (4xx)
    TOO_MANY_REQUESTS("TOO_MANY_REQUESTS", "너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.", HttpStatus.TOO_MANY_REQUESTS),
    RATE_LIMIT_EXCEEDED("RATE_LIMIT_EXCEEDED", "요청 한도를 초과했습니다.", HttpStatus.TOO_MANY_REQUESTS),

    // 서버 관련 (5xx)
    INTERNAL_SERVER_ERROR("INTERNAL_SERVER_ERROR", "서버 내부 오류가 발생했습니다.", HttpStatus.INTERNAL_SERVER_ERROR),
    DATABASE_ERROR("DATABASE_ERROR", "데이터베이스 오류가 발생했습니다.", HttpStatus.INTERNAL_SERVER_ERROR),
    EXTERNAL_SERVICE_ERROR("EXTERNAL_SERVICE_ERROR", "외부 서비스 오류가 발생했습니다.", HttpStatus.BAD_GATEWAY),
    SERVICE_UNAVAILABLE("SERVICE_UNAVAILABLE", "서비스를 사용할 수 없습니다.", HttpStatus.SERVICE_UNAVAILABLE),

    // AI/RAG 관련 (5xx)
    AI_SERVICE_ERROR("AI_SERVICE_ERROR", "AI 서비스 오류가 발생했습니다.", HttpStatus.INTERNAL_SERVER_ERROR),
    RAG_PROCESSING_ERROR("RAG_PROCESSING_ERROR", "문서 처리 중 오류가 발생했습니다.", HttpStatus.INTERNAL_SERVER_ERROR),

    // Health Check 관련
    HEALTH_CHECK_FAILED("HEALTH_CHECK_FAILED", "서비스 상태 확인에 실패했습니다.", HttpStatus.SERVICE_UNAVAILABLE);

    private final String code;
    private final String message;
    private final HttpStatus httpStatus;

    ApiErrorCode(String code, String message, HttpStatus httpStatus) {
        this.code = code;
        this.message = message;
        this.httpStatus = httpStatus;
    }

    public String getCode() {
        return code;
    }

    public String getMessage() {
        return message;
    }

    public HttpStatus getHttpStatus() {
        return httpStatus;
    }
}
