package com.bank.yaksok.api.drug.service;

import com.bank.yaksok.api.dur.dto.DrugInfoResponse;
import com.bank.yaksok.api.dur.dto.DrugPermitResponse;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * AI 에 넘길 약 정보 (공공데이터 원문). AI 는 이 안의 내용만 근거로 요약한다.
 */
record DrugFacts(String itemName, String source, Map<String, String> fields) {

    /** 한 항목 원문 최대 길이 (너무 긴 원문은 잘라서 비용·시간을 줄인다) */
    static final int MAX_FIELD_LENGTH = 1500;

    static DrugFacts fromEasyDrug(DrugInfoResponse.Summary s) {
        Map<String, String> f = new LinkedHashMap<>();
        put(f, "제조사", s.company());
        put(f, "효능", s.efficacy());
        put(f, "사용법", s.usage());
        put(f, "사용 전 반드시 알아야 할 내용", s.warning());
        put(f, "사용상 주의사항", s.precaution());
        put(f, "함께 먹으면 안 되는 약·음식", s.interaction());
        put(f, "부작용", s.sideEffect());
        put(f, "보관법", s.storage());
        return new DrugFacts(s.itemName(), "e약은요", f);
    }

    static DrugFacts fromPermit(DrugPermitResponse.Item i) {
        Map<String, String> f = new LinkedHashMap<>();
        put(f, "제조사", i.entpName());
        put(f, "전문/일반", i.specialty());
        put(f, "분류", i.productType());
        put(f, "주성분", i.ingredient());
        return new DrugFacts(i.itemName(), "의약품 허가정보", f);
    }

    private static void put(Map<String, String> f, String key, String value) {
        if (value == null || value.isBlank()) return;
        String v = value.trim();
        f.put(key, v.length() > MAX_FIELD_LENGTH ? v.substring(0, MAX_FIELD_LENGTH) + "…" : v);
    }

    /** 제조사만 있고 내용이 없으면 요약할 거리가 없다 */
    boolean hasContent() {
        return fields.keySet().stream().anyMatch(k -> !k.equals("제조사"));
    }
}
