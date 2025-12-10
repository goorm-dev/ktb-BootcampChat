package com.ktb.chatapp.service;

import com.ktb.chatapp.config.MongoTestContainer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;

/**
 * SessionService 통합 테스트
 * SessionService의 공개 API만 사용하는 비침투적(Non-invasive) 테스트
 * 백엔드 저장소(Redis/MongoDB)가 변경되어도 테스트 코드 수정이 불필요
 */
@SpringBootTest
@Import(MongoTestContainer.class)
@TestPropertySource(properties = {
    "socketio.enabled=false"
})
@DisplayName("SessionService 통합 테스트")
class SessionServiceTest {

    @Autowired
    private SessionService sessionService;

    private static final String TEST_USER_ID = "test-user-123";
    private static final String TEST_USER_ID_2 = "test-user-456";
    private static final String TEST_IP = "127.0.0.1";
    private static final String TEST_USER_AGENT = "Mozilla/5.0 Test Browser";

    @AfterEach
    void tearDown() {
        try {
            sessionService.removeAllUserSessions(TEST_USER_ID);
        } catch (Exception ignored) {}
        
        try {
            sessionService.removeAllUserSessions(TEST_USER_ID_2);
        } catch (Exception ignored) {}
    }

    private SessionMetadata createTestMetadata() {
        return new SessionMetadata(TEST_USER_AGENT, TEST_IP, "Desktop Mac OS Chrome");
    }

    // ============ 세션 생성 테스트 ============

    @Test
    @DisplayName("세션 생성 성공")
    void createSession_Success() {
        // Given
        SessionMetadata metadata = createTestMetadata();

        // When
        SessionCreationResult result = sessionService.createSession(TEST_USER_ID, metadata);

        // Then
        assertNotNull(result);
        assertNotNull(result.getSessionId());
        assertFalse(result.getSessionId().isEmpty());
        assertEquals(1800L, result.getExpiresIn()); // 30 minutes
        assertNotNull(result.getSessionData());
        assertEquals(TEST_USER_ID, result.getSessionData().getUserId());
        assertEquals(result.getSessionId(), result.getSessionData().getSessionId());
    }

    @Test
    @DisplayName("세션 생성 시 기존 세션 제거")
    void createSession_RemovesExistingSession() {
        // Given - 첫 번째 세션 생성
        SessionMetadata metadata = createTestMetadata();
        SessionCreationResult firstSession = sessionService.createSession(TEST_USER_ID, metadata);
        String firstSessionId = firstSession.getSessionId();

        // When - 같은 사용자로 두 번째 세션 생성
        SessionCreationResult secondSession = sessionService.createSession(TEST_USER_ID, metadata);
        String secondSessionId = secondSession.getSessionId();

        // Then - 새 세션 ID가 생성되고 첫 번째 세션은 무효화됨
        assertNotEquals(firstSessionId, secondSessionId);
        
        // 첫 번째 세션 검증 실패 확인
        SessionValidationResult validationResult = sessionService.validateSession(TEST_USER_ID, firstSessionId);
        assertFalse(validationResult.isValid());
        
        // 두 번째 세션은 유효
        validationResult = sessionService.validateSession(TEST_USER_ID, secondSessionId);
        assertTrue(validationResult.isValid());
    }

    @Test
    @DisplayName("세션 생성 - null 메타데이터 처리")
    void createSession_WithNullMetadata() {
        // When
        SessionCreationResult result = sessionService.createSession(TEST_USER_ID, null);

        // Then
        assertNotNull(result);
        assertNotNull(result.getSessionId());
        assertNull(result.getSessionData().getMetadata());
    }

    // ============ 세션 검증 테스트 ============

    @Test
    @DisplayName("세션 검증 성공")
    void validateSession_ValidSession_Success() {
        // Given
        SessionMetadata metadata = createTestMetadata();
        SessionCreationResult created = sessionService.createSession(TEST_USER_ID, metadata);

        // When
        SessionValidationResult result = sessionService.validateSession(TEST_USER_ID, created.getSessionId());

        // Then
        assertTrue(result.isValid());
        assertNull(result.getError());
        assertNull(result.getMessage());
        assertNotNull(result.getSession());
        assertEquals(TEST_USER_ID, result.getSession().getUserId());
    }

    @Test
    @DisplayName("세션 검증 실패 - 잘못된 세션 ID")
    void validateSession_InvalidSessionId_Failure() {
        // Given
        SessionMetadata metadata = createTestMetadata();
        sessionService.createSession(TEST_USER_ID, metadata);
        String wrongSessionId = "wrong-session-id";

        // When
        SessionValidationResult result = sessionService.validateSession(TEST_USER_ID, wrongSessionId);

        // Then
        assertFalse(result.isValid());
        assertEquals("INVALID_SESSION", result.getError());
        assertNotNull(result.getMessage());
    }

    @Test
    @DisplayName("세션 검증 실패 - null 파라미터")
    void validateSession_NullParameters_Failure() {
        // When & Then
        SessionValidationResult result1 = sessionService.validateSession(null, "session-id");
        assertFalse(result1.isValid());
        assertEquals("INVALID_PARAMETERS", result1.getError());

        SessionValidationResult result2 = sessionService.validateSession(TEST_USER_ID, null);
        assertFalse(result2.isValid());
        assertEquals("INVALID_PARAMETERS", result2.getError());
    }

    @Test
    @DisplayName("세션 검증 실패 - 존재하지 않는 사용자")
    void validateSession_NonExistentUser_Failure() {
        // When
        SessionValidationResult result = sessionService.validateSession("non-existent-user", "some-session-id");

        // Then
        assertFalse(result.isValid());
        assertNotNull(result.getError());
    }

    @Test
    @DisplayName("세션 검증 - lastActivity 업데이트")
    void validateSession_UpdatesLastActivity() throws InterruptedException {
        // Given
        SessionMetadata metadata = createTestMetadata();
        SessionCreationResult created = sessionService.createSession(TEST_USER_ID, metadata);
        long initialLastActivity = created.getSessionData().getLastActivity();

        Thread.sleep(100);

        // When
        SessionValidationResult result = sessionService.validateSession(TEST_USER_ID, created.getSessionId());

        // Then
        assertTrue(result.isValid());
        assertThat(result.getSession().getLastActivity()).isGreaterThan(initialLastActivity);
    }

    // ============ 세션 활동 업데이트 테스트 ============

    @Test
    @DisplayName("lastActivity 업데이트 성공")
    void updateLastActivity_Success() throws InterruptedException {
        // Given
        SessionMetadata metadata = createTestMetadata();
        SessionCreationResult created = sessionService.createSession(TEST_USER_ID, metadata);
        long initialLastActivity = created.getSessionData().getLastActivity();

        Thread.sleep(100);

        // When
        sessionService.updateLastActivity(TEST_USER_ID);

        // Then - 세션 데이터를 다시 가져와서 확인
        SessionData activeSession = sessionService.getActiveSession(TEST_USER_ID);
        assertNotNull(activeSession);
        assertThat(activeSession.getLastActivity()).isGreaterThan(initialLastActivity);
    }

    @Test
    @DisplayName("lastActivity 업데이트 - null userId 처리")
    void updateLastActivity_NullUserId_NoException() {
        // When & Then - 예외 발생하지 않아야 함
        assertDoesNotThrow(() -> sessionService.updateLastActivity(null));
    }

    @Test
    @DisplayName("lastActivity 업데이트 - 존재하지 않는 세션")
    void updateLastActivity_NonExistentSession_NoException() {
        // When & Then
        assertDoesNotThrow(() -> sessionService.updateLastActivity("non-existent-user"));
    }

    // ============ 세션 제거 테스트 ============

    @Test
    @DisplayName("세션 제거 성공")
    void removeSession_Success() {
        // Given
        SessionMetadata metadata = createTestMetadata();
        SessionCreationResult created = sessionService.createSession(TEST_USER_ID, metadata);

        // When
        sessionService.removeSession(TEST_USER_ID, created.getSessionId());

        // Then - 세션이 더 이상 유효하지 않음
        SessionValidationResult result = sessionService.validateSession(TEST_USER_ID, created.getSessionId());
        assertFalse(result.isValid());
    }

    @Test
    @DisplayName("세션 제거 - sessionId 없이 제거")
    void removeSession_WithoutSessionId_Success() {
        // Given
        SessionMetadata metadata = createTestMetadata();
        SessionCreationResult created = sessionService.createSession(TEST_USER_ID, metadata);

        // When - sessionId 없이 userId만으로 제거
        sessionService.removeSession(TEST_USER_ID);

        // Then
        SessionValidationResult result = sessionService.validateSession(TEST_USER_ID, created.getSessionId());
        assertFalse(result.isValid());
    }

    @Test
    @DisplayName("모든 사용자 세션 제거")
    void removeAllUserSessions_Success() {
        // Given
        SessionMetadata metadata = createTestMetadata();
        SessionCreationResult created = sessionService.createSession(TEST_USER_ID, metadata);

        // When
        sessionService.removeAllUserSessions(TEST_USER_ID);

        // Then - 세션 검증 실패 및 활성 세션 없음
        SessionValidationResult result = sessionService.validateSession(TEST_USER_ID, created.getSessionId());
        assertFalse(result.isValid());
        
        assertNull(sessionService.getActiveSession(TEST_USER_ID));
    }

    // ============ 활성 세션 조회 테스트 ============

    @Test
    @DisplayName("활성 세션 조회 성공")
    void getActiveSession_Success() {
        // Given
        SessionMetadata metadata = createTestMetadata();
        SessionCreationResult created = sessionService.createSession(TEST_USER_ID, metadata);

        // When
        SessionData activeSession = sessionService.getActiveSession(TEST_USER_ID);

        // Then
        assertNotNull(activeSession);
        assertEquals(TEST_USER_ID, activeSession.getUserId());
        assertEquals(created.getSessionId(), activeSession.getSessionId());
        assertNotNull(activeSession.getMetadata());
        assertEquals(TEST_IP, activeSession.getMetadata().ipAddress());
    }

    @Test
    @DisplayName("활성 세션 조회 - 세션 없음")
    void getActiveSession_NoSession_ReturnsNull() {
        // When
        SessionData activeSession = sessionService.getActiveSession("user-with-no-session");

        // Then
        assertNull(activeSession);
    }

    // ============ 동시성 및 멀티 사용자 테스트 ============

    @Test
    @DisplayName("여러 사용자의 독립적인 세션 관리")
    void multipleSessions_IndependentUsers() {
        // Given
        SessionMetadata metadata1 = createTestMetadata();
        SessionMetadata metadata2 = new SessionMetadata(TEST_USER_AGENT, "192.168.1.1", "Desktop Mac OS Chrome");

        // When - 두 사용자가 동시에 세션 생성
        SessionCreationResult session1 = sessionService.createSession(TEST_USER_ID, metadata1);
        SessionCreationResult session2 = sessionService.createSession(TEST_USER_ID_2, metadata2);

        // Then - 두 세션 모두 유효
        SessionValidationResult validation1 = sessionService.validateSession(TEST_USER_ID, session1.getSessionId());
        SessionValidationResult validation2 = sessionService.validateSession(TEST_USER_ID_2, session2.getSessionId());

        assertTrue(validation1.isValid());
        assertTrue(validation2.isValid());

        // 세션 ID가 서로 다름
        assertNotEquals(session1.getSessionId(), session2.getSessionId());

        // 각 세션의 메타데이터가 올바름
        assertEquals(TEST_IP, validation1.getSession().getMetadata().ipAddress());
        assertEquals("192.168.1.1", validation2.getSession().getMetadata().ipAddress());
    }

    @Test
    @DisplayName("한 사용자 세션 제거가 다른 사용자에게 영향 없음")
    void removeSession_DoesNotAffectOtherUsers() {
        // Given
        SessionMetadata metadata = createTestMetadata();
        SessionCreationResult session1 = sessionService.createSession(TEST_USER_ID, metadata);
        SessionCreationResult session2 = sessionService.createSession(TEST_USER_ID_2, metadata);

        // When - 첫 번째 사용자의 세션만 제거
        sessionService.removeSession(TEST_USER_ID);

        // Then - 첫 번째 사용자 세션은 무효, 두 번째는 여전히 유효
        SessionValidationResult validation1 = sessionService.validateSession(TEST_USER_ID, session1.getSessionId());
        SessionValidationResult validation2 = sessionService.validateSession(TEST_USER_ID_2, session2.getSessionId());

        assertFalse(validation1.isValid());
        assertTrue(validation2.isValid());
    }

    // ============ 메타데이터 테스트 ============

    @Test
    @DisplayName("세션 메타데이터 저장 및 조회")
    void sessionMetadata_StoredAndRetrieved() {
        // Given
        SessionMetadata metadata = new SessionMetadata("Safari iOS App", "192.168.1.100", "iPhone iOS 17");

        // When
        SessionCreationResult created = sessionService.createSession(TEST_USER_ID, metadata);
        SessionData activeSession = sessionService.getActiveSession(TEST_USER_ID);

        // Then
        assertNotNull(activeSession.getMetadata());
        assertEquals("iPhone iOS 17", activeSession.getMetadata().deviceInfo());
        assertEquals("192.168.1.100", activeSession.getMetadata().ipAddress());
        assertEquals("Safari iOS App", activeSession.getMetadata().userAgent());
    }

    // ============ Edge Cases ============

    @Test
    @DisplayName("세션 ID 고유성 확인")
    void sessionId_Uniqueness() {
        // Given
        SessionMetadata metadata = createTestMetadata();

        // When - 같은 사용자로 여러 번 세션 생성
        SessionCreationResult session1 = sessionService.createSession(TEST_USER_ID, metadata);
        sessionService.removeSession(TEST_USER_ID);
        
        SessionCreationResult session2 = sessionService.createSession(TEST_USER_ID, metadata);
        sessionService.removeSession(TEST_USER_ID);
        
        SessionCreationResult session3 = sessionService.createSession(TEST_USER_ID, metadata);

        // Then - 모든 세션 ID가 다름
        assertNotEquals(session1.getSessionId(), session2.getSessionId());
        assertNotEquals(session2.getSessionId(), session3.getSessionId());
        assertNotEquals(session1.getSessionId(), session3.getSessionId());
    }

    @Test
    @DisplayName("세션 생성 후 즉시 검증")
    void createAndValidate_Immediately() {
        // Given & When
        SessionMetadata metadata = createTestMetadata();
        SessionCreationResult created = sessionService.createSession(TEST_USER_ID, metadata);
        SessionValidationResult validated = sessionService.validateSession(TEST_USER_ID, created.getSessionId());

        // Then
        assertTrue(validated.isValid());
        assertEquals(created.getSessionData().getUserId(), validated.getSession().getUserId());
        assertEquals(created.getSessionData().getSessionId(), validated.getSession().getSessionId());
    }
}
