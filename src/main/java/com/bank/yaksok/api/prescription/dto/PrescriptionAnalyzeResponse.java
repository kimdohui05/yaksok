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
            String name,           // 예: 타이레놀정500mg (교정되면 공식 품목명)
            String dose,           // 1회 복용량, 예: 1정 (못 읽으면 null)
            Integer timesPerDay,   // 하루 복용 횟수 (못 읽으면 null)
            Integer days,          // 총 처방일수 (못 읽으면 null)
            String ediCode,        // 처방전에 적힌 보험코드 9자리 (못 읽으면 null)
            Boolean verified,      // 공공데이터에서 확인된 약이면 true, 확인 못 하면 false
            String originalName    // AI 가 읽은 이름이 공식 품목명으로 바뀐 경우 원래 읽은 이름, 아니면 null
    ) {
        public Medicine(String name, String dose, Integer timesPerDay, Integer days, String ediCode) {
            this(name, dose, timesPerDay, days, ediCode, null, null);
        }

        public Medicine withVerification(String verifiedName, boolean isVerified, String original) {
            return new Medicine(verifiedName, dose, timesPerDay, days, ediCode, isVerified, original);
        }
    }
}
