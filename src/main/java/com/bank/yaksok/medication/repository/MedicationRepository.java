package com.bank.yaksok.medication.repository;

import com.bank.yaksok.medication.entity.MedicationEntity;
import com.bank.yaksok.user.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalTime;
import java.util.List;

public interface MedicationRepository extends JpaRepository<MedicationEntity, Long> {
    List<MedicationEntity> findByUser(UserEntity user);
    List<MedicationEntity> findByAlarmTime(LocalTime alarmTime); // 스케줄러에서 쓸 예정
}