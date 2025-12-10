package com.ktb.chatapp.repository;

import com.ktb.chatapp.model.User;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserRepository extends MongoRepository<User, String> {

    Optional<User> findByEmail(String email);

    // 여러 ID로 한 번에 유저 가져오기 (N+1 방지용)
    List<User> findByIdIn(Collection<String> ids);

}
