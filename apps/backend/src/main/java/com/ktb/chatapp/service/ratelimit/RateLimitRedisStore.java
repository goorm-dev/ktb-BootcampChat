package com.ktb.chatapp.service.ratelimit;

import com.ktb.chatapp.model.RateLimit;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

/**
 * Redis implementation of RateLimitStore.
 * Provides high-performance rate limiting with automatic TTL expiration.
 * Uses Redis INCR command for atomic counter increments.
 */
@Slf4j
@Component
@Primary  // MongoDB 대신 Redis를 우선 사용
@RequiredArgsConstructor
public class RateLimitRedisStore implements RateLimitStore {

    private final RedisTemplate<String, Object> redisTemplate;

    // Redis key prefix for rate limits
    private static final String RATE_LIMIT_PREFIX = "ratelimit:";

    // Rate limit window: 1 second (same as MongoDB)
    private static final Duration RATE_LIMIT_WINDOW = Duration.ofSeconds(1);

    /**
     * Generate Redis key for rate limit
     * Format: "ratelimit:{clientId}"
     */
    private String getRateLimitKey(String clientId) {
        return RATE_LIMIT_PREFIX + clientId;
    }

    @Override
    public Optional<RateLimit> findByClientId(String clientId) {
        try {
            String key = getRateLimitKey(clientId);

            // Get current count from Redis
            Object countObj = redisTemplate.opsForValue().get(key);

            if (countObj == null) {
                return Optional.empty();
            }

            int count = Integer.parseInt(countObj.toString());

            // Get TTL
            Long ttl = redisTemplate.getExpire(key, TimeUnit.SECONDS);
            Instant expiresAt = ttl != null && ttl > 0
                    ? Instant.now().plusSeconds(ttl)
                    : Instant.now().plus(RATE_LIMIT_WINDOW);

            RateLimit rateLimit = RateLimit.builder()
                    .clientId(clientId)
                    .count(count)
                    .expiresAt(expiresAt)
                    .build();

            return Optional.of(rateLimit);

        } catch (Exception e) {
            log.error("Error finding rate limit for clientId: {}", clientId, e);
            return Optional.empty();
        }
    }

    @Override
    public RateLimit save(RateLimit rateLimit) {
        try {
            String key = getRateLimitKey(rateLimit.getClientId());

            // Use Redis INCR for atomic increment
            // If key doesn't exist, it will be created with value 1
            Long newCount = redisTemplate.opsForValue().increment(key);

            if (newCount == null) {
                newCount = 1L;
            }

            // Set TTL only if this is the first increment (new key)
            if (newCount == 1) {
                redisTemplate.expire(key, RATE_LIMIT_WINDOW);
            }

            // Update the count in the rate limit object
            rateLimit.setCount(newCount.intValue());

            log.debug("Rate limit updated: clientId={}, count={}", rateLimit.getClientId(), newCount);

            return rateLimit;

        } catch (Exception e) {
            log.error("Error saving rate limit: clientId={}", rateLimit.getClientId(), e);
            throw new RuntimeException("Failed to save rate limit to Redis", e);
        }
    }

    /**
     * Atomic increment operation for rate limiting
     * Returns the new count after increment
     */
    public long incrementAndGet(String clientId) {
        try {
            String key = getRateLimitKey(clientId);

            // Atomic increment
            Long newCount = redisTemplate.opsForValue().increment(key);

            if (newCount == null) {
                newCount = 1L;
            }

            // Set TTL only if this is the first increment
            if (newCount == 1) {
                redisTemplate.expire(key, RATE_LIMIT_WINDOW);
            }

            return newCount;

        } catch (Exception e) {
            log.error("Error incrementing rate limit for clientId: {}", clientId, e);
            return 0;
        }
    }

    /**
     * Reset rate limit for a client
     */
    public void reset(String clientId) {
        try {
            String key = getRateLimitKey(clientId);
            redisTemplate.delete(key);
            log.debug("Rate limit reset: clientId={}", clientId);
        } catch (Exception e) {
            log.error("Error resetting rate limit for clientId: {}", clientId, e);
        }
    }
}