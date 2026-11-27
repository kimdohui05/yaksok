package com.bank.yaksok.medication.dto;

import com.bank.yaksok.medication.entity.MedicationEntity;

import java.time.LocalDate;
import java.time.LocalTime;

/** startDate, days 는 없으면 null (기간 제한 없음) */
public record MedicationResponseDto(Long id, String medicineName, LocalTime alarmTime,
                                    LocalDate startDate, Integer days) {

    public static MedicationResponseDto from(MedicationEntity m) {
        return new MedicationResponseDto(m.getId(), m.getMedicineName(), m.getAlarmTime(), m.getStartDate(), m.getDays());
    }
}
