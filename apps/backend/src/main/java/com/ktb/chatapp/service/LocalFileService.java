package com.ktb.chatapp.service;

import com.ktb.chatapp.model.File;
import com.ktb.chatapp.model.Message;
import com.ktb.chatapp.model.Room;
import com.ktb.chatapp.repository.FileRepository;
import com.ktb.chatapp.repository.MessageRepository;
import com.ktb.chatapp.repository.RoomRepository;
import com.ktb.chatapp.util.FileUtil;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.net.URL;
import java.time.LocalDateTime;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.S3Utilities;

@Slf4j
@Service
public class LocalFileService implements FileService {

    private final FileRepository fileRepository;
    private final MessageRepository messageRepository;
    private final RoomRepository roomRepository;
    private final S3Client s3Client;

    private final String bucketName;
    private final String baseDir;

    public LocalFileService(
            // 예전에는 로컬 디렉토리 경로였지만, 지금은 사용하지 않음 (호환용으로만 남겨둠)
            @Value("${file.upload-dir:uploads}") String uploadDir,
            @Value("${cloud.aws.s3.bucket}") String bucketName,
            @Value("${cloud.aws.s3.base-dir:uploads}") String baseDir,
            FileRepository fileRepository,
            MessageRepository messageRepository,
            RoomRepository roomRepository,
            S3Client s3Client
    ) {
        this.fileRepository = fileRepository;
        this.messageRepository = messageRepository;
        this.roomRepository = roomRepository;
        this.s3Client = s3Client;
        this.bucketName = bucketName;
        this.baseDir = baseDir;
    }

    @PostConstruct
    public void init() {
        // 예전에는 로컬 디렉토리 생성하던 곳
        log.info("S3 FileService 초기화 - bucket: {}, baseDir: {}", bucketName, baseDir);
    }

    private String buildKey(String safeFileName) {
        // 간단히 baseDir/safeFileName 형식으로 저장
        if (baseDir == null || baseDir.isBlank()) {
            return safeFileName;
        }
        return baseDir.replaceFirst("/+$", "") + "/" + safeFileName;
    }

    @Override
    public FileUploadResult uploadFile(MultipartFile file, String uploaderId) {
        try {
            // 1. 파일 보안 검증
            FileUtil.validateFile(file);

            // 2. 파일명 정리 및 safeFileName 생성
            String originalFilename = file.getOriginalFilename();
            if (originalFilename == null) {
                originalFilename = "file";
            }
            originalFilename = StringUtils.cleanPath(originalFilename);
            String safeFileName = FileUtil.generateSafeFileName(originalFilename);

            // 3. S3 Object Key 생성
            String key = buildKey(safeFileName);

            // 4. S3 업로드
            PutObjectRequest putRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .contentType(file.getContentType())
                    .contentLength(file.getSize())
                    .build();

            s3Client.putObject(putRequest, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));

            log.info("S3 업로드 완료: bucket={}, key={}", bucketName, key);

            // 5. 원본 파일명 정규화
            String normalizedOriginalname = FileUtil.normalizeOriginalFilename(originalFilename);

            // 6. 메타데이터 MongoDB 저장
            File fileEntity = File.builder()
                    .filename(safeFileName)
                    .originalname(normalizedOriginalname)
                    .mimetype(file.getContentType())
                    .size(file.getSize())
                    .path(key)               // 여기에는 S3 Object Key 저장
                    .user(uploaderId)
                    .uploadDate(LocalDateTime.now())
                    .build();

            File savedFile = fileRepository.save(fileEntity);

            return FileUploadResult.builder()
                    .success(true)
                    .file(savedFile)
                    .build();

        } catch (Exception e) {
            log.error("S3 파일 업로드 처리 실패: {}", e.getMessage(), e);
            throw new RuntimeException("파일 업로드에 실패했습니다: " + e.getMessage(), e);
        }
    }

    @Override
    public String storeFile(MultipartFile file, String subDirectory) {
        try {
            // 1. 파일 보안 검증
            FileUtil.validateFile(file);

            // 2. 파일명 및 key 생성
            String originalFilename = file.getOriginalFilename();
            if (originalFilename == null) {
                originalFilename = "file";
            }
            originalFilename = StringUtils.cleanPath(originalFilename);
            String safeFileName = FileUtil.generateSafeFileName(originalFilename);

            String keyBase = baseDir;
            if (subDirectory != null && !subDirectory.trim().isEmpty()) {
                keyBase = baseDir.replaceFirst("/+$", "") + "/" + subDirectory.replaceFirst("^/+", "");
            }
            String key = (keyBase == null || keyBase.isBlank())
                    ? safeFileName
                    : keyBase.replaceFirst("/+$", "") + "/" + safeFileName;

            // 3. S3 업로드
            PutObjectRequest putRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .contentType(file.getContentType())
                    .contentLength(file.getSize())
                    .build();

            s3Client.putObject(putRequest, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));

            log.info("S3 storeFile 업로드 완료: bucket={}, key={}", bucketName, key);

            // 4. 접근용 URL 반환 (public 버킷 or CloudFront 전제)
            S3Utilities utilities = s3Client.utilities();
            URL url = utilities.getUrl(builder -> builder.bucket(bucketName).key(key));
            return url.toExternalForm();

            /*
             * 만약 “/api/files/view/{filename}” 같은 백엔드 경로로만 접근시키고 싶다면
             * 여기 대신:
             *   return "/api/files/view/" + safeFileName;
             * 로 바꾸고, 별도로 File 엔티티도 저장하는 형태로 확장하면 됨.
             */

        } catch (IOException ex) {
            log.error("S3 storeFile 실패: {}", ex.getMessage(), ex);
            throw new RuntimeException("파일 저장에 실패했습니다: " + ex.getMessage(), ex);
        }
    }

    @Override
    public Resource loadFileAsResource(String fileName, String requesterId) {
        try {
            // 1. 파일 메타데이터 조회
            File fileEntity = fileRepository.findByFilename(fileName)
                    .orElseThrow(() -> new RuntimeException("파일을 찾을 수 없습니다: " + fileName));

            // 2. 메시지 조회 (파일과 메시지 연결 확인)
            Message message = messageRepository.findByFileId(fileEntity.getId())
                    .orElseThrow(() -> new RuntimeException("파일과 연결된 메시지를 찾을 수 없습니다"));

            // 3. 방 조회 (사용자가 방 참가자인지 확인)
            Room room = roomRepository.findById(message.getRoomId())
                    .orElseThrow(() -> new RuntimeException("방을 찾을 수 없습니다"));

            // 4. 권한 검증
            if (!room.getParticipantIds().contains(requesterId)) {
                log.warn("파일 접근 권한 없음: {} (사용자: {})", fileName, requesterId);
                throw new RuntimeException("파일에 접근할 권한이 없습니다");
            }

            // 5. S3에서 파일 로드
            String key = (fileEntity.getPath() != null && !fileEntity.getPath().isBlank())
                    ? fileEntity.getPath()
                    : buildKey(fileEntity.getFilename());

            GetObjectRequest getRequest = GetObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .build();

            ResponseInputStream<?> s3Object = s3Client.getObject(getRequest);

            Resource resource = new InputStreamResource(s3Object) {
                @Override
                public String getFilename() {
                    return fileEntity.getFilename();
                }
            };

            log.info("S3 파일 로드 성공: key={} (사용자: {})", key, requesterId);
            return resource;

        } catch (Exception ex) {
            log.error("S3 파일 로드 실패: {}", ex.getMessage(), ex);
            throw new RuntimeException("파일을 찾을 수 없습니다: " + fileName, ex);
        }
    }

    @Override
    public boolean deleteFile(String fileId, String requesterId) {
        try {
            File fileEntity = fileRepository.findById(fileId)
                    .orElseThrow(() -> new RuntimeException("파일을 찾을 수 없습니다."));

            // 삭제 권한 검증 (업로더만 삭제 가능)
            if (!fileEntity.getUser().equals(requesterId)) {
                throw new RuntimeException("파일을 삭제할 권한이 없습니다.");
            }

            // 1. S3에서 객체 삭제
            String key = (fileEntity.getPath() != null && !fileEntity.getPath().isBlank())
                    ? fileEntity.getPath()
                    : buildKey(fileEntity.getFilename());

            DeleteObjectRequest deleteRequest = DeleteObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .build();

            s3Client.deleteObject(deleteRequest);

            // 2. MongoDB 메타데이터 삭제
            fileRepository.delete(fileEntity);

            log.info("S3 파일 삭제 완료: fileId={}, key={}, user={}", fileId, key, requesterId);
            return true;

        } catch (Exception e) {
            log.error("S3 파일 삭제 실패: {}", e.getMessage(), e);
            throw new RuntimeException("파일 삭제 중 오류가 발생했습니다.", e);
        }
    }
}
