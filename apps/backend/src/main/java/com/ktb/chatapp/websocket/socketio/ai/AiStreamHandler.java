package com.ktb.chatapp.websocket.socketio.ai;

import com.ktb.chatapp.event.AiMessageChunkEvent;
import com.ktb.chatapp.event.AiMessageCompleteEvent;
import com.ktb.chatapp.event.AiMessageErrorEvent;
import com.ktb.chatapp.websocket.socketio.handler.StreamingSession;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.reactivestreams.Subscriber;
import org.reactivestreams.Subscription;
import org.springframework.context.ApplicationEventPublisher;

@Slf4j
@RequiredArgsConstructor
public class AiStreamHandler implements Subscriber<ChunkData> {
    private final StreamingSession session;
    private final ApplicationEventPublisher eventPublisher;
    private Subscription subscription;

    @Override
    public void onSubscribe(Subscription subscription) {
        this.subscription = subscription;
        subscription.request(Long.MAX_VALUE);
    }

    @Override
    public void onNext(ChunkData chunk) {
        session.appendContent(chunk.currentChunk());
        
        String messageId = session.getMessageId();
        String roomId = session.getRoomId();
        if (roomId == null) {
            log.warn("Room id missing while processing AI chunk - messageId: {}", messageId);
            return;
        }

        eventPublisher.publishEvent(new AiMessageChunkEvent(
            this, roomId, messageId,
            session.getContent(), chunk.codeBlock()
        ));
    }

    @Override
    public void onError(Throwable error) {
        String messageId = session.getMessageId();
        log.error("AI streaming error for messageId: {}", messageId, error);

        String errorMessage = error.getMessage() != null
            ? error.getMessage()
            : "AI 응답 생성 중 오류가 발생했습니다.";
        sendErrorEvent(errorMessage);
    }

    @Override
    public void onComplete() {
        String messageId = session.getMessageId();

        try {
            sendCompletionEvent();
            log.debug("AI streaming completed for messageId: {}", messageId);
        } catch (Exception e) {
            log.error("Error sending completion event for messageId: {}", messageId, e);
            sendErrorEvent("AI 메시지 완료 처리 중 오류가 발생했습니다.");
        }
    }

    public boolean matches(String roomId, String userId) {
        return Objects.equals(roomId, session.getRoomId())
            && Objects.equals(userId, session.getUserId());
    }

    public void cancel() {
        if (subscription != null) {
            subscription.cancel();
        }
    }

    private void sendCompletionEvent() {
        eventPublisher.publishEvent(new AiMessageCompleteEvent(
            this, session.getRoomId(), session.getMessageId(),
            session.getContent(), session.aiTypeEnum(),
            session.getTimestamp(), session.getQuery(),
            session.generationTimeMillis()
        ));
    }

    private void sendErrorEvent(String errorMessage) {
        eventPublisher.publishEvent(new AiMessageErrorEvent(
            this, session.getRoomId(), session.getMessageId(),
            errorMessage, session.aiTypeEnum()
        ));
    }
}
