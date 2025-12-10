package com.ktb.chatapp.controller;

import com.ktb.chatapp.dto.StandardResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

/**
 * 메시지 시스템 REST API 컨트롤러
 *
 * - GET /api/message/rooms/:roomId/messages → 500 에러 (미구현)
 * - 모든 메시지 기능은 Socket.IO를 통해 제공됨
 */
@Tag(name = "메시지 (Messages)", description = "메시지 관련 API (주의: 실제 메시지 기능은 Socket.IO를 통해 제공됩니다)")
@Slf4j
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/message")
public class MessageController {

    /**
     * 채팅방 메시지 조회 - 미구현 (500 반환)
     * 실제 메시지 조회는 Socket.IO의 'fetchPreviousMessages' 이벤트를 사용하세요.
     */
    @Operation(
        summary = "메시지 조회 (미구현)",
        description = "이 엔드포인트는 미구현 상태입니다. 실제 메시지 조회는 Socket.IO의 'fetchPreviousMessages' 이벤트를 사용하세요.",
        deprecated = true
    )
    @ApiResponses({
        @ApiResponse(responseCode = "500", description = "미구현 엔드포인트",
            content = @Content(schema = @Schema(implementation = StandardResponse.class),
                examples = @ExampleObject(value = "{\"success\":false,\"message\":\"미구현.\"}")))
    })
    @GetMapping("/rooms/{roomId}/messages")
    public ResponseEntity<?> loadMessages(
            @Parameter(description = "채팅방 ID") @PathVariable String roomId,
            @Parameter(description = "이전 메시지 ID (페이지네이션)") @RequestParam(required = false) String before,
            @Parameter(description = "조회할 메시지 개수", example = "30") @RequestParam(defaultValue = "30") Integer limit,
            Principal principal) {
        log.debug("Message REST API called - returning 500 (not implemented, use Socket.IO)");
        
        return ResponseEntity.status(500).body(
                StandardResponse.error("미구현.")
        );
    }
}
