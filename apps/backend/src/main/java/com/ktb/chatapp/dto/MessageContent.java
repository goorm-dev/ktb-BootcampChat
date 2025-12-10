package com.ktb.chatapp.dto;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.Getter;

/**
 * 메시지 내용과 AI 멘션을 처리하는 클래스
 */
@Getter
public class MessageContent {
    private static final Pattern AI_MENTION_PATTERN = Pattern.compile("@(wayneAI|consultingAI)\\b");
    
    private final String rawContent;
    private final String trimmedContent;
    
    private MessageContent(String content) {
        this.rawContent = content != null ? content : "";
        this.trimmedContent = this.rawContent.trim();
    }
    
    /**
     * 메시지 내용으로부터 MessageContent 객체 생성
     */
    public static MessageContent from(String content) {
        return new MessageContent(content);
    }
    
    /**
     * 내용이 비어있는지 확인
     */
    public boolean isEmpty() {
        return trimmedContent.isEmpty();
    }
    
    /**
     * 특정 AI 타입의 멘션을 제거한 쿼리 문자열 반환
     */
    public String getQueryWithoutMention(String aiType) {
        return trimmedContent.replaceAll("@" + aiType + "\\b", "").trim();
    }
    
    /**
     * AI 멘션 추출
     */
    public List<String> aiMentions() {
        if (this.rawContent.isBlank()) {
            return Collections.emptyList();
        }
        
        Matcher matcher = AI_MENTION_PATTERN.matcher(this.rawContent);
        Set<String> mentions = new LinkedHashSet<>();
        
        while (matcher.find()) {
            mentions.add(matcher.group(1));
        }
        
        return new ArrayList<>(mentions);
    }
}
