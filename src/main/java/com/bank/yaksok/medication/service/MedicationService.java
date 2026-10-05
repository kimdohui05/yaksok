package com.bank.yaksok.medication.service;

import com.bank.yaksok.medication.dto.MedicationRequestDto;
import com.bank.yaksok.medication.dto.MedicationResponseDto;
import com.bank.yaksok.medication.entity.MedicationEntity;
import com.bank.yaksok.medication.repository.MedicationRepository;
import com.bank.yaksok.user.entity.UserEntity;
import com.bank.yaksok.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class MedicationService {

    private final MedicationRepository medicationRepository;
    private final UserRepository userRepository;

    public MedicationResponseDto register(String email, MedicationRequestDto request) {
        UserEntity user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        MedicationEntity medication = MedicationEntity.builder()
                .user(user)
                .medicineName(request.medicineName())
                .alarmTime(request.alarmTime())
                .build();

        MedicationEntity saved = medicationRepository.save(medication);
        return new MedicationResponseDto(saved.getId(), saved.getMedicineName(), saved.getAlarmTime());
    }

    public List<MedicationResponseDto> getMyMedications(String email) {
        UserEntity user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        return medicationRepository.findByUser(user).stream()
                .map(m -> new MedicationResponseDto(m.getId(), m.getMedicineName(), m.getAlarmTime()))
                .toList();
    }

    public void delete(String email, Long medicationId) {
        UserEntity user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        MedicationEntity medication = medicationRepository.findById(medicationId)
                .orElseThrow(() -> new IllegalArgumentException("해당 약 정보를 찾을 수 없습니다."));

        if (!medication.getUser().getId().equals(user.getId())) {
            throw new IllegalArgumentException("본인의 약 정보만 삭제할 수 있습니다.");
        }

        medicationRepository.delete(medication);
    }
}