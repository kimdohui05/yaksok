package com.bank.yaksok.medication.service;

import com.bank.yaksok.api.prescription.service.DrugNameVerifier;
import com.bank.yaksok.medication.dto.MedicationRequestDto;
import com.bank.yaksok.medication.dto.MedicationResponseDto;
import com.bank.yaksok.medication.entity.MedicationEntity;
import com.bank.yaksok.medication.exception.UnverifiedDrugNameException;
import com.bank.yaksok.medication.repository.MedicationRepository;
import com.bank.yaksok.user.entity.UserEntity;
import com.bank.yaksok.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
public class MedicationService {

    private final MedicationRepository medicationRepository;
    private final UserRepository userRepository;
    private final DrugNameVerifier drugNameVerifier;

    private static final int MAX_SUGGESTIONS = 5;

    public MedicationResponseDto register(String email, MedicationRequestDto request) {
        UserEntity user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        String medicineName = checkMedicineName(request);

        MedicationEntity medication = MedicationEntity.builder()
                .user(user)
                .medicineName(medicineName)
                .alarmTime(request.alarmTime())
                .build();

        MedicationEntity saved = medicationRepository.save(medication);
        return new MedicationResponseDto(saved.getId(), saved.getMedicineName(), saved.getAlarmTime());
    }

    /**
     * 저장 전 약 이름 확인.
     *  - 공공데이터에서 같은 약으로 확인되면 저장 (한 글자 오타는 공식 이름으로 고쳐서 저장)
     *  - 확인되지 않으면 저장하지 않고 비슷한 약 이름 후보와 함께 거부 (422)
     *  - confirmed=true 면 사용자가 확인한 것이므로 입력한 이름 그대로 저장
     */
    private String checkMedicineName(MedicationRequestDto request) {
        String name = request.medicineName() == null ? "" : request.medicineName().trim();
        if (name.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "약 이름을 입력해 주세요.");
        }
        if (Boolean.TRUE.equals(request.confirmed())) {
            return name;
        }
        DrugNameVerifier.Result result = drugNameVerifier.verify(name, null);
        if (result.verified()) {
            return result.name();
        }
        throw new UnverifiedDrugNameException(name, drugNameVerifier.suggest(name, MAX_SUGGESTIONS));
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

    @Transactional
    public MedicationResponseDto update(String email, Long medicationId, MedicationRequestDto request) {
        UserEntity user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        MedicationEntity medication = medicationRepository.findById(medicationId)
                .orElseThrow(() -> new IllegalArgumentException("해당 약 정보를 찾을 수 없습니다."));

        if (!medication.getUser().getId().equals(user.getId())) {
            throw new IllegalArgumentException("본인의 약 정보만 수정할 수 있습니다.");
        }

        // 수정할 때도 저장과 똑같이 약 이름 확인 (확인 안 되면 422, confirmed=true 면 그대로)
        String medicineName = checkMedicineName(request);

        medication.update(medicineName, request.alarmTime());
        return new MedicationResponseDto(medication.getId(), medication.getMedicineName(), medication.getAlarmTime());
    }
}
