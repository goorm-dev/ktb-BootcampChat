package com.ktb.chatapp.model;

import com.ktb.chatapp.service.SessionMetadata;
import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "sessions")
@CompoundIndexes({
    @CompoundIndex(name = "userId_sessionId_idx", def = "{'userId': 1, 'sessionId': 1}", unique = true)
})
public class Session {
    public static final String SESSION_TTL = "30m";

    @Id
    private String id;

    @Indexed
    private String userId;

    private String sessionId;

    private long createdAt;

    private long lastActivity;

    private SessionMetadata metadata;

    @Indexed(expireAfter = SESSION_TTL)
    private Instant expiresAt;
}
