package com.ktb.chatapp.model;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "rate_limits")
public class RateLimit {

    @Id
    private String id;

    @Indexed(unique = true)
    private String clientId;

    private int count;

    @Indexed(expireAfter = "0s")
    private Instant expiresAt;
}
