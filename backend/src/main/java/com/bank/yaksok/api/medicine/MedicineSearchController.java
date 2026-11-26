package com.bank.yaksok.api.medicine;

import com.bank.yaksok.api.prescription.service.DrugNameVerifier;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/medicines")
@RequiredArgsConstructor
public class MedicineSearchController {

    private static final int MAX_LIMIT = 10;

    private final DrugNameVerifier drugNameVerifier;

    /**
     * 약 이름 연관검색어 (프론트 medicineSearch.js). 로그인 필요.
     * 예: GET /api/medicines/search?keyword=타이&limit=10
     * 응답: ["타이레놀정500밀리그람", "타이레놀정160밀리그램", ...]  (공식 약 이름, 앞글자가 같은 것 먼저, 최대 10개)
     * 2글자 미만이면 외부 조회 없이 빈 배열.
     */
    @GetMapping("/search")
    public ResponseEntity<List<String>> search(@RequestParam(defaultValue = "") String keyword,
                                               @RequestParam(defaultValue = "10") int limit) {
        int size = Math.max(1, Math.min(limit, MAX_LIMIT));
        return ResponseEntity.ok(drugNameVerifier.autocomplete(keyword, size));
    }
}
