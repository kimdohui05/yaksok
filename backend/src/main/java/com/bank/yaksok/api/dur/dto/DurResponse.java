package com.bank.yaksok.api.dur.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record DurResponse(Header header, Body body) {

    public record Header(
            @JsonProperty("resultCode") String resultCode,
            @JsonProperty("resultMsg") String resultMsg
    ) {}

    public record Body(
            @JsonProperty("pageNo") int pageNo,
            @JsonProperty("totalCount") int totalCount,
            @JsonProperty("numOfRows") int numOfRows,
            @JsonProperty("items") List<Item> items
    ) {}

    public record Item(
            @JsonProperty("ITEM_NAME") String itemName,
            @JsonProperty("MIXTURE_ITEM_NAME") String mixtureItemName,
            @JsonProperty("PROHBT_CONTENT") String prohibitContent,
            @JsonProperty("TYPE_NAME") String typeName
    ) {}
}