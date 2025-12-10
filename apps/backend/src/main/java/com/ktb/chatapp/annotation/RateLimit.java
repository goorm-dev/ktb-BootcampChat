package com.ktb.chatapp.annotation;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface RateLimit {

    /**
     * 허용되는 최대 요청 수
     */
    int maxRequests() default 10000;

    /**
     * 시간 윈도우 (초 단위)
     */
    int windowSeconds() default 30;

    /**
     * Rate Limit 적용 범위
     * IP: IP 주소별
     * USER: 인증된 사용자별
     * IP_AND_USER: IP + 사용자별
     */
    LimitScope scope() default LimitScope.IP;

    enum LimitScope {
        IP,
        USER,
        IP_AND_USER
    }
}
