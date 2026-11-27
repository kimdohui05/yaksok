package com.bank.yaksok.notification.dto;

import com.bank.yaksok.notification.entity.NotificationEntity;

import java.time.LocalDateTime;

/** { id, title, body, alarmAt: "2026-11-27T08:00:00", read } */
public record NotificationResponse(Long id, String title, String body, LocalDateTime alarmAt, boolean read) {

    public static NotificationResponse from(NotificationEntity n) {
        return new NotificationResponse(n.getId(), n.getTitle(), n.getBody(), n.getAlarmAt(), n.getReadAt() != null);
    }
}
