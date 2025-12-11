package com.ktb.chatapp.repository;

import com.ktb.chatapp.model.Message;
import java.time.LocalDateTime;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

@Repository
public interface MessageRepository extends MongoRepository<Message, String> {
    Page<Message> findByRoomIdAndIsDeletedAndTimestampBefore(String roomId, Boolean isDeleted, LocalDateTime timestamp, Pageable pageable);
    /**
     * 특정 시간 이후의 메시지 수 카운트 (삭제되지 않은 메시지만)
     * 최근 N분간 메시지 수를 조회할 때 사용
     */
    @Query(value = "{ 'room': ?0, 'isDeleted': false, 'timestamp': { $gte: ?1 } }", count = true)
    long countRecentMessagesByRoomId(String roomId, LocalDateTime since);

    /**
     * fileId로 메시지 조회 (파일 권한 검증용)
     */
    Optional<Message> findByFileId(String fileId);

    /**
     * 여러 방에 대해 최근 메시지 수를 한 번에 집계
     */
    @org.springframework.data.mongodb.repository.Aggregation(pipeline = {
        "{ $match: { 'room': { $in: ?0 }, 'isDeleted': false, 'timestamp': { $gte: ?1 } } }",
        "{ $group: { _id: '$room', count: { $sum: 1 } } }",
        "{ $project: { roomId: '$_id', count: 1, _id: 0 } }"
    })
    java.util.List<RoomMessageCount> countRecentMessagesByRoomIds(java.util.List<String> roomIds, LocalDateTime since);

    interface RoomMessageCount {
        String getRoomId();
        long getCount();
    }
}
