package com.bank.yaksok.api.prescription.service;

import com.bank.yaksok.api.dur.client.DrugPermitApiClient;
import com.bank.yaksok.api.dur.dto.DrugInfoResponse;
import com.bank.yaksok.api.dur.dto.DrugPermitResponse;
import com.bank.yaksok.api.dur.service.DurService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * AI 가 읽은 약 이름을 공공데이터로 확인한다.
 *
 * 원칙: 약 이름은 틀리게 바꾸는 것이 가장 위험하다.
 *  - 이름을 "자동으로" 바꾸는 것은 한 글자 차이(오인식)일 때만 한다.
 *  - 그보다 많이 다르면 바꾸지 않고 suggestedName 으로 "제안"만 하고 verified=false 로 둔다.
 *    (회사명 접두어가 같은 다른 약 — 예: 신일우소데옥시콜산정 ↔ 신일슈도에페드린정 — 을 막기 위함)
 *
 * 조회 순서
 *  1) 보험코드(처방전 약 이름 앞 9자리)로 허가정보 API 조회
 *  2) 이름으로 허가정보 API 조회 (그대로 → 용량 이후 제거 → 앞 2글자)
 *  3) 기존 e약은요 조회(DurService.getDrugInfo, /api/dur/info)
 *  보험코드 결과와 이름 결과가 서로 다른 약을 가리키면 verified=false 로 사용자 확인을 받는다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DrugNameVerifier {

    private final DrugPermitApiClient drugPermitApiClient;
    private final DurService durService;

    /**
     * @param name          화면에 보여줄 이름 (확인되면 그대로 또는 한 글자 교정된 이름)
     * @param verified      공공데이터로 같은 약임이 확인됐는지
     * @param originalName  한 글자 교정이 일어났을 때 AI 가 원래 읽은 이름
     * @param suggestedName 확신할 수 없어 바꾸지 않았지만, 공공데이터에서 찾은 후보 이름
     */
    public record Result(String name, boolean verified, String originalName, String suggestedName) {}

    public Result verify(String aiName, String ediCode) {
        // 1) 보험코드로 찾은 공식명
        String byCode = null;
        if (ediCode != null) {
            try {
                byCode = activeNames(drugPermitApiClient.searchByEdiCode(ediCode)).stream().findFirst().orElse(null);
            } catch (RuntimeException e) {
                log.warn("보험코드 조회 실패, 이름으로 계속: code={}, reason={}", ediCode, e.getMessage());
            }
        }
        if (byCode != null) {
            if (isSameDrug(aiName, byCode)) {
                return new Result(aiName, true, null, null);
            }
            if (isOneCharOff(aiName, byCode)) {
                return new Result(displayName(byCode), true, aiName, null);
            }
        }

        // 2), 3) 이름 검색
        Result byName = searchByName(aiName);

        if (byCode != null) {
            String suggestion = displayName(byCode);
            if (byName != null) {
                // 이름으로는 확인됐지만 보험코드는 다른 약을 가리킴 → 둘 중 무엇이 맞는지 사용자 확인
                log.warn("보험코드와 이름이 다른 약을 가리킴: name={}, code={} -> {}", aiName, ediCode, byCode);
                return new Result(byName.name(), false, byName.originalName(), suggestion);
            }
            return new Result(aiName, false, null, suggestion);
        }
        return byName != null ? byName : new Result(aiName, false, null, null);
    }

    /** 허가정보 → e약은요 순으로 이름 검색. 같은 약이거나 한 글자 차이일 때만 결과를 돌려준다. */
    private Result searchByName(String aiName) {
        try {
            Result r = matchAmong(aiName, this::permitNames);
            if (r != null) return r;
        } catch (RuntimeException e) {
            log.warn("허가정보 이름 조회 실패: name={}, reason={}", aiName, e.getMessage());
        }
        try {
            return matchAmong(aiName, this::easyDrugNames);
        } catch (RuntimeException e) {
            log.warn("e약은요 조회 실패: name={}, reason={}", aiName, e.getMessage());
            return null;
        }
    }

    private interface Searcher {
        List<String> search(String keyword);
    }

    /** 그대로 → 용량 이후 제거 → 앞 2글자 순으로 후보를 모아 비교 */
    private Result matchAmong(String aiName, Searcher searcher) {
        List<String> first = searcher.search(aiName);
        if (findSame(aiName, first) != null) {
            return new Result(aiName, true, null, null);
        }

        Set<String> candidates = new LinkedHashSet<>(first);
        String shortName = shortName(aiName);
        if (!shortName.equals(aiName) && shortName.length() >= 2) {
            candidates.addAll(searcher.search(shortName));
        }
        if (aiName.length() >= 3) {
            candidates.addAll(searcher.search(aiName.substring(0, 2)));
        }
        if (findSame(aiName, new ArrayList<>(candidates)) != null) {
            return new Result(aiName, true, null, null);
        }
        String closest = findOneCharOff(aiName, new ArrayList<>(candidates));
        return closest == null ? null : new Result(correctedName(aiName, closest), true, aiName, null);
    }

    private List<String> permitNames(String keyword) {
        return activeNames(drugPermitApiClient.searchByName(keyword));
    }

    private List<String> easyDrugNames(String keyword) {
        return durService.getDrugInfo(keyword).stream()
                .map(DrugInfoResponse.Summary::itemName)
                .filter(n -> n != null && !n.isBlank())
                .toList();
    }

    private static List<String> activeNames(List<DrugPermitResponse.Item> items) {
        return items.stream()
                .filter(DrugPermitResponse.Item::isActive)
                .map(DrugPermitResponse.Item::itemName)
                .filter(n -> n != null && !n.isBlank())
                .toList();
    }

    // ───── 아래는 외부 호출 없는 순수 로직 (단위 테스트 대상) ─────

    /** 사실상 같은 약 이름인지 (괄호·공백·단위 표기 차이 무시, 읽은 이름에 용량이 없으면 공식명 용량도 무시) */
    static boolean isSameDrug(String aiName, String official) {
        String target = normalize(aiName);
        return base(target, official).equals(target);
    }

    /** 한 글자만 다른지 (OCR 오인식 수준). 읽은 이름에 용량 숫자가 있으면 숫자가 같아야 한다. */
    static boolean isOneCharOff(String aiName, String official) {
        String target = normalize(aiName);
        String c = base(target, official);
        if (!digits(target).isEmpty() && !digits(c).equals(digits(target))) {
            return false; // 용량이 다르면 다른 약
        }
        return distance(target, c) <= 1;
    }

    /** 같은 약 후보 */
    static String findSame(String aiName, List<String> candidates) {
        return candidates.stream().filter(c -> isSameDrug(aiName, c)).findFirst().orElse(null);
    }

    /** 한 글자 차이 후보 */
    static String findOneCharOff(String aiName, List<String> candidates) {
        return candidates.stream().filter(c -> isOneCharOff(aiName, c)).findFirst().orElse(null);
    }

    /** 이름 검색으로 교정할 때: 읽은 이름에 용량이 없으면 공식명에서도 용량은 붙이지 않는다 */
    static String correctedName(String aiName, String official) {
        return digits(normalize(aiName)).isEmpty()
                ? shortName(displayName(official))
                : displayName(official);
    }

    /** 비교 대상: 읽은 이름에 숫자가 없으면 후보에서도 용량 이후를 뺀다 */
    private static String base(String normalizedTarget, String candidate) {
        String c = normalize(candidate);
        return digits(normalizedTarget).isEmpty() ? shortName(c) : c;
    }

    /** "폰탈캡슐(메페남산)" → "폰탈캡슐" (화면·저장용, 괄호는 겹쳐 있어도 모두 제거) */
    static String displayName(String official) {
        return removeParens(official).trim();
    }

    /**
     * 비교용 정규화: 괄호 안 내용·공백 제거, 소문자, 단위 표기 통일
     * 예: "지스로맥스정250밀리그램(아지트로마이신수화물)" → "지스로맥스정250mg"
     */
    static String normalize(String name) {
        return removeParens(name)
                .replaceAll("\\s+", "")
                .toLowerCase()
                .replaceAll("밀리그램|밀리그람", "mg")
                .replaceAll("마이크로그램|마이크로그람", "mcg")
                .replaceAll("밀리리터", "ml");
    }

    /** 괄호를 안쪽부터 반복해서 지우고, 짝이 안 맞아 남은 괄호 문자도 지운다 */
    static String removeParens(String s) {
        String prev;
        do {
            prev = s;
            s = s.replaceAll("\\([^()]*\\)", "");
        } while (!s.equals(prev));
        return s.replaceAll("[()]", "");
    }

    /** "타이레놀정500mg" → "타이레놀정" */
    static String shortName(String name) {
        return name.replaceAll("[\\d(].*$", "").trim();
    }

    private static String digits(String s) {
        return s.replaceAll("\\D", "");
    }

    /** 편집 거리 (글자 추가·삭제·교체 횟수) */
    static int distance(String a, String b) {
        int[] prev = new int[b.length() + 1];
        int[] cur = new int[b.length() + 1];
        for (int j = 0; j <= b.length(); j++) prev[j] = j;
        for (int i = 1; i <= a.length(); i++) {
            cur[0] = i;
            for (int j = 1; j <= b.length(); j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                cur[j] = Math.min(Math.min(cur[j - 1] + 1, prev[j] + 1), prev[j - 1] + cost);
            }
            int[] tmp = prev; prev = cur; cur = tmp;
        }
        return prev[b.length()];
    }
}
