package com.ktb.chatapp.repository;

import com.ktb.chatapp.model.Session;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SessionRepository extends MongoRepository<Session, String> {
    Optional<Session> findByUserId(String userId);
    void deleteByUserId(String userId);
}
