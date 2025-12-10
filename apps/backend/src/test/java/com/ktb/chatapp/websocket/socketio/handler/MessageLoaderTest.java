package com.ktb.chatapp.websocket.socketio.handler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.ktb.chatapp.dto.FetchMessagesRequest;
import com.ktb.chatapp.dto.FetchMessagesResponse;
import com.ktb.chatapp.model.Message;
import com.ktb.chatapp.model.User;
import com.ktb.chatapp.repository.FileRepository;
import com.ktb.chatapp.repository.MessageRepository;
import com.ktb.chatapp.repository.UserRepository;
import com.ktb.chatapp.service.MessageReadStatusService;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;
import net.datafaker.Faker;
import org.jetbrains.annotations.NotNull;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.*;

@ExtendWith(MockitoExtension.class)
class MessageLoaderTest {
    
    @Mock
    private MessageRepository messageRepository;
    
    @Mock
    private UserRepository userRepository;
    
    @Mock
    private FileRepository fileRepository;
    
    @Mock
    private MessageReadStatusService messageReadStatusService;
    
    @InjectMocks
    private MessageLoader messageLoader;
    
    private Faker faker;
    private List<Message> testMessages;
    private String roomId;
    private String userId;
    
    @BeforeEach
    void setUp() {
        faker = new Faker();
        roomId = faker.internet().uuid();
        userId = faker.internet().uuid();
        
        messageLoader = new MessageLoader(
                messageRepository,
                userRepository,
                new MessageResponseMapper(fileRepository),
                messageReadStatusService
        );
        
        var testUser = User.builder()
                .id(userId)
                .name(faker.name().fullName())
                .email(faker.internet().emailAddress())
                .build();
        
        // 테스트 메시지 50개 생성 (오름차순: 오래된 것 → 최신 것)
        // i=0: 50시간 전, i=1: 49시간 전, ... i=49: 1시간 전
        testMessages = IntStream.range(0, 50)
                .mapToObj(i -> createMessage(
                        faker.internet().uuid(),
                        LocalDateTime.now().minusHours(50 - i)
                ))
                .toList();
        
        lenient().when(userRepository.findAllById(anySet()))
                .thenReturn(List.of(testUser));
        lenient().doNothing().when(messageReadStatusService).updateReadStatus(anyList(), anyString());
    }
    
    private Message createMessage(String id, LocalDateTime timestamp) {
        Message message = new Message();
        message.setId(id);
        message.setRoomId(roomId);
        message.setSenderId(userId);
        message.setContent(faker.lorem().sentence(10));
        message.setTimestamp(timestamp);
        message.setIsDeleted(false);
        return message;
    }
    
    @Test
    @DisplayName("loadMessages: 내림차순 조회 후 오름차순 재정렬")
    void loadMessages_shouldReturnAscendingOrderAfterReversing() {
        // Given: testMessages[0~29] (50시간 전 ~ 21시간 전) - 오름차순 상태
        List<Message> first30Messages = testMessages.subList(0, 30);
        
        // DB는 DESC 정렬로 반환한다고 가정 (최신 것 먼저)
        // [21시간 전, 22시간 전, ..., 50시간 전]
        var messagePage = getMessagePage(first30Messages);
        
        when(messageRepository.findByRoomIdAndIsDeletedAndTimestampBefore(
                eq(roomId), eq(false), any(LocalDateTime.class), any(Pageable.class)))
                .thenReturn(messagePage);
        
        // When: 메시지 로드
        FetchMessagesRequest req = new FetchMessagesRequest(roomId, 30, null);
        FetchMessagesResponse result = messageLoader.loadMessages(req, userId);
        
        // Then: 결과는 오름차순으로 정렬되어야 함
        assertThat(result.getMessages()).hasSize(30);
        assertThat(result.isHasMore()).isTrue();
        
        // 시간순 정렬 확인 (오름차순: 오래된 것 → 최신 것)
        // [50시간 전, 49시간 전, ..., 21시간 전]
        verifyAscending(result);
    }
    
    private static @NotNull Page<Message> getMessagePage(List<Message> first30Messages) {
        List<Message> messages = new ArrayList<>(first30Messages.reversed());
        
        Pageable pageable = PageRequest.of(0, 30, Sort.by("timestamp").descending());
        Page<Message> messagePage = new PageImpl<>(messages, pageable, 50);
        return messagePage;
    }
    
    @Test
    @DisplayName("loadInitialMessages: 내림차순 조회 후 오름차순 재정렬")
    void loadInitialMessages_shouldReturnAscendingOrderAfterReversing() {
        // Given: testMessages[20~49] (30시간 전 ~ 1시간 전) - 최신 30개 메시지
        List<Message> last30Messages = testMessages.subList(20, 50);
        
        // DB는 DESC 정렬로 반환 (최신 것부터)
        // [1시간 전, 2시간 전, ..., 30시간 전]
        Page<Message> messagePage = getMessagePage(last30Messages);
        
        when(messageRepository.findByRoomIdAndIsDeletedAndTimestampBefore(
                eq(roomId), eq(false), any(LocalDateTime.class), any(Pageable.class)))
                .thenReturn(messagePage);
        
        // When: 초기 메시지 로드
        FetchMessagesRequest req = new FetchMessagesRequest(roomId, 30, null);
        FetchMessagesResponse result = messageLoader.loadMessages(req, userId);
        
        // Then: 결과는 오름차순으로 정렬되어야 함
        assertThat(result.getMessages()).hasSize(30);
        
        // 시간순 정렬 확인 (오름차순: 오래된 것 → 최신 것)
        // [30시간 전, 29시간 전, ..., 1시간 전]
        verifyAscending(result);
    }
    
    private static void verifyAscending(FetchMessagesResponse result) {
        for (int i = 0; i < result.getMessages().size() - 1; i++) {
            long current = result.getMessages().get(i).getTimestamp();
            long next = result.getMessages().get(i + 1).getTimestamp();
            assertThat(current).isLessThanOrEqualTo(next);
        }
    }
    
    @Test
    @DisplayName("loadInitialMessages: 에러 시 빈 응답")
    void loadInitialMessages_shouldReturnEmptyOnError() {
        when(messageRepository.findByRoomIdAndIsDeletedAndTimestampBefore(
                any(), anyBoolean(), any(LocalDateTime.class), any(Pageable.class)))
                .thenThrow(new RuntimeException("DB error"));
        
        FetchMessagesRequest req = new FetchMessagesRequest(roomId, 30, null);
        FetchMessagesResponse result = messageLoader.loadMessages(req, userId);
        
        assertThat(result.getMessages()).isEmpty();
        assertThat(result.isHasMore()).isFalse();
    }
}
