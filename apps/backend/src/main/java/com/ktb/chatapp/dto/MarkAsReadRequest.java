package com.ktb.chatapp.dto;

import lombok.Data;

import java.util.List;

@Data
public class MarkAsReadRequest {
    private List<String> messageIds;
}
