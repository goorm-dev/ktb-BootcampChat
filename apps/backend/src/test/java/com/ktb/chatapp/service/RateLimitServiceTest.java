package com.ktb.chatapp.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.ktb.chatapp.config.MongoTestContainer;
import com.ktb.chatapp.repository.RateLimitRepository;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;

@SpringBootTest
@Import(MongoTestContainer.class)
@TestPropertySource(properties = {
        "socketio.enabled=false"
})
@DisplayName("RateLimitService 통합 테스트")
class RateLimitServiceTest {

    @Autowired
    private RateLimitRepository rateLimitRepository;

    @Autowired
    private RateLimitService rateLimitService;

    @BeforeEach
    void setUp() {
        rateLimitRepository.deleteAll();
    }

    @Test
    @DisplayName("최초 요청은 허용되고 TTL과 남은 횟수가 갱신된다")
    void checkRateLimit_AllowsFirstRequest() {
        int maxRequests = 5;
        Duration window = Duration.ofSeconds(60);
        String clientId = "ip:127.0.0.1";

        long beforeCall = Instant.now().getEpochSecond();
        RateLimitCheckResult result =
                rateLimitService.checkRateLimit(clientId, maxRequests, window);
        long afterCall = Instant.now().getEpochSecond();

        assertThat(result.allowed()).isTrue();
        assertThat(result.limit()).isEqualTo(maxRequests);
        assertThat(result.remaining()).isEqualTo(maxRequests - 1);
        assertThat(result.windowSeconds()).isEqualTo(window.getSeconds());
        assertThat(result.retryAfterSeconds()).isPositive();
        assertThat(result.resetEpochSeconds())
                .isBetween(beforeCall + result.retryAfterSeconds(), afterCall + result.retryAfterSeconds());
    }

    @Test
    @DisplayName("요청 한도를 초과하면 차단된다")
    void checkRateLimit_DeniesWhenLimitExceeded() {
        int maxRequests = 5;
        Duration window = Duration.ofSeconds(60);
        String clientId = "ip:127.0.0.1";

        // 한도까지 요청을 수행
        for (int i = 0; i < maxRequests; i++) {
            RateLimitCheckResult result =
                    rateLimitService.checkRateLimit(clientId, maxRequests, window);
            assertThat(result.allowed()).isTrue();
        }

        // 한도 초과 요청
        long beforeCall = Instant.now().getEpochSecond();
        RateLimitCheckResult result =
                rateLimitService.checkRateLimit(clientId, maxRequests, window);
        long afterCall = Instant.now().getEpochSecond();

        assertThat(result.allowed()).isFalse();
        assertThat(result.limit()).isEqualTo(maxRequests);
        assertThat(result.remaining()).isZero();
        assertThat(result.retryAfterSeconds()).isBetween(1L, window.getSeconds());
        assertThat(result.resetEpochSeconds())
                .isBetween(beforeCall + result.retryAfterSeconds(), afterCall + result.retryAfterSeconds());
    }

    @Test
    @DisplayName("연속 요청 시 카운트가 증가하고 남은 횟수가 감소한다")
    void checkRateLimit_DecreasesRemainingOnConsecutiveRequests() {
        int maxRequests = 3;
        Duration window = Duration.ofSeconds(60);
        String clientId = "ip:192.168.1.1";

        RateLimitCheckResult result1 =
                rateLimitService.checkRateLimit(clientId, maxRequests, window);
        assertThat(result1.allowed()).isTrue();
        assertThat(result1.remaining()).isEqualTo(2);

        RateLimitCheckResult result2 =
                rateLimitService.checkRateLimit(clientId, maxRequests, window);
        assertThat(result2.allowed()).isTrue();
        assertThat(result2.remaining()).isEqualTo(1);

        RateLimitCheckResult result3 =
                rateLimitService.checkRateLimit(clientId, maxRequests, window);
        assertThat(result3.allowed()).isTrue();
        assertThat(result3.remaining()).isZero();
    }

    @Test
    @DisplayName("서로 다른 클라이언트는 독립적인 rate limit을 갖는다")
    void checkRateLimit_IndependentLimitsPerClient() {
        int maxRequests = 2;
        Duration window = Duration.ofSeconds(60);
        String clientId1 = "ip:10.0.0.1";
        String clientId2 = "ip:10.0.0.2";

        // 첫 번째 클라이언트가 한도까지 요청
        for (int i = 0; i < maxRequests; i++) {
            RateLimitCheckResult result =
                    rateLimitService.checkRateLimit(clientId1, maxRequests, window);
            assertThat(result.allowed()).isTrue();
        }

        // 첫 번째 클라이언트 한도 초과
        RateLimitCheckResult result1 =
                rateLimitService.checkRateLimit(clientId1, maxRequests, window);
        assertThat(result1.allowed()).isFalse();

        // 두 번째 클라이언트는 여전히 요청 가능
        RateLimitCheckResult result2 =
                rateLimitService.checkRateLimit(clientId2, maxRequests, window);
        assertThat(result2.allowed()).isTrue();
        assertThat(result2.remaining()).isEqualTo(1);
    }
}
