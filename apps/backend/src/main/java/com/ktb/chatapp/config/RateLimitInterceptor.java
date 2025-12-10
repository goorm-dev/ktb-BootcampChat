package com.ktb.chatapp.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ktb.chatapp.annotation.RateLimit;
import com.ktb.chatapp.dto.ApiErrorCode;
import com.ktb.chatapp.dto.StandardResponse;
import com.ktb.chatapp.service.RateLimitCheckResult;
import com.ktb.chatapp.service.RateLimitService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

@Slf4j
@Component
@RequiredArgsConstructor
public class RateLimitInterceptor implements HandlerInterceptor {

    private final RateLimitService rateLimitService;
    private final ObjectMapper objectMapper;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {
        if (!(handler instanceof HandlerMethod handlerMethod)) {
            return true;
        }

        RateLimit rateLimit = resolveRateLimit(handlerMethod);
        if (rateLimit == null) {
            return true;
        }

        int maxRequests = rateLimit.maxRequests();
        Duration window = Duration.ofSeconds(rateLimit.windowSeconds());
        String clientId = generateClientId(request, rateLimit.scope());

        RateLimitCheckResult result = rateLimitService.checkRateLimit(clientId, maxRequests, window);
        applyRateLimitHeaders(response, result);

        if (result.allowed()) {
            return true;
        }

        log.warn("Rate limit exceeded for client: {} on endpoint: {}", clientId, request.getRequestURI());
        writeTooManyRequestsResponse(response, result, maxRequests, window);
        return false;
    }

    private RateLimit resolveRateLimit(HandlerMethod handlerMethod) {
        RateLimit methodRateLimit = handlerMethod.getMethodAnnotation(RateLimit.class);
        if (methodRateLimit != null) {
            return methodRateLimit;
        }
        return handlerMethod.getBeanType().getAnnotation(RateLimit.class);
    }

    private String generateClientId(HttpServletRequest request, RateLimit.LimitScope scope) {
        String clientIp = getClientIpAddress(request);

        switch (scope) {
            case USER:
                Authentication auth = SecurityContextHolder.getContext().getAuthentication();
                if (auth != null && auth.isAuthenticated() && !auth.getName().equals("anonymousUser")) {
                    return "user:" + auth.getName();
                }
                return "ip:" + clientIp;
            case IP_AND_USER:
                Authentication userAuth = SecurityContextHolder.getContext().getAuthentication();
                if (userAuth != null && userAuth.isAuthenticated() && !userAuth.getName().equals("anonymousUser")) {
                    return "ip_user:" + clientIp + ":" + userAuth.getName();
                }
                return "ip:" + clientIp;
            case IP:
            default:
                return "ip:" + clientIp;
        }
    }

    private void applyRateLimitHeaders(HttpServletResponse response, RateLimitCheckResult result) {
        response.setHeader("X-RateLimit-Limit", String.valueOf(result.limit()));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(result.remaining()));
        response.setHeader("X-RateLimit-Reset", String.valueOf(result.resetEpochSeconds()));
        response.setHeader("X-RateLimit-Window", String.valueOf(result.windowSeconds()));
        if (!result.allowed()) {
            response.setHeader("Retry-After", String.valueOf(result.retryAfterSeconds()));
        }
    }

    private void writeTooManyRequestsResponse(
            HttpServletResponse response,
            RateLimitCheckResult result,
            int maxRequests,
            Duration window) throws IOException {
        
        var errorCode = ApiErrorCode.TOO_MANY_REQUESTS;
        response.setStatus(errorCode.getHttpStatus().value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");

        StandardResponse<Object> errorResponse = StandardResponse.error(
                errorCode.getMessage(),
                Map.of(
                        "code", errorCode.getCode(),
                        "maxRequests", maxRequests,
                        "windowMs", window.toMillis(),
                        "retryAfter", result.retryAfterSeconds()));

        objectMapper.writeValue(response.getWriter(), errorResponse);
    }

    private String getClientIpAddress(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }

        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isEmpty()) {
            return xRealIp;
        }

        return request.getRemoteAddr();
    }
}
