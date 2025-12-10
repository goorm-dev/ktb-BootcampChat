package com.ktb.chatapp.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class CustomBearerTokenResolver implements BearerTokenResolver {
    
    private static final String CUSTOM_HEADER = "x-auth-token";
    private static final String SESSION_HEADER = "x-session-id";
    
    @Override
    public String resolve(HttpServletRequest request) {
        // 1. Try custom header first (x-auth-token)
        String token = request.getHeader(CUSTOM_HEADER);
        if (StringUtils.hasText(token)) {
            return token;
        }
        
        // 2. Try query parameter (for WebSocket connections)
        token = request.getParameter("token");
        if (StringUtils.hasText(token)) {
            return token;
        }
        
        // 3. Try standard Authorization header (Bearer scheme)
        String authHeader = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (StringUtils.hasText(authHeader) && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }
        
        return null;
    }
}
