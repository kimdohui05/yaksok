package com.bank.yaksok.api.drug.dto;

/**
 * 약 정보 AI 요약 응답.
 * found=false 이면 공공데이터에 정보가 없어 요약하지 않은 것 (AI 가 지어내지 않도록).
 * 각 항목은 원본 정보에 없으면 null.
 */
public record DrugSummaryResponse(
        String itemName,      // 조회한 공식 품목명 (못 찾으면 요청한 이름)
        boolean found,        // 공공데이터에서 약 정보를 찾았는지
        String source,        // 정보 출처: "e약은요" / "의약품 허가정보" / null
        String efficacy,      // 어디에 쓰는 약인지
        String howToTake,     // 복용 방법
        String cautions,      // 주의사항 (함께 먹으면 안 되는 것 포함)
        String sideEffects,   // 부작용
        String storage,       // 보관 방법
        String notice         // 화면 하단 안내 문구
) {
    public static final String AI_NOTICE =
            "AI가 공공데이터의 약 정보를 쉽게 정리한 내용입니다. 실제 복용은 처방전과 의사·약사의 안내를 따르세요.";
    public static final String NOT_FOUND_NOTICE =
            "공공데이터에서 이 약의 정보를 찾지 못했습니다. 약 이름을 확인하거나 의사·약사와 상담하세요.";

    public static DrugSummaryResponse notFound(String itemName) {
        return new DrugSummaryResponse(itemName, false, null, null, null, null, null, null, NOT_FOUND_NOTICE);
    }
}
