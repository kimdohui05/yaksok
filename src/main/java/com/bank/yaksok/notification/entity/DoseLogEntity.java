package com.bank.yaksok.notification.entity;

import com.bank.yaksok.medication.entity.MedicationEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** "먹었어요" 기록. 약(알림 시간 하나)·날짜마다 하나 */
@Entity
@Table(name = "dose_log",
        uniqueConstraints = @UniqueConstraint(name = "uk_dose_log_med_date", columnNames = {"medication_id", "taken_date"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class DoseLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "medication_id", nullable = false)
    private MedicationEntity medication;

    @Column(name = "taken_date", nullable = false)
    private LocalDate takenDate;

    @Column(updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
