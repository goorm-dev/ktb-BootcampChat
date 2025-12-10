package com.ktb.chatapp.service;

import com.ktb.chatapp.config.MongoTestContainer;
import java.time.Instant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;

import static org.junit.jupiter.api.Assertions.*;

/**
 * JwtService 통합 테스트
 * 실제 Spring Context를 사용하여 테스트
 */
@SpringBootTest
@TestPropertySource(properties = {
    "app.jwt.secret=testsecrettestsecrettestsecrettestsecret1234567890",
    "app.jwt.expiration-ms=3600000",
    "socketio.enabled=false"
})
@DisplayName("JwtService 통합 테스트")
@Import(MongoTestContainer.class)
class JwtServiceTest {

    @Autowired
    private JwtService jwtService;

    @Test
    @DisplayName("토큰 생성 성공")
    void generateToken_Success() {
        // Given
        String sessionId = "test-session-id";
        String email = "test@example.com";
        String userId = "user-123";

        // When
        String token = jwtService.generateToken(sessionId, email, userId);

        // Then
        assertNotNull(token);
        assertFalse(token.isEmpty());
    }

    @Test
    @DisplayName("토큰 검증 - 유효한 토큰")
    void validateToken_ValidToken_Success() {
        // Given
        String token = jwtService.generateToken("session-1", "user@test.com", "user-1");

        // When
        Boolean isValid = jwtService.validateToken(token);

        // Then
        assertTrue(isValid);
    }

    @Test
    @DisplayName("토큰에서 이메일 추출")
    void extractEmail_Success() {
        // Given
        String email = "test@example.com";
        String token = jwtService.generateToken("session-1", email, "user-1");

        // When
        String extractedEmail = jwtService.extractEmail(token);

        // Then
        assertEquals(email, extractedEmail);
    }

    @Test
    @DisplayName("토큰에서 사용자 ID 추출")
    void extractUserId_Success() {
        // Given
        String userId = "user-123";
        String token = jwtService.generateToken("session-1", "test@example.com", userId);

        // When
        String extractedUserId = jwtService.extractUserId(token);

        // Then
        assertEquals(userId, extractedUserId);
    }

    @Test
    @DisplayName("토큰에서 세션 ID 추출")
    void extractSessionId_Success() {
        // Given
        String sessionId = "session-abc-123";
        String token = jwtService.generateToken(sessionId, "test@example.com", "user-1");

        // When
        String extractedSessionId = jwtService.extractSessionId(token);

        // Then
        assertEquals(sessionId, extractedSessionId);
    }

    @Test
    @DisplayName("토큰 만료 시간 확인")
    void extractExpiration_Success() {
        // Given
        String token = jwtService.generateToken("session-1", "test@example.com", "user-1");

        // When
        Instant expiration = jwtService.extractExpiration(token);

        // Then
        assertNotNull(expiration);
        assertTrue(expiration.isAfter(Instant.now()));
    }

    @Test
    @DisplayName("유효하지 않은 토큰 검증 실패")
    void validateToken_InvalidToken_Failure() {
        // Given
        String invalidToken = "invalid.jwt.token";

        // When
        Boolean isValid = jwtService.validateToken(invalidToken);

        // Then
        assertFalse(isValid);
    }
}
