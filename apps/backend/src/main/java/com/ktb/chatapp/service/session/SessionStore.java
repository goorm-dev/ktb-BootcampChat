package com.ktb.chatapp.service.session;

import com.ktb.chatapp.model.Session;
import java.util.Optional;

/**
 * Data store interface for session storage.
 * Provides operations for storing and retrieving session data.
 */
public interface SessionStore {
    
    /**
     * Find session by user ID
     *
     * @param userId the user identifier
     * @return Optional containing the Session if found, empty otherwise
     */
    Optional<Session> findByUserId(String userId);
    
    /**
     * Save or update session
     *
     * @param session the session to save
     * @return the saved session
     */
    Session save(Session session);
    
    /**
     * Delete all sessions for a user
     *
     * @param userId the user identifier
     */
    void deleteAll(String userId);
    
    void delete(String userId, String sessionId);
}
