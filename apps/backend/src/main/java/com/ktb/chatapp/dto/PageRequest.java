package com.ktb.chatapp.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Data;

@Data
public class PageRequest {
    @Min(value = 0, message = "페이지는 0 이상이어야 합니다.")
    private int page = 0;

    @Min(value = 1, message = "페이지 크기는 1 이상이어야 합니다.")
    @Max(value = 50, message = "페이지 크기는 50 이하여야 합니다.")
    private int pageSize = 10;

    private String sortField = "createdAt";
    private String sortOrder = "desc";
    private String search;

    public boolean isValidSortField() {
        return "createdAt".equals(sortField) ||
               "name".equals(sortField) ||
               "participantsCount".equals(sortField);
    }

    public boolean isValidSortOrder() {
        return "asc".equals(sortOrder) || "desc".equals(sortOrder);
    }
}
