package com.ktb.chatapp.repository;

import com.ktb.chatapp.model.File;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface FileRepository extends MongoRepository<File, String> {
    Optional<File> findByFilename(String filename);
}
