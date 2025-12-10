package com.ktb.chatapp.websocket.socketio;

/**
 * Socket User Record
 * @param id user id
 * @param name user name
 * @param authSessionId user auth session id
 * @param socketId user websocket session id
 */
public record SocketUser(String id, String name, String authSessionId, String socketId) {
}
