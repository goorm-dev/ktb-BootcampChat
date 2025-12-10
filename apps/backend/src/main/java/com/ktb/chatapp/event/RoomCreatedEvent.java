package com.ktb.chatapp.event;

import com.ktb.chatapp.dto.RoomResponse;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class RoomCreatedEvent extends ApplicationEvent {
    private final RoomResponse roomResponse;

    public RoomCreatedEvent(Object source, RoomResponse roomResponse) {
        super(source);
        this.roomResponse = roomResponse;
    }
}
