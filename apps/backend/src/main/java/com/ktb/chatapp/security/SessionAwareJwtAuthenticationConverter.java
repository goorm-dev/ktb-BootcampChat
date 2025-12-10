package com.ktb.chatapp.security;

import com.ktb.chatapp.exception.SessionExpiredException;
import com.ktb.chatapp.service.SessionService;
import com.ktb.chatapp.service.SessionValidationResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class SessionAwareJwtAuthenticationConverter implements Converter<Jwt, AbstractAuthenticationToken> {
    
    private final SessionService sessionService;
    private final JwtGrantedAuthoritiesConverter jwtGrantedAuthoritiesConverter = new JwtGrantedAuthoritiesConverter();
    
    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        // 1. JWT에서 사용자 이메일 및 ID 추출
        String email = jwt.getSubject();  // subject는 이메일
        String userId = jwt.getClaimAsString("userId");  // userId는 별도 claim
        
        // 2. JWT 클레임에서 세션 ID 추출
        String sessionId = jwt.getClaimAsString("sessionId");
        
        // 3. userId 유효성 검증
        if (userId == null) {
            log.warn("JWT missing userId claim for email: {}", email);
            throw new SessionExpiredException("Missing userId in JWT");
        }
        
        // 4. 세션 검증 (필수)
        if (sessionId == null) {
            log.warn("JWT missing sessionId claim for user: {}", userId);
            throw new SessionExpiredException("Missing sessionId in JWT");
        }
        
        SessionValidationResult validation =
            sessionService.validateSession(userId, sessionId);
        
        if (!validation.isValid()) {
            log.debug("Session validation failed: {} - {}",
                validation.getError(), validation.getMessage());
            throw new SessionExpiredException(validation.getMessage());
        }
        
        // 5. Authorities 생성 (기본적으로 빈 리스트)
        Collection<GrantedAuthority> authorities = jwtGrantedAuthoritiesConverter.convert(jwt);
        
        // 6. JwtAuthenticationToken 생성 with details
        JwtAuthenticationToken authenticationToken = new JwtAuthenticationToken(jwt, authorities, email);
        
        // 7. Details에 userId와 sessionId 포함
        Map<String, Object> details = new HashMap<>();
        details.put("userId", userId);
        details.put("sessionId", sessionId);
        details.put("email", email);
        authenticationToken.setDetails(details);
        
        log.debug("JWT authentication successful for user: {} (email: {})", userId, email);
        
        return authenticationToken;
    }
}
