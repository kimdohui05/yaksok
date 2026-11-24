package com.bank.yaksok.api.drug.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

/** Gemini 가 돌려준 요약 JSON 원본 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record GeminiDrugSummary(
        String efficacy,
        List<Food> foods,
        String foodBasis
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Food(String food, String reason) {}
}
