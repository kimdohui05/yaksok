package com.bank.yaksok.notification.service;

import com.bank.yaksok.medication.entity.MedicationEntity;
import com.bank.yaksok.medication.repository.MedicationRepository;
import com.bank.yaksok.notification.dto.NotificationResponse;
import com.bank.yaksok.notification.entity.DoseLogEntity;
import com.bank.yaksok.notification.repository.DoseLogRepository;
import com.bank.yaksok.notification.repository.NotificationRepository;
import com.bank.yaksok.user.entity.UserEntity;
import com.bank.yaksok.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

/** 알림 목록·읽음 처리, "먹었어요" 기록 */
@Service
@RequiredArgsConstructor
public class NotificationService {

    public static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

    private final NotificationRepository notificationRepository;
    private final DoseLogRepository doseLogRepository;
    private final MedicationRepository medicationRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<NotificationResponse> list(String email) {
        return notificationRepository.findTop50ByUserIdOrderByAlarmAtDesc(user(email).getId()).stream()
                .map(NotificationResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public long unreadCount(String email) {
        return notificationRepository.countByUserIdAndReadAtIsNull(user(email).getId());
    }

    @Transactional
    public void readAll(String email) {
        notificationRepository.markAllRead(user(email).getId(), LocalDateTime.now(SEOUL));
    }

    @Transactional(readOnly = true)
    public List<Long> takenIds(String email, LocalDate date) {
        return doseLogRepository.findTakenMedicationIds(user(email).getId(), date == null ? today() : date);
    }

    @Transactional
    public void markTaken(String email, Long medicationId, LocalDate date) {
        MedicationEntity medication = myMedication(email, medicationId);
        LocalDate day = date == null ? today() : date;
        if (doseLogRepository.findByMedicationIdAndTakenDate(medicationId, day).isPresent()) return;
        try {
            doseLogRepository.save(DoseLogEntity.builder().medication(medication).takenDate(day).build());
        } catch (DataIntegrityViolationException ignored) {
            // 동시에 두 번 누른 경우: 이미 기록됨
        }
    }

    @Transactional
    public void unmarkTaken(String email, Long medicationId, LocalDate date) {
        myMedication(email, medicationId);
        doseLogRepository.findByMedicationIdAndTakenDate(medicationId, date == null ? today() : date)
                .ifPresent(doseLogRepository::delete);
    }

    private MedicationEntity myMedication(String email, Long medicationId) {
        UserEntity user = user(email);
        MedicationEntity medication = medicationRepository.findById(medicationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "해당 약 정보를 찾을 수 없습니다."));
        if (!medication.getUser().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "본인의 약만 기록할 수 있습니다.");
        }
        return medication;
    }

    private UserEntity user(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "사용자를 찾을 수 없습니다."));
    }

    private static LocalDate today() {
        return LocalDate.now(SEOUL);
    }
}
