package com.bank.yaksok.medication.repository;

import com.bank.yaksok.medication.entity.MedicationEntity;
import com.bank.yaksok.user.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalTime;
import java.util.List;

public interface MedicationRepository extends JpaRepository<MedicationEntity, Long> {

    List<MedicationEntity> findByUser(UserEntity user);

    // 스케줄러용: user를 같이 조회해서 LAZY 로딩 에러 방지
    @Query("select m from MedicationEntity m join fetch m.user where m.alarmTime = :alarmTime")
    List<MedicationEntity> findByAlarmTime(@Param("alarmTime") LocalTime alarmTime);
}