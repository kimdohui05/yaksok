package com.bank.yaksok.api.gemini;

import com.bank.yaksok.api.prescription.client.GeminiApiClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.util.List;
import java.util.function.Function;

/**
 * Gemini 호출 공통 재시도 (처방전 분석, 약 정보 요약이 함께 사용).
 *
 * 조회성 요청이라 다시 보내도 부작용이 없다.
 * 일시적 장애(5xx, 429, 시간 초과, 깨진 응답)면 모델을 바꿔 가며 최대 maxAttempts 번 시도한다.
 * - 모델 순서: 기본 → 예비1 → 예비2 ... → 다시 기본 (순환)
 * - 시도 사이 대기: 1초, 2초, 4초, 4초 ...
 * - 전체 시간이 TOTAL_BUDGET 을 넘으면 더 시도하지 않는다
 * - 모델명이 틀려 404 가 나면 그 모델만 건너뛴다
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GeminiRetryExecutor {

    /** 실패했을 때 사용자에게 보여줄 문구 (기능마다 다르게) */
    public record FailureMessages(String busy, String quotaExceeded, String unavailable) {}

    private static final Duration TOTAL_BUDGET = Duration.ofSeconds(45);

    private final GeminiApiClient geminiApiClient;

    /** 최대 시도 횟수 (환경변수 GEMINI_MAX_ATTEMPTS, 기본 4) */
    @Value("${gemini.max-attempts:4}")
    private int maxAttempts;

    /**
     * @param call     모델명을 받아 Gemini 를 호출하고 응답 텍스트(JSON)를 돌려주는 함수
     * @param parse    응답 텍스트를 결과로 바꾸는 함수. 읽을 수 없으면 ResponseStatusException 을 던진다 (재시도 대상)
     * @param messages 최종 실패 시 문구
     */
    public <T> T execute(String label, Function<String, String> call, Function<String, T> parse,
                         FailureMessages messages) {
        List<String> models = geminiApiClient.models();
        int attempts = Math.max(1, maxAttempts);
        long startedAt = System.nanoTime();
        ResponseStatusException lastFailure = busy(messages);

        for (int i = 0; i < attempts; i++) {
            if (i > 0) {
                if (Duration.ofNanos(System.nanoTime() - startedAt).compareTo(TOTAL_BUDGET) > 0) {
                    log.warn("Gemini {} 재시도 시간 초과로 중단 ({}번 시도)", label, i);
                    break;
                }
                sleepBeforeRetry(i, messages);
            }
            String model = models.get(i % models.size());
            try {
                T result = parse.apply(call.apply(model));
                log.info("Gemini {} 성공({}, {}/{}번째 시도)", label, model, i + 1, attempts);
                return result;
            } catch (RestClientException e) {
                if (isModelNotFound(e)) {
                    log.warn("Gemini 모델을 찾을 수 없음({}), 다음 모델로", model);
                    lastFailure = unavailable(messages);
                    continue;
                }
                if (!isTemporary(e)) {
                    logRejected(e);
                    throw unavailable(messages);
                }
                log.warn("Gemini {} 일시 오류({}, {}/{}): {}", label, model, i + 1, attempts, shortMessage(e));
                lastFailure = isQuotaExceeded(e) ? quotaExceeded(messages) : busy(messages);
            } catch (ResponseStatusException unreadable) {
                log.warn("Gemini {} 응답을 읽지 못함({}, {}/{})", label, model, i + 1, attempts);
                lastFailure = unreadable;
            }
        }
        log.error("Gemini {} 최종 실패 (모델: {})", label, models);
        throw lastFailure;
    }

    /** 429: 이 키의 사용 한도(할당량) 초과 */
    private boolean isQuotaExceeded(RestClientException e) {
        return e instanceof HttpClientErrorException clientError && clientError.getStatusCode().value() == 429;
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
    private void sleepBeforeRetry(int retryCount, FailureMessages messages) {
        long millis = Math.min(4000L, 1000L << Math.min(retryCount - 1, 2));
        try {
            Thread.sleep(millis);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw unavailable(messages);
        }
    }

    private String shortMessage(Exception e) {
        String message = e.getMessage();
        if (message == null) return e.getClass().getSimpleName();
        message = message.replace('\n', ' ');
        return message.length() > 200 ? message.substring(0, 200) + "..." : message;
    }

    private ResponseStatusException busy(FailureMessages m) {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, m.busy());
    }

    private ResponseStatusException quotaExceeded(FailureMessages m) {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, m.quotaExceeded());
    }

    private ResponseStatusException unavailable(FailureMessages m) {
        return new ResponseStatusException(HttpStatus.BAD_GATEWAY, m.unavailable());
    }
}
