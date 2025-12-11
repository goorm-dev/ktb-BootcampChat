package com.ktb.chatapp.service;

import com.ktb.chatapp.model.Message;
import com.ktb.chatapp.repository.MessageRepository;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

/**
 * 메시지 읽음 상태 관리 서비스
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MessageReadStatusService {

    private final MessageRepository messageRepository;
    private final MongoTemplate mongoTemplate;

    /**
     * 메시지 읽음 상태 업데이트
     *
     * @param messageIds 읽음 상태를 업데이트할 메시지 리스트
     * @param userId 읽은 사용자 ID
     */
    public void updateReadStatus(List<String> messageIds, String userId) {
        if (messageIds == null || messageIds.isEmpty() || userId == null) {
            return;
        }

        try {
            // 이미 해당 사용자가 readers에 있는 문서는 제외하고, addToSet으로 한 번에 추가
            Query query = Query.query(
                    Criteria.where("_id").in(messageIds)
                            .and("readers.userId").ne(userId)
            );

            Message.MessageReader readerInfo = Message.MessageReader.builder()
                    .userId(userId)
                    .readAt(LocalDateTime.now())
                    .build();

            Update update = new Update().addToSet("readers", readerInfo);

            var result = mongoTemplate.updateMulti(query, update, Message.class);

            log.debug("Read status bulk-updated for {} messages by user {} (matched: {}, modified: {})",
                    messageIds.size(), userId, result.getMatchedCount(), result.getModifiedCount());

        } catch (Exception e) {
            log.error("Read status update error for user {}", userId, e);
        }
    }
}
