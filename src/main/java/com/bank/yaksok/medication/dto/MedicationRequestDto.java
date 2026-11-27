package com.bank.yaksok.medication.dto;

import java.time.LocalDate;
import java.time.LocalTime;

/**
 * @param medicineName 약 이름
 * @param alarmTime    알림 시간 ("08:00:00")
 * @param confirmed    true 면 공공데이터에서 확인되지 않은 이름이어도 사용자가 확인하고 그대로 저장 (생략하면 false)
 * @param startDate    처방 시작일 ("2026-11-27"). 생략하면 기간 제한 없음 (수정할 때 생략하면 기존 값 유지)
 * @param days         총 투약 일수 (1~365). 생략하면 기간 제한 없음 (수정할 때 생략하면 기존 값 유지)
 */
public record MedicationRequestDto(String medicineName, LocalTime alarmTime, Boolean confirmed,
                                   LocalDate startDate, Integer days) {}
