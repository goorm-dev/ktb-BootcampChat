package com.ktb.chatapp.service.session;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.ktb.chatapp.model.Session;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Optional;
import java.util.Set;

/**
 * Redis implementation of SessionStore.
 * Provides high-performance session storage with automatic TTL expiration.
 */
@Slf4j
@Component
@Primary  // MongoDB 대신 Redis를 우선 사용
@RequiredArgsConstructor
public class SessionRedisStore implements SessionStore {

    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    // Redis key prefix for sessions
    private static final String SESSION_PREFIX = "session:";
    private static final String USER_SESSIONS_PREFIX = "user_sessions:";

    // Session TTL: 30 minutes (same as MongoDB)
    private static final Duration SESSION_TTL = Duration.ofMinutes(30);

    /**
     * Generate Redis key for session
     * Format: "session:{userId}:{sessionId}"
     */
    private String getSessionKey(String userId, String sessionId) {
        return SESSION_PREFIX + userId + ":" + sessionId;
    }

    /**
     * Generate Redis key for user's session list
     * Format: "user_sessions:{userId}"
     */
    private String getUserSessionsKey(String userId) {
        return USER_SESSIONS_PREFIX + userId;
    }

    /**
     * Serialize Session object to JSON string
     */
    private String serializeSession(Session session) {
        try {
            return objectMapper.writeValueAsString(session);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize session: {}", session, e);
            throw new RuntimeException("Failed to serialize session", e);
        }
    }

    /**
     * Deserialize JSON string to Session object
     */
    private Session deserializeSession(String json) {
        try {
            return objectMapper.readValue(json, Session.class);
        } catch (JsonProcessingException e) {
            log.error("Failed to deserialize session: {}", json, e);
            return null;
        }
    }

    @Override
    public Optional<Session> findByUserId(String userId) {
        try {
            // Get all session IDs for this user
            Set<String> sessionIds = stringRedisTemplate.opsForSet().members(getUserSessionsKey(userId));

            if (sessionIds == null || sessionIds.isEmpty()) {
                return Optional.empty();
            }

            // Return the first (and should be only) session
            String firstSessionId = sessionIds.iterator().next();
            String sessionKey = getSessionKey(userId, firstSessionId);

            String sessionJson = stringRedisTemplate.opsForValue().get(sessionKey);
            if (sessionJson == null) {
                return Optional.empty();
            }

            Session session = deserializeSession(sessionJson);
            return Optional.ofNullable(session);

        } catch (Exception e) {
            log.error("Error finding session for userId: {}", userId, e);
            return Optional.empty();
        }
    }

    @Override
    public Session save(Session session) {
        try {
            String userId = session.getUserId();
            String sessionId = session.getSessionId();
            String sessionKey = getSessionKey(userId, sessionId);
            String userSessionsKey = getUserSessionsKey(userId);

            // Serialize session to JSON
            String sessionJson = serializeSession(session);

            // Save session data with TTL
            stringRedisTemplate.opsForValue().set(sessionKey, sessionJson, SESSION_TTL);

            // Add session ID to user's session set (store as String)
            stringRedisTemplate.opsForSet().add(userSessionsKey, sessionId);
            stringRedisTemplate.expire(userSessionsKey, SESSION_TTL);

            log.debug("Session saved to Redis: userId={}, sessionId={}", userId, sessionId);
            return session;

        } catch (Exception e) {
            log.error("Error saving session: userId={}, sessionId={}",
                    session.getUserId(), session.getSessionId(), e);
            throw new RuntimeException("Failed to save session to Redis", e);
        }
    }

    @Override
    public void delete(String userId, String sessionId) {
        try {
            String sessionKey = getSessionKey(userId, sessionId);
            String userSessionsKey = getUserSessionsKey(userId);

            // Delete session data
            stringRedisTemplate.delete(sessionKey);

            // Remove session ID from user's session set
            stringRedisTemplate.opsForSet().remove(userSessionsKey, sessionId);

            log.debug("Session deleted from Redis: userId={}, sessionId={}", userId, sessionId);

        } catch (Exception e) {
            log.error("Error deleting session: userId={}, sessionId={}", userId, sessionId, e);
        }
    }

    @Override
    public void deleteAll(String userId) {
        try {
            String userSessionsKey = getUserSessionsKey(userId);

            // Get all session IDs for this user
            Set<String> sessionIds = stringRedisTemplate.opsForSet().members(userSessionsKey);

            if (sessionIds != null && !sessionIds.isEmpty()) {
                // Delete all sessions
                for (String sessionId : sessionIds) {
                    String sessionKey = getSessionKey(userId, sessionId);
                    stringRedisTemplate.delete(sessionKey);
                }
            }

            // Delete user's session set
            stringRedisTemplate.delete(userSessionsKey);

            log.debug("All sessions deleted for userId: {}", userId);

        } catch (Exception e) {
            log.error("Error deleting all sessions for userId: {}", userId, e);
        }
    }
}