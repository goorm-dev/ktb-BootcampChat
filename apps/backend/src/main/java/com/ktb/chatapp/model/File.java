package com.ktb.chatapp.model;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "files")
public class File {

    @Id
    private String id;

    @Indexed
    private String filename;

    private String originalname;

    private String mimetype;

    private long size;

    private String path;

    @Field("user")
    @Indexed
    private String user;

    @Field("uploadDate")
    @CreatedDate
    @Indexed
    private LocalDateTime uploadDate;

    /**
     * 미리보기 지원 여부 확인
     */
    public boolean isPreviewable() {
        List<String> previewableTypes = Arrays.asList(
            "image/jpeg", "image/png", "image/gif", "image/webp",
            "video/mp4", "video/webm",
            "audio/mpeg", "audio/wav",
            "application/pdf"
        );
        return previewableTypes.contains(this.mimetype);
    }
}
