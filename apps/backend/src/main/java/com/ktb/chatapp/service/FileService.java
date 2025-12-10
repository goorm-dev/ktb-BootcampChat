package com.ktb.chatapp.service;

import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

public interface FileService {

    FileUploadResult uploadFile(MultipartFile file, String uploaderId);

    String storeFile(MultipartFile file, String subDirectory);

    Resource loadFileAsResource(String fileName, String requesterId);

    boolean deleteFile(String fileId, String requesterId);
}

