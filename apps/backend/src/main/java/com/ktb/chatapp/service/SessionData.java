package com.ktb.chatapp.service;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SessionData {
    private String userId;
    private String sessionId;
    private long createdAt;
    private long lastActivity;
    private SessionMetadata metadata;
}
