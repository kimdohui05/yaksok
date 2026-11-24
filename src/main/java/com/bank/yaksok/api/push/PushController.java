package com.bank.yaksok.api.push;

import com.bank.yaksok.api.push.dto.PushPublicKeyResponse;
import com.bank.yaksok.api.push.dto.PushSubscribeRequest;
import com.bank.yaksok.api.push.dto.PushUnsubscribeRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

/** PC 알림 센터 알림(웹 푸시). 프론트 src/features/notification/push.js 와 같은 주소. 모두 로그인 필요. */
@RestController
@RequestMapping("/api/push")
@RequiredArgsConstructor
public class PushController {

    private final PushService pushService;

    /** GET /api/push/public-key → { publicKey } */
    @GetMapping("/public-key")
    public ResponseEntity<PushPublicKeyResponse> publicKey() {
        return ResponseEntity.ok(new PushPublicKeyResponse(pushService.publicKey()));
    }

    /** POST /api/push/subscribe ← PushSubscription.toJSON() */
    @PostMapping("/subscribe")
    public ResponseEntity<Void> subscribe(Authentication authentication, @RequestBody PushSubscribeRequest request) {
        pushService.subscribe(authentication.getName(), request);
        return ResponseEntity.ok().build();
    }

    /** POST /api/push/unsubscribe ← { endpoint } */
    @PostMapping("/unsubscribe")
    public ResponseEntity<Void> unsubscribe(Authentication authentication, @RequestBody PushUnsubscribeRequest request) {
        pushService.unsubscribe(authentication.getName(), request == null ? null : request.endpoint());
        return ResponseEntity.ok().build();
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handle(ResponseStatusException e) {
        String message = e.getReason() == null ? "요청을 처리하지 못했습니다." : e.getReason();
        return ResponseEntity.status(e.getStatusCode()).body(Map.of("message", message));
    }
}
