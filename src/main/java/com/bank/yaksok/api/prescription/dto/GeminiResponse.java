package com.bank.yaksok.api.prescription.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

/** Gemini generateContent 응답 중 우리가 쓰는 부분(candidates[0].content.parts[0].text)만 받는다. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record GeminiResponse(List<Candidate> candidates) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Candidate(Content content, String finishReason) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Content(List<Part> parts) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Part(String text) {}

    /** 첫 번째 후보의 첫 번째 텍스트. 없으면 null (안전 필터 차단, 빈 응답 등). */
    public String firstText() {
        if (candidates == null || candidates.isEmpty()) return null;
        Candidate candidate = candidates.get(0);
        if (candidate == null || candidate.content() == null) return null;
        List<Part> parts = candidate.content().parts();
        if (parts == null || parts.isEmpty() || parts.get(0) == null) return null;
        return parts.get(0).text();
    }
}
