package com.bank.yaksok.api.prescription.service;

import com.bank.yaksok.api.prescription.dto.GeminiPrescriptionResult;
import com.bank.yaksok.api.prescription.dto.PrescriptionAnalyzeResponse;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PrescriptionResultCleanerTest {

    private final PrescriptionResultCleaner cleaner = new PrescriptionResultCleaner();

    @Test
    void 정상값은_그대로_통과한다() {
        var raw = new GeminiPrescriptionResult("2026-11-22", List.of(
                new GeminiPrescriptionResult.Item(" 타이레놀정500mg ", "1정", 3, 5, "648900880")));

        PrescriptionAnalyzeResponse result = cleaner.clean(raw);

        assertEquals("2026-11-22", result.prescriptionDate());
        assertEquals(1, result.medicines().size());
        var med = result.medicines().get(0);
        assertEquals("타이레놀정500mg", med.name());
        assertEquals("1정", med.dose());
        assertEquals(3, med.timesPerDay());
        assertEquals(5, med.days());
        assertEquals("648900880", med.ediCode());
    }

    @Test
    void 이상한_값은_null로_바꾼다() {
        var raw = new GeminiPrescriptionResult("2026-13-45", List.of(
                new GeminiPrescriptionResult.Item("뮤코펙트정", " ", 0, 999, "12-34")));

        var med = cleaner.clean(raw).medicines().get(0);

        assertNull(cleaner.clean(raw).prescriptionDate());
        assertNull(med.dose());
        assertNull(med.timesPerDay());
        assertNull(med.days());
        assertNull(med.ediCode());
    }

    @Test
    void 이름없는_약과_null_항목은_제외한다() {
        var raw = new GeminiPrescriptionResult(null, Arrays.asList(
                new GeminiPrescriptionResult.Item("", "1정", 2, 3, null),
                null,
                new GeminiPrescriptionResult.Item("가스모틴정5mg", null, 2, null, null)));

        var result = cleaner.clean(raw);

        assertEquals(1, result.medicines().size());
        assertEquals("가스모틴정5mg", result.medicines().get(0).name());
    }

    @Test
    void 결과가_없으면_빈_목록() {
        assertTrue(cleaner.clean(null).medicines().isEmpty());
        assertTrue(cleaner.clean(new GeminiPrescriptionResult(null, null)).medicines().isEmpty());
    }
}
