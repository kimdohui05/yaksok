package com.bank.yaksok.api.dur.client;

import com.bank.yaksok.api.dur.dto.DrugPermitResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;

/**
 * 의약품 제품 허가정보 API 호출.
 * 키는 기존 dur.service-key 를 그대로 쓰고, 호출 방식도 DurApiClient 와 같게 맞췄다.
 */
@Component
public class DrugPermitApiClient {

    private final RestClient restClient;

    @Value("${dur.service-key}")
    private String serviceKey;

    @Value("${dur.permit-url}")
    private String permitUrl;

    public DrugPermitApiClient() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        requestFactory.setReadTimeout(Duration.ofSeconds(10));
        this.restClient = RestClient.builder().requestFactory(requestFactory).build();
    }

    /** 제품명으로 검색 (부분 일치) */
    public List<DrugPermitResponse.Item> searchByName(String itemName) {
        return call("item_name", itemName);
    }

    /** 보험코드(EDI 코드)로 검색 */
    public List<DrugPermitResponse.Item> searchByEdiCode(String ediCode) {
        return call("edi_code", ediCode);
    }

    private List<DrugPermitResponse.Item> call(String param, String value) {
        URI uri = UriComponentsBuilder.fromUriString(permitUrl)
                .queryParam("serviceKey", serviceKey)
                .queryParam("pageNo", 1)
                .queryParam("numOfRows", 20)
                .queryParam("type", "json")
                .queryParam(param, URLEncoder.encode(value, StandardCharsets.UTF_8))
                .build(true)
                .toUri();

        DrugPermitResponse response = restClient.get().uri(uri).retrieve().body(DrugPermitResponse.class);
        if (response == null || response.body() == null || response.body().items() == null) {
            return List.of();
        }
        return response.body().items();
    }
}
