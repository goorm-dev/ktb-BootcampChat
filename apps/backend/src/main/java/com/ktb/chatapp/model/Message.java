package com.ktb.chatapp.model;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Message 문서 모델 정의.
 * MongoDB 필드 이름과 인덱스를 명시한다.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "messages")
@CompoundIndexes({
    @CompoundIndex(name = "readers_userId_idx", def = "{'readers.userId': 1}"),
    @CompoundIndex(name = "room_isDeleted_timestamp_idx", def = "{'room': 1, 'isDeleted': 1, 'timestamp': -1}")
})
public class Message {

    @Id
    private String id;

    // Mongo 문서 필드명 "room" 사용
    @Indexed
    @Field("room")
    private String roomId;

    @Size(max = 10000, message = "메시지는 10000자를 초과할 수 없습니다.")
    private String content;

    // Mongo 문서 필드명 "sender" 사용
    @Field("sender")
    private String senderId;

    private MessageType type;

    // Mongo 문서 필드명 "file" 사용
    @Field("file")
    private String fileId;

    private AiType aiType;

    @Builder.Default
    private List<String> mentions = new ArrayList<>();

    @CreatedDate
    private LocalDateTime timestamp;

    @Builder.Default
    private Map<String, Set<String>> reactions = new HashMap<>();

    // 메시지 읽음 상태 관리
    @Builder.Default
    private List<MessageReader> readers = new ArrayList<>();

    // 자유 형식 metadata 저장 필드
    @Builder.Default
    private Map<String, Object> metadata = new HashMap<>();

    @Indexed
    @Builder.Default
    private Boolean isDeleted = false;

    // 메시지 읽음 상태를 나타내는 내부 클래스
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MessageReader {
        private String userId;
        private LocalDateTime readAt;
    }
    
    
    public long toTimestampMillis() {
        return timestamp.atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli();
    }
    
    /**
     * 메시지에 리액션을 추가한다.
     * Tell, Don't Ask 원칙을 준수하여 도메인 로직을 캡슐화한다.
     *
     * @param reaction 리액션 이모지
     * @param userId 사용자 ID
     * @return 리액션이 추가되었으면 true, 이미 존재하면 false
     */
    public boolean addReaction(String reaction, String userId) {
        if (this.reactions == null) {
            this.reactions = new HashMap<>();
        }
        Set<String> userReactions = this.reactions.computeIfAbsent(
            reaction,
            key -> new java.util.HashSet<>()
        );
        return userReactions.add(userId);
    }
    
    /**
     * 메시지에서 리액션을 제거한다.
     *
     * @param reaction 리액션 이모지
     * @param userId 사용자 ID
     * @return 리액션이 제거되었으면 true, 존재하지 않았으면 false
     */
    public boolean removeReaction(String reaction, String userId) {
        if (this.reactions == null) {
            return false;
        }
        Set<String> userReactions = this.reactions.get(reaction);
        if (userReactions != null && userReactions.remove(userId)) {
            if (userReactions.isEmpty()) {
                this.reactions.remove(reaction);
            }
            return true;
        }
        return false;
    }
    
    /**
     * 파일 메타데이터를 메시지에 첨부한다.
     *
     * @param file 파일 객체
     */
    public void attachFileMetadata(File file) {
        if (this.fileId != null && this.metadata == null) {
            this.metadata = new HashMap<>();
            this.metadata.put("fileType", file.getMimetype());
            this.metadata.put("fileSize", file.getSize());
            this.metadata.put("originalName", file.getOriginalname());
        }
    }
}
