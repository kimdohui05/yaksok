package com.bank.yaksok.medication.dto;

import java.time.LocalTime;

public record MedicationResponseDto(Long id, String medicineName, LocalTime alarmTime) {}