package com.ktb.chatapp.controller;

import java.time.Instant;
import lombok.Data;

@Data
class StatusResponse {
    private final boolean success = true;
    private final String message;
    private final Instant timestamp;
    
    StatusResponse(String message) {
        this.message = message;
        this.timestamp = Instant.now();
    }
}
