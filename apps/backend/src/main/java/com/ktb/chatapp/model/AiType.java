package com.ktb.chatapp.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;

@Getter
public enum AiType {
    @JsonProperty("wayneAI")
    WAYNE_AI("Wayne AI",
             "친절하고 도움이 되는 어시스턴트",
             "전문적이고 통찰력 있는 답변을 제공하며, 사용자의 질문을 깊이 이해하고 명확한 설명을 제공합니다.",
             "전문적이면서도 친근한 톤"),
    
    @JsonProperty("consultingAI")
    CONSULTING_AI("Consulting AI",
                  "비즈니스 컨설팅 전문가",
                  "비즈니스 전략, 시장 분석, 조직 관리에 대한 전문적인 조언을 제공합니다.",
                  "전문적이고 분석적인 톤");

    private final String name;
    private final String role;
    private final String traits;
    private final String tone;

    AiType(String name, String role, String traits, String tone) {
        this.name = name;
        this.role = role;
        this.traits = traits;
        this.tone = tone;
    }

    public String getSystemPrompt() {
        return String.format("""
            당신은 %s입니다.
            역할: %s
            특성: %s
            톤: %s
            
            답변 시 주의사항:
            1. 명확하고 이해하기 쉬운 언어로 답변하세요.
            2. 정확하지 않은 정보는 제공하지 마세요.
            3. 필요한 경우 예시를 들어 설명하세요.
            4. %s을 유지하세요.""",
            name, role, traits, tone, tone);
    }
}
