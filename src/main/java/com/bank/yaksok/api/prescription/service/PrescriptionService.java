package com.bank.yaksok.api.prescription.service;

import com.bank.yaksok.api.prescription.client.GeminiApiClient;
import com.bank.yaksok.api.prescription.dto.GeminiPrescriptionResult;
import com.bank.yaksok.api.prescription.dto.PrescriptionAnalyzeResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
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
    private final ObjectMapper objectMapper;

    /** 최대 시도 횟수 (환경변수 GEMINI_MAX_ATTEMPTS, 기본 4) */
    @Value("${gemini.max-attempts:4}")
    private int maxAttempts;

    /** 재시도를 포함한 전체 대기 한도 */
    private static final Duration TOTAL_BUDGET = Duration.ofSeconds(45);

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

        PrescriptionAnalyzeResponse cleaned = resultCleaner.clean(callGeminiWithRetry(bytes, mimeType));

        if (cleaned.medicines().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_CONTENT,
                    "처방전에서 약 정보를 찾지 못했습니다. 처방전 전체가 잘 보이게 다시 촬영해 주세요.");
        }

        // AI 가 읽은 약 이름을 공공데이터로 검증 (보험코드 → 허가정보 → e약은요)
        var verifiedMedicines = cleaned.medicines().stream()
                .map(m -> {
                    DrugNameVerifier.Result v = drugNameVerifier.verify(m.name(), m.ediCode());
                    return m.withVerification(v.name(), v.verified(), v.originalName());
                })
                .toList();
        return new PrescriptionAnalyzeResponse(cleaned.prescriptionDate(), verifiedMedicines);
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

    /**
     * 분석은 조회성 요청이라 다시 보내도 부작용이 없다.
     * 일시적 장애(5xx, 429, 시간 초과, 깨진 응답)면 모델을 바꿔 가며 최대 maxAttempts 번 시도한다.
     * - 모델 순서: 기본 → 예비1 → 예비2 ... → 다시 기본 (순환)
     * - 시도 사이 대기: 1초, 2초, 4초, 4초 ...
     * - 전체 시간이 TOTAL_BUDGET 을 넘으면 더 시도하지 않는다 (사용자가 너무 오래 기다리지 않게)
     * - 모델명이 틀려 404 가 나면 그 모델만 건너뛴다
     */
    private GeminiPrescriptionResult callGeminiWithRetry(byte[] bytes, String mimeType) {
        List<String> models = geminiApiClient.models();
        int attempts = Math.max(1, maxAttempts);
        long startedAt = System.nanoTime();
        ResponseStatusException lastFailure = aiBusy();

        for (int i = 0; i < attempts; i++) {
            if (i > 0) {
                if (Duration.ofNanos(System.nanoTime() - startedAt).compareTo(TOTAL_BUDGET) > 0) {
                    log.warn("Gemini 재시도 시간 초과로 중단 ({}번 시도)", i);
                    break;
                }
                sleepBeforeRetry(i);
            }
            String model = models.get(i % models.size());
            try {
                GeminiPrescriptionResult result = parse(geminiApiClient.analyzePrescription(bytes, mimeType, model));
                log.info("Gemini 분석 성공({}, {}/{}번째 시도)", model, i + 1, attempts);
                return result;
            } catch (RestClientException e) {
                if (isModelNotFound(e)) {
                    log.warn("Gemini 모델을 찾을 수 없음({}), 다음 모델로", model);
                    lastFailure = aiUnavailable();
                    continue;
                }
                if (!isTemporary(e)) {
                    logRejected(e);
                    throw aiUnavailable();
                }
                log.warn("Gemini 일시 오류({}, {}/{}): {}", model, i + 1, attempts, shortMessage(e));
                lastFailure = aiBusy();
            } catch (ResponseStatusException unreadable) {
                log.warn("Gemini 응답을 읽지 못함({}, {}/{})", model, i + 1, attempts);
                lastFailure = unreadable;
            }
        }
        log.error("Gemini 분석 최종 실패 (모델: {})", models);
        throw lastFailure;
    }

    private boolean isModelNotFound(RestClientException e) {
        return e instanceof HttpClientErrorException clientError && clientError.getStatusCode().value() == 404;
    }

    /** 다시 시도하면 될 수도 있는 오류인지 */
    private boolean isTemporary(RestClientException e) {
        if (e instanceof HttpServerErrorException || e instanceof ResourceAccessException) {
            return true;
        }
        if (e instanceof HttpClientErrorException clientError) {
            return clientError.getStatusCode().value() == 429; // 호출 한도 초과
        }
        // 응답 본문을 읽다가 시간 초과된 경우 RestClientException 으로 감싸져 온다
        Throwable cause = e.getCause();
        while (cause != null) {
            if (cause instanceof java.net.SocketTimeoutException) {
                return true;
            }
            cause = cause.getCause();
        }
        return false;
    }

    private void logRejected(RestClientException e) {
        if (e instanceof HttpClientErrorException clientError) {
            // 400/401/403/404: 키 오류, 모델명 오류 등 → 재시도해도 같음
            log.error("Gemini 요청 거절: status={}, body={}",
                    clientError.getStatusCode(), clientError.getResponseBodyAsString());
        } else {
            log.error("Gemini 호출 실패", e);
        }
    }

    /** 1초, 2초, 4초, 4초 ... */
    private void sleepBeforeRetry(int retryCount) {
        long millis = Math.min(4000L, 1000L << Math.min(retryCount - 1, 2));
        try {
            Thread.sleep(millis);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw aiUnavailable();
        }
    }

    private String shortMessage(Exception e) {
        String message = e.getMessage();
        if (message == null) return e.getClass().getSimpleName();
        message = message.replace('\n', ' ');
        return message.length() > 200 ? message.substring(0, 200) + "..." : message;
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

    /** Gemini 가 붐비거나 응답이 늦을 때. 프론트는 이 문구를 그대로 보여주면 된다. */
    private ResponseStatusException aiBusy() {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "지금 AI 사용량이 많아 분석하지 못했습니다. 잠시 후 다시 촬영해 주세요.");
    }

    private ResponseStatusException aiUnavailable() {
        return new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                "AI 분석에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    }
}
