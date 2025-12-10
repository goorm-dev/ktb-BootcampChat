package com.ktb.chatapp.util;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.encrypt.Encryptors;
import org.springframework.security.crypto.encrypt.TextEncryptor;
import org.springframework.stereotype.Component;

/**
 * Spring Security Crypto를 사용한 암호화 유틸리티
 * AES-256-GCM with PBKDF2 key derivation
 */
@Slf4j
@Component
public class EncryptionUtil {

    @Value("${app.encryption.key}")
    private String encryptionKey;
    
    @Value("${app.encryption.salt:defaultSalt123456}")
    private String salt;
    
    private TextEncryptor textEncryptor;
    
    @PostConstruct
    public void init() {
        this.textEncryptor = Encryptors.text(encryptionKey, salt);
    }
    
    public String encrypt(String plainText) {
        return textEncryptor.encrypt(plainText);
    }

    public String decrypt(String encryptedText) {
        try {
            return textEncryptor.decrypt(encryptedText);
        } catch (IllegalArgumentException e) {
            log.error("Decryption failed for text: {}", encryptedText);
            return null;
        }
    }
}
