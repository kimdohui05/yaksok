package com.bank.yaksok.api.drug.service;

import com.bank.yaksok.api.drug.dto.DrugSummaryResponse;
import com.bank.yaksok.api.drug.dto.GeminiDrugSummary.Food;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DrugSummaryCleanTest {

    @Test
    void 빈_항목과_중복_음식은_뺀다() {
        var foods = DrugSummaryService.cleanFoods(Arrays.asList(
                new Food("술", "간 손상 위험이 커져요."),
                new Food(" 술 ", "중복"),
                new Food("", "이름 없음"),
                new Food("우유", null),
                null));
        assertEquals(1, foods.size());
        assertEquals("술", foods.get(0).food());
    }

    @Test
    void 음식은_최대_5개까지만() {
        List<Food> raw = new ArrayList<>();
        for (int i = 0; i < 8; i++) raw.add(new Food("음식" + i, "이유"));
        assertEquals(5, DrugSummaryService.cleanFoods(raw).size());
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
