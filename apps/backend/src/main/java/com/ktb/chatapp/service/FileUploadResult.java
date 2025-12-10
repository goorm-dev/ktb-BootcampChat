package com.ktb.chatapp.service;

import com.ktb.chatapp.model.File;
import lombok.Builder;
import lombok.Data;

/**
 * 파일 업로드 결과 DTO
 */
@Data
@Builder
public class FileUploadResult {
    private boolean success;
    private File file;
}
