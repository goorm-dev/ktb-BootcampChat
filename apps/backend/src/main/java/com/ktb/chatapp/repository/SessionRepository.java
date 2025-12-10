package com.ktb.chatapp.repository;

import com.ktb.chatapp.model.Session;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SessionRepository extends MongoRepository<Session, String> {
    Optional<Session> findByUserId(String userId);
    void deleteByUserId(String userId);
}
