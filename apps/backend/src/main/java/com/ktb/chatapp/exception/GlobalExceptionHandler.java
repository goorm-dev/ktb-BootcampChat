package com.ktb.chatapp.exception;

import com.ktb.chatapp.dto.ApiErrorCode;
import com.ktb.chatapp.dto.StandardResponse;
import com.ktb.chatapp.dto.ValidationError;
import jakarta.servlet.http.HttpServletRequest;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.List;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * 전역 예외 처리기
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @Value("${spring.profiles.active:production}")
    private String activeProfile;

    /**
     * 인증 예외 처리
     */
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<StandardResponse<Object>> handleAuthenticationException(
            AuthenticationException ex, HttpServletRequest request) {

        log.warn("인증 실패: {} - {}", request.getRequestURI(), ex.getMessage());

        StandardResponse<Object> response = StandardResponse.error(ApiErrorCode.UNAUTHORIZED);
        response.setPath(request.getRequestURI());
        return ResponseEntity.status(ApiErrorCode.UNAUTHORIZED.getHttpStatus()).body(response);
    }

    /**
     * 인가 예외 처리 (권한 없음)
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<StandardResponse<Object>> handleAccessDeniedException(
            AccessDeniedException ex, HttpServletRequest request) {

        log.warn("접근 권한 없음: {} - {}", request.getRequestURI(), ex.getMessage());

        StandardResponse<Object> response = StandardResponse.error(ApiErrorCode.FORBIDDEN);
        response.setPath(request.getRequestURI());
        return ResponseEntity.status(ApiErrorCode.FORBIDDEN.getHttpStatus()).body(response);
    }

    /**
     * 유효성 검증 실패 처리
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<StandardResponse<Object>> handleValidationException(
            MethodArgumentNotValidException ex, HttpServletRequest request) {

        List<ValidationError> errors = ex.getBindingResult().getFieldErrors().stream()
                .map(fieldError -> ValidationError.builder()
                        .field(fieldError.getField())
                        .message(fieldError.getDefaultMessage())
                        .build())
                .collect(Collectors.toList());

        log.warn("유효성 검증 실패: {}", errors);

        StandardResponse<Object> response = StandardResponse.validationError(errors);
        response.setPath(request.getRequestURI());
        return ResponseEntity.badRequest().body(response);
    }

    /**
     * 파일 업로드 크기 초과 예외 처리
     */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<StandardResponse<Object>> handleMaxUploadSizeExceededException(
            MaxUploadSizeExceededException ex, HttpServletRequest request) {

        log.warn("파일 업로드 크기 초과: {}", ex.getMessage());

        StandardResponse<Object> response = StandardResponse.error(ApiErrorCode.FILE_TOO_LARGE);
        response.setPath(request.getRequestURI());
        return ResponseEntity.status(ApiErrorCode.FILE_TOO_LARGE.getHttpStatus()).body(response);
    }
    
    /**
     * 일반적인 Runtime 예외 처리
     */
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<StandardResponse<Object>> handleRuntimeException(
            RuntimeException ex, HttpServletRequest request) {

        log.error("런타임 예외: {} - {}", request.getRequestURI(), ex.getMessage(), ex);

        StandardResponse<Object> response = StandardResponse.error(ApiErrorCode.INTERNAL_SERVER_ERROR);
        response.setPath(request.getRequestURI());
        if (isDevelopmentProfile()) {
            response.setStack(getStackTrace(ex));
        }

        return ResponseEntity.status(ApiErrorCode.INTERNAL_SERVER_ERROR.getHttpStatus()).body(response);
    }
    
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<StandardResponse<Object>> handleNoResourceFoundException() {
        return ResponseEntity.notFound().build();
    }

    /**
     * 모든 예외의 최종 처리기
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<StandardResponse<Object>> handleGenericException(
            Exception ex, HttpServletRequest request) {

        log.error("예상치 못한 예외: {} - {}", request.getRequestURI(), ex.getMessage(), ex);

        StandardResponse<Object> response = StandardResponse.error(ApiErrorCode.INTERNAL_SERVER_ERROR);
        response.setPath(request.getRequestURI());
        if (isDevelopmentProfile()) {
            response.setStack(getStackTrace(ex));
        }

        return ResponseEntity.status(ApiErrorCode.INTERNAL_SERVER_ERROR.getHttpStatus()).body(response);
    }

    private boolean isDevelopmentProfile() {
        String normalized = activeProfile.trim().toLowerCase();
        return "dev".equals(normalized);
    }

    private String getStackTrace(Throwable throwable) {
        StringWriter stringWriter = new StringWriter();
        throwable.printStackTrace(new PrintWriter(stringWriter));
        return stringWriter.toString();
    }
}
