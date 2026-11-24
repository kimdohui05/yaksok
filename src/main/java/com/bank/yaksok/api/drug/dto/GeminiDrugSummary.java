package com.bank.yaksok.api.drug.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** Gemini 가 돌려준 요약 JSON 원본 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record GeminiDrugSummary(
        String efficacy,
        String howToTake,
        String cautions,
        String sideEffects,
        String storage
) {}
