package com.ktb.chatapp.service;

import com.ktb.chatapp.model.RateLimit;
import com.ktb.chatapp.service.ratelimit.RateLimitStore;
import jakarta.annotation.PostConstruct;
import java.time.Duration;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import static java.net.InetAddress.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class RateLimitService {

    private final RateLimitStore rateLimitStore;
    @Value("${HOSTNAME:''}")
    private String hostName;
    
    @PostConstruct
    public void init() {
        if (!hostName.isEmpty()) {
            return;
        }
        hostName = generateHostname();
    }
    
    private String generateHostname() {
        try {
            return getLocalHost().getHostName();
        } catch (Exception e) {
            return "unknown-" + java.util.UUID.randomUUID().toString().substring(0, 8);
        }
    }
    
    
    @Transactional
    public RateLimitCheckResult checkRateLimit(String _clientId, int maxRequests, Duration window) {
        String actualClientId = hostName + ":" + _clientId;
        long windowSeconds = Math.max(1L, window.getSeconds());
        Instant now = Instant.now();
        long nowEpochSeconds = now.getEpochSecond();
        Instant expiresAt = now.plus(window);

        try {
            RateLimit rateLimit = rateLimitStore.findByClientId(actualClientId).orElse(null);
            int currentCount = rateLimit != null ? rateLimit.getCount() : 0;

            if (rateLimit != null && currentCount >= maxRequests) {
                long retryAfterSeconds = Math.max(1L,
                    rateLimit.getExpiresAt().getEpochSecond() - nowEpochSeconds);
                long resetEpochSeconds = rateLimit.getExpiresAt().getEpochSecond();
                return RateLimitCheckResult.rejected(
                        maxRequests, windowSeconds, resetEpochSeconds, retryAfterSeconds);
            }

            // Create or update rate limit
            if (rateLimit == null) {
                rateLimit = RateLimit.builder()
                        .clientId(actualClientId)
                        .count(1)
                        .expiresAt(expiresAt)
                        .build();
            } else {
                rateLimit.setCount(currentCount + 1);
            }
            rateLimitStore.save(rateLimit);

            int newCount = currentCount + 1;
            int remaining = Math.max(0, maxRequests - newCount);
            long ttlSeconds = Math.max(1L, rateLimit.getExpiresAt().getEpochSecond() - nowEpochSeconds);
            long resetEpochSeconds = rateLimit.getExpiresAt().getEpochSecond();

            return RateLimitCheckResult.allowed(
                    maxRequests, remaining, windowSeconds, resetEpochSeconds, ttlSeconds);
        } catch (Exception e) {
            log.error("Rate limit check failed for client: {}", actualClientId, e);
            long resetEpochSeconds = nowEpochSeconds + windowSeconds;
            return RateLimitCheckResult.allowed(
                    maxRequests, maxRequests, windowSeconds, resetEpochSeconds, windowSeconds);
        }
    }
    
}
