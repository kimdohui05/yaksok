package com.bank.yaksok.medication.dto;

import java.util.List;

/**
 * 약 저장 거부 응답 (422).
 * 프론트는 suggestions 중 하나를 골라 다시 저장하거나, 입력한 이름 그대로 confirmed=true 로 다시 저장한다.
 */
public record UnverifiedDrugNameResponse(
        String code,               // "UNVERIFIED_DRUG_NAME"
        String message,            // 화면에 보여줄 안내
        String inputName,          // 사용자가 보낸 이름
        List<String> suggestions   // 비슷한 공식 약 이름 (가까운 순, 최대 5개, 없으면 빈 목록)
) {
    public static final String CODE = "UNVERIFIED_DRUG_NAME";
}
