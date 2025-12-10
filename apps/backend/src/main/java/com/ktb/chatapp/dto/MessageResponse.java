package com.ktb.chatapp.dto;

import com.ktb.chatapp.model.AiType;
import com.ktb.chatapp.model.Message;
import com.ktb.chatapp.model.MessageType;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 메시지 응답 DTO.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageResponse {
    @JsonProperty("_id")
    private String id;
    
    @JsonProperty("room")
    private String roomId;
    
    private String content;
    
    private UserResponse sender;
    
    private MessageType type;
    
    @JsonProperty("file")
    private FileResponse file;
    
    private AiType aiType;
    
    private long timestamp;
    
    private Map<String, Set<String>> reactions;
    
    private List<Message.MessageReader> readers;
    
    private Map<String, Object> metadata;
}
