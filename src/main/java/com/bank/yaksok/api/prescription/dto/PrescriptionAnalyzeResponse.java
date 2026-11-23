package com.bank.yaksok.api.prescription.dto;

import java.util.List;

/**
 * 처방전 분석 결과 (프론트로 내려주는 응답).
 * AI가 읽지 못한 값은 null 이다. 사용자가 화면에서 확인·수정한 뒤 POST /medications 로 저장한다.
 */
public record PrescriptionAnalyzeResponse(
        String prescriptionDate,   // yyyy-MM-dd, 못 읽으면 null
        List<Medicine> medicines
) {
    public record Medicine(
            String name,           // 예: 타이레놀정500mg
            String dose,           // 1회 복용량, 예: 1정 (못 읽으면 null)
            Integer timesPerDay,   // 하루 복용 횟수 (못 읽으면 null)
            Integer days           // 총 처방일수 (못 읽으면 null)
    ) {}
}
