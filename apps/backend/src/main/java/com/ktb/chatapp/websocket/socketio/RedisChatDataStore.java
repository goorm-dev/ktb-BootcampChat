package com.ktb.chatapp.websocket.socketio;

import java.util.Optional;

import org.redisson.api.RBucket;
import org.redisson.api.RSet;
import org.redisson.api.RedissonClient;

/**
 * Redis B 기반 ChatDataStore 구현.
 * SocketIOConfig에서 주입해주는 RedissonClient(=Redis B)에
 * ConnectedUsers / UserRooms 같은 소켓 상태를 저장한다.
 */
public class RedisChatDataStore implements ChatDataStore {

    private static final String KEY_PREFIX = "chatapp:socket:";
    private static final String KEY_SET = "chatapp:socket:keys";

    private final RedissonClient redissonClient;

    public RedisChatDataStore(RedissonClient redissonClient) {
        this.redissonClient = redissonClient;
    }

    private String namespacedKey(String key) {
        return KEY_PREFIX + key;
    }

    @Override
    public <T> Optional<T> get(String key, Class<T> type) {
        String redisKey = namespacedKey(key);
        RBucket<Object> bucket = redissonClient.getBucket(redisKey);
        Object value = bucket.get();
        if (value == null) {
            return Optional.empty();
        }

        try {
            return Optional.of(type.cast(value));
        } catch (ClassCastException e) {
            // 타입이 다르면 그냥 비어 있는 걸로 처리
            return Optional.empty();
        }
    }

    @Override
    public void set(String key, Object value) {
        String redisKey = namespacedKey(key);
        RBucket<Object> bucket = redissonClient.getBucket(redisKey);
        bucket.set(value);

        // size()를 위해 키 목록도 따로 관리
        RSet<String> keySet = redissonClient.getSet(KEY_SET);
        keySet.add(redisKey);
    }

    @Override
    public void delete(String key) {
        String redisKey = namespacedKey(key);
        RBucket<Object> bucket = redissonClient.getBucket(redisKey);
        bucket.delete();

        RSet<String> keySet = redissonClient.getSet(KEY_SET);
        keySet.remove(redisKey);
    }

    @Override
    public int size() {
        RSet<String> keySet = redissonClient.getSet(KEY_SET);
        return keySet.size();
    }
}
