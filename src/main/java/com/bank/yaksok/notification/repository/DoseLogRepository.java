package com.bank.yaksok.notification.repository;

import com.bank.yaksok.notification.entity.DoseLogEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface DoseLogRepository extends JpaRepository<DoseLogEntity, Long> {

    Optional<DoseLogEntity> findByMedicationIdAndTakenDate(Long medicationId, LocalDate takenDate);

    /** 그날 먹은 약 id 목록 (사용자 기준) */
    @Query("select d.medication.id from DoseLogEntity d where d.medication.user.id = :userId and d.takenDate = :date")
    List<Long> findTakenMedicationIds(@Param("userId") Long userId, @Param("date") LocalDate date);

    /** 주어진 약들 중 그날 이미 먹은 약 id (스케줄러: 먼저 먹은 약은 알림에서 뺌) */
    @Query("select d.medication.id from DoseLogEntity d where d.medication.id in :ids and d.takenDate = :date")
    List<Long> findTakenAmong(@Param("ids") Collection<Long> ids, @Param("date") LocalDate date);

    @Modifying
    @Query("delete from DoseLogEntity d where d.medication.id = :medicationId")
    int deleteByMedicationId(@Param("medicationId") Long medicationId);
}
