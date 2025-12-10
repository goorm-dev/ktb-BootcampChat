package com.ktb.chatapp.event;

import com.ktb.chatapp.dto.RoomResponse;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class RoomUpdatedEvent extends ApplicationEvent {
    private final String roomId;
    private final RoomResponse roomResponse;

    public RoomUpdatedEvent(Object source, String roomId, RoomResponse roomResponse) {
        super(source);
        this.roomId = roomId;
        this.roomResponse = roomResponse;
    }
}
