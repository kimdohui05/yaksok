package com.bank.yaksok.notification.controller;

import com.bank.yaksok.notification.dto.NotificationResponse;
import com.bank.yaksok.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** 알림 기록과 "먹었어요". 모두 로그인 필요 */
@RestController
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    /** GET /api/notifications → 최근 알림 50개 (최신순) [{ id, title, body, alarmAt, read }] */
    @GetMapping("/api/notifications")
    public ResponseEntity<List<NotificationResponse>> list(Authentication auth) {
        return ResponseEntity.ok(notificationService.list(auth.getName()));
    }

    /** GET /api/notifications/unread-count → { count } */
    @GetMapping("/api/notifications/unread-count")
    public ResponseEntity<Map<String, Long>> unreadCount(Authentication auth) {
        return ResponseEntity.ok(Map.of("count", notificationService.unreadCount(auth.getName())));
    }

    /** POST /api/notifications/read-all → 모두 읽음 */
    @PostMapping("/api/notifications/read-all")
    public ResponseEntity<Void> readAll(Authentication auth) {
        notificationService.readAll(auth.getName());
        return ResponseEntity.ok().build();
    }

    /** GET /api/doses?date=2026-11-27 → 그날 먹은 약 id 목록 [3, 5]. date 생략하면 오늘 */
    @GetMapping("/api/doses")
    public ResponseEntity<List<Long>> taken(Authentication auth,
                                            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(notificationService.takenIds(auth.getName(), date));
    }

    /** PUT /api/doses/{medicationId}?date= → 먹었어요 */
    @PutMapping("/api/doses/{medicationId}")
    public ResponseEntity<Void> markTaken(Authentication auth, @PathVariable Long medicationId,
                                          @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        notificationService.markTaken(auth.getName(), medicationId, date);
        return ResponseEntity.ok().build();
    }

    /** DELETE /api/doses/{medicationId}?date= → 먹었어요 취소 */
    @DeleteMapping("/api/doses/{medicationId}")
    public ResponseEntity<Void> unmarkTaken(Authentication auth, @PathVariable Long medicationId,
                                            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        notificationService.unmarkTaken(auth.getName(), medicationId, date);
        return ResponseEntity.ok().build();
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handle(ResponseStatusException e) {
        String message = e.getReason() == null ? "요청을 처리하지 못했습니다." : e.getReason();
        return ResponseEntity.status(e.getStatusCode()).body(Map.of("message", message));
    }
}
