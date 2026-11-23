package com.bank.yaksok.api.prescription.service;

import com.bank.yaksok.api.dur.dto.DrugInfoResponse;
import com.bank.yaksok.api.dur.service.DurService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * AI 가 읽은 약 이름을 기존 e약은요 조회(DurService.getDrugInfo, /api/dur/info 와 같은 로직)로 확인한다.
 *
 * 1) 읽은 이름 그대로 검색
 * 2) 없으면 용량·괄호 이후를 뺀 이름으로 검색 (프론트 MedicineListPage 의 재검색 규칙과 같음)
 * 3) 그래도 없으면 앞 2글자로 검색해서 후보를 받은 뒤, 글자 차이가 아주 작은 것만 인정
 *    (예: AI 가 "폰탈한캡슐"로 잘못 읽음 → "폰탈캡슐")
 *
 * 용량 숫자가 다르면(250mg vs 500mg) 다른 약일 수 있으므로 절대 바꾸지 않는다.
 * 확인이 안 되면 이름은 그대로 두고 verified=false 로 돌려준다 (사용자가 화면에서 직접 확인).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DrugNameVerifier {

    private final DurService durService;

    public record Result(String name, boolean verified, String originalName) {}

    public Result verify(String aiName) {
        try {
            // 1) 그대로
            List<String> exactCandidates = search(aiName);
            String exact = findSame(aiName, exactCandidates);
            if (exact != null) {
                return new Result(exact, true, null);
            }

            // 2) 용량·괄호 이후 제거
            Set<String> candidates = new LinkedHashSet<>(exactCandidates);
            String shortName = shortName(aiName);
            if (!shortName.equals(aiName) && shortName.length() >= 2) {
                candidates.addAll(search(shortName));
            }
            // 3) 앞 2글자 (오인식 대비)
            if (aiName.length() >= 3) {
                candidates.addAll(search(aiName.substring(0, 2)));
            }

            String closest = findClosest(aiName, new ArrayList<>(candidates));
            if (closest != null) {
                boolean changed = !normalize(closest).equals(normalize(aiName));
                return new Result(closest, true, changed ? aiName : null);
            }
            return new Result(aiName, false, null);

        } catch (RuntimeException e) {
            // 공공 API 장애 등: 검증만 건너뛰고 분석 결과는 그대로 돌려준다
            log.warn("약 이름 검증 실패, 건너뜀: name={}, reason={}", aiName, e.getMessage());
            return new Result(aiName, false, null);
        }
    }

    private List<String> search(String keyword) {
        return durService.getDrugInfo(keyword).stream()
                .map(DrugInfoResponse.Summary::itemName)
                .filter(n -> n != null && !n.isBlank())
                .toList();
    }

    // ───── 아래는 외부 호출 없는 순수 로직 (단위 테스트 대상) ─────

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

    /** 공백·괄호 안 내용 제거, 소문자 (예: "폰탈캡슐(메페남산)" → "폰탈캡슐") */
    static String normalize(String name) {
        return name.replaceAll("\\([^)]*\\)", "")
                .replaceAll("\\s+", "")
                .toLowerCase();
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
