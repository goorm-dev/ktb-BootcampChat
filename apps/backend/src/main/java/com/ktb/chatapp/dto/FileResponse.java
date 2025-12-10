package com.ktb.chatapp.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.ktb.chatapp.model.File;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FileResponse {
    @JsonProperty("_id")
    private String id;
    private String filename;
    private String originalname;
    private String mimetype;
    private long size;
    private String user;
    private LocalDateTime uploadDate;

    // File 엔티티에서 FileResponse로 변환하는 정적 메서드
    public static FileResponse from(File file) {
        return FileResponse.builder()
                .id(file.getId())
                .filename(file.getFilename())
                .originalname(file.getOriginalname())
                .mimetype(file.getMimetype())
                .size(file.getSize())
                .user(file.getUser())
                .uploadDate(file.getUploadDate())
                .build();
    }
}
