package com.bank.yaksok.medication.dto;

import java.time.LocalTime;

/**
 * @param medicineName 약 이름
 * @param alarmTime    알림 시간
 * @param confirmed    true 면 공공데이터에서 확인되지 않은 이름이어도 사용자가 확인하고 그대로 저장 (생략하면 false)
 */
public record MedicationRequestDto(String medicineName, LocalTime alarmTime, Boolean confirmed) {}
