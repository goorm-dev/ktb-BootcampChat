package com.ktb.chatapp.config;

import com.corundumstudio.socketio.AuthTokenListener;
import com.corundumstudio.socketio.SocketConfig;
import com.corundumstudio.socketio.SocketIOServer;
import com.corundumstudio.socketio.annotation.SpringAnnotationScanner;
import com.corundumstudio.socketio.namespace.Namespace;
import com.corundumstudio.socketio.protocol.JacksonJsonSupport;
import com.corundumstudio.socketio.store.MemoryStoreFactory;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.ktb.chatapp.websocket.socketio.ChatDataStore;
import com.ktb.chatapp.websocket.socketio.LocalChatDataStore;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.context.annotation.Role;

import static org.springframework.beans.factory.config.BeanDefinition.ROLE_INFRASTRUCTURE;

@Slf4j
@Configuration
@ConditionalOnProperty(name = "socketio.enabled", havingValue = "true", matchIfMissing = true)
public class SocketIOConfig {

    @Value("${socketio.server.host:localhost}")
    private String host;

    @Value("${socketio.server.port:5002}")
    private Integer port;

    @Bean(initMethod = "start", destroyMethod = "stop")
    public SocketIOServer socketIOServer(AuthTokenListener authTokenListener) {
        var config = new com.corundumstudio.socketio.Configuration();
        config.setHostname(host);
        config.setPort(port);

        // --- Netty Thread 설정 (가장 중요) ---
        config.setBossThreads(2);     // Accept 전담 스레드 2개
        config.setWorkerThreads(8);   // 이벤트 처리 스레드 8개 (CPU 따라 16까지 증가 가능)

        // --- 소켓 설정 튜닝 ---
        var socketConfig = new SocketConfig();
        socketConfig.setReuseAddress(true);
        socketConfig.setTcpNoDelay(true); // 소규모 메시지 처리량↑
        socketConfig.setAcceptBackLog(1024); // 동시 접속 대기열 증가
        socketConfig.setTcpSendBufferSize(1024 * 64);
        socketConfig.setTcpReceiveBufferSize(1024 * 64);
        config.setSocketConfig(socketConfig);

        // --- Ping/Pong ---
        config.setPingTimeout(60000);
        config.setPingInterval(25000);
        config.setUpgradeTimeout(10000);

        // --- Redis 기반 StoreFactory로 교체(권장) ---
        // config.setStoreFactory(new RedissonStoreFactory(redissonClient));

        // 단일 노드는 그대로 MemoryStore 쓸 수 있으나 성능↓
        config.setStoreFactory(new MemoryStoreFactory());

        config.setJsonSupport(new JacksonJsonSupport(new JavaTimeModule()));

        var server = new SocketIOServer(config);
        server.getNamespace(Namespace.DEFAULT_NAME).addAuthTokenListener(authTokenListener);

        log.info("Socket.IO server configured on {}:{} (boss={}, workers={})",
                host, port, config.getBossThreads(), config.getWorkerThreads());

        return server;
    }


    /**
     * SpringAnnotationScanner는 BeanPostProcessor로서
     * ApplicationContext 초기화 초기에 등록되고,
     * 내부에서 사용하는 SocketIOServer는 Lazy로 지연되어
     * 다른 Bean들의 초기화 과정에 간섭하지 않게 한다.
     */
    @Bean
    @Role(ROLE_INFRASTRUCTURE)
    public BeanPostProcessor springAnnotationScanner(@Lazy SocketIOServer socketIOServer) {
        return new SpringAnnotationScanner(socketIOServer);
    }
    
    // 인메모리 저장소, 단일 노드 환경에서만 사용
    @Bean
    @ConditionalOnProperty(name = "socketio.enabled", havingValue = "true", matchIfMissing = true)
    public ChatDataStore chatDataStore() {
        return new LocalChatDataStore();
    }
}
