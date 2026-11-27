package com.bank.yaksok.notification.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

/** 복약 알림 규칙 (외부 의존 없는 순수 로직) */
public final class AlarmRules {

    public static final String TITLE = "복약 시간이에요";

    /** 서버가 멈췄다 켜졌을 때 몇 분 전 알림까지 늦게라도 보낼지 */
    public static final int MAX_CATCH_UP_MINUTES = 5;

    private static final int MAX_NAMES_IN_BODY = 3;

    private AlarmRules() {}

    /**
     * 그 날짜에 알림을 보낼 약인지.
     * 시작일 전이면 아님, 시작일부터 투약 일수가 지나면 아님. 시작일이나 일수가 없으면 제한 없음.
     * 예: 11/27 시작, 3일 → 11/27, 11/28, 11/29 에만 알림
     */
    public static boolean isActiveOn(LocalDate startDate, Integer days, LocalDate date) {
        if (startDate == null) return true;
        if (date.isBefore(startDate)) return false;
        return days == null || days <= 0 || date.isBefore(startDate.plusDays(days));
    }

    /** 같은 시간 약 여러 개를 한 문장으로: "타이레놀, 부루펜 복용할 시간입니다." (4개 이상은 "외 N개") */
    public static String body(List<String> medicineNames) {
        List<String> names = new ArrayList<>(new LinkedHashSet<>(medicineNames));
        String joined;
        if (names.size() <= MAX_NAMES_IN_BODY) {
            joined = String.join(", ", names);
        } else {
            joined = String.join(", ", names.subList(0, MAX_NAMES_IN_BODY)) + " 외 " + (names.size() - MAX_NAMES_IN_BODY) + "개";
        }
        return joined + " 복용할 시간입니다.";
    }

    /**
     * 이번 실행에서 확인할 분 목록 (마지막으로 처리한 분 다음부터 지금까지, 최대 MAX_CATCH_UP_MINUTES 분).
     * 처음 실행이면(last == null) 서버가 꺼져 있던 동안 놓쳤을 수 있는 최근 몇 분도 확인한다.
     * 같은 알림이 두 번 가는 건 알림 기록(사용자·시각 하나)으로 막는다.
     */
    public static List<LocalDateTime> minutesToProcess(LocalDateTime last, LocalDateTime now, int maxCatchUp) {
        LocalDateTime current = now.truncatedTo(ChronoUnit.MINUTES);
        LocalDateTime earliest = current.minusMinutes(Math.max(1, maxCatchUp) - 1L);
        LocalDateTime start = last == null ? earliest : last.truncatedTo(ChronoUnit.MINUTES).plusMinutes(1);
        if (start.isBefore(earliest)) start = earliest;
        List<LocalDateTime> minutes = new ArrayList<>();
        for (LocalDateTime t = start; !t.isAfter(current); t = t.plusMinutes(1)) {
            minutes.add(t);
        }
        return minutes;
    }
}
