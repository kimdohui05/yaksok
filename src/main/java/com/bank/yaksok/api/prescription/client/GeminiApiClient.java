package com.bank.yaksok.api.prescription.client;

import com.bank.yaksok.api.prescription.dto.GeminiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.Base64;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

/**
 * Gemini generateContent 호출.
 * API 키는 코드/properties 에 직접 쓰지 않고 환경변수 GEMINI_API_KEY 로 받는다.
 */
@Slf4j
@Component
public class GeminiApiClient {

    private static final String PROMPT = """
            너는 한국 병원 처방전(또는 약국 조제 약봉투) 사진에서 복약 정보를 옮겨 적는 도우미다.
            사진에 적힌 내용만 그대로 옮기고, 보이지 않거나 확실하지 않은 값은 추측하지 말고 null 로 둬라.

            [한국 처방전 표 구조]
            약 목록 표는 보통 아래 순서의 칸으로 되어 있다. 한 줄이 약 하나다.
              처방 의약품의 명칭 | 1회 투약량 | 1일 투여횟수 | 총 투약일수 | 용법
            - 약 이름 앞의 9자리 숫자(보험 코드, 예: 648900880)는 이름에서 빼고 ediCode 에 따로 넣어라.
            - 이름 뒤 괄호 표기 (내복), (외용) 등은 빼라.
            - 숫자 세 개는 반드시 위 칸 순서대로 1회 투약량, 1일 투여횟수, 총 투약일수에 대응시켜라.
              예: "지스로맥스정250mg  2  1  3" → dose "2정", timesPerDay 1, days 3
            - 총 투약일수 칸이 표 맨 위 한 칸에만 적혀 있으면 모든 약에 같은 값을 넣어라.
            - 처방일자는 표 위쪽의 "교부년월일" 또는 "처방일" 칸에 있다. 가려져 있거나 안 보이면 null.

            [출력 필드]
            - prescriptionDate: 교부(처방)일자 또는 조제일자. yyyy-MM-dd 형식. 없으면 null
            - medicines: 처방된 약마다 하나씩
              - name: 약 이름 (용량 표기 포함, 예: 타이레놀정500mg)
              - dose: 1회 투약량. 단위가 적혀 있으면 그대로(예: 0.5정, 10ml).
                숫자만 적혀 있으면 약 이름의 제형으로 단위를 붙여라:
                이름에 "캡슐" → 캡슐, "정" → 정, "시럽"/"액" → ml, "산"/"과립" → 포.
                제형을 알 수 없으면 숫자만 문자열로. 칸이 비어 있으면 null
              - timesPerDay: 1일 투여횟수 (정수). 없으면 null
              - days: 총 투약일수 (정수). 없으면 null
              - ediCode: 약 이름 앞의 보험 코드 9자리 숫자 (문자열). 한 자리라도 확실하지 않으면 null

            환자 이름, 주민등록번호, 주소, 병원명, 의사 이름 같은 개인정보는 절대 출력하지 마라.
            약이 하나도 보이지 않으면 medicines 를 빈 배열로 둬라.

            [사진 화질 판단]
            - readability: 약 목록 표의 글씨가 얼마나 잘 읽히는지
              GOOD = 약 이름과 숫자를 모두 확실히 읽을 수 있음
              PARTIAL = 흐리거나 작거나 가려져서 일부 글자·숫자가 확실하지 않음
              POOR = 대부분 읽기 어려움 (흐림, 너무 작음, 어두움, 빛 반사, 일부만 찍힘)
            """;

    /** Gemini 구조화 출력 스키마: 응답을 항상 같은 JSON 모양으로 받기 위함 */
    private static final Map<String, Object> RESPONSE_SCHEMA = Map.of(
            "type", "OBJECT",
            "properties", Map.of(
                    "prescriptionDate", Map.of("type", "STRING", "nullable", true),
                    "readability", Map.of("type", "STRING", "enum", List.of("GOOD", "PARTIAL", "POOR")),
                    "medicines", Map.of(
                            "type", "ARRAY",
                            "items", Map.of(
                                    "type", "OBJECT",
                                    "properties", Map.of(
                                            "name", Map.of("type", "STRING"),
                                            "dose", Map.of("type", "STRING", "nullable", true),
                                            "timesPerDay", Map.of("type", "INTEGER", "nullable", true),
                                            "days", Map.of("type", "INTEGER", "nullable", true),
                                            "ediCode", Map.of("type", "STRING", "nullable", true)
                                    ),
                                    "required", List.of("name")
                            )
                    )
            ),
            "required", List.of("medicines", "readability")
    );

    private final RestClient restClient;
    private final String apiKey;
    private final String model;
    private final String fallbackModel;

    public GeminiApiClient(
            @Value("${gemini.base-url}") String baseUrl,
            @Value("${gemini.api-key:}") String apiKey,
            @Value("${gemini.model}") String model,
            @Value("${gemini.fallback-model:}") String fallbackModel
    ) {
        // 시간 제한: 이미지 분석은 오래 걸릴 수 있어 60초까지 기다리고, 그 이상은 끊는다
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        requestFactory.setReadTimeout(Duration.ofSeconds(60));

        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .build();
        this.apiKey = apiKey;
        this.model = model;
        this.fallbackModel = fallbackModel;
    }

    public boolean hasApiKey() {
        return apiKey != null && !apiKey.isBlank();
    }

    /** 기본 모델 */
    public String primaryModel() {
        return model;
    }

    /**
     * 시도할 모델 순서: 기본 모델 → 예비 모델들(쉼표로 여러 개 가능, 중복 제거).
     * 예: GEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite,gemini-3.6-flash
     */
    public List<String> models() {
        LinkedHashSet<String> ordered = new LinkedHashSet<>();
        ordered.add(model);
        if (fallbackModel != null) {
            for (String m : fallbackModel.split(",")) {
                if (!m.isBlank()) ordered.add(m.trim());
            }
        }
        return List.copyOf(ordered);
    }

    /**
     * 처방전 사진을 보내고 Gemini 가 만든 JSON 문자열을 돌려준다.
     * 텍스트가 없으면(안전 필터 차단 등) null.
     */
    public String analyzePrescription(byte[] image, String mimeType, String modelName) {
        Map<String, Object> body = Map.of(
                "contents", List.of(Map.of(
                        "parts", List.of(
                                Map.of("inlineData", Map.of(
                                        "mimeType", mimeType,
                                        "data", Base64.getEncoder().encodeToString(image)
                                )),
                                Map.of("text", PROMPT)
                        )
                )),
                "generationConfig", Map.of(
                        "responseMimeType", "application/json",
                        "responseSchema", RESPONSE_SCHEMA,
                        // 출력 길이 상한: 모델이 같은 글자를 끝없이 반복하는 경우를 끊는다.
                        // 약이 많은 처방전이나 내부 추론을 쓰는 모델은 2048 로는 잘려서 8192 로 둔다.
                        "maxOutputTokens", 8192
                        // temperature 는 지정하지 않고 모델 기본값을 쓴다 (0 으로 두면 반복 출력이 생길 수 있음)
                )
        );

        GeminiResponse response = restClient.post()
                .uri("/models/{model}:generateContent", modelName)
                .header("x-goog-api-key", apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(GeminiResponse.class);

        if (response == null) {
            return null;
        }
        String finishReason = response.firstFinishReason();
        if (finishReason != null && !"STOP".equals(finishReason)) {
            // MAX_TOKENS: 길이 제한으로 잘림, SAFETY: 안전 필터 차단 등
            log.warn("Gemini 응답이 정상 종료되지 않음: model={}, finishReason={}", modelName, finishReason);
        }
        return response.firstText();
    }
}
