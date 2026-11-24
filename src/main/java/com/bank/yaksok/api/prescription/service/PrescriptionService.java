package com.bank.yaksok.api.prescription.service;

import com.bank.yaksok.api.gemini.GeminiRetryExecutor;
import com.bank.yaksok.api.prescription.client.GeminiApiClient;
import com.bank.yaksok.api.prescription.dto.GeminiPrescriptionResult;
import com.bank.yaksok.api.prescription.dto.PrescriptionAnalyzeResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.Locale;
import java.util.Set;

/**
 * 처방전 사진 → Gemini → 정리된 결과. DB 에는 저장하지 않는다.
 * 사용자가 결과를 확인·수정한 뒤 기존 POST /medications 로 등록한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PrescriptionService {

    static final long MAX_IMAGE_BYTES = 10L * 1024 * 1024; // 10MB
    private static final Set<String> ALLOWED_TYPES =
            Set.of("image/jpeg", "image/png", "image/webp", "image/heic", "image/heif");

    private final GeminiApiClient geminiApiClient;
    private final PrescriptionResultCleaner resultCleaner;
    private final DrugNameVerifier drugNameVerifier;
    private final ImageQualityChecker imageQualityChecker;
    private final ObjectMapper objectMapper;
    private final GeminiRetryExecutor geminiRetryExecutor;

    private static final GeminiRetryExecutor.FailureMessages FAILURE_MESSAGES = new GeminiRetryExecutor.FailureMessages(
            "지금 AI 사용량이 많아 분석하지 못했습니다. 잠시 후 다시 촬영해 주세요.",
            "AI 사용 한도를 초과했습니다. 잠시 후 다시 시도하거나 약 정보를 직접 입력해 주세요.",
            "AI 분석에 실패했습니다. 잠시 후 다시 시도해 주세요.");

    public PrescriptionAnalyzeResponse analyze(MultipartFile image) {
        String mimeType = validate(image);

        if (!geminiApiClient.hasApiKey()) {
            log.error("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.");
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "AI 분석 기능이 아직 설정되지 않았습니다.");
        }

        byte[] bytes;
        try {
            bytes = image.getBytes();
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "사진을 읽지 못했습니다. 다시 촬영해 주세요.");
        }

        // 사진이 너무 작으면 AI 를 부르지 않고 바로 안내 (할당량 절약)
        ImageQualityChecker.Resolution resolution = imageQualityChecker.checkResolution(bytes);
        if (resolution == ImageQualityChecker.Resolution.TOO_LOW) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_CONTENT, ImageQualityChecker.UNREADABLE_MESSAGE);
        }

        GeminiPrescriptionResult raw = callGeminiWithRetry(bytes, mimeType);
        PrescriptionAnalyzeResponse cleaned = resultCleaner.clean(raw);
        boolean poorQuality = resolution == ImageQualityChecker.Resolution.LOW
                || ImageQualityChecker.isPoorReadability(raw.readability());

        if (cleaned.medicines().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_CONTENT, poorQuality
                    ? ImageQualityChecker.UNREADABLE_MESSAGE
                    : "처방전에서 약 정보를 찾지 못했습니다. 처방전 전체가 잘 보이게 다시 촬영해 주세요.");
        }
        if (poorQuality) {
            log.info("화질 경고: resolution={}, readability={}", resolution, raw.readability());
        }

        // AI 가 읽은 약 이름을 공공데이터로 검증 (보험코드 → 허가정보 → e약은요)
        var verifiedMedicines = cleaned.medicines().stream()
                .map(m -> {
                    DrugNameVerifier.Result v = drugNameVerifier.verify(m.name(), m.ediCode());
                    return m.withVerification(v.name(), v.verified(), v.originalName(), v.suggestedName());
                })
                .toList();
        return new PrescriptionAnalyzeResponse(cleaned.prescriptionDate(), verifiedMedicines,
                poorQuality ? ImageQualityChecker.WARNING_MESSAGE : null);
    }

    /** 파일 형식·크기 검사. 통과하면 Gemini 에 보낼 MIME 타입을 돌려준다. */
    private String validate(MultipartFile image) {
        if (image == null || image.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "처방전 사진을 첨부해 주세요.");
        }
        if (image.getSize() > MAX_IMAGE_BYTES) {
            throw new ResponseStatusException(HttpStatus.CONTENT_TOO_LARGE, "사진 용량은 10MB 이하만 가능합니다.");
        }
        String type = image.getContentType() == null ? "" : image.getContentType().toLowerCase(Locale.ROOT);
        int semicolon = type.indexOf(';');
        if (semicolon >= 0) {
            type = type.substring(0, semicolon).trim();
        }
        if (type.equals("image/jpg")) {
            type = "image/jpeg";
        }
        if (!ALLOWED_TYPES.contains(type)) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "jpg, png, webp, heic 사진만 올릴 수 있습니다.");
        }
        return type;
    }

    /** Gemini 호출 (재시도는 공통 GeminiRetryExecutor 가 담당) */
    private GeminiPrescriptionResult callGeminiWithRetry(byte[] bytes, String mimeType) {
        return geminiRetryExecutor.execute("처방전 분석",
                model -> geminiApiClient.analyzePrescription(bytes, mimeType, model),
                this::parse,
                FAILURE_MESSAGES);
    }

    private GeminiPrescriptionResult parse(String json) {
        if (json == null || json.isBlank()) {
            log.warn("Gemini 응답에 텍스트가 없습니다.");
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "처방전을 읽지 못했습니다. 다시 촬영해 주세요.");
        }
        try {
            return objectMapper.readValue(json, GeminiPrescriptionResult.class);
        } catch (RuntimeException e) { // Jackson 3 의 JacksonException 은 unchecked
            log.warn("Gemini 응답 JSON 파싱 실패: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "처방전을 읽지 못했습니다. 다시 촬영해 주세요.");
        }
    }
}
