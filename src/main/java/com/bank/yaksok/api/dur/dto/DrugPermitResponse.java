package com.bank.yaksok.api.dur.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * 식품의약품안전처_의약품 제품 허가정보 (DrugPrdtPrmsnInfoService08/getDrugPrdtPrmsnInq08) 응답.
 * 전문의약품까지 포함된 허가 의약품 전체가 대상이다. (e약은요는 일반의약품 위주)
 * 결과가 0건이면 body.items 가 아예 없다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record DrugPermitResponse(Header header, Body body) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Header(
            @JsonProperty("resultCode") String resultCode,
            @JsonProperty("resultMsg") String resultMsg
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Body(
            @JsonProperty("totalCount") Integer totalCount,
            @JsonProperty("items") List<Item> items
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Item(
            @JsonProperty("ITEM_SEQ") String itemSeq,
            @JsonProperty("ITEM_NAME") String itemName,      // 예: 타이레놀정500밀리그람(아세트아미노펜)
            @JsonProperty("ENTP_NAME") String entpName,
            @JsonProperty("SPCLTY_PBLC") String specialty,   // 전문의약품 / 일반의약품
            @JsonProperty("EDI_CODE") String ediCode,        // 보험코드 (일반의약품은 null 인 경우가 많음)
            @JsonProperty("CANCEL_NAME") String cancelName   // 정상 / 취소 등
    ) {
        /** 허가가 취소되지 않은 품목인지 */
        public boolean isActive() {
            return cancelName == null || cancelName.isBlank() || "정상".equals(cancelName.trim());
        }
    }
}
