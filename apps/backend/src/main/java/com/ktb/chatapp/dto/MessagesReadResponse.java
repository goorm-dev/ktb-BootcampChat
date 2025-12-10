package com.ktb.chatapp.dto;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MessagesReadResponse {
    private String userId;
    private List<String> messageIds;
}
