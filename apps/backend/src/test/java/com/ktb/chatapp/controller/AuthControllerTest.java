package com.ktb.chatapp.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ktb.chatapp.config.MongoTestContainer;
import com.ktb.chatapp.dto.LoginRequest;
import com.ktb.chatapp.dto.RegisterRequest;
import com.ktb.chatapp.service.SessionCreationResult;
import com.ktb.chatapp.service.SessionMetadata;
import com.ktb.chatapp.service.SessionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithAnonymousUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@Import({MongoTestContainer.class})
@TestPropertySource(properties = "socketio.enabled=false")
public class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private SessionService sessionService;

    @Test
    @WithAnonymousUser
    public void testRegisterUser() throws Exception {
        when(sessionService.createSession(any(String.class), any(SessionMetadata.class)))
                .thenReturn(SessionCreationResult.builder()
                        .sessionId("mock-session-id")
                        .expiresIn(3600L)
                        .build());

        String email = "test" + System.currentTimeMillis() + "@example.com";
        RegisterRequest registerRequest = new RegisterRequest();
        registerRequest.setName("Test User");
        registerRequest.setEmail(email);
        registerRequest.setPassword("password");

        mockMvc.perform(post("/api/auth/register")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerRequest)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("회원가입이 완료되었습니다."))
                .andExpect(jsonPath("$.user.email").value(email))
                .andExpect(jsonPath("$.user.name").value("Test User"));
    }

    @Test
    @WithAnonymousUser
    public void testAuthenticateUser() throws Exception {
        when(sessionService.createSession(any(String.class), any(SessionMetadata.class)))
                .thenReturn(SessionCreationResult.builder()
                        .sessionId("mock-session-id")
                        .expiresIn(3600L)
                        .build());

        String email = "test" + System.currentTimeMillis() + "@example.com";

        RegisterRequest registerRequest = new RegisterRequest();
        registerRequest.setName("Test User");
        registerRequest.setEmail(email);
        registerRequest.setPassword("password");

        mockMvc.perform(post("/api/auth/register")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerRequest)))
                .andExpect(status().isCreated());

        LoginRequest loginRequest = new LoginRequest(email, "password");

        mockMvc.perform(post("/api/auth/login")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").exists());
    }
}
