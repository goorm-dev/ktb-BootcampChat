package com.ktb.chatapp.service;

public record RateLimitCheckResult(
        boolean allowed,
        int limit,
        int remaining,
        long windowSeconds,
        long resetEpochSeconds,
        long retryAfterSeconds) {
    
    public static RateLimitCheckResult allowed(
            int limit,
            int remaining,
            long windowSeconds,
            long resetEpochSeconds,
            long retryAfterSeconds) {
        return new RateLimitCheckResult(
                true, limit, remaining, windowSeconds, resetEpochSeconds, retryAfterSeconds);
    }
    
    public static RateLimitCheckResult rejected(
            int limit, long windowSeconds, long resetEpochSeconds, long retryAfterSeconds) {
        return new RateLimitCheckResult(
                false, limit, 0, windowSeconds, resetEpochSeconds, retryAfterSeconds);
    }
}
