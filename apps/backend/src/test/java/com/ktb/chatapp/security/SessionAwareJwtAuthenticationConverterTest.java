package com.ktb.chatapp.security;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

import com.ktb.chatapp.exception.SessionExpiredException;
import com.ktb.chatapp.service.SessionData;
import com.ktb.chatapp.service.SessionService;
import com.ktb.chatapp.service.SessionValidationResult;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.oauth2.jwt.Jwt;

@ExtendWith(MockitoExtension.class)
@DisplayName("SessionAwareJwtAuthenticationConverter 테스트")
class SessionAwareJwtAuthenticationConverterTest {

    @Mock
    private SessionService sessionService;

    @InjectMocks
    private SessionAwareJwtAuthenticationConverter converter;

    private Jwt validJwt;
    private static final String TEST_EMAIL = "test@example.com";
    private static final String TEST_USER_ID = "user-123";
    private static final String TEST_SESSION_ID = "session-456";

    @BeforeEach
    void setUp() {
        validJwt = createJwt(TEST_EMAIL, TEST_USER_ID, TEST_SESSION_ID);
    }

    @Test
    @DisplayName("유효한 JWT와 세션으로 인증 토큰 생성 성공")
    void convert_ValidJwtAndSession_Success() {
        // Given
        SessionData sessionData = createSessionData();
        SessionValidationResult validResult = SessionValidationResult.valid(sessionData);
        when(sessionService.validateSession(TEST_USER_ID, TEST_SESSION_ID))
            .thenReturn(validResult);

        // When
        AbstractAuthenticationToken result = converter.convert(validJwt);

        // Then
        assertNotNull(result);
        assertEquals(TEST_EMAIL, result.getName());
        assertNotNull(result.getAuthorities());
        
        @SuppressWarnings("unchecked")
        Map<String, Object> details = (Map<String, Object>) result.getDetails();
        assertEquals(TEST_USER_ID, details.get("userId"));
        assertEquals(TEST_SESSION_ID, details.get("sessionId"));
        assertEquals(TEST_EMAIL, details.get("email"));
        
        verify(sessionService, times(1)).validateSession(TEST_USER_ID, TEST_SESSION_ID);
    }

    @Test
    @DisplayName("JWT에 userId가 없으면 SessionExpiredException 발생")
    void convert_MissingUserId_ThrowsSessionExpiredException() {
        // Given
        Jwt jwtWithoutUserId = createJwt(TEST_EMAIL, null, TEST_SESSION_ID);

        // When & Then
        SessionExpiredException exception = assertThrows(
            SessionExpiredException.class,
            () -> converter.convert(jwtWithoutUserId)
        );
        
        assertTrue(exception.getMessage().contains("Missing userId in JWT"));
        verify(sessionService, never()).validateSession(anyString(), anyString());
    }

    @Test
    @DisplayName("JWT에 sessionId가 없으면 SessionExpiredException 발생")
    void convert_MissingSessionId_ThrowsSessionExpiredException() {
        // Given
        Jwt jwtWithoutSessionId = createJwt(TEST_EMAIL, TEST_USER_ID, null);

        // When & Then
        SessionExpiredException exception = assertThrows(
            SessionExpiredException.class,
            () -> converter.convert(jwtWithoutSessionId)
        );
        
        assertTrue(exception.getMessage().contains("Missing sessionId in JWT"));
        verify(sessionService, never()).validateSession(anyString(), anyString());
    }

    @Test
    @DisplayName("세션 검증 실패 시 SessionExpiredException 발생")
    void convert_InvalidSession_ThrowsSessionExpiredException() {
        // Given
        String errorMessage = "Session has expired";
        SessionValidationResult invalidResult = SessionValidationResult.invalid(
            "SESSION_EXPIRED",
            errorMessage
        );
        when(sessionService.validateSession(TEST_USER_ID, TEST_SESSION_ID))
            .thenReturn(invalidResult);

        // When & Then
        SessionExpiredException exception = assertThrows(
            SessionExpiredException.class,
            () -> converter.convert(validJwt)
        );
        
        assertEquals(errorMessage, exception.getMessage());
        verify(sessionService, times(1)).validateSession(TEST_USER_ID, TEST_SESSION_ID);
    }

    @Test
    @DisplayName("세션 검증 실패 - SESSION_NOT_FOUND")
    void convert_SessionNotFound_ThrowsSessionExpiredException() {
        // Given
        SessionValidationResult notFoundResult = SessionValidationResult.invalid(
            "SESSION_NOT_FOUND",
            "Session not found"
        );
        when(sessionService.validateSession(TEST_USER_ID, TEST_SESSION_ID))
            .thenReturn(notFoundResult);

        // When & Then
        assertThrows(SessionExpiredException.class, () -> converter.convert(validJwt));
        verify(sessionService, times(1)).validateSession(TEST_USER_ID, TEST_SESSION_ID);
    }

    @Test
    @DisplayName("세션 검증 실패 - USER_MISMATCH")
    void convert_UserMismatch_ThrowsSessionExpiredException() {
        // Given
        SessionValidationResult mismatchResult = SessionValidationResult.invalid(
            "USER_MISMATCH",
            "Session does not belong to this user"
        );
        when(sessionService.validateSession(TEST_USER_ID, TEST_SESSION_ID))
            .thenReturn(mismatchResult);

        // When & Then
        assertThrows(SessionExpiredException.class, () -> converter.convert(validJwt));
        verify(sessionService, times(1)).validateSession(TEST_USER_ID, TEST_SESSION_ID);
    }

    @Test
    @DisplayName("유효한 JWT - Authorities가 올바르게 변환됨")
    void convert_ValidJwt_AuthoritiesConverted() {
        // Given
        SessionData sessionData = createSessionData();
        SessionValidationResult validResult = SessionValidationResult.valid(sessionData);
        when(sessionService.validateSession(TEST_USER_ID, TEST_SESSION_ID))
            .thenReturn(validResult);

        // When
        AbstractAuthenticationToken result = converter.convert(validJwt);

        // Then
        assertNotNull(result.getAuthorities());
        assertTrue(result.getAuthorities() instanceof java.util.Collection);
    }

    @Test
    @DisplayName("여러 세션 검증 요청이 각각 독립적으로 처리됨")
    void convert_MultipleRequests_IndependentValidation() {
        // Given
        Jwt jwt1 = createJwt("user1@test.com", "user-1", "session-1");
        Jwt jwt2 = createJwt("user2@test.com", "user-2", "session-2");
        
        SessionData sessionData1 = createSessionData("user-1", "session-1");
        SessionData sessionData2 = createSessionData("user-2", "session-2");
        
        when(sessionService.validateSession("user-1", "session-1"))
            .thenReturn(SessionValidationResult.valid(sessionData1));
        when(sessionService.validateSession("user-2", "session-2"))
            .thenReturn(SessionValidationResult.valid(sessionData2));

        // When
        AbstractAuthenticationToken result1 = converter.convert(jwt1);
        AbstractAuthenticationToken result2 = converter.convert(jwt2);

        // Then
        assertEquals("user1@test.com", result1.getName());
        assertEquals("user2@test.com", result2.getName());
        
        verify(sessionService, times(1)).validateSession("user-1", "session-1");
        verify(sessionService, times(1)).validateSession("user-2", "session-2");
    }

    @Test
    @DisplayName("JWT에 subject(email)가 null일 때 처리")
    void convert_NullSubject_HandlesGracefully() {
        // Given
        Jwt jwtWithNullSubject = createJwt(null, TEST_USER_ID, TEST_SESSION_ID);
        SessionData sessionData = createSessionData();
        SessionValidationResult validResult = SessionValidationResult.valid(sessionData);
        when(sessionService.validateSession(TEST_USER_ID, TEST_SESSION_ID))
            .thenReturn(validResult);

        // When
        AbstractAuthenticationToken result = converter.convert(jwtWithNullSubject);

        // Then
        assertNotNull(result);
        assertNull(result.getName());
    }

    @Test
    @DisplayName("빈 sessionId는 null로 간주되어 예외 발생")
    void convert_EmptySessionId_ThrowsException() {
        // Given
        Jwt jwtWithEmptySessionId = createJwt(TEST_EMAIL, TEST_USER_ID, "");

        // When & Then
        assertThrows(SessionExpiredException.class,
            () -> converter.convert(jwtWithEmptySessionId));
    }

    // Helper methods
    private SessionData createSessionData() {
        return createSessionData(TEST_USER_ID, TEST_SESSION_ID);
    }
    
    private SessionData createSessionData(String userId, String sessionId) {
        return SessionData.builder()
            .userId(userId)
            .sessionId(sessionId)
            .createdAt(System.currentTimeMillis())
            .lastActivity(System.currentTimeMillis())
            .build();
    }
    
    private Jwt createJwt(String subject, String userId, String sessionId) {
        Map<String, Object> claims = new HashMap<>();
        if (userId != null) {
            claims.put("userId", userId);
        }
        if (sessionId != null && !sessionId.isEmpty()) {
            claims.put("sessionId", sessionId);
        }
        
        Instant now = Instant.now();
        return new Jwt(
            "test-token-value",
            now,
            now.plusSeconds(3600),
            Map.of("alg", "HS256", "typ", "JWT"),
            claims
        ) {
            @Override
            public String getSubject() {
                return subject;
            }
        };
    }
}
