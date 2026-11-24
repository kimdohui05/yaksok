package com.bank.yaksok.api.drug.dto;

import java.util.List;

/**
 * 약 정보 AI 요약 응답: 효능 요약 + 같이 먹으면 안 되는 음식.
 * found=false 이면 공공데이터에 약 정보가 없어 요약하지 않은 것 (AI 가 지어내지 않도록).
 */
public record DrugSummaryResponse(
        String itemName,                  // 조회한 공식 품목명 (못 찾으면 요청한 이름)
        boolean found,                    // 공공데이터에서 약 정보를 찾았는지
        String source,                    // 약 정보 출처: "e약은요" / "의약품 허가정보" / null
        String efficacy,                  // 효능 요약 (어디에 쓰는 약인지)
        List<FoodInteraction> foods,      // 같이 먹으면 안 되는(조심할) 음식, 없으면 빈 목록
        String foodBasis,                 // 음식 정보 근거: SOURCE(공공데이터 원문) / GENERAL(AI 일반 지식) / NONE(알려진 것 없음)
        String notice                     // 화면 하단 안내 문구
) {
    public record FoodInteraction(
            String food,    // 음식 이름 (예: 술, 자몽주스, 우유)
            String reason   // 왜 안 되는지 (예: 간 손상 위험이 커져요)
    ) {}

    public static final String BASIS_SOURCE = "SOURCE";
    public static final String BASIS_GENERAL = "GENERAL";
    public static final String BASIS_NONE = "NONE";

    public static final String AI_NOTICE =
            "AI가 공공데이터의 약 정보를 쉽게 정리한 내용입니다. 실제 복용은 처방전과 의사·약사의 안내를 따르세요.";
    public static final String GENERAL_NOTICE =
            "음식 정보는 공공데이터에 없어 AI가 주성분을 기준으로 일반적으로 알려진 내용을 정리했습니다. 정확한 내용은 의사·약사에게 확인하세요.";
    public static final String NOT_FOUND_NOTICE =
            "공공데이터에서 이 약의 정보를 찾지 못했습니다. 약 이름을 확인하거나 의사·약사와 상담하세요.";

    public static DrugSummaryResponse notFound(String itemName) {
        return new DrugSummaryResponse(itemName, false, null, null, List.of(), BASIS_NONE, NOT_FOUND_NOTICE);
    }
}
