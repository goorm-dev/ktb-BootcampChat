package com.ktb.chatapp.util;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BannedWordCheckerTest {

    private static final Path WORD_LIST_PATH =
            Path.of("src/main/resources/fake_banned_words_10k.txt");
    private static final List<String> LOADED_WORDS = loadDictionary();
    private static final Set<String> BANNED_WORDS = new HashSet<>(LOADED_WORDS);

    private static List<String> loadDictionary() {
        try {
            List<String> words =
                    Files.readAllLines(WORD_LIST_PATH).stream()
                            .map(String::trim)
                            .filter(word -> !word.isEmpty())
                            .toList();
            if (words.isEmpty()) {
                throw new IllegalStateException("Banned word dictionary must not be empty.");
            }
            return words;
        } catch (IOException e) {
            throw new IllegalStateException("Failed to load banned word dictionary.", e);
        }
    }

    @Test
    void containsBannedWord_detectsExactWord() {
        BannedWordChecker checker = new BannedWordChecker(BANNED_WORDS);
        assertTrue(checker.containsBannedWord(LOADED_WORDS.getFirst()));
    }

    @Test
    void containsBannedWord_detectsWordEmbeddedInMessage() {
        BannedWordChecker checker = new BannedWordChecker(BANNED_WORDS);
        String message = "prefix-" + LOADED_WORDS.getFirst() + "-suffix";
        assertTrue(checker.containsBannedWord(message));
    }

    @Test
    void containsBannedWord_returnsFalseForCleanOrEmptyInput() {
        BannedWordChecker checker = new BannedWordChecker(BANNED_WORDS);
        assertFalse(checker.containsBannedWord("safe message without banned tokens"));
        assertFalse(checker.containsBannedWord(null));
        assertFalse(checker.containsBannedWord("   "));
    }
}
