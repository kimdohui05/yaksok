package com.bank.yaksok.notification.service;

import com.bank.yaksok.api.push.PushService;
import com.bank.yaksok.email.service.EmailService;
import com.bank.yaksok.medication.entity.MedicationEntity;
import com.bank.yaksok.medication.repository.MedicationRepository;
import com.bank.yaksok.notification.entity.NotificationEntity;
import com.bank.yaksok.notification.repository.DoseLogRepository;
import com.bank.yaksok.notification.repository.NotificationRepository;
import com.bank.yaksok.user.entity.UserEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 한 분(예: 08:00)에 보낼 복약 알림을 모아서 보낸다.
 *  - 처방 기간(시작일·투약 일수) 안의 약만
 *  - 알림을 끈 사용자는 제외
 *  - 그날 이미 "먹었어요"를 누른 약은 제외
 *  - 사용자마다 알림 하나로 묶어서 PC 알림 + 메일 (약 3개면 한 번에)
 *  - 보낸 알림은 기록 (종 아이콘 목록). 같은 사용자·시각은 한 번만 보냄
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MedicationAlarmService {

    private static final DateTimeFormatter TAG_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmm");

    private final MedicationRepository medicationRepository;
    private final NotificationRepository notificationRepository;
    private final DoseLogRepository doseLogRepository;
    private final PushService pushService;
    private final EmailService emailService;

    /** @return 알림을 보낸 사용자 수 */
    public int sendAlarmsAt(LocalDateTime alarmAt) {
        List<MedicationEntity> due = medicationRepository.findByAlarmTime(alarmAt.toLocalTime()).stream()
                .filter(m -> AlarmRules.isActiveOn(m.getStartDate(), m.getDays(), alarmAt.toLocalDate()))
                .filter(m -> m.getUser().isAlarmOn())
                .toList();
        if (due.isEmpty()) return 0;

        Set<Long> taken = new HashSet<>(doseLogRepository.findTakenAmong(
                due.stream().map(MedicationEntity::getId).toList(), alarmAt.toLocalDate()));

        Map<Long, List<MedicationEntity>> byUser = new LinkedHashMap<>();
        for (MedicationEntity m : due) {
            if (!taken.contains(m.getId())) {
                byUser.computeIfAbsent(m.getUser().getId(), k -> new java.util.ArrayList<>()).add(m);
            }
        }

        int sentUsers = 0;
        for (List<MedicationEntity> meds : byUser.values()) {
            try {
                if (notifyUser(meds.get(0).getUser(), meds, alarmAt)) sentUsers++;
            } catch (Exception e) {
                log.error("복약 알림 처리 실패: userId={}, alarmAt={}", meds.get(0).getUser().getId(), alarmAt, e);
            }
        }
        return sentUsers;
    }

    private boolean notifyUser(UserEntity user, List<MedicationEntity> meds, LocalDateTime alarmAt) {
        if (notificationRepository.existsByUserIdAndAlarmAt(user.getId(), alarmAt)) {
            return false; // 이미 보낸 알림 (서버 재시작 후 보충 확인 등)
        }
        List<String> names = meds.stream().map(MedicationEntity::getMedicineName).toList();
        String body = AlarmRules.body(names);

        try {
            notificationRepository.save(NotificationEntity.builder()
                    .user(user).title(AlarmRules.TITLE).body(body).alarmAt(alarmAt).build());
        } catch (DataIntegrityViolationException e) {
            return false; // 동시에 다른 곳에서 먼저 기록함
        }

        // PC 알림과 메일은 따로 처리해서 한쪽이 실패해도 다른 쪽은 보낸다
        try {
            int browsers = pushService.sendToUser(user.getId(), AlarmRules.TITLE, body, "/",
                    "med-" + user.getId() + "-" + alarmAt.format(TAG_FORMAT));
            if (browsers > 0) log.info("PC 알림 발송: userId={}, 약={}, 브라우저={}개", user.getId(), names, browsers);
        } catch (Exception e) {
            log.error("PC 알림 발송 실패: userId={}", user.getId(), e);
        }
        try {
            emailService.send(user.getEmail(), "[약속] 복약 시간입니다",
                    user.getName() + "님, " + String.join(", ", names) + " 드실 시간이에요.");
            log.info("메일 알림 발송: to={}, 약={}", user.getEmail(), names);
        } catch (Exception e) {
            log.error("메일 알림 발송 실패: userId={}", user.getId(), e);
        }
        return true;
    }
}
