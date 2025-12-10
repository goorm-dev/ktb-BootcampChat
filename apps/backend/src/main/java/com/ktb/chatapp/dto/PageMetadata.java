package com.ktb.chatapp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PageMetadata {
    private long total;
    private int page;
    private int pageSize;
    private long totalPages;
    private boolean hasMore;
    private int currentCount;
    private SortInfo sort;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SortInfo {
        private String field;
        private String order;
    }
}
