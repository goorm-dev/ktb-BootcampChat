package com.ktb.chatapp.util;

import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.util.Assert;

public class BannedWordChecker {
    
    private final Set<String> bannedWords;
    
    public BannedWordChecker(Set<String> bannedWords) {
        this.bannedWords =
                bannedWords.stream()
                        .filter(word -> word != null && !word.isBlank())
                        .map(word -> word.toLowerCase(Locale.ROOT))
                        .collect(Collectors.toUnmodifiableSet());
        Assert.notEmpty(this.bannedWords, "Banned words set must not be empty");
    }
    
    public boolean containsBannedWord(String message) {
        if (message == null || message.isBlank()) {
            return false;
        }
        
        String normalizedMessage = message.toLowerCase(Locale.ROOT);
        return bannedWords.stream().anyMatch(normalizedMessage::contains);
    }
}
