package com.ktb.chatapp.config;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.server.resource.BearerTokenError;

@Configuration
public class JwtConfig {

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    /**
     * JwtEncoder 빈 생성
     * JWT 토큰 생성을 위한 표준 인코더
     */
    @Bean
    public JwtEncoder jwtEncoder() {
        SecretKey key = new SecretKeySpec(
            jwtSecret.getBytes(StandardCharsets.UTF_8),
            "HmacSHA256"
        );
        return new NimbusJwtEncoder(new ImmutableSecret<>(key));
    }

    /**
     * NimbusJwtDecoder 빈 생성
     * Spring Security 6의 표준 JWT 디코더 사용
     */
    @Bean
    public JwtDecoder jwtDecoder() {
        SecretKeySpec secretKey = new SecretKeySpec(
            jwtSecret.getBytes(StandardCharsets.UTF_8),
            "HmacSHA256"
        );

        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(secretKey)
            .macAlgorithm(MacAlgorithm.HS256)
            .build();

        // Custom Validator 추가 (sessionId, userId 클레임 검증)
        OAuth2TokenValidator<Jwt> validator = new CustomJwtValidator();
        OAuth2TokenValidator<Jwt> defaultValidators = JwtValidators.createDefault();
        
        // 기본 검증기와 커스텀 검증기를 조합
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(defaultValidators, validator));

        return decoder;
    }

    /**
     * 만료된 토큰 처리를 위한 JwtDecoder
     * 세션 정리 등의 목적으로 만료된 토큰에서 클레임을 추출해야 할 때 사용
     */
    @Bean("expiredTokenDecoder")
    public JwtDecoder expiredTokenDecoder() {
        SecretKeySpec secretKey = new SecretKeySpec(
            jwtSecret.getBytes(StandardCharsets.UTF_8),
            "HmacSHA256"
        );

        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(secretKey)
            .macAlgorithm(MacAlgorithm.HS256)
            .build();

        // 시간 검증을 제외한 커스텀 검증기만 적용
        OAuth2TokenValidator<Jwt> validator = new CustomJwtValidator();
        decoder.setJwtValidator(validator);

        return decoder;
    }

    /**
     * Custom JWT Validator
     * sessionId와 userId 클레임이 존재하는지 검증
     */
    private static class CustomJwtValidator implements OAuth2TokenValidator<Jwt> {
        
        @Override
        public OAuth2TokenValidatorResult validate(Jwt jwt) {
            // sessionId 클레임 검증
            String sessionId = jwt.getClaimAsString("sessionId");
            if (sessionId == null || sessionId.isEmpty()) {
                BearerTokenError error = new BearerTokenError(
                    "invalid_token",
                    null,
                    "Missing required claim: sessionId",
                    null
                );
                return OAuth2TokenValidatorResult.failure(error);
            }

            // userId 클레임 검증
            String userId = jwt.getClaimAsString("userId");
            if (userId == null || userId.isEmpty()) {
                BearerTokenError error = new BearerTokenError(
                    "invalid_token",
                    null,
                    "Missing required claim: userId",
                    null
                );
                return OAuth2TokenValidatorResult.failure(error);
            }

            return OAuth2TokenValidatorResult.success();
        }
    }
}
