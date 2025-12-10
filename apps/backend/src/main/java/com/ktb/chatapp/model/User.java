package com.ktb.chatapp.model;

import com.ktb.chatapp.util.EncryptionUtil;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.event.AbstractMongoEventListener;
import org.springframework.data.mongodb.core.mapping.event.BeforeConvertEvent;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "users")
public class User {

    @Id
    private String id;

    private String name;

    @Indexed(unique = true)
    private String email;
    
    private String encryptedEmail;

    private String password;

    private String profileImage;

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    private LocalDateTime lastActive;

    private LocalDateTime lastLogin;

    private boolean isOnline = false;
    
    /**
     * Email lowercase conversion before save
     */
    @Component
    public static class UserEventListener extends AbstractMongoEventListener<User> {
        
        private final org.springframework.context.ApplicationContext applicationContext;
        
        public UserEventListener(org.springframework.context.ApplicationContext applicationContext) {
            this.applicationContext = applicationContext;
        }
        
        @Override
        public void onBeforeConvert(BeforeConvertEvent<User> event) {
            User user = event.getSource();
            if (user.getEmail() != null) {
                user.setEmail(user.getEmail().toLowerCase());
                
                // 이메일 암호화
                try {
                    EncryptionUtil encryptionUtil =
                        applicationContext.getBean(EncryptionUtil.class);
                    String encrypted = encryptionUtil.encrypt(user.getEmail());
                    if (encrypted != null) {
                        user.setEncryptedEmail(encrypted);
                    }
                } catch (Exception e) {
                    // 암호화 실패 시 로그만 남기고 계속 진행
                    System.err.println("Email encryption failed: " + e.getMessage());
                }
            }
        }
    }
}