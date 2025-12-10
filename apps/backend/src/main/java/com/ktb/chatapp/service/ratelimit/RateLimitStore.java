package com.ktb.chatapp.service.ratelimit;

import com.ktb.chatapp.model.RateLimit;
import java.util.Optional;

/**
 * Data store interface for rate limit storage.
 * Provides operations for storing and retrieving rate limit data.
 */
public interface RateLimitStore {
    
    /**
     * Find rate limit by client ID
     *
     * @param clientId the client identifier
     * @return Optional containing the RateLimit if found, empty otherwise
     */
    Optional<RateLimit> findByClientId(String clientId);
    
    /**
     * Save or update rate limit
     *
     * @param rateLimit the rate limit to save
     * @return the saved rate limit
     */
    RateLimit save(RateLimit rateLimit);
}
