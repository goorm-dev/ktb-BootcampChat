package com.ktb.chatapp.dto;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * MessageContent 클래스의 단위 테스트
 */
@DisplayName("MessageContent 테스트")
class MessageContentTest {

    @Test
    @DisplayName("정상적인 메시지 내용으로 MessageContent 생성")
    void createMessageContentFromValidContent() {
        // given
        String content = "Hello @wayneAI";
        
        // when
        MessageContent messageContent = MessageContent.from(content);
        
        // then
        assertThat(messageContent).isNotNull();
        assertThat(messageContent.getRawContent()).isEqualTo(content);
        assertThat(messageContent.getTrimmedContent()).isEqualTo(content);
    }

    @Test
    @DisplayName("null 메시지 내용으로 MessageContent 생성")
    void createMessageContentFromNullContent() {
        // when
        MessageContent messageContent = MessageContent.from(null);
        
        // then
        assertThat(messageContent).isNotNull();
        assertThat(messageContent.getRawContent()).isEmpty();
        assertThat(messageContent.getTrimmedContent()).isEmpty();
    }

    @Test
    @DisplayName("공백이 포함된 메시지 내용 trim 처리")
    void trimContentWithWhitespace() {
        // given
        String content = "  Hello @wayneAI  ";
        
        // when
        MessageContent messageContent = MessageContent.from(content);
        
        // then
        assertThat(messageContent.getRawContent()).isEqualTo(content);
        assertThat(messageContent.getTrimmedContent()).isEqualTo("Hello @wayneAI");
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   ", "\t", "\n"})
    @DisplayName("빈 메시지 내용 확인")
    void checkEmptyContent(String content) {
        // when
        MessageContent messageContent = MessageContent.from(content);
        
        // then
        assertThat(messageContent.isEmpty()).isTrue();
    }

    @Test
    @DisplayName("비어있지 않은 메시지 내용 확인")
    void checkNonEmptyContent() {
        // given
        MessageContent messageContent = MessageContent.from("Hello");
        
        // when & then
        assertThat(messageContent.isEmpty()).isFalse();
    }

    @Test
    @DisplayName("단일 wayneAI 멘션 추출")
    void extractSingleWayneAiMention() {
        // given
        MessageContent messageContent = MessageContent.from("Hello @wayneAI, how are you?");
        
        // when
        List<String> mentions = messageContent.aiMentions();
        
        // then
        assertThat(mentions)
            .hasSize(1)
            .containsExactly("wayneAI");
    }

    @Test
    @DisplayName("단일 consultingAI 멘션 추출")
    void extractSingleConsultingAiMention() {
        // given
        MessageContent messageContent = MessageContent.from("Hello @consultingAI, help me!");
        
        // when
        List<String> mentions = messageContent.aiMentions();
        
        // then
        assertThat(mentions)
            .hasSize(1)
            .containsExactly("consultingAI");
    }

    @Test
    @DisplayName("여러 AI 멘션 추출 (중복 제거)")
    void extractMultipleAiMentionsWithDuplicates() {
        // given
        MessageContent messageContent = MessageContent.from("@wayneAI and @consultingAI and @wayneAI again");
        
        // when
        List<String> mentions = messageContent.aiMentions();
        
        // then
        assertThat(mentions)
            .hasSize(2)
            .containsExactly("wayneAI", "consultingAI");
    }

    @Test
    @DisplayName("AI 멘션이 없는 경우 빈 리스트 반환")
    void returnEmptyListWhenNoMentions() {
        // given
        MessageContent messageContent = MessageContent.from("Hello world");
        
        // when
        List<String> mentions = messageContent.aiMentions();
        
        // then
        assertThat(mentions).isEmpty();
    }

    @Test
    @DisplayName("빈 메시지에서 AI 멘션 추출 시 빈 리스트 반환")
    void returnEmptyListForBlankContent() {
        // given
        MessageContent messageContent = MessageContent.from("   ");
        
        // when
        List<String> mentions = messageContent.aiMentions();
        
        // then
        assertThat(mentions).isEmpty();
    }

    @Test
    @DisplayName("단어 경계가 있는 AI 멘션만 추출")
    void extractOnlyMentionsWithWordBoundary() {
        // given
        MessageContent messageContent = MessageContent.from("@wayneAI is great but @wayneAIbot is not");
        
        // when
        List<String> mentions = messageContent.aiMentions();
        
        // then
        assertThat(mentions)
            .hasSize(1)
            .containsExactly("wayneAI");
    }

    @Test
    @DisplayName("wayneAI 멘션 제거하고 쿼리 반환")
    void getQueryWithoutWayneAiMention() {
        // given
        MessageContent messageContent = MessageContent.from("  @wayneAI what is the weather?  ");
        
        // when
        String query = messageContent.getQueryWithoutMention("wayneAI");
        
        // then
        assertThat(query).isEqualTo("what is the weather?");
    }

    @Test
    @DisplayName("consultingAI 멘션 제거하고 쿼리 반환")
    void getQueryWithoutConsultingAiMention() {
        // given
        MessageContent messageContent = MessageContent.from("@consultingAI help with my project");
        
        // when
        String query = messageContent.getQueryWithoutMention("consultingAI");
        
        // then
        assertThat(query).isEqualTo("help with my project");
    }

    @Test
    @DisplayName("중간에 위치한 AI 멘션 제거")
    void getQueryWithMentionInMiddle() {
        // given
        MessageContent messageContent = MessageContent.from("Can you @wayneAI help me?");
        
        // when
        String query = messageContent.getQueryWithoutMention("wayneAI");
        
        // then
        assertThat(query).isEqualTo("Can you  help me?");
    }

    @Test
    @DisplayName("멘션이 없는 경우 원본 쿼리 반환")
    void getQueryWhenNoMention() {
        // given
        MessageContent messageContent = MessageContent.from("Just a normal message");
        
        // when
        String query = messageContent.getQueryWithoutMention("wayneAI");
        
        // then
        assertThat(query).isEqualTo("Just a normal message");
    }

    @Test
    @DisplayName("다른 타입의 멘션은 유지하고 특정 멘션만 제거")
    void getQueryRemovingOnlySpecificMention() {
        // given
        MessageContent messageContent = MessageContent.from("@wayneAI and @consultingAI help");
        
        // when
        String query = messageContent.getQueryWithoutMention("wayneAI");
        
        // then
        assertThat(query).isEqualTo("and @consultingAI help");
    }

    @Test
    @DisplayName("여러 개의 동일한 멘션을 모두 제거")
    void getQueryRemovingMultipleSameMentions() {
        // given
        MessageContent messageContent = MessageContent.from("@wayneAI please @wayneAI help");
        
        // when
        String query = messageContent.getQueryWithoutMention("wayneAI");
        
        // then
        assertThat(query).isEqualTo("please  help");
        assertThat(query).doesNotContain("@wayneAI");
    }

    @Test
    @DisplayName("AI 멘션 순서 유지 (LinkedHashSet)")
    void maintainOrderOfAiMentions() {
        // given
        MessageContent messageContent = MessageContent.from("@consultingAI first, @wayneAI second, @consultingAI again");
        
        // when
        List<String> mentions = messageContent.aiMentions();
        
        // then
        assertThat(mentions)
            .hasSize(2)
            .containsExactly("consultingAI", "wayneAI");
    }

    @Test
    @DisplayName("특수문자와 함께 있는 AI 멘션 추출")
    void extractMentionsWithSpecialCharacters() {
        // given
        MessageContent messageContent = MessageContent.from("Hey! @wayneAI, can you help? @consultingAI?");
        
        // when
        List<String> mentions = messageContent.aiMentions();
        
        // then
        assertThat(mentions)
            .hasSize(2)
            .containsExactly("wayneAI", "consultingAI");
    }

    @Test
    @DisplayName("줄바꿈이 포함된 메시지에서 AI 멘션 추출")
    void extractMentionsFromMultilineContent() {
        // given
        MessageContent messageContent = MessageContent.from("Hello\n@wayneAI\nHow are you?\n@consultingAI");
        
        // when
        List<String> mentions = messageContent.aiMentions();
        
        // then
        assertThat(mentions)
            .hasSize(2)
            .containsExactly("wayneAI", "consultingAI");
    }
}
