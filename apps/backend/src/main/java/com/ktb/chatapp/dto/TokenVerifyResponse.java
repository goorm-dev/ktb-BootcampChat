package com.ktb.chatapp.dto;

public record TokenVerifyResponse(
    boolean success,
    String message,
    AuthUserDto user
) {
}
