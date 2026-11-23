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

            - prescriptionDate: 처방(교부)일자 또는 조제일자. yyyy-MM-dd 형식. 없으면 null
            - medicines: 처방된 약마다 하나씩
              - name: 약 이름 (용량 표기 포함, 예: 타이레놀정500mg)
              - dose: 1회 투약량과 단위 (예: 1정, 0.5정, 10ml). 없으면 null
              - timesPerDay: 1일 투여횟수 (정수). 없으면 null
              - days: 총 투약일수 (정수). 없으면 null

            환자 이름, 주민등록번호, 주소 같은 개인정보는 절대 출력하지 마라.
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
                                            "days", Map.of("type", "INTEGER", "nullable", true)
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

    public GeminiApiClient(
            @Value("${gemini.base-url}") String baseUrl,
            @Value("${gemini.api-key:}") String apiKey,
            @Value("${gemini.model}") String model
    ) {
        // 시간 제한: Gemini 가 응답을 안 주면 무한정 기다리지 않도록
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        requestFactory.setReadTimeout(Duration.ofSeconds(30));

        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .build();
        this.apiKey = apiKey;
        this.model = model;
    }

    public boolean hasApiKey() {
        return apiKey != null && !apiKey.isBlank();
    }

    /**
     * 처방전 사진을 보내고 Gemini 가 만든 JSON 문자열을 돌려준다.
     * 텍스트가 없으면(안전 필터 차단 등) null.
     */
    public String analyzePrescription(byte[] image, String mimeType) {
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
                        "temperature", 0
                )
        );

        GeminiResponse response = restClient.post()
                .uri("/models/{model}:generateContent", model)
                .header("x-goog-api-key", apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(GeminiResponse.class);

        return response == null ? null : response.firstText();
    }
}
