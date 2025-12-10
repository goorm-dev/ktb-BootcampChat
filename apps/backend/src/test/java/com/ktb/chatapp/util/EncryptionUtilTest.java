package com.ktb.chatapp.util;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.encrypt.Encryptors;
import org.springframework.security.crypto.encrypt.TextEncryptor;
import org.springframework.test.util.ReflectionTestUtils;

class EncryptionUtilTest {

    private EncryptionUtil encryptionUtil;

    @BeforeEach
    void setUp() {
        // Given: POJO 기반으로 EncryptionUtil 생성
        encryptionUtil = new EncryptionUtil();
        
        // 테스트용 암호화 키와 salt 설정
        String testKey = "testEncryptionKey1234567890123456";
        String testSalt = "3132333435363738";
        
        // @Value 필드를 직접 설정
        ReflectionTestUtils.setField(encryptionUtil, "encryptionKey", testKey);
        ReflectionTestUtils.setField(encryptionUtil, "salt", testSalt);
        
        // TextEncryptor 초기화
        TextEncryptor textEncryptor = Encryptors.text(testKey, testSalt);
        ReflectionTestUtils.setField(encryptionUtil, "textEncryptor", textEncryptor);
    }

    @Test
    void testEncryptDecrypt() {
        // Given
        String plainText = "test@example.com";

        // When
        String encrypted = encryptionUtil.encrypt(plainText);
        String decrypted = encryptionUtil.decrypt(encrypted);

        // Then
        assertNotNull(encrypted);
        assertNotNull(decrypted);
        assertEquals(plainText, decrypted);
        assertNotEquals(plainText, encrypted);
    }

    @Test
    void testEncryptProducesDifferentResults() {
        // Given
        String plainText = "test@example.com";

        // When
        String encrypted1 = encryptionUtil.encrypt(plainText);
        String encrypted2 = encryptionUtil.encrypt(plainText);

        // Then - Spring Security Crypto는 매번 다른 결과를 생성
        assertNotNull(encrypted1);
        assertNotNull(encrypted2);
        assertNotEquals(encrypted1, encrypted2);
        
        // But both decrypt to the same value
        assertEquals(plainText, encryptionUtil.decrypt(encrypted1));
        assertEquals(plainText, encryptionUtil.decrypt(encrypted2));
    }

    @Test
    void testDecryptInvalidData() {
        // Given
        String invalidEncrypted = "invalid_data";

        // When
        String decrypted = encryptionUtil.decrypt(invalidEncrypted);

        // Then
        assertNull(decrypted);
    }
}

