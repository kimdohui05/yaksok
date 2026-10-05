package com.bank.yaksok.medication.dto;

import java.time.LocalTime;

public record MedicationRequestDto(String medicineName, LocalTime alarmTime) {}