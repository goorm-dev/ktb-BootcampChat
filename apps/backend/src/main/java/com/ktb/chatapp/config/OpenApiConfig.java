package com.ktb.chatapp.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * OpenAPI (Swagger) 설정 클래스
 */
@Configuration
public class OpenApiConfig {

    @Value("${server.port:8080}")
    private String serverPort;

    @Value("${spring.profiles.active:production}")
    private String activeProfile;

    @Bean
    public OpenAPI customOpenAPI() {
        // 서버 정보 설정
        Server localServer = new Server()
                .url("http://localhost:" + serverPort)
                .description("로컬 개발 서버");

        Server productionServer = new Server()
                .url("https://api.ktb-chat.com")
                .description("프로덕션 서버");

        // 보안 스키마 이름
        String jwtSchemeName = "Bearer Authentication";
        String sessionSchemeName = "Session ID";

        return new OpenAPI()
                .info(new Info()
                        .title("KTB Chat API")
                        .description("""
                                KTB 채팅 애플리케이션 REST API 문서입니다.

                                ## 인증 방법
                                1. `/api/auth/register` 또는 `/api/auth/login`으로 회원가입/로그인
                                2. 응답으로 받은 `token`과 `sessionId`를 사용
                                3. 이후 모든 요청에 다음 헤더 포함:
                                   - `Authorization: Bearer {token}`
                                   - `x-session-id: {sessionId}`

                                ## 주요 기능
                                - 사용자 인증 및 관리
                                - 채팅방 생성 및 관리
                                - 실시간 메시징 (Socket.IO)
                                - 파일 업로드/다운로드
                                - AI 기반 채팅

                                ## 에러 응답 형식
                                모든 에러는 다음 형식으로 반환됩니다:
                                ```json
                                {
                                  "success": false,
                                  "code": "ERROR_CODE",
                                  "message": "에러 메시지",
                                  "errors": [...], // 유효성 검증 에러 시
                                  "path": "/api/endpoint"
                                }
                                ```
                                """)
                        .version("1.0.0")
                        .contact(new Contact()
                                .name("KTB Chat Team")
                                .email("support@ktb-chat.com")))
                .servers(List.of(localServer, productionServer))
                .components(new Components()
                        // JWT Bearer Token 보안 스키마
                        .addSecuritySchemes(jwtSchemeName, new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("JWT 토큰을 입력하세요 (Bearer 접두사 제외)"))
                        // Session ID 헤더 보안 스키마
                        .addSecuritySchemes(sessionSchemeName, new SecurityScheme()
                                .type(SecurityScheme.Type.APIKEY)
                                .in(SecurityScheme.In.HEADER)
                                .name("x-session-id")
                                .description("세션 ID를 입력하세요"))
                        // 공통 에러 응답 스키마
                        .addSchemas("ApiErrorResponse", new Schema<>()
                                .type("object")
                                .description("API 에러 응답")
                                .addProperty("success", new Schema<>().type("boolean").example(false))
                                .addProperty("code", new Schema<>().type("string").example("ERROR_CODE"))
                                .addProperty("message", new Schema<>().type("string").example("에러 메시지"))
                                .addProperty("path", new Schema<>().type("string").example("/api/endpoint")))
                        // 유효성 검증 에러 응답 스키마
                        .addSchemas("ValidationErrorResponse", new Schema<>()
                                .type("object")
                                .description("유효성 검증 에러 응답")
                                .addProperty("success", new Schema<>().type("boolean").example(false))
                                .addProperty("code", new Schema<>().type("string").example("VALIDATION_ERROR"))
                                .addProperty("errors", new Schema<>().type("array")
                                        .items(new Schema<>()
                                                .type("object")
                                                .addProperty("field", new Schema<>().type("string").example("email"))
                                                .addProperty("message", new Schema<>().type("string").example("올바른 이메일 형식이 아닙니다."))))
                                .addProperty("path", new Schema<>().type("string").example("/api/auth/register")))
                        // 공통 에러 응답 정의
                        .addResponses("UnauthorizedError", new ApiResponse()
                                .description("인증 실패 - 토큰이 유효하지 않거나 만료되었습니다.")
                                .content(new Content()
                                        .addMediaType("application/json", new MediaType()
                                                .schema(new Schema<>().$ref("#/components/schemas/ApiErrorResponse"))
                                                .example("{ \"success\": false, \"code\": \"UNAUTHORIZED\", \"message\": \"인증이 필요합니다.\", \"path\": \"/api/users/profile\" }"))))
                        .addResponses("ForbiddenError", new ApiResponse()
                                .description("권한 없음 - 해당 리소스에 접근할 권한이 없습니다.")
                                .content(new Content()
                                        .addMediaType("application/json", new MediaType()
                                                .schema(new Schema<>().$ref("#/components/schemas/ApiErrorResponse"))
                                                .example("{ \"success\": false, \"code\": \"FORBIDDEN\", \"message\": \"권한이 없습니다.\", \"path\": \"/api/rooms/123\" }"))))
                        .addResponses("NotFoundError", new ApiResponse()
                                .description("리소스를 찾을 수 없습니다.")
                                .content(new Content()
                                        .addMediaType("application/json", new MediaType()
                                                .schema(new Schema<>().$ref("#/components/schemas/ApiErrorResponse"))
                                                .example("{ \"success\": false, \"code\": \"RESOURCE_NOT_FOUND\", \"message\": \"요청한 리소스를 찾을 수 없습니다.\" }"))))
                        .addResponses("ValidationError", new ApiResponse()
                                .description("유효성 검증 실패 - 입력값이 올바르지 않습니다.")
                                .content(new Content()
                                        .addMediaType("application/json", new MediaType()
                                                .schema(new Schema<>().$ref("#/components/schemas/ValidationErrorResponse"))
                                                .example("{ \"success\": false, \"code\": \"VALIDATION_ERROR\", \"errors\": [{ \"field\": \"email\", \"message\": \"올바른 이메일 형식이 아닙니다.\" }] }"))))
                        .addResponses("InternalServerError", new ApiResponse()
                                .description("서버 내부 오류가 발생했습니다.")
                                .content(new Content()
                                        .addMediaType("application/json", new MediaType()
                                                .schema(new Schema<>().$ref("#/components/schemas/ApiErrorResponse"))
                                                .example("{ \"success\": false, \"code\": \"INTERNAL_SERVER_ERROR\", \"message\": \"서버 내부 오류가 발생했습니다.\" }"))))
                        .addResponses("TooManyRequestsError", new ApiResponse()
                                .description("요청 한도 초과 - 너무 많은 요청이 발생했습니다.")
                                .content(new Content()
                                        .addMediaType("application/json", new MediaType()
                                                .schema(new Schema<>().$ref("#/components/schemas/ApiErrorResponse"))
                                                .example("{ \"success\": false, \"code\": \"RATE_LIMIT_EXCEEDED\", \"message\": \"요청 한도를 초과했습니다.\" }")))))
                // 글로벌 보안 요구사항 (일부 엔드포인트는 개별적으로 재정의)
                .addSecurityItem(new SecurityRequirement()
                        .addList(jwtSchemeName)
                        .addList(sessionSchemeName));
    }
}
