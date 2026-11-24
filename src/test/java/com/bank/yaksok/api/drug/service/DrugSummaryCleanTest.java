package com.bank.yaksok.api.drug.service;

import com.bank.yaksok.api.drug.dto.DrugSummaryResponse;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DrugSummaryCleanTest {

    @Test
    void 빈_값과_중복_음식은_빼고_순서는_유지한다() {
        var foods = DrugSummaryService.cleanFoods(Arrays.asList("술", "커피", " 술 ", "", null, "자몽주스"));
        assertEquals(List.of("술", "커피", "자몽주스"), foods);
    }

    @Test
    void 음식은_최대_5개까지만() {
        List<String> raw = new ArrayList<>();
        for (int i = 0; i < 8; i++) raw.add("음식" + i);
        assertEquals(List.of("음식0", "음식1", "음식2", "음식3", "음식4"), DrugSummaryService.cleanFoods(raw));
    }

    @Test
    void null_목록은_빈_목록() {
        assertTrue(DrugSummaryService.cleanFoods(null).isEmpty());
    }

    @Test
    void 근거를_모르면_일반지식으로_표시() {
        assertEquals(DrugSummaryResponse.BASIS_SOURCE, DrugSummaryService.cleanBasis("SOURCE"));
        assertEquals(DrugSummaryResponse.BASIS_GENERAL, DrugSummaryService.cleanBasis("GENERAL"));
        assertEquals(DrugSummaryResponse.BASIS_GENERAL, DrugSummaryService.cleanBasis(null));
        assertEquals(DrugSummaryResponse.BASIS_GENERAL, DrugSummaryService.cleanBasis("뭔가"));
    }
}
