package com.ktb.chatapp.config;

import com.ktb.chatapp.security.CustomBearerTokenResolver;
import com.ktb.chatapp.security.SessionAwareJwtAuthenticationConverter;
import java.time.Duration;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
@Slf4j
public class SecurityConfig {

    private final JwtDecoder jwtDecoder;
    private final CustomBearerTokenResolver bearerTokenResolver;
    private final SessionAwareJwtAuthenticationConverter jwtAuthenticationConverter;

    private static final List<String> CORS_ALLOWED_ORIGINS = List.of("*");

    private static final List<String> CORS_ALLOWED_HEADERS = List.of(
            "Content-Type",
            "Authorization",
            "x-auth-token",
            "x-session-id",
            "Cache-Control",
            "Pragma"
    );

    private static final List<String> CORS_EXPOSED_HEADERS = List.of(
            "x-auth-token",
            "x-session-id"
    );

    private static final List<String> CORS_ALLOWED_METHODS = List.of("GET", "POST", "PUT", "DELETE", "OPTIONS");

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authenticationConfiguration) throws Exception {
        return authenticationConfiguration.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {

        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(request -> createCorsConfiguration()))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers(
                                "/api/health",
                                "/api/auth/**",
                                "/api/v3/api-docs/**",
                                "/api/swagger-ui/**",
                                "/api/swagger-ui.html",
                                "/api/docs/**"
                        ).permitAll()
                        .requestMatchers("/api/**").authenticated()
                        .anyRequest().permitAll()
                )
                .securityMatcher("/api/**")
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                )
                // Spring Security 6 OAuth2 Resource Server 설정
                .oauth2ResourceServer(oauth2 -> oauth2
                        .bearerTokenResolver(bearerTokenResolver)
                        .jwt(jwt -> jwt
                                .decoder(jwtDecoder)
                                .jwtAuthenticationConverter(jwtAuthenticationConverter)
                        )
                );
        
        return http.build();
    }

    private CorsConfiguration createCorsConfiguration() {
        CorsConfiguration config = new CorsConfiguration();
        if (CORS_ALLOWED_ORIGINS.contains("*")) {
            log.warn("╔═══════════════════════════════════════════════════════════════════════════════╗");
            log.warn("║                           ⚠️  CORS 보안 경고  ⚠️                              ║");
            log.warn("╠═══════════════════════════════════════════════════════════════════════════════╣");
            log.warn("║  CORS_ALLOWED_ORIGINS에 와일드카드 '*'가 포함되어 있습니다.                 ║");
            log.warn("║  ➜ 모든 Origin의 요청을 허용하므로 보안 위험이 있습니다.                    ║");
            log.warn("║                                                                               ║");
            log.warn("║  🔓 예상하지 못한 도메인에서의 요청도 수용됩니다:                           ║");
            log.warn("║     예시) https://a-team-front.com → https://b-team-backend.com             ║");
            log.warn("║                                                                               ║");
            log.warn("║  💡 팀 도메인으로 CORS 설정하세요.         ║");
            log.warn("╚═══════════════════════════════════════════════════════════════════════════════╝");
        }
        config.setAllowedOriginPatterns(CORS_ALLOWED_ORIGINS);
        config.setAllowedMethods(CORS_ALLOWED_METHODS);
        config.setAllowedHeaders(CORS_ALLOWED_HEADERS);
        config.setExposedHeaders(CORS_EXPOSED_HEADERS);
        config.setAllowCredentials(true);
        config.setMaxAge(Duration.ofHours(1).getSeconds());
        return config;
    }
}
