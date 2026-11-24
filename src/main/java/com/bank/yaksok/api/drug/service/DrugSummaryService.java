package com.bank.yaksok.api.drug.service;

import com.bank.yaksok.api.drug.dto.DrugSummaryResponse;
import com.bank.yaksok.api.drug.dto.GeminiDrugSummary;
import com.bank.yaksok.api.dur.client.DrugPermitApiClient;
import com.bank.yaksok.api.dur.dto.DrugInfoResponse;
import com.bank.yaksok.api.dur.dto.DrugPermitResponse;
import com.bank.yaksok.api.dur.service.DurService;
import com.bank.yaksok.api.gemini.GeminiRetryExecutor;
import com.bank.yaksok.api.prescription.client.GeminiApiClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 약 정보 AI 요약.
 * 1) 공공데이터에서 약 정보 원문을 찾는다: e약은요(효능·사용법·주의사항 등) → 없으면 의약품 허가정보(분류·주성분)
 * 2) 그 원문만 근거로 Gemini 가 쉬운 말로 요약한다. 원문이 없으면 요약하지 않는다 (지어내지 않게).
 * 3) 같은 약은 서버 메모리에 잠깐 저장해서 다시 부르지 않는다 (속도·할당량 절약).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DrugSummaryService {

    private static final int CACHE_SIZE = 200;

    private static final GeminiRetryExecutor.FailureMessages FAILURE_MESSAGES = new GeminiRetryExecutor.FailureMessages(
            "지금 AI 사용량이 많아 요약하지 못했습니다. 잠시 후 다시 시도해 주세요.",
            "AI 사용 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.",
            "AI 요약에 실패했습니다. 잠시 후 다시 시도해 주세요.");

    private static final Map<String, Object> RESPONSE_SCHEMA = Map.of(
            "type", "OBJECT",
            "properties", Map.of(
                    "efficacy", Map.of("type", "STRING", "nullable", true),
                    "howToTake", Map.of("type", "STRING", "nullable", true),
                    "cautions", Map.of("type", "STRING", "nullable", true),
                    "sideEffects", Map.of("type", "STRING", "nullable", true),
                    "storage", Map.of("type", "STRING", "nullable", true)
            )
    );

    private final DurService durService;
    private final DrugPermitApiClient drugPermitApiClient;
    private final GeminiApiClient geminiApiClient;
    private final GeminiRetryExecutor geminiRetryExecutor;
    private final ObjectMapper objectMapper;

    /** 최근 요약 결과 (약 이름 → 응답), 오래된 것부터 버림 */
    private final Map<String, DrugSummaryResponse> cache = Collections.synchronizedMap(
            new LinkedHashMap<>(16, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, DrugSummaryResponse> eldest) {
                    return size() > CACHE_SIZE;
                }
            });

    public DrugSummaryResponse summarize(String itemName) {
        if (itemName == null || itemName.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "약 이름을 입력해 주세요.");
        }
        String name = itemName.trim();
        String cacheKey = name.replaceAll("\\s+", "");
        DrugSummaryResponse cached = cache.get(cacheKey);
        if (cached != null) {
            return cached;
        }

        DrugFacts facts = findFacts(name);
        if (facts == null || !facts.hasContent()) {
            return DrugSummaryResponse.notFound(name);
        }

        if (!geminiApiClient.hasApiKey()) {
            log.error("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.");
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "AI 요약 기능이 아직 설정되지 않았습니다.");
        }

        String prompt = buildPrompt(facts);
        GeminiDrugSummary s = geminiRetryExecutor.execute("약 정보 요약",
                model -> geminiApiClient.generateJson(List.of(Map.of("text", prompt)), RESPONSE_SCHEMA, model),
                this::parse,
                FAILURE_MESSAGES);

        DrugSummaryResponse response = new DrugSummaryResponse(
                facts.itemName(), true, facts.source(),
                blankToNull(s.efficacy()), blankToNull(s.howToTake()), blankToNull(s.cautions()),
                blankToNull(s.sideEffects()), blankToNull(s.storage()),
                DrugSummaryResponse.AI_NOTICE);
        cache.put(cacheKey, response);
        return response;
    }

    /** e약은요(이름 → 용량 뺀 이름) → 허가정보(이름 → 용량 뺀 이름) 순으로 첫 결과 */
    private DrugFacts findFacts(String name) {
        String shortName = name.replaceAll("[\\d(].*$", "").trim();
        List<String> keywords = shortName.length() >= 2 && !shortName.equals(name) ? List.of(name, shortName) : List.of(name);

        for (String keyword : keywords) {
            try {
                List<DrugInfoResponse.Summary> easy = durService.getDrugInfo(keyword);
                if (!easy.isEmpty()) {
                    return DrugFacts.fromEasyDrug(easy.get(0));
                }
            } catch (RuntimeException e) {
                log.warn("e약은요 조회 실패, 허가정보로 계속: name={}, reason={}", keyword, e.getMessage());
            }
        }
        for (String keyword : keywords) {
            try {
                List<DrugPermitResponse.Item> permits = drugPermitApiClient.searchByName(keyword).stream()
                        .filter(DrugPermitResponse.Item::isActive)
                        .toList();
                if (!permits.isEmpty()) {
                    return DrugFacts.fromPermit(permits.get(0));
                }
            } catch (RuntimeException e) {
                log.warn("허가정보 조회 실패: name={}, reason={}", keyword, e.getMessage());
            }
        }
        return null;
    }

    /** AI 에게 줄 지시문: 원문만 근거로, 쉬운 말로, 없는 내용은 null */
    static String buildPrompt(DrugFacts facts) {
        String body = facts.fields().entrySet().stream()
                .map(e -> "[" + e.getKey() + "]\n" + e.getValue())
                .collect(Collectors.joining("\n\n"));
        return """
                너는 약국에서 환자에게 약을 쉽게 설명해 주는 도우미다.
                아래 [약 정보 원문]에 적힌 내용만 근거로, 약을 처음 보는 일반인이 이해하기 쉽게 정리해라.

                규칙
                - 원문에 없는 내용은 절대 추측하거나 지어내지 말고 해당 항목을 null 로 둬라.
                - 각 항목은 1~3문장, 쉬운 우리말로. 어려운 의학 용어는 풀어서 써라.
                - 진단을 내리거나 복용량을 바꾸라고 권하지 마라.
                - 원문이 분류·주성분뿐이면 efficacy 에 그 분류로 알 수 있는 용도만 짧게 쓰고, 나머지는 null.

                항목
                - efficacy: 어디에 쓰는 약인지
                - howToTake: 어떻게 먹는지
                - cautions: 꼭 알아야 할 주의사항 (함께 먹으면 안 되는 약·음식 포함)
                - sideEffects: 나타날 수 있는 부작용
                - storage: 보관 방법

                [약 이름]
                %s

                [약 정보 원문] (출처: %s)
                %s
                """.formatted(facts.itemName(), facts.source(), body);
    }

    private GeminiDrugSummary parse(String json) {
        if (json == null || json.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI 요약에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        }
        try {
            return objectMapper.readValue(json, GeminiDrugSummary.class);
        } catch (RuntimeException e) {
            log.warn("Gemini 요약 JSON 파싱 실패: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI 요약에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        }
    }

    private static String blankToNull(String v) {
        if (v == null) return null;
        String t = v.trim();
        return (t.isEmpty() || t.equalsIgnoreCase("null")) ? null : t;
    }
}
