package com.ktb.chatapp.websocket.socketio;

import java.util.HashSet;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "socketio.enabled", havingValue = "true", matchIfMissing = true)
@RequiredArgsConstructor
public class UserRooms {

    private static final String USER_ROOM_KEY_PREFIX = "userroom:roomids:";

    private final ChatDataStore chatDataStore;

    /**
     * Get all room IDs for a user
     *
     * @param userId the user ID
     * @return the set of room IDs the user is currently in, or empty set if not in any room
     */
    @SuppressWarnings("unchecked")
    public Set<String> get(String userId) {
        return chatDataStore.get(buildKey(userId), Set.class)
                .map(obj -> (Set<String>) obj)
                .orElse(new HashSet<>());
    }

    /**
     * Add a room ID for a user
     *
     * @param userId the user ID
     * @param roomId the room ID to add to the user's room set
     */
    public void add(String userId, String roomId) {
        Set<String> rooms = new HashSet<>(get(userId));
        rooms.add(roomId);
        chatDataStore.set(buildKey(userId), rooms);
    }

    /**
     * Remove a specific room ID from a user's room set
     *
     * @param userId the user ID
     * @param roomId the room ID to remove
     */
    public void remove(String userId, String roomId) {
        Set<String> rooms = new HashSet<>(get(userId));
        rooms.remove(roomId);
        if (rooms.isEmpty()) {
            chatDataStore.delete(buildKey(userId));
        } else {
            chatDataStore.set(buildKey(userId), rooms);
        }
    }

    /**
     * Remove all room associations for a user
     *
     * @param userId the user ID
     */
    public void clear(String userId) {
        chatDataStore.delete(buildKey(userId));
    }

    /**
     * Check if a user is in a specific room
     *
     * @param userId the user ID
     * @param roomId the room ID to check
     * @return true if the user is in the room, false otherwise
     */
    public boolean isInRoom(String userId, String roomId) {
        return get(userId).contains(roomId);
    }

    private String buildKey(String userId) {
        return USER_ROOM_KEY_PREFIX + userId;
    }
    
    public void removeAllRooms(String userId) {
        get(userId).forEach(roomId -> remove(userId, roomId));
    }
}
