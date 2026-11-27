package com.bank.yaksok.api.drug.controller;

import com.bank.yaksok.api.drug.dto.DrugVerifyResponse;
import com.bank.yaksok.api.prescription.service.DrugNameVerifier;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/drugs")
@RequiredArgsConstructor
public class DrugVerifyController {

    private static final int MAX_SUGGESTIONS = 5;

    private final DrugNameVerifier drugNameVerifier;

    /**
     * 약 이름 확인. 로그인 필요.
     * 예: GET /api/drugs/verify?name=타이레놀정500mg
     *  - 있는 약:  { verified: true,  name: "타이레놀정500mg", message: null, category: "해열·진통", suggestions: [] }
     *  - 없는 약:  { verified: false, name: null, message: "그런 약은 존재하지 않습니다.", category: null, suggestions: [...] }
     *  - 빈 이름:  400 { message }
     */
    @GetMapping("/verify")
    public ResponseEntity<?> verify(@RequestParam(defaultValue = "") String name) {
        String input = name.trim();
        if (input.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "약 이름을 입력해 주세요."));
        }
        DrugNameVerifier.Result result = drugNameVerifier.verify(input, null);
        if (result.verified()) {
            return ResponseEntity.ok(new DrugVerifyResponse(input, true, result.name(), null,
                    drugNameVerifier.categoryOf(input), List.of()));
        }
        return ResponseEntity.ok(new DrugVerifyResponse(input, false, null,
                DrugVerifyResponse.NOT_FOUND_MESSAGE, null, drugNameVerifier.suggest(input, MAX_SUGGESTIONS)));
    }
}
