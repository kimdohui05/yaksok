package com.bank.yaksok.api.prescription.client;

import com.bank.yaksok.api.prescription.dto.GeminiResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Map;

/**
 * Gemini generateContent 호출.
 * API 키는 코드/properties 에 직접 쓰지 않고 환경변수 GEMINI_API_KEY 로 받는다.
 */
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
            """;

    /** Gemini 구조화 출력 스키마: 응답을 항상 같은 JSON 모양으로 받기 위함 */
    private static final Map<String, Object> RESPONSE_SCHEMA = Map.of(
            "type", "OBJECT",
            "properties", Map.of(
                    "prescriptionDate", Map.of("type", "STRING", "nullable", true),
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
            "required", List.of("medicines")
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

    /** 재시도에 쓸 모델. 예비 모델이 설정돼 있으면 그것, 없으면 기본 모델 */
    public String retryModel() {
        return (fallbackModel == null || fallbackModel.isBlank()) ? model : fallbackModel;
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
                        // 출력 길이 상한: 모델이 같은 글자를 끝없이 반복하는 경우를 끊는다
                        "maxOutputTokens", 2048
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

        return response == null ? null : response.firstText();
    }
}
