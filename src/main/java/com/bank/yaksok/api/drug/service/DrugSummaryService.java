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
 * 약 정보 AI 요약: 효능 요약 + 같이 먹으면 안 되는 음식.
 * 1) 공공데이터에서 약 정보 원문을 찾는다: e약은요(효능·주의사항·상호작용) → 없으면 의약품 허가정보(분류·주성분)
 * 2) 효능은 원문만 근거로 요약한다. 음식은 이름만 많이 먹는 순으로 최대 5개, 원문에 있으면 원문, 없으면 주성분 기준 널리 알려진 것만 (GENERAL 표시).
 *    약 정보 자체를 못 찾으면 AI 를 부르지 않는다 (지어내지 않게).
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
                    "foods", Map.of("type", "ARRAY", "items", Map.of("type", "STRING")),
                    "foodBasis", Map.of("type", "STRING", "enum", List.of("SOURCE", "GENERAL", "NONE"))
            ),
            "required", List.of("foods", "foodBasis")
    );

    /** 음식 목록 최대 개수 (화면이 너무 길어지지 않게) */
    private static final int MAX_FOODS = 5;

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

        List<String> foods = cleanFoods(s.foods());
        String basis = foods.isEmpty() ? DrugSummaryResponse.BASIS_NONE : cleanBasis(s.foodBasis());
        String notice = DrugSummaryResponse.BASIS_GENERAL.equals(basis)
                ? DrugSummaryResponse.AI_NOTICE + " " + DrugSummaryResponse.GENERAL_NOTICE
                : DrugSummaryResponse.AI_NOTICE;

        DrugSummaryResponse response = new DrugSummaryResponse(
                facts.itemName(), true, facts.source(),
                blankToNull(s.efficacy()), foods, basis, notice);
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

    /** AI 에게 줄 지시문: 효능 요약 + 같이 먹으면 안 되는 음식 */
    static String buildPrompt(DrugFacts facts) {
        String body = facts.fields().entrySet().stream()
                .map(e -> "[" + e.getKey() + "]\n" + e.getValue())
                .collect(Collectors.joining("\n\n"));
        return """
                너는 약국에서 환자에게 약을 쉽게 설명해 주는 도우미다.
                아래 [약 정보 원문]을 보고 두 가지만 정리해라.

                1. efficacy: 이 약이 어디에 쓰는 약인지 1~2문장, 쉬운 우리말로.
                   - 원문에 적힌 효능·분류만 근거로 써라. 원문으로 알 수 없으면 null.

                2. foods: 이 약과 같이 먹거나 마시면 안 되는(조심해야 하는) 음식·음료 이름 목록. 최대 5개.
                   - 이유나 설명 없이 음식 이름만 짧게 (예: "술", "자몽주스", "우유", "커피")
                   - 한국 사람들이 평소에 많이 먹고 마시는 것부터 순서대로 나열해라.
                   - 다른 약 이름은 넣지 마라. 음식·음료(술, 카페인 음료 포함)만 넣어라.
                   - foodBasis 를 함께 정해라:
                     * 원문에 음식·음료 관련 내용이 있으면 그것만 쓰고 foodBasis = "SOURCE"
                     * 원문에 음식 내용이 없으면, 주성분에 대해 의약품 정보에서 널리 확립된 음식 상호작용만 쓰고 foodBasis = "GENERAL"
                     * 확실히 알려진 것이 없으면 foods 는 빈 배열, foodBasis = "NONE"
                   - 확실하지 않은 내용은 넣지 마라. 빈 배열이 틀린 정보보다 낫다.

                공통 규칙
                - 진단을 내리거나 복용량을 바꾸라고 권하지 마라.
                - 어려운 의학 용어는 풀어서 써라.

                [약 이름]
                %s

                [약 정보 원문] (출처: %s)
                %s
                """.formatted(facts.itemName(), facts.source(), body);
    }

    /** 빈 값·중복 음식 제거, AI 가 준 순서(많이 먹는 순) 유지, 최대 개수 제한 */
    static List<String> cleanFoods(List<String> raw) {
        if (raw == null) return List.of();
        Map<String, String> unique = new LinkedHashMap<>();
        for (String f : raw) {
            String food = blankToNull(f);
            if (food == null) continue;
            unique.putIfAbsent(food.replaceAll("\\s+", ""), food);
            if (unique.size() >= MAX_FOODS) break;
        }
        return List.copyOf(unique.values());
    }

    static String cleanBasis(String basis) {
        if (DrugSummaryResponse.BASIS_SOURCE.equals(basis) || DrugSummaryResponse.BASIS_GENERAL.equals(basis)) {
            return basis;
        }
        // 음식은 있는데 근거를 모르면 안전하게 일반 지식으로 표시 (안내 문구가 붙도록)
        return DrugSummaryResponse.BASIS_GENERAL;
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

    static String blankToNull(String v) {
        if (v == null) return null;
        String t = v.trim();
        return (t.isEmpty() || t.equalsIgnoreCase("null")) ? null : t;
    }
}
