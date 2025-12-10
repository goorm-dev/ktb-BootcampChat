package com.ktb.chatapp.websocket.socketio.ai;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("ChunkData 테스트")
class ChunkDataTest {

    @Test
    @DisplayName("코드 블록 마커가 없는 경우 상태가 변경되지 않음")
    void updateCodeBlockState_noMarker_stateUnchanged() {
        // given
        AtomicBoolean codeBlockState = new AtomicBoolean(false);
        String chunk = "일반 텍스트입니다.";

        // when
        boolean result = ChunkData.from(chunk).updateCodeBlockState(codeBlockState).codeBlock();

        // then
        assertThat(result).isFalse();
        assertThat(codeBlockState.get()).isFalse();
    }

    @Test
    @DisplayName("코드 블록 시작: false -> true")
    void updateCodeBlockState_singleMarker_togglesState() {
        // given
        AtomicBoolean codeBlockState = new AtomicBoolean(false);
        String chunk = "```java";

        // when
        boolean result = ChunkData.from(chunk).updateCodeBlockState(codeBlockState).codeBlock();

        // then
        assertThat(result).isTrue();
        assertThat(codeBlockState.get()).isTrue();
    }

    @Test
    @DisplayName("코드 블록 종료: true -> false")
    void updateCodeBlockState_singleMarkerFromTrue_togglesState() {
        // given
        AtomicBoolean codeBlockState = new AtomicBoolean(true);
        String chunk = "```";

        // when
        boolean result = ChunkData.from(chunk).updateCodeBlockState(codeBlockState).codeBlock();

        // then
        assertThat(result).isFalse();
        assertThat(codeBlockState.get()).isFalse();
    }

    @Test
    @DisplayName("하나의 청크에 두 개의 마커: false -> false")
    void updateCodeBlockState_twoMarkers_returnToOriginalState() {
        // given
        AtomicBoolean codeBlockState = new AtomicBoolean(false);
        String chunk = "```java\ncode\n```";

        // when
        boolean result = ChunkData.from(chunk).updateCodeBlockState(codeBlockState).codeBlock();

        // then
        assertThat(result).isFalse();
        assertThat(codeBlockState.get()).isFalse();
    }

    @Test
    @DisplayName("하나의 청크에 세 개의 마커: false -> true")
    void updateCodeBlockState_threeMarkers_togglesState() {
        // given
        AtomicBoolean codeBlockState = new AtomicBoolean(false);
        String chunk = "```java\ncode\n```\n```python";

        // when
        boolean result = ChunkData.from(chunk).updateCodeBlockState(codeBlockState).codeBlock();

        // then
        assertThat(result).isTrue();
        assertThat(codeBlockState.get()).isTrue();
    }

    @ParameterizedTest
    @MethodSource("provideMultipleChunksTestCases")
    @DisplayName("여러 청크 연속 처리 시나리오")
    void updateCodeBlockState_multipleChunks(String[] chunks, boolean[] expectedStates) {
        // given
        AtomicBoolean codeBlockState = new AtomicBoolean(false);

        // when & then
        for (int i = 0; i < chunks.length; i++) {
            boolean result = ChunkData.from(chunks[i]).updateCodeBlockState(codeBlockState).codeBlock();
            assertThat(result)
                    .as("Chunk %d: '%s'", i, chunks[i])
                    .isEqualTo(expectedStates[i]);
            assertThat(codeBlockState.get())
                    .as("State after chunk %d", i)
                    .isEqualTo(expectedStates[i]);
        }
    }

    private static Stream<Arguments> provideMultipleChunksTestCases() {
        return Stream.of(
                // 시나리오 1: 코드 블록 시작 -> 코드 내용 -> 코드 블록 종료
                Arguments.of(
                        new String[]{"일반 텍스트", "```java", "System.out.println();", "```", "일반 텍스트"},
                        new boolean[]{false, true, true, false, false}
                ),
                // 시나리오 2: 여러 코드 블록
                Arguments.of(
                        new String[]{"```python", "code1", "```", "텍스트", "```javascript", "code2", "```"},
                        new boolean[]{true, true, false, false, true, true, false}
                ),
                // 시나리오 3: 중첩된 마커 (하나의 청크에 여러 마커)
                Arguments.of(
                        new String[]{"```java\ncode\n```", "일반", "```\ncode"},
                        new boolean[]{false, false, true}
                )
        );
    }

    @Test
    @DisplayName("빈 문자열 처리")
    void updateCodeBlockState_emptyString_stateUnchanged() {
        // given
        AtomicBoolean codeBlockState = new AtomicBoolean(false);
        String chunk = "";

        // when
        boolean result = ChunkData.from(chunk).updateCodeBlockState(codeBlockState).codeBlock();

        // then
        assertThat(result).isFalse();
        assertThat(codeBlockState.get()).isFalse();
    }

    @Test
    @DisplayName("마커 유사 문자열은 무시됨")
    void updateCodeBlockState_similarButNotMarker_ignored() {
        // given
        AtomicBoolean codeBlockState = new AtomicBoolean(false);
        String chunk = "``java 또는 ``";

        // when
        boolean result = ChunkData.from(chunk).updateCodeBlockState(codeBlockState).codeBlock();

        // then
        assertThat(result).isFalse();
        assertThat(codeBlockState.get()).isFalse();
    }

    @Test
    @DisplayName("연속된 마커 처리: ``````")
    void updateCodeBlockState_consecutiveMarkers_togglesTwice() {
        // given
        AtomicBoolean codeBlockState = new AtomicBoolean(false);
        String chunk = "``````";

        // when
        boolean result = ChunkData.from(chunk).updateCodeBlockState(codeBlockState).codeBlock();

        // then
        assertThat(result).isFalse(); // false -> true -> false
        assertThat(codeBlockState.get()).isFalse();
    }

    @Test
    @DisplayName("Record 생성 테스트")
    void chunkData_creation() {
        // given
        String chunk = "test chunk";
        boolean codeBlock = true;

        // when
        ChunkData chunkData = new ChunkData(chunk, codeBlock);

        // then
        assertThat(chunkData.currentChunk()).isEqualTo(chunk);
        assertThat(chunkData.codeBlock()).isEqualTo(codeBlock);
    }
}
