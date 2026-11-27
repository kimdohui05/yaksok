package com.bank.yaksok.medication.entity;

import com.bank.yaksok.user.entity.UserEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(name = "medication")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MedicationEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Column(nullable = false, length = 50)
    private String medicineName;

    @Column(nullable = false)
    private LocalTime alarmTime; // 예: 08:00

    /** 처방 시작일. 없으면 기간 제한 없이 매일 알림 (이 칸이 생기기 전에 저장한 약) */
    private LocalDate startDate;

    /** 총 투약 일수. 시작일부터 이 일수 동안만 알림, 없으면 계속 */
    private Integer days;

    @Column(updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    // 약 이름 / 알람 시간 / 처방 기간 수정
    public void update(String medicineName, LocalTime alarmTime, LocalDate startDate, Integer days) {
        this.medicineName = medicineName;
        this.alarmTime = alarmTime;
        this.startDate = startDate;
        this.days = days;
    }
}
