package com.ktb.chatapp.websocket.socketio.ai;

import java.util.concurrent.atomic.AtomicBoolean;

public record ChunkData(String currentChunk, boolean codeBlock) {
    
    public static ChunkData from(String chunk) {
        return new ChunkData(chunk, false);
    }
    
    public ChunkData updateCodeBlockState(AtomicBoolean codeBlockState) {
        boolean currentState = codeBlockState.get();
        int index = 0;
        while ((index = currentChunk.indexOf("```", index)) != -1) {
            currentState = !currentState;
            index += 3;
        }
        codeBlockState.set(currentState);
        return new ChunkData(currentChunk, currentState);
    }
}
