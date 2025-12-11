package com.ktb.chatapp.service;

import com.amazonaws.HttpMethod;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.GeneratePresignedUrlRequest;
import com.amazonaws.services.s3.model.ObjectMetadata;
import com.ktb.chatapp.model.File;
import com.ktb.chatapp.model.Message;
import com.ktb.chatapp.model.Room;
import com.ktb.chatapp.repository.FileRepository;
import com.ktb.chatapp.repository.MessageRepository;
import com.ktb.chatapp.repository.RoomRepository;
import com.ktb.chatapp.util.FileUtil;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URL;
import java.time.LocalDateTime;

@Slf4j
@Service
public class S3FileService implements FileService {

    private final AmazonS3 amazonS3;
    private final FileRepository fileRepository;
    private final MessageRepository messageRepository;
    private final RoomRepository roomRepository;

    @Value("${cloud.aws.s3.bucket}")
    private String bucket;

    public S3FileService(AmazonS3 amazonS3,
                         FileRepository fileRepository,
                         MessageRepository messageRepository,
                         RoomRepository roomRepository) {
        this.amazonS3 = amazonS3;
        this.fileRepository = fileRepository;
        this.messageRepository = messageRepository;
        this.roomRepository = roomRepository;
    }

    @PostConstruct
    public void init() {
        log.info("S3FileService initialized. Using bucket: {}", bucket);
    }

    @Override
    public FileUploadResult uploadFile(MultipartFile file, String uploaderId) {
        try {
            // 파일 보안 검증
            FileUtil.validateFile(file);

            // 안전한 파일명 생성
            String originalFilename = file.getOriginalFilename();
            if (originalFilename == null) {
                originalFilename = "file";
            }
            originalFilename = StringUtils.cleanPath(originalFilename);
            String safeFileName = FileUtil.generateSafeFileName(originalFilename);

            // S3에 업로드
            ObjectMetadata metadata = new ObjectMetadata();
            metadata.setContentLength(file.getSize());
            metadata.setContentType(file.getContentType());

            amazonS3.putObject(bucket, safeFileName, file.getInputStream(), metadata);

            log.info("S3 파일 업로드 완료: {}", safeFileName);

            // 원본 파일명 정규화
            String normalizedOriginalname = FileUtil.normalizeOriginalFilename(originalFilename);

            // 메타데이터 생성 및 저장
            File fileEntity = File.builder()
                    .filename(safeFileName)
                    .originalname(normalizedOriginalname)
                    .mimetype(file.getContentType())
                    .size(file.getSize())
                    .path(safeFileName)
                    .user(uploaderId)
                    .uploadDate(LocalDateTime.now())
                    .build();

            File savedFile = fileRepository.save(fileEntity);

            return FileUploadResult.builder()
                    .success(true)
                    .file(savedFile)
                    .build();

        } catch (Exception e) {
            log.error("S3 파일 업로드 실패: {}", e.getMessage(), e);
            throw new RuntimeException("파일 업로드 실패", e);
        }
    }

    @Override
    public String storeFile(MultipartFile file, String subDirectory) {
        try {

            FileUtil.validateFile(file);

            String originalFilename = file.getOriginalFilename();
            if (originalFilename == null) {
                originalFilename = "file";
            }
            originalFilename = StringUtils.cleanPath(originalFilename);

            // 서브 디렉토리 있는 경우 key 설정
            String safeFileName = FileUtil.generateSafeFileName(originalFilename);
            String key = (subDirectory == null || subDirectory.isBlank())
                    ? safeFileName
                    : subDirectory + "/" + safeFileName;

            // S3에 업로드
            ObjectMetadata metadata = new ObjectMetadata();
            metadata.setContentLength(file.getSize());
            metadata.setContentType(file.getContentType());

            amazonS3.putObject(bucket, key, file.getInputStream(), metadata);

            log.info("S3 파일 저장 완료: {}", key);

            // URL 반환
            return "/api/uploads/" + key;

        } catch (IOException e) {
            log.error("파일 저장 실패: {}", e.getMessage(), e);
            throw new RuntimeException("파일 저장 실패", e);
        }
    }

    @Override
    public Resource loadFileAsResource(String fileName, String requesterId) {
        // DB에서 파일 조회
        File fileEntity = fileRepository.findByFilename(fileName)
                .orElseThrow(() -> new RuntimeException("파일 없음: " + fileName));

        // 해당 파일이 연결된 메시지 조회
        Message message = messageRepository.findByFileId(fileEntity.getId())
                .orElseThrow(() -> new RuntimeException("파일과 연결된 메시지 없음"));

        // 방 참가자 확인
        Room room = roomRepository.findById(message.getRoomId())
                .orElseThrow(() -> new RuntimeException("방이 존재하지 않음"));

        if (!room.getParticipantIds().contains(requesterId)) {
            log.warn("접근 권한 없음: {} (사용자: {})", fileName, requesterId);
            throw new RuntimeException("파일 접근 권한 없음");
        }

        // Presigned GET URL 생성 (5분 유효)
        GeneratePresignedUrlRequest request =
                new GeneratePresignedUrlRequest(bucket, fileName)
                        .withMethod(HttpMethod.GET)
                        .withExpiration(new java.util.Date(System.currentTimeMillis() + 1000 * 60 * 5));

        URL presignedUrl = amazonS3.generatePresignedUrl(request);

        log.info("파일 접근 허용: {} → presigned URL 생성 완료", fileName);

        return new UrlResource(presignedUrl);

    }

    @Override
    public boolean deleteFile(String fileId, String requesterId) {
        try {
            File fileEntity = fileRepository.findById(fileId)
                    .orElseThrow(() -> new RuntimeException("파일 없음"));

            // 삭제 권한 확인
            if (!fileEntity.getUser().equals(requesterId)) {
                throw new RuntimeException("삭제 권한 없음");
            }

            // S3에서 삭제
            amazonS3.deleteObject(bucket, fileEntity.getFilename());

            // DB 삭제
            fileRepository.delete(fileEntity);

            log.info("파일 삭제 완료: {} (사용자: {})", fileId, requesterId);
            return true;

        } catch (Exception e) {
            log.error("파일 삭제 실패: {}", e.getMessage(), e);
            throw new RuntimeException("파일 삭제 실패", e);
        }
    }
}
