package com.bank.yaksok.medication.controller;

import com.bank.yaksok.medication.dto.MedicationRequestDto;
import com.bank.yaksok.medication.dto.MedicationResponseDto;
import com.bank.yaksok.medication.service.MedicationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(Authentication authentication, @PathVariable Long id) {
        String email = authentication.getName();
        medicationService.delete(email, id);
        return ResponseEntity.ok().build();
    }
}