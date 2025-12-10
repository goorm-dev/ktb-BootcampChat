package com.ktb.chatapp.config;

import static org.junit.jupiter.api.Assertions.assertThrows;

import com.corundumstudio.socketio.SocketIOServer;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.NoSuchBeanDefinitionException;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;

@SpringBootTest
@TestPropertySource(properties = "socketio.enabled=false")
@Import(MongoTestContainer.class)
class SocketIOConfigTest {

    @Test
    void shouldNotLoadSocketIOBeansWhenDisabled(ApplicationContext context) {
        // SocketIOServer bean should not exist when socketio.enabled=false
        assertThrows(NoSuchBeanDefinitionException.class,
            () -> context.getBean(SocketIOServer.class));
    }
}
