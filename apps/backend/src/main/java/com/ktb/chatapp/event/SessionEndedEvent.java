package com.ktb.chatapp.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class SessionEndedEvent extends ApplicationEvent {
    private final String userId;
    private final String reason;
    private final String message;

    public SessionEndedEvent(Object source, String userId, String reason, String message) {
        super(source);
        this.userId = userId;
        this.reason = reason;
        this.message = message;
    }
}
