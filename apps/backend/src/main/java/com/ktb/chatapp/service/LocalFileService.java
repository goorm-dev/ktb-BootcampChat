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
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Slf4j
//@Service
public class LocalFileService implements FileService {

    private final Path fileStorageLocation;
    private final FileRepository fileRepository;
    private final MessageRepository messageRepository;
    private final RoomRepository roomRepository;

    public LocalFileService(@Value("${file.upload-dir:uploads}") String uploadDir,
                      FileRepository fileRepository,
                      MessageRepository messageRepository,
                      RoomRepository roomRepository) {
        this.fileRepository = fileRepository;
        this.messageRepository = messageRepository;
        this.roomRepository = roomRepository;
        this.fileStorageLocation = Paths.get(uploadDir).toAbsolutePath().normalize();
    }
    
    @PostConstruct
    public void init() {
        try {
            Files.createDirectories(this.fileStorageLocation);
        } catch (Exception ex) {
            throw new RuntimeException("Could not create the directory where the uploaded files will be stored.", ex);
        }
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

            // 파일 경로 보안 검증
            Path filePath = fileStorageLocation.resolve(safeFileName);
            FileUtil.validatePath(filePath, fileStorageLocation);

            // 파일 저장
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

            log.info("파일 저장 완료: {}", safeFileName);

            // 원본 파일명 정규화
            String normalizedOriginalname = FileUtil.normalizeOriginalFilename(originalFilename);

            // 메타데이터 생성 및 저장
            File fileEntity = File.builder()
                    .filename(safeFileName)
                    .originalname(normalizedOriginalname)
                    .mimetype(file.getContentType())
                    .size(file.getSize())
                    .path(filePath.toString())
                    .user(uploaderId)
                    .uploadDate(LocalDateTime.now())
                    .build();

            File savedFile = fileRepository.save(fileEntity);

            return FileUploadResult.builder()
                    .success(true)
                    .file(savedFile)
                    .build();

        } catch (Exception e) {
            log.error("파일 업로드 처리 실패: {}", e.getMessage(), e);
            throw new RuntimeException("파일 업로드에 실패했습니다: " + e.getMessage(), e);
        }
    }

    @Override
    public String storeFile(MultipartFile file, String subDirectory) {
        try {
            // 파일 보안 검증
            FileUtil.validateFile(file);

            // 서브디렉토리 생성 (예: profiles)
            Path targetLocation = fileStorageLocation;
            if (subDirectory != null && !subDirectory.trim().isEmpty()) {
                targetLocation = fileStorageLocation.resolve(subDirectory);
                Files.createDirectories(targetLocation);
            }

            // 안전한 파일명 생성
            String originalFilename = file.getOriginalFilename();
            if (originalFilename == null) {
                originalFilename = "file";
            }
            originalFilename = StringUtils.cleanPath(originalFilename);
            String safeFileName = FileUtil.generateSafeFileName(originalFilename);

            // 파일 경로 보안 검증
            Path filePath = targetLocation.resolve(safeFileName);
            FileUtil.validatePath(filePath, targetLocation);

            // 파일 저장
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

            log.info("파일 저장 완료: {}", safeFileName);

            // URL 반환 (서브디렉토리 포함)
            if (subDirectory != null && !subDirectory.trim().isEmpty()) {
                return "/api/uploads/" + subDirectory + "/" + safeFileName;
            } else {
                return "/api/uploads/" + safeFileName;
            }

        } catch (IOException ex) {
            log.error("파일 저장 실패: {}", ex.getMessage(), ex);
            throw new RuntimeException("파일 저장에 실패했습니다: " + ex.getMessage(), ex);
        }
    }

    @Override
    public Resource loadFileAsResource(String fileName, String requesterId) {
        try {
            // 1. 파일 조회
            File fileEntity = fileRepository.findByFilename(fileName)
                    .orElseThrow(() -> new RuntimeException("파일을 찾을 수 없습니다: " + fileName));

            // 2. 메시지 조회 (파일과 메시지 연결 확인) - 효율적인 쿼리 메서드 사용
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

            // 5. 파일 경로 검증 및 로드
            Path filePath = this.fileStorageLocation.resolve(fileName).normalize();
            FileUtil.validatePath(filePath, this.fileStorageLocation);

            Resource resource = new UrlResource(filePath.toUri());
            if (resource.exists()) {
                log.info("파일 로드 성공: {} (사용자: {})", fileName, requesterId);
                return resource;
            } else {
                throw new RuntimeException("파일을 찾을 수 없습니다: " + fileName);
            }
        } catch (MalformedURLException ex) {
            log.error("파일 로드 실패: {}", ex.getMessage(), ex);
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

            // 물리적 파일 삭제
            Path filePath = this.fileStorageLocation.resolve(fileEntity.getFilename());
            Files.deleteIfExists(filePath);

            // 데이터베이스에서 제거
            fileRepository.delete(fileEntity);

            log.info("파일 삭제 완료: {} (사용자: {})", fileId, requesterId);
            return true;

        } catch (Exception e) {
            log.error("파일 삭제 실패: {}", e.getMessage(), e);
            throw new RuntimeException("파일 삭제 중 오류가 발생했습니다.", e);
        }
    }
}
