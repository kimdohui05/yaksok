package com.bank.yaksok.api.dur.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record DrugInfoResponse(Header header, Body body) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Header(
            @JsonProperty("resultCode") String resultCode,
            @JsonProperty("resultMsg") String resultMsg
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Body(
            @JsonProperty("pageNo") int pageNo,
            @JsonProperty("totalCount") int totalCount,
            @JsonProperty("numOfRows") int numOfRows,
            @JsonProperty("items") List<Item> items
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Item(
            @JsonProperty("itemSeq") String itemSeq,
            @JsonProperty("itemName") String itemName,
            @JsonProperty("entpName") String entpName,
            @JsonProperty("efcyQesitm") String efcyQesitm,
            @JsonProperty("useMethodQesitm") String useMethodQesitm,
            @JsonProperty("atpnWarnQesitm") String atpnWarnQesitm,
            @JsonProperty("atpnQesitm") String atpnQesitm,
            @JsonProperty("intrcQesitm") String intrcQesitm,
            @JsonProperty("seQesitm") String seQesitm,
            @JsonProperty("depositMethodQesitm") String depositMethodQesitm,
            @JsonProperty("itemImage") String itemImage
    ) {}

    // 프론트로 내려주는 응답 (필드명을 읽기 쉽게 변환)
    public record Summary(
            String itemSeq, String itemName, String company,
            String efficacy,     // 효능
            String usage,        // 사용법
            String warning,      // 사용 전 반드시 알아야 할 내용
            String precaution,   // 사용상 주의사항
            String interaction,  // 상호작용
            String sideEffect,   // 부작용
            String storage,      // 보관법
            String imageUrl      // 낱알 이미지
    ) {
        public static Summary from(Item i) {
            return new Summary(i.itemSeq(), i.itemName(), i.entpName(),
                    clean(i.efcyQesitm()), clean(i.useMethodQesitm()),
                    clean(i.atpnWarnQesitm()), clean(i.atpnQesitm()),
                    clean(i.intrcQesitm()), clean(i.seQesitm()),
                    clean(i.depositMethodQesitm()), i.itemImage());
        }

        private static String clean(String text) {
            if (text == null) return null;
            return text.replaceAll("<[^>]*>", "").trim();   // 섞여 올 수 있는 HTML 태그 제거
        }
    }
}