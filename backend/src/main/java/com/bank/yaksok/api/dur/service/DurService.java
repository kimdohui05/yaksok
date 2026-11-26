package com.bank.yaksok.api.dur.service;

import com.bank.yaksok.api.dur.client.DurApiClient;
import com.bank.yaksok.api.dur.dto.DrugInfoResponse;
import com.bank.yaksok.api.dur.dto.DurResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

import java.util.Collections;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class DurService {

    private final DurApiClient durApiClient;

    public List<DurResponse.Item> checkInteractions(String itemName) {
        DurResponse response = durApiClient.getUsjntTaboo(itemName);

        if (response.body().items() == null) {
            return Collections.emptyList();
        }

        return response.body().items();
    }

    // import: lombok.extern.slf4j.Slf4j, org.springframework.http.HttpStatus,
//         org.springframework.web.client.RestClientException,
//         org.springframework.web.server.ResponseStatusException, DrugInfoResponse

    public List<DrugInfoResponse.Summary> getDrugInfo(String itemName) {
        if (itemName == null || itemName.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "약 이름을 입력해 주세요.");
        }

        DrugInfoResponse response;
        try {
            response = durApiClient.getDrugInfo(itemName.trim());
        } catch (RestClientException e) {   // 공공 API 장애, 키 오류, XML 에러 응답 등
            log.error("의약품 정보 조회 실패: itemName={}", itemName, e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "의약품 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
        }

        if (response == null || response.body() == null || response.body().items() == null) {
            return Collections.emptyList();
        }
        return response.body().items().stream().map(DrugInfoResponse.Summary::from).toList();
    }
}