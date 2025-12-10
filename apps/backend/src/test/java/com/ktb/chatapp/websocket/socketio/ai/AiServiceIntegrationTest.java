package com.ktb.chatapp.websocket.socketio.ai;

import com.ktb.chatapp.config.MongoTestContainer;
import com.ktb.chatapp.websocket.socketio.handler.StreamingSession;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import reactor.core.publisher.Flux;
import reactor.test.StepVerifier;

import static org.junit.jupiter.api.Assertions.*;

/**
 * AiService 통합 테스트
 * 실제 OpenAI API를 호출하여 테스트
 *
 * 테스트 실행 방법:
 * mvn test -Dtest=AiServiceIntegrationTest -Dspring.ai.openai.api-key=YOUR_API_KEY
 *
 * 또는 환경변수 설정:
 * export OPENAI_API_KEY=your_actual_api_key
 * mvn test -Dtest=AiServiceIntegrationTest
 */
@SpringBootTest
@DisplayName("AiService 통합 테스트 (실제 API 호출)")
@TestPropertySource(properties = "socketio.enabled=true")
@Import(MongoTestContainer.class)
@Disabled("실제 AI 호출")
class AiServiceIntegrationTest {

    @Autowired
    private AiService aiService;

    private StreamingSession session;

    @BeforeEach
    void setUp() {
        session = StreamingSession.builder()
                .messageId("test-message-id")
                .roomId("test-room-id")
                .userId("test-user-id")
                .timestamp(System.currentTimeMillis())
                .query("안녕하세요")
                .build();
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "OPENAI_API_KEY", matches = ".+")
    @DisplayName("Wayne AI - 실제 스트리밍 응답 생성")
    void streamResponse_WayneAI_Success() {
        // Given
        session.setAiType("wayneai");
        session.setQuery("간단하게 자바의 주요 특징 3가지만 알려주세요");

        // When
        Flux<ChunkData> responseFlux = aiService.streamResponse(session);

        // Then
        StepVerifier.create(responseFlux)
                .expectNextMatches(chunk -> {
                    assertNotNull(chunk.currentChunk());
                    assertFalse(chunk.currentChunk().isBlank());
                    return true;
                })
                .expectNextCount(0) // 최소 1개 이상의 청크를 기대
                .thenCancel() // 스트리밍이 길어질 수 있으므로 취소
                .verify(Duration.ofSeconds(30));
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "OPENAI_API_KEY", matches = ".+")
    @DisplayName("Consulting AI - 실제 스트리밍 응답 생성")
    void streamResponse_ConsultingAI_Success() {
        // Given
        session.setAiType("consultingai");
        session.setQuery("스타트업의 초기 전략에 대해 간단히 알려주세요");

        // When
        Flux<ChunkData> responseFlux = aiService.streamResponse(session);

        // Then
        StepVerifier.create(responseFlux)
                .expectNextMatches(chunk -> {
                    assertNotNull(chunk.currentChunk());
                    assertFalse(chunk.currentChunk().isBlank());
                    return true;
                })
                .expectNextCount(0)
                .thenCancel()
                .verify(Duration.ofSeconds(30));
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "OPENAI_API_KEY", matches = ".+")
    @DisplayName("스트리밍 응답 - 전체 청크 수집 및 검증")
    void streamResponse_CollectAllChunks_Success() {
        // Given
        session.setAiType("wayneai");
        session.setQuery("'Hello World'라고만 응답해주세요");

        // When
        Flux<ChunkData> responseFlux = aiService.streamResponse(session);

        // Then
        StepVerifier.create(responseFlux.collectList())
                .assertNext(chunks -> {
                    assertFalse(chunks.isEmpty(), "청크 리스트가 비어있지 않아야 합니다");
                    
                    // 모든 청크를 연결하여 전체 응답 생성
                    StringBuilder fullResponse = new StringBuilder();
                    for (ChunkData chunk : chunks) {
                        fullResponse.append(chunk.currentChunk());
                    }
                    
                    String response = fullResponse.toString();
                    assertNotNull(response);
                    assertFalse(response.isBlank(), "전체 응답이 비어있지 않아야 합니다");
                    
                    System.out.println("=== 전체 응답 ===");
                    System.out.println(response);
                    System.out.println("=== 청크 수: " + chunks.size() + " ===");
                })
                .verifyComplete();
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "OPENAI_API_KEY", matches = ".+")
    @DisplayName("코드 블록 상태 추적 테스트")
    void streamResponse_CodeBlockTracking_Success() {
        // Given
        session.setAiType("wayneai");
        session.setQuery("자바로 'Hello World'를 출력하는 코드를 작성해주세요");

        // When
        Flux<ChunkData> responseFlux = aiService.streamResponse(session);

        // Then
        List<Boolean> codeBlockStates = new ArrayList<>();
        
        StepVerifier.create(responseFlux)
                .recordWith(ArrayList::new)
                .thenConsumeWhile(
                    chunk -> {
                        codeBlockStates.add(chunk.codeBlock());
                        return true;
                    },
                    chunk -> {
                        assertNotNull(chunk.currentChunk());
                    }
                )
                .consumeRecordedWith(chunks -> {
                    assertFalse(chunks.isEmpty(), "청크가 최소 1개 이상이어야 합니다");
                    
                    // 코드 블록 상태 변화 확인
                    StringBuilder fullResponse = new StringBuilder();
                    for (ChunkData chunk : chunks) {
                        fullResponse.append(chunk.currentChunk());
                    }
                    
                    String response = fullResponse.toString();
                    System.out.println("=== 응답 내용 ===");
                    System.out.println(response);
                    System.out.println("=== 코드 블록 상태 변화 횟수: " +
                        codeBlockStates.stream().distinct().count() + " ===");
                })
                .verifyComplete();
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "OPENAI_API_KEY", matches = ".+")
    @DisplayName("잘못된 AI 타입으로 에러 반환")
    void streamResponse_InvalidAiType_ReturnsError() {
        // Given
        session.setAiType("invalid-ai-type");
        session.setQuery("테스트 질문");

        // When
        Flux<ChunkData> responseFlux = aiService.streamResponse(session);

        // Then
        StepVerifier.create(responseFlux)
                .expectErrorMatches(throwable ->
                    throwable instanceof IllegalArgumentException &&
                    throwable.getMessage().contains("Unknown AI persona")
                )
                .verify(Duration.ofSeconds(5));
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "OPENAI_API_KEY", matches = ".+")
    @DisplayName("빈 질문으로 응답 생성 불가")
    void streamResponse_EmptyQuery_ReturnsError() {
        // Given
        session.setAiType("wayneai");
        session.setQuery("");

        // When
        Flux<ChunkData> responseFlux = aiService.streamResponse(session);

        // Then
        StepVerifier.create(responseFlux)
                .expectErrorMatches(throwable ->
                    throwable instanceof IllegalArgumentException &&
                    throwable.getMessage().contains("text cannot be null or empty")
                )
                .verify(Duration.ofSeconds(5));
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "OPENAI_API_KEY", matches = ".+")
    @DisplayName("긴 질문에 대한 스트리밍 응답")
    void streamResponse_LongQuery_Success() {
        // Given
        session.setAiType("consultingai");
        session.setQuery("""
                스타트업을 처음 시작하려고 합니다.
                사업 계획서 작성 시 고려해야 할 주요 항목들을
                단계별로 설명해주세요. 각 단계마다 간단한 예시도 포함해주세요.
                """);

        // When
        Flux<ChunkData> responseFlux = aiService.streamResponse(session);

        // Then
        AtomicInteger chunkCount = new AtomicInteger(0);
        
        StepVerifier.create(responseFlux)
                .thenConsumeWhile(
                    chunk -> chunkCount.incrementAndGet() < 20, // 처음 20개 청크만 확인
                    chunk -> {
                        assertNotNull(chunk.currentChunk());
                        assertFalse(chunk.currentChunk().isBlank());
                    }
                )
                .thenCancel()
                .verify(Duration.ofSeconds(45));
        
        assertTrue(chunkCount.get() > 0, "최소 1개 이상의 청크를 받아야 합니다");
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "OPENAI_API_KEY", matches = ".+")
    @DisplayName("여러 AI 타입 순차 호출 테스트")
    void streamResponse_MultipleAiTypes_Success() {
        // Given
        String query = "안녕하세요";

        // Wayne AI 테스트
        session.setAiType("wayneai");
        session.setQuery(query);
        Flux<ChunkData> wayneResponse = aiService.streamResponse(session);

        StepVerifier.create(wayneResponse.take(5))
                .expectNextCount(5)
                .verifyComplete();

        // Consulting AI 테스트
        session.setAiType("consultingai");
        session.setQuery(query);
        Flux<ChunkData> consultingResponse = aiService.streamResponse(session);

        StepVerifier.create(consultingResponse.take(5))
                .expectNextCount(5)
                .verifyComplete();
    }
}
