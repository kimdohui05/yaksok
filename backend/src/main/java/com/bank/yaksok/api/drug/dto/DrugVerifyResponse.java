package com.bank.yaksok.api.drug.dto;

import java.util.List;

/**
 * 약 이름 확인 결과 (약 추가 1단계에서 다음으로 넘어가기 전에 사용).
 * 기준은 약 저장(POST /medications)과 같다: 여기서 verified=true 면 저장할 때도 통과한다.
 */
public record DrugVerifyResponse(
        String inputName,          // 요청한 이름
        boolean verified,          // 공공데이터(의약품 허가정보)에 있는 약인지
        String name,               // 확인된 이름 (한 글자 오타는 공식 이름으로 교정됨), 확인 안 되면 null
        String message,            // 확인 안 됐을 때 화면에 보여줄 문구, 확인되면 null
        String category,           // 확인된 약의 카테고리 (식약처 분류 기준, 예: "해열·진통"), 정할 수 없으면 null
        List<String> suggestions   // 확인 안 됐을 때 비슷한 약 이름 (최대 5개, 없으면 빈 목록)
) {
    public static final String NOT_FOUND_MESSAGE = "그런 약은 존재하지 않습니다.";
}
