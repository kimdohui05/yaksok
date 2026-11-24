package com.bank.yaksok.api.drug.dto;

import java.util.List;

/**
 * 연관검색어 응답.
 * items 는 공공데이터(의약품 허가정보)에 등록된 공식 약 이름이라, 골라서 저장하면 이름 검증을 그대로 통과한다.
 */
public record DrugAutocompleteResponse(
        String query,        // 요청한 검색어
        List<String> items   // 약 이름 후보 (앞글자가 같은 것 먼저, 최대 10개, 2글자 미만이면 빈 목록)
) {}
