package com.ktb.chatapp.service.ratelimit;

import com.ktb.chatapp.model.RateLimit;
import com.ktb.chatapp.repository.RateLimitRepository;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * MongoDB implementation of RateLimitStore.
 * Uses RateLimitRepository for persistence.
 */
@Component
@RequiredArgsConstructor
public class RateLimitMongoStore implements RateLimitStore {
    
    private final RateLimitRepository rateLimitRepository;
    
    @Override
    public Optional<RateLimit> findByClientId(String clientId) {
        return rateLimitRepository.findByClientId(clientId);
    }
    
    @Override
    public RateLimit save(RateLimit rateLimit) {
        return rateLimitRepository.save(rateLimit);
    }
}
