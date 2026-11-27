package com.bank.yaksok.notification.service;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class AlarmRulesTest {

    private static final LocalDate START = LocalDate.of(2026, 11, 27);

    @Test
    void 처방_기간_안에만_알림() {
        assertFalse(AlarmRules.isActiveOn(START, 3, START.minusDays(1)));  // 시작 전
        assertTrue(AlarmRules.isActiveOn(START, 3, START));                // 1일째
        assertTrue(AlarmRules.isActiveOn(START, 3, START.plusDays(2)));    // 3일째
        assertFalse(AlarmRules.isActiveOn(START, 3, START.plusDays(3)));   // 끝난 다음 날
    }

    @Test
    void 시작일이나_일수가_없으면_제한_없음() {
        assertTrue(AlarmRules.isActiveOn(null, null, START));
        assertTrue(AlarmRules.isActiveOn(null, 3, START.plusYears(1)));
        assertTrue(AlarmRules.isActiveOn(START, null, START.plusYears(1)));
        assertFalse(AlarmRules.isActiveOn(START, null, START.minusDays(1)));
    }

    @Test
    void 같은_시간_약은_한_문장으로_묶는다() {
        assertEquals("타이레놀 복용할 시간입니다.", AlarmRules.body(List.of("타이레놀")));
        assertEquals("타이레놀, 부루펜 복용할 시간입니다.", AlarmRules.body(List.of("타이레놀", "부루펜", "타이레놀")));
        assertEquals("A, B, C 외 2개 복용할 시간입니다.", AlarmRules.body(List.of("A", "B", "C", "D", "E")));
    }

    @Test
    void 평소에는_이번_분만_확인() {
        LocalDateTime now = LocalDateTime.of(2026, 11, 27, 8, 0, 3);
        assertEquals(List.of(now.withSecond(0)), AlarmRules.minutesToProcess(now.minusMinutes(1), now, 5));
    }

    @Test
    void 서버가_멈췄던_분은_최대_5분까지_보충() {
        LocalDateTime now = LocalDateTime.of(2026, 11, 27, 8, 10);
        // 3분 늦게 돈 경우: 08:08, 08:09, 08:10
        assertEquals(3, AlarmRules.minutesToProcess(now.minusMinutes(3), now, 5).size());
        // 오래 멈춘 경우: 최근 5분만 (08:06 ~ 08:10)
        List<LocalDateTime> m = AlarmRules.minutesToProcess(now.minusHours(2), now, 5);
        assertEquals(5, m.size());
        assertEquals(now.minusMinutes(4), m.get(0));
        // 처음 켜졌을 때도 최근 5분 확인
        assertEquals(5, AlarmRules.minutesToProcess(null, now, 5).size());
        // 같은 분에 두 번 돌면 확인할 게 없음
        assertTrue(AlarmRules.minutesToProcess(now, now, 5).isEmpty());
    }

    @Test
    void 자정을_넘어도_이어서_확인() {
        LocalDateTime now = LocalDateTime.of(2026, 11, 28, 0, 1);
        List<LocalDateTime> m = AlarmRules.minutesToProcess(LocalDateTime.of(2026, 11, 27, 23, 59), now, 5);
        assertEquals(List.of(LocalDateTime.of(2026, 11, 28, 0, 0), now), m);
    }
}
