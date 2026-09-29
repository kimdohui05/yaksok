package com.bank.yaksok.api.dur.client;

import com.bank.yaksok.api.dur.dto.DurResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Component
public class DurApiClient {

    private final RestClient restClient = RestClient.create();

    @Value("${dur.service-key}")
    private String serviceKey;

    @Value("${dur.base-url}")
    private String baseUrl;

    public DurResponse getUsjntTaboo(String itemName) {
        String encodedItemName = URLEncoder.encode(itemName, StandardCharsets.UTF_8);

        URI uri = UriComponentsBuilder.fromUriString(baseUrl)
                .queryParam("serviceKey", serviceKey)
                .queryParam("pageNo", 1)
                .queryParam("numOfRows", 50)
                .queryParam("type", "json")
                .queryParam("itemName", encodedItemName)
                .build(true)
                .toUri();

        return restClient.get()
                .uri(uri)
                .retrieve()
                .body(DurResponse.class);
    }
}