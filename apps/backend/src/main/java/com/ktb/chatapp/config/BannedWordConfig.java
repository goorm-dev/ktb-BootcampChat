package com.ktb.chatapp.config;

import com.ktb.chatapp.util.BannedWordChecker;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;

@Configuration
public class BannedWordConfig {

    private final ApplicationContext applicationContext;
    private final String bannedWordLocation;

    public BannedWordConfig(
            ApplicationContext applicationContext,
            @Value("${chatapp.banned-word.location:classpath:fake_banned_words_10k.txt}")
                    String bannedWordLocation) {
        this.applicationContext = applicationContext;
        this.bannedWordLocation = bannedWordLocation;
    }

    @Bean
    public BannedWordChecker bannedWordChecker() {
        Resource resource = applicationContext.getResource(bannedWordLocation);
        if (!resource.exists()) {
            throw new IllegalStateException(
                    "Banned word resource not found at " + bannedWordLocation);
        }

        Set<String> words;
        try (BufferedReader reader =
                new BufferedReader(
                        new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8))) {
            words =
                    reader.lines()
                            .map(String::trim)
                            .filter(line -> !line.isEmpty())
                            .collect(Collectors.toUnmodifiableSet());
        } catch (IOException e) {
            throw new IllegalStateException(
                    "Failed to load banned words from " + bannedWordLocation, e);
        }

        if (words.isEmpty()) {
            throw new IllegalStateException(
                    "Banned word dictionary at " + bannedWordLocation + " must not be empty.");
        }

        return new BannedWordChecker(words);
    }
}
