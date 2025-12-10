package com.ktb.chatapp.repository;

import com.ktb.chatapp.model.RateLimit;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RateLimitRepository extends MongoRepository<RateLimit, String> {
    Optional<RateLimit> findByClientId(String clientId);
}
