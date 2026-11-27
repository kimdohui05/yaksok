package com.bank.yaksok.user.controller;

import com.bank.yaksok.user.dto.UserProfileResponse;
import com.bank.yaksok.user.dto.UserSettingsRequest;
import com.bank.yaksok.user.entity.UserEntity;
import com.bank.yaksok.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserProfileController {

    private final UserRepository userRepository;

    /** 내 정보. 로그인 필요. 응답: { "name": "김도희", "email": "...", "alarmEnabled": true } */
    @GetMapping("/profile")
    public ResponseEntity<?> profile(Authentication authentication) {
        return findUser(authentication)
                .<ResponseEntity<?>>map(u -> ResponseEntity.ok(toResponse(u)))
                .orElseGet(UserProfileController::notFound);
    }

    /**
     * 앱 설정 변경. 로그인 필요.
     * PUT /api/user/settings  { "alarmEnabled": false } → 복약 알림(메일·PC 알림)을 서버에서 보내지 않음
     */
    @PutMapping("/settings")
    @Transactional
    public ResponseEntity<?> updateSettings(Authentication authentication, @RequestBody UserSettingsRequest request) {
        if (request == null || request.alarmEnabled() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "alarmEnabled 값을 보내 주세요."));
        }
        return findUser(authentication)
                .<ResponseEntity<?>>map(u -> {
                    u.changeAlarmEnabled(request.alarmEnabled());
                    return ResponseEntity.ok(toResponse(userRepository.save(u)));
                })
                .orElseGet(UserProfileController::notFound);
    }

    private Optional<UserEntity> findUser(Authentication authentication) {
        return userRepository.findByEmail(authentication.getName());
    }

    private static UserProfileResponse toResponse(UserEntity u) {
        return new UserProfileResponse(u.getName(), u.getEmail(), u.isAlarmOn());
    }

    private static ResponseEntity<?> notFound() {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "사용자를 찾을 수 없습니다."));
    }
}
