package com.bank.yaksok.api.drug.controller;

import com.bank.yaksok.api.drug.dto.DrugAutocompleteResponse;
import com.bank.yaksok.api.prescription.service.DrugNameVerifier;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/drugs")
@RequiredArgsConstructor
public class DrugAutocompleteController {

    private static final int MAX_ITEMS = 10;

    private final DrugNameVerifier drugNameVerifier;

    /**
     * 약 이름 연관검색어. 로그인 필요 (Authorization: Bearer 토큰).
     * 예: GET /api/drugs/autocomplete?q=타이
     * 2글자 미만이면 외부 조회 없이 빈 목록. 프론트는 입력을 멈추고 0.3초 뒤에 한 번만 요청하는 걸 권장.
     */
    @GetMapping("/autocomplete")
    public ResponseEntity<DrugAutocompleteResponse> autocomplete(@RequestParam(defaultValue = "") String q) {
        String query = q.trim();
        return ResponseEntity.ok(new DrugAutocompleteResponse(query, drugNameVerifier.autocomplete(query, MAX_ITEMS)));
    }
}
