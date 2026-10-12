package com.bank.yaksok.medication.scheduler;

import com.bank.yaksok.email.service.EmailService;
import com.bank.yaksok.medication.entity.MedicationEntity;
import com.bank.yaksok.medication.repository.MedicationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class MedicationAlarmScheduler {

    private final MedicationRepository medicationRepository;
    private final EmailService emailService;

    @Scheduled(cron = "0 * * * * *", zone = "Asia/Seoul") // 매분 0초
    public void sendAlarms() {
        LocalTime now = LocalTime.now(ZoneId.of("Asia/Seoul")).withSecond(0).withNano(0);
        List<MedicationEntity> targets = medicationRepository.findByAlarmTime(now);
        log.info("복약 알림 체크: now={}, 대상={}건", now, targets.size());

        for (MedicationEntity m : targets) {
            try {
                emailService.send(
                        m.getUser().getEmail(),
                        "[약속] 복약 시간입니다",
                        m.getUser().getName() + "님, " + m.getMedicineName() + " 드실 시간이에요."
                );
                log.info("복약 알림 발송 완료: to={}, medicine={}", m.getUser().getEmail(), m.getMedicineName());
            } catch (Exception e) {
                log.error("복약 알림 발송 실패: medicationId={}", m.getId(), e);
            }
        }
    }
}