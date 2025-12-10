package com.ktb.chatapp.controller;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CustomErrorController implements ErrorController {

    private final Environment environment;

    public CustomErrorController(Environment environment) {
        this.environment = environment;
    }

    @RequestMapping("${server.error.path:${error.path:/error}}")
    public ResponseEntity<Map<String, Object>> handleError(HttpServletRequest request) {
        Integer statusCode = (Integer) request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
        HttpStatus status = statusCode != null ? HttpStatus.resolve(statusCode) : HttpStatus.INTERNAL_SERVER_ERROR;
        String path = (String) request.getAttribute(RequestDispatcher.ERROR_REQUEST_URI);
        Throwable throwable = (Throwable) request.getAttribute(RequestDispatcher.ERROR_EXCEPTION);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", false);
        body.put("path", path != null ? path : request.getRequestURI());

        if (status == null) {
            status = HttpStatus.INTERNAL_SERVER_ERROR;
        }

        if (status == HttpStatus.NOT_FOUND) {
            body.put("message", "요청하신 리소스를 찾을 수 없습니다.");
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body);
        }

        body.put("message", "서버 에러가 발생했습니다.");
        if (isDevelopmentProfile() && throwable != null) {
            body.put("stack", getStackTrace(throwable));
        }

        return ResponseEntity.status(status).body(body);
    }

    private boolean isDevelopmentProfile() {
        for (String profile : environment.getActiveProfiles()) {
            if ("dev".equalsIgnoreCase(profile)) {
                return true;
            }
        }
        String profile = environment.getProperty("spring.profiles.active");
        return "dev".equalsIgnoreCase(profile);
    }

    private String getStackTrace(Throwable throwable) {
        StringWriter stringWriter = new StringWriter();
        throwable.printStackTrace(new PrintWriter(stringWriter));
        return stringWriter.toString();
    }
}
