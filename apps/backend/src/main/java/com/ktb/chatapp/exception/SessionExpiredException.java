package com.ktb.chatapp.exception;

import org.springframework.security.core.AuthenticationException;

public class SessionExpiredException extends AuthenticationException {
    
    public SessionExpiredException(String message) {
        super(message);
    }
    
    public SessionExpiredException(String message, Throwable cause) {
        super(message, cause);
    }
}
