package com.ktb.chatapp.controller;

import com.ktb.chatapp.dto.UserResponse;
import lombok.Data;

@Data
class UserApiResponse {
    private boolean success;
    private UserResponse user;
    
    public UserApiResponse(UserResponse user) {
        this.user = user;
        this.success = true;
    }
}
