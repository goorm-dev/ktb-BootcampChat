package com.ktb.chatapp.util;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

@Slf4j
@Component
public class FileUtil {

    private static final Map<String, List<String>> ALLOWED_TYPES = Map.ofEntries(
        Map.entry("image/jpeg", Arrays.asList("jpg", "jpeg")),
        Map.entry("image/png", Arrays.asList("png")),
        Map.entry("image/gif", Arrays.asList("gif")),
        Map.entry("image/webp", Arrays.asList("webp")),
        Map.entry("video/mp4", Arrays.asList("mp4")),
        Map.entry("video/webm", Arrays.asList("webm")),
        Map.entry("video/quicktime", Arrays.asList("mov")),
        Map.entry("audio/mpeg", Arrays.asList("mp3")),
        Map.entry("audio/wav", Arrays.asList("wav")),
        Map.entry("audio/ogg", Arrays.asList("ogg")),
        Map.entry("application/pdf", Arrays.asList("pdf")),
        Map.entry("application/msword", Arrays.asList("doc")),
        Map.entry("application/vnd.openxmlformats-officedocument.wordprocessingml.document", Arrays.asList("docx"))
    );

    private static final Map<String, Long> FILE_SIZE_LIMITS = Map.of(
        "image", 10L * 1024 * 1024,      // 10MB
        "video", 50L * 1024 * 1024,      // 50MB
        "audio", 20L * 1024 * 1024,      // 20MB
        "application", 20L * 1024 * 1024 // 20MB (문서)
    );

    private static final SecureRandom secureRandom = new SecureRandom();

    /**
     * 파일 유효성 검증
     */
    public static void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new RuntimeException("파일이 비어있습니다.");
        }

        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || originalFilename.trim().isEmpty()) {
            throw new RuntimeException("파일명이 올바르지 않습니다.");
        }

        // 파일명 길이 검증 (UTF-8 바이트 기준 255바이트)
        int filenameBytes = originalFilename.getBytes(StandardCharsets.UTF_8).length;
        if (filenameBytes > 255) {
            throw new RuntimeException("파일명이 너무 깁니다.");
        }

        // MIME 타입 검증
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_TYPES.containsKey(contentType)) {
            throw new RuntimeException("지원하지 않는 파일 형식입니다.");
        }

        // 확장자-MIME 일치 검증
        String extension = getFileExtension(originalFilename).toLowerCase();
        List<String> allowedExtensions = ALLOWED_TYPES.get(contentType);
        if (allowedExtensions == null || !allowedExtensions.contains(extension)) {
            String fileType = getFileType(contentType);
            throw new RuntimeException(fileType + " 확장자가 올바르지 않습니다.");
        }

        // 타입별 크기 제한 검증
        String type = contentType.split("/")[0];
        long limit = FILE_SIZE_LIMITS.getOrDefault(type, FILE_SIZE_LIMITS.get("application"));
        
        if (file.getSize() > limit) {
            int limitInMB = (int) (limit / 1024 / 1024);
            String fileType = getFileType(contentType);
            throw new RuntimeException(fileType + " 파일은 " + limitInMB + "MB를 초과할 수 없습니다.");
        }
    }

    /**
     * 파일 타입 한글명 반환
     */
    private static String getFileType(String mimetype) {
        if (mimetype == null) return "파일";
        
        String type = mimetype.split("/")[0];
        switch (type) {
            case "image": return "이미지";
            case "video": return "동영상";
            case "audio": return "오디오";
            case "application": return "문서";
            default: return "파일";
        }
    }

    /**
     * 경로 안전성 검증 (Path Traversal 공격 방지)
     */
    public static void validatePath(Path filePath, Path allowedDirectory) {
        try {
            Path normalizedPath = filePath.normalize();
            Path normalizedAllowedDir = allowedDirectory.normalize();

            if (!normalizedPath.startsWith(normalizedAllowedDir)) {
                throw new RuntimeException("허용되지 않은 파일 경로입니다.");
            }
        } catch (Exception e) {
            log.error("경로 검증 실패: {}", e.getMessage());
            throw new RuntimeException("파일 경로가 안전하지 않습니다.");
        }
    }

    /**
     * 파일 확장자 추출
     */
    public static String getFileExtension(String filename) {
        if (filename == null || filename.trim().isEmpty()) {
            return "";
        }

        int lastDot = filename.lastIndexOf('.');
        if (lastDot == -1 || lastDot == filename.length() - 1) {
            return "";
        }

        return filename.substring(lastDot + 1);
    }

    /**
     * 안전한 파일명 생성
     */
    public static String generateSafeFileName(String originalFilename) {
        if (originalFilename == null || originalFilename.trim().isEmpty()) {
            return generateRandomFileName("file");
        }

        // 파일 확장자 분리
        String extension = getFileExtension(originalFilename);

        // 타임스탬프와 16자리 hex 랜덤 값으로 고유성 보장
        long timestamp = Instant.now().toEpochMilli();
        byte[] randomBytes = new byte[8];
        secureRandom.nextBytes(randomBytes);
        String randomHex = bytesToHex(randomBytes);

        if (!extension.isEmpty()) {
            return String.format("%d_%s.%s", timestamp, randomHex, extension);
        } else {
            return String.format("%d_%s", timestamp, randomHex);
        }
    }
    
    /**
     * 바이트 배열을 16진수 문자열로 변환
     */
    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    /**
     * 랜덤 파일명 생성
     */
    private static String generateRandomFileName(String prefix) {
        long timestamp = Instant.now().toEpochMilli();
        int random = secureRandom.nextInt(10000);
        return String.format("%s_%d_%04d", prefix, timestamp, random);
    }

    /**
     * 원본 파일명 정규화 (경로 문자 제거 및 NFC 정규화)
     */
    public static String normalizeOriginalFilename(String originalFilename) {
        if (originalFilename == null || originalFilename.trim().isEmpty()) {
            return "";
        }
        
        // 경로 문자 제거 (/, \)
        String cleaned = originalFilename.replaceAll("[/\\\\]", "");
        
        // NFC 정규화 (한글 등 유니코드 정규화)
        return java.text.Normalizer.normalize(cleaned, java.text.Normalizer.Form.NFC);
    }
    
}
