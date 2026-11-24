package com.bank.yaksok.medication.controller;

import com.bank.yaksok.medication.dto.MedicationRequestDto;
import com.bank.yaksok.medication.dto.MedicationResponseDto;
import com.bank.yaksok.medication.dto.UnverifiedDrugNameResponse;
import com.bank.yaksok.medication.exception.UnverifiedDrugNameException;
import com.bank.yaksok.medication.service.MedicationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/medications")
@RequiredArgsConstructor
public class MedicationController {

    private final MedicationService medicationService;

    @PostMapping
    public ResponseEntity<MedicationResponseDto> register(
            Authentication authentication,
            @RequestBody MedicationRequestDto request
    ) {
        String email = authentication.getName();
        return ResponseEntity.ok(medicationService.register(email, request));
    }

    @GetMapping
    public ResponseEntity<List<MedicationResponseDto>> getMyMedications(Authentication authentication) {
        String email = authentication.getName();
        return ResponseEntity.ok(medicationService.getMyMedications(email));
    }

    @PutMapping("/{id}")
    public ResponseEntity<MedicationResponseDto> update(
            Authentication authentication,
            @PathVariable Long id,
            @RequestBody MedicationRequestDto request
    ) {
        String email = authentication.getName();
        return ResponseEntity.ok(medicationService.update(email, id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(Authentication authentication, @PathVariable Long id) {
        String email = authentication.getName();
        medicationService.delete(email, id);
        return ResponseEntity.ok().build();
    }

    /** 확인되지 않은 약 이름: 422 + 후보 이름 */
    @ExceptionHandler(UnverifiedDrugNameException.class)
    public ResponseEntity<UnverifiedDrugNameResponse> handleUnverified(UnverifiedDrugNameException e) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(new UnverifiedDrugNameResponse(
                UnverifiedDrugNameResponse.CODE, e.getMessage(), e.getInputName(), e.getSuggestions()));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleStatus(ResponseStatusException e) {
        String message = e.getReason() != null ? e.getReason() : "요청을 처리하지 못했습니다.";
        return ResponseEntity.status(e.getStatusCode()).body(Map.of("message", message));
    }
}
