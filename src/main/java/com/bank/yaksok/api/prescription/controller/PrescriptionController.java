package com.bank.yaksok.api.prescription.controller;

import com.bank.yaksok.api.prescription.dto.PrescriptionAnalyzeResponse;
import com.bank.yaksok.api.prescription.service.PrescriptionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/prescriptions")
@RequiredArgsConstructor
public class PrescriptionController {

    private final PrescriptionService prescriptionService;

    /**
     * 처방전 사진 분석. 로그인 필요 (Authorization: Bearer 토큰).
     * 요청: multipart/form-data, 파일 필드명 "image"
     * 응답: { prescriptionDate, medicines: [{ name, dose, timesPerDay, days }] }
     */
    @PostMapping(value = "/analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PrescriptionAnalyzeResponse> analyze(@RequestParam("image") MultipartFile image) {
        return ResponseEntity.ok(prescriptionService.analyze(image));
    }

    /** 오류도 { "message": "..." } JSON 으로 바로 내려서 프론트가 안내 문구로 쓸 수 있게 한다. */
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handle(ResponseStatusException e) {
        String message = e.getReason() == null ? "요청을 처리하지 못했습니다." : e.getReason();
        return ResponseEntity.status(e.getStatusCode()).body(Map.of("message", message));
    }
}
