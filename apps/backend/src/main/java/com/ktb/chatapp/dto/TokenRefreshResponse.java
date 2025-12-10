package com.ktb.chatapp.dto;

public record TokenRefreshResponse(
    boolean success,
    String message,
    String token,
    String sessionId
) {
}
