package com.ktb.chatapp.dto;

import java.util.List;
import lombok.Data;

@Data
public class MarkAsReadRequest {
    private List<String> messageIds;
}
