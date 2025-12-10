package com.ktb.chatapp.dto;

import com.fasterxml.jackson.annotation.JsonGetter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class HealthResponse {
    private boolean success;
    @Builder.Default
    private String timestamp = Instant.now().toString();
    private Map<String, ServiceHealth> services;
    
    @JsonIgnore
    private LocalDateTime lastActivity;
    
    @JsonGetter("lastActivity")
    public String getLastActivity() {
        if (lastActivity == null) {
            return null;
        }
        return lastActivity.atZone(ZoneId.systemDefault())
                .toInstant()
                .toString();
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ServiceHealth {
        private boolean connected;
        private long latency;
    }
}
