package com.bank.yaksok.medication.scheduler;

import com.bank.yaksok.notification.service.AlarmRules;
import com.bank.yaksok.notification.service.MedicationAlarmService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.ZoneId;

/**
 * 매분 복약 알림 확인.
 * 지난번에 처리한 분 다음부터 지금까지 확인해서, 서버가 잠깐 멈췄거나 늦게 돌아도 최대 5분 전 알림까지 보낸다.
 * (같은 알림이 두 번 가는 건 알림 기록으로 막음)
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MedicationAlarmScheduler {

    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

    private final MedicationAlarmService medicationAlarmService;

    private LocalDateTime lastProcessed;

    @Scheduled(cron = "0 * * * * *", zone = "Asia/Seoul") // 매분 0초
    public void sendAlarms() {
        LocalDateTime now = LocalDateTime.now(SEOUL);
        for (LocalDateTime minute : AlarmRules.minutesToProcess(lastProcessed, now, AlarmRules.MAX_CATCH_UP_MINUTES)) {
            try {
                int users = medicationAlarmService.sendAlarmsAt(minute);
                if (users > 0) log.info("복약 알림: {} → {}명", minute.toLocalTime(), users);
            } catch (Exception e) {
                log.error("복약 알림 확인 실패: {}", minute, e);
            }
            lastProcessed = minute;
        }
    }
}
