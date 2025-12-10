package com.ktb.chatapp.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.IndexDirection;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "rooms")
@CompoundIndexes({
    @CompoundIndex(name = "name_createdAt_idx", def = "{'name': 1, 'createdAt': -1}")
})
public class Room {

    @Id
    private String id;

    @Indexed
    private String name;

    private String creator;

    private boolean hasPassword;

    @JsonIgnore
    private String password;

    @CreatedDate
    @Indexed(direction = IndexDirection.DESCENDING)
    private LocalDateTime createdAt;

    @Field("participantIds")
    @Builder.Default
    private Set<String> participantIds = new HashSet<>();
    
    /**
     * 방에 참가자를 추가한다.
     *
     * @param userId 추가할 사용자 ID
     */
    public void addParticipant(String userId) {
        if (this.participantIds == null) {
            this.participantIds = new HashSet<>();
        }
        this.participantIds.add(userId);
    }
    
    /**
     * 방에서 참가자를 제거한다.
     *
     * @param userId 제거할 사용자 ID
     */
    public void removeParticipant(String userId) {
        if (this.participantIds != null) {
            this.participantIds.remove(userId);
        }
    }
    
    /**
     * 방이 비어있는지 확인한다.
     *
     * @return 참가자가 없으면 true
     */
    public boolean isEmpty() {
        return this.participantIds == null || this.participantIds.isEmpty();
    }
    
    /**
     * 방의 참가자 수를 반환한다.
     *
     * @return 참가자 수
     */
    public int getParticipantCount() {
        return this.participantIds != null ? this.participantIds.size() : 0;
    }
}
