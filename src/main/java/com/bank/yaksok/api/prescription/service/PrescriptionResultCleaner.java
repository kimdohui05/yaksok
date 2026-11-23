package com.bank.yaksok.api.prescription.service;

import com.bank.yaksok.api.prescription.dto.GeminiPrescriptionResult;
import com.bank.yaksok.api.prescription.dto.PrescriptionAnalyzeResponse;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Objects;

/**
 * AI 출력은 틀릴 수 있어서 프론트로 보내기 전에 정리한다.
 * - 형식이 이상한 값은 버리고 null 로 (사용자가 화면에서 직접 입력)
 * - 이름 없는 약은 제외
 */
@Component
public class PrescriptionResultCleaner {

    static final int MAX_TIMES_PER_DAY = 10;
    static final int MAX_DAYS = 365;

    public PrescriptionAnalyzeResponse clean(GeminiPrescriptionResult raw) {
        if (raw == null) {
            return new PrescriptionAnalyzeResponse(null, List.of());
        }

        List<PrescriptionAnalyzeResponse.Medicine> medicines = raw.medicines() == null
                ? List.of()
                : raw.medicines().stream()
                        .filter(Objects::nonNull)
                        .map(this::cleanMedicine)
                        .filter(Objects::nonNull)
                        .toList();

        return new PrescriptionAnalyzeResponse(cleanDate(raw.prescriptionDate()), medicines);
    }

    private PrescriptionAnalyzeResponse.Medicine cleanMedicine(GeminiPrescriptionResult.Item item) {
        String name = blankToNull(item.name());
        if (name == null) {
            return null;
        }
        return new PrescriptionAnalyzeResponse.Medicine(
                name,
                blankToNull(item.dose()),
                inRange(item.timesPerDay(), MAX_TIMES_PER_DAY),
                inRange(item.days(), MAX_DAYS),
                cleanEdiCode(item.ediCode())
        );
    }

    /** 보험코드는 숫자 9자리만 인정 (공백·하이픈은 제거) */
    private String cleanEdiCode(String code) {
        String value = blankToNull(code);
        if (value == null) {
            return null;
        }
        String digitsOnly = value.replaceAll("[\\s-]", "");
        return digitsOnly.matches("\\d{9}") ? digitsOnly : null;
    }

    /** yyyy-MM-dd 로 실제 존재하는 날짜만 통과 */
    private String cleanDate(String date) {
        String value = blankToNull(date);
        if (value == null) {
            return null;
        }
        try {
            return LocalDate.parse(value).toString();
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private Integer inRange(Integer value, int max) {
        return (value != null && value >= 1 && value <= max) ? value : null;
    }

    private String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return (trimmed.isEmpty() || trimmed.equalsIgnoreCase("null")) ? null : trimmed;
    }
}
