package com.bank.yaksok.api.drug.controller;

import com.bank.yaksok.api.drug.dto.DrugSummaryResponse;
import com.bank.yaksok.api.drug.service.DrugSummaryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/drugs")
@RequiredArgsConstructor
public class DrugSummaryController {

    private final DrugSummaryService drugSummaryService;

    /**
     * 약 정보 AI 요약. 로그인 필요 (Authorization: Bearer 토큰).
     * 예: GET /api/drugs/summary?itemName=타이레놀정500mg
     */
    @GetMapping("/summary")
    public ResponseEntity<DrugSummaryResponse> summary(@RequestParam String itemName) {
        return ResponseEntity.ok(drugSummaryService.summarize(itemName));
    }

    /** 오류도 { "message": "..." } JSON 으로 바로 내려서 프론트가 안내 문구로 쓸 수 있게 한다. */
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handle(ResponseStatusException e) {
        String message = e.getReason() == null ? "요청을 처리하지 못했습니다." : e.getReason();
        return ResponseEntity.status(e.getStatusCode()).body(Map.of("message", message));
    }
}
