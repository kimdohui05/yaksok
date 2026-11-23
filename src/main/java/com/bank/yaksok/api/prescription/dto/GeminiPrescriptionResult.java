package com.bank.yaksok.api.prescription.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

/**
 * Gemini 가 돌려준 JSON 원본. AI 출력이라 값이 틀리거나 비어 있을 수 있어서
 * 그대로 쓰지 않고 PrescriptionResultCleaner 로 정리한 뒤 응답으로 내보낸다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record GeminiPrescriptionResult(
        String prescriptionDate,
        List<Item> medicines
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Item(
            String name,
            String dose,
            Integer timesPerDay,
            Integer days,
            String ediCode
    ) {}
}
