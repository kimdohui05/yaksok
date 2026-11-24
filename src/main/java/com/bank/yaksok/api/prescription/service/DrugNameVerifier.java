package com.bank.yaksok.api.prescription.service;

import com.bank.yaksok.api.dur.client.DrugPermitApiClient;
import com.bank.yaksok.api.dur.dto.DrugInfoResponse;
import com.bank.yaksok.api.dur.dto.DrugPermitResponse;
import com.bank.yaksok.api.dur.service.DurService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Supplier;

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
 *  3) 허가정보 조회가 실패했을 때만 e약은요 조회(DurService.getDrugInfo, /api/dur/info)
 *  검색어별 조회는 동시에 보내고, 결과는 1시간 캐시한다 (같은 약을 다시 확인할 때 외부 호출 없음).
 *  보험코드 결과와 이름 결과가 서로 다른 약을 가리키면 verified=false 로 사용자 확인을 받는다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DrugNameVerifier implements DisposableBean {

    private final DrugPermitApiClient drugPermitApiClient;
    private final DurService durService;

    /** 공공데이터 호출용 (호출은 대부분 네트워크 대기라 가상 스레드로 동시에 보낸다) */
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    /** 검색어 → 약 이름 목록 (1시간 유지, 최대 1000개) */
    private final TtlCache searchCache = new TtlCache(1000, Duration.ofHours(1));

    /**
     * @param name          화면에 보여줄 이름 (확인되면 그대로 또는 한 글자 교정된 이름)
     * @param verified      공공데이터로 같은 약임이 확인됐는지
     * @param originalName  한 글자 교정이 일어났을 때 AI 가 원래 읽은 이름
     * @param suggestedName 확신할 수 없어 바꾸지 않았지만, 공공데이터에서 찾은 후보 이름
     */
    public record Result(String name, boolean verified, String originalName, String suggestedName) {}

    /** 여러 약을 동시에 확인 (처방전 분석용). 결과 순서는 입력 순서와 같다. */
    public record Request(String name, String ediCode) {}

    public List<Result> verifyAll(List<Request> requests) {
        List<CompletableFuture<Result>> futures = requests.stream()
                .map(r -> CompletableFuture.supplyAsync(() -> verify(r.name(), r.ediCode()), executor))
                .toList();
        return futures.stream().map(CompletableFuture::join).toList();
    }

    public Result verify(String aiName, String ediCode) {
        // 보험코드 조회와 이름 조회를 동시에 시작 (이름 조회는 캐시되어 있으면 바로 끝난다)
        CompletableFuture<String> codeFuture = ediCode == null
                ? CompletableFuture.completedFuture(null)
                : CompletableFuture.supplyAsync(() -> firstActiveByCode(ediCode), executor);
        CompletableFuture<Result> nameFuture = CompletableFuture.supplyAsync(() -> searchByName(aiName), executor);

        // 1) 보험코드로 찾은 공식명
        String byCode = codeFuture.join();
        if (byCode != null) {
            if (isSameDrug(aiName, byCode)) {
                return new Result(aiName, true, null, null);
            }
            if (isOneCharOff(aiName, byCode)) {
                return new Result(displayName(byCode), true, aiName, null);
            }
        }

        // 2) 이름 검색
        Result byName = nameFuture.join();

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

    /**
     * 확인되지 않은 이름에 대해 비슷한 공식 약 이름 후보를 찾는다 (가까운 순, 최대 limit 개).
     * 약 저장 거부 응답과 연관검색어에서 쓴다. verify 직후라면 검색 결과가 캐시에 있어 외부 호출이 없다.
     */
    public List<String> suggest(String name, int limit) {
        if (name == null || name.isBlank()) return List.of();
        String input = name.trim();
        return rankSuggestions(input, candidates(searchKeywords(input)), limit);
    }

    /** 이름 검색: 같은 약이거나 한 글자 차이일 때만 결과를 돌려준다. */
    private Result searchByName(String aiName) {
        List<String> candidates = candidates(searchKeywords(aiName));
        if (findSame(aiName, candidates) != null) {
            return new Result(aiName, true, null, null);
        }
        String closest = findOneCharOff(aiName, candidates);
        return closest == null ? null : new Result(correctedName(aiName, closest), true, aiName, null);
    }

    /**
     * 검색어들로 후보 이름을 모은다 (검색어 순서대로, 중복 제거).
     * 허가정보를 검색어마다 동시에 조회하고, 허가정보 조회가 실패했을 때만 e약은요로 보충한다.
     * (허가정보에는 일반의약품도 들어 있어서, 결과가 0건이면 e약은요에도 없다고 본다)
     */
    private List<String> candidates(List<String> keywords) {
        List<CompletableFuture<List<String>>> permits = keywords.stream()
                .map(k -> CompletableFuture.supplyAsync(() -> permitNames(k), executor))
                .toList();

        Set<String> result = new LinkedHashSet<>();
        boolean permitFailed = false;
        for (int i = 0; i < permits.size(); i++) {
            try {
                result.addAll(permits.get(i).join());
            } catch (CompletionException e) {
                permitFailed = true;
                log.warn("허가정보 이름 조회 실패: name={}, reason={}", keywords.get(i), rootMessage(e));
            }
        }
        if (permitFailed) {
            List<CompletableFuture<List<String>>> easies = keywords.stream()
                    .map(k -> CompletableFuture.supplyAsync(() -> easyDrugNames(k), executor))
                    .toList();
            for (int i = 0; i < easies.size(); i++) {
                try {
                    result.addAll(easies.get(i).join());
                } catch (CompletionException e) {
                    log.warn("e약은요 조회 실패: name={}, reason={}", keywords.get(i), rootMessage(e));
                }
            }
        }
        return new ArrayList<>(result);
    }

    private String firstActiveByCode(String ediCode) {
        try {
            return cached("edi:" + ediCode, () -> activeNames(drugPermitApiClient.searchByEdiCode(ediCode)))
                    .stream().findFirst().orElse(null);
        } catch (RuntimeException e) {
            log.warn("보험코드 조회 실패, 이름으로 계속: code={}, reason={}", ediCode, e.getMessage());
            return null;
        }
    }

    private List<String> permitNames(String keyword) {
        return cached("permit:" + keyword, () -> activeNames(drugPermitApiClient.searchByName(keyword)));
    }

    private List<String> easyDrugNames(String keyword) {
        return cached("easy:" + keyword, () -> durService.getDrugInfo(keyword).stream()
                .map(DrugInfoResponse.Summary::itemName)
                .filter(n -> n != null && !n.isBlank())
                .toList());
    }

    private static List<String> activeNames(List<DrugPermitResponse.Item> items) {
        return items.stream()
                .filter(DrugPermitResponse.Item::isActive)
                .map(DrugPermitResponse.Item::itemName)
                .filter(n -> n != null && !n.isBlank())
                .toList();
    }

    // ───── 검색 결과 캐시 (성공한 결과만 저장, 실패는 저장하지 않음) ─────

    private List<String> cached(String key, Supplier<List<String>> loader) {
        List<String> hit = searchCache.get(key);
        if (hit != null) return hit;
        List<String> loaded = List.copyOf(loader.get());
        searchCache.put(key, loaded);
        return loaded;
    }

    private static String rootMessage(Throwable e) {
        Throwable t = e.getCause() != null ? e.getCause() : e;
        return t.getMessage();
    }

    @Override
    public void destroy() {
        executor.shutdown();
    }

    /** 검색어: 그대로 → 용량 이후 제거 → 앞 2글자 (중복 제거) */
    static List<String> searchKeywords(String name) {
        String input = name.trim();
        Set<String> keywords = new LinkedHashSet<>();
        keywords.add(input);
        String shortName = shortName(input);
        if (shortName.length() >= 2) keywords.add(shortName);
        if (input.length() >= 3) keywords.add(input.substring(0, 2));
        return new ArrayList<>(keywords);
    }

    // ───── 아래는 외부 호출 없는 순수 로직 (단위 테스트 대상) ─────

    /** 후보를 화면용 이름으로 바꾸고 중복을 뺀 뒤, 입력과 글자 차이가 적은 순(같으면 짧은 이름 먼저)으로 정렬 */
    static List<String> rankSuggestions(String input, List<String> candidates, int limit) {
        String target = normalize(input);
        Set<String> seen = new LinkedHashSet<>();
        List<String> unique = new ArrayList<>();
        for (String c : candidates) {
            if (c == null || c.isBlank()) continue;
            String display = displayName(c);
            if (!display.isEmpty() && seen.add(normalize(display))) unique.add(display);
        }
        // 입력에 용량이 없으면 후보도 용량을 빼고 비교 ("타이래놀정" ↔ "타이레놀정500밀리그람" 은 1글자 차이)
        unique.sort(java.util.Comparator.comparingInt((String c) -> distance(target, base(target, c)))
                .thenComparingInt(String::length));
        return unique.size() > limit ? List.copyOf(unique.subList(0, limit)) : List.copyOf(unique);
    }

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
