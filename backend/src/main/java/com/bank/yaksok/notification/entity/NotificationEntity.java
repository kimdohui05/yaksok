package com.bank.yaksok.notification.entity;

import com.bank.yaksok.user.entity.UserEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/** 보낸 복약 알림 기록 (종 아이콘 목록). 사용자·알림 시각마다 하나 → 같은 알림이 두 번 가지 않게 막는 역할도 함 */
@Entity
@Table(name = "notification",
        uniqueConstraints = @UniqueConstraint(name = "uk_notification_user_alarm", columnNames = {"user_id", "alarm_at"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class NotificationEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(nullable = false, length = 500)
    private String body;

    /** 알림 예정 시각 (분 단위, 예: 2026-11-27T08:00) */
    @Column(name = "alarm_at", nullable = false)
    private LocalDateTime alarmAt;

    /** 읽은 시각, 안 읽었으면 null */
    private LocalDateTime readAt;

    @Column(updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
