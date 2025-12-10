package com.ktb.chatapp.dto;

import com.ktb.chatapp.validation.ValidEmail;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Schema(description = "로그인 요청")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoginRequest {

    @Schema(description = "이메일 주소", example = "user@example.com", required = true)
    @NotBlank(message = "이메일을 입력해주세요.")
    @ValidEmail(message = "올바른 이메일 형식이 아닙니다.")
    private String email;

    @Schema(description = "비밀번호", example = "password123", required = true)
    @NotBlank(message = "비밀번호를 입력해주세요.")
    private String password;
}
