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
 * 1) 보험코드(처방전 약 이름 앞 9자리)로 허가정보 API 조회 → 가장 정확
 *    단, 코드를 잘못 읽었을 수도 있으니 이름 앞부분이 비슷할 때만 인정
 * 2) 이름으로 허가정보 API 조회 (그대로 → 용량 이후 제거 → 앞 2글자)
 *    전문의약품까지 포함되어 처방전 약을 찾을 수 있다
 * 3) 마지막으로 기존 e약은요 조회(DurService.getDrugInfo, /api/dur/info) — 일반의약품 보조
 *
 * 용량 숫자가 다르면(250mg vs 500mg) 다른 약일 수 있으므로 절대 바꾸지 않는다.
 * 확인이 안 되면 이름은 그대로 두고 verified=false (사용자가 화면에서 직접 확인).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DrugNameVerifier {

    private final DrugPermitApiClient drugPermitApiClient;
    private final DurService durService;

    public record Result(String name, boolean verified, String originalName) {}

    public Result verify(String aiName, String ediCode) {
        // 1) 보험코드
        if (ediCode != null) {
            try {
                List<String> byCode = activeNames(drugPermitApiClient.searchByEdiCode(ediCode));
                for (String official : byCode) {
                    if (sameStart(aiName, official)) {
                        return resultFor(aiName, official);
                    }
                }
            } catch (RuntimeException e) {
                log.warn("보험코드 조회 실패, 이름으로 계속: code={}, reason={}", ediCode, e.getMessage());
            }
        }

        // 2) 허가정보 API 이름 검색
        try {
            Result byPermit = matchAmong(aiName, this::permitNames);
            if (byPermit != null) return byPermit;
        } catch (RuntimeException e) {
            log.warn("허가정보 이름 조회 실패: name={}, reason={}", aiName, e.getMessage());
        }

        // 3) 기존 e약은요 조회
        try {
            Result byEasy = matchAmong(aiName, this::easyDrugNames);
            if (byEasy != null) return byEasy;
        } catch (RuntimeException e) {
            log.warn("e약은요 조회 실패: name={}, reason={}", aiName, e.getMessage());
        }

        return new Result(aiName, false, null);
    }

    private interface Searcher {
        List<String> search(String keyword);
    }

    /** 그대로 → 용량 이후 제거 → 앞 2글자 순으로 후보를 모아 비교 */
    private Result matchAmong(String aiName, Searcher searcher) {
        List<String> first = searcher.search(aiName);
        String same = findSame(aiName, first);
        if (same != null) return resultFor(aiName, same);

        Set<String> candidates = new LinkedHashSet<>(first);
        String shortName = shortName(aiName);
        if (!shortName.equals(aiName) && shortName.length() >= 2) {
            candidates.addAll(searcher.search(shortName));
        }
        if (aiName.length() >= 3) {
            candidates.addAll(searcher.search(aiName.substring(0, 2)));
        }
        String closest = findClosest(aiName, new ArrayList<>(candidates));
        return closest == null ? null : resultFor(aiName, closest);
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

    /**
     * 공식명과 사실상 같으면 AI 가 읽은 이름을 그대로 쓰고(verified),
     * 다르면 공식명(괄호 성분명 제외)으로 교정하고 원래 이름을 남긴다.
     */
    static Result resultFor(String aiName, String official) {
        if (normalize(official).equals(normalize(aiName))) {
            return new Result(aiName, true, null);
        }
        return new Result(displayName(official), true, aiName);
    }

    /** "폰탈캡슐(메페남산)" → "폰탈캡슐" (화면·저장용, 성분명 괄호 제거) */
    static String displayName(String official) {
        return official.replaceAll("\\([^)]*\\)", "").trim();
    }

    /** 앞 2글자가 같은지 (보험코드를 잘못 읽어 엉뚱한 약이 나오는 경우 걸러내기) */
    static boolean sameStart(String a, String b) {
        String x = normalize(a), y = normalize(b);
        return x.length() >= 2 && y.length() >= 2 && x.substring(0, 2).equals(y.substring(0, 2));
    }

    /** 정규화 후 완전히 같은 후보 */
    static String findSame(String aiName, List<String> candidates) {
        String target = normalize(aiName);
        return candidates.stream()
                .filter(c -> normalize(c).equals(target))
                .findFirst()
                .orElse(null);
    }

    /** 용량 숫자가 같고, 글자 차이가 허용 범위 안인 후보 중 가장 가까운 것 */
    static String findClosest(String aiName, List<String> candidates) {
        String target = normalize(aiName);
        String targetDigits = digits(target);
        int allowed = Math.max(1, target.length() / 5);

        String best = null;
        int bestDistance = Integer.MAX_VALUE;
        for (String candidate : candidates) {
            String c = normalize(candidate);
            if (!digits(c).equals(targetDigits)) {
                continue; // 용량이 다르면 다른 약
            }
            int d = distance(target, c);
            if (d <= allowed && d < bestDistance) {
                best = candidate;
                bestDistance = d;
            }
        }
        return best;
    }

    /**
     * 비교용 정규화: 괄호 안 내용·공백 제거, 소문자, 단위 표기 통일
     * 예: "지스로맥스정250밀리그램(아지트로마이신수화물)" → "지스로맥스정250mg"
     */
    static String normalize(String name) {
        return name.replaceAll("\\([^)]*\\)", "")
                .replaceAll("\\s+", "")
                .toLowerCase()
                .replaceAll("밀리그램|밀리그람", "mg")
                .replaceAll("마이크로그램|마이크로그람", "mcg")
                .replaceAll("밀리리터", "ml");
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
