package com.bank.yaksok.api.prescription.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DrugNameVerifierTest {

    @Test
    void 괄호_공백_단위표기가_달라도_같은_약() {
        assertTrue(DrugNameVerifier.isSameDrug("폰탈캡슐", "폰탈캡슐(메페남산)"));
        assertTrue(DrugNameVerifier.isSameDrug("지스로맥스정250mg", "지스로맥스정250밀리그램(아지트로마이신수화물)"));
        assertTrue(DrugNameVerifier.isSameDrug("에리우스정", "에리우스정(데스로라타딘(미분화))"));
    }

    @Test
    void 읽은_이름에_용량이_없으면_공식명_용량은_무시() {
        assertTrue(DrugNameVerifier.isSameDrug("폰탈캡슐", "폰탈캡슐250밀리그램(메페남산)"));
    }

    @Test
    void 한_글자_오인식만_교정_대상() {
        assertTrue(DrugNameVerifier.isOneCharOff("폰탈한캡슐", "폰탈캡슐(메페남산)"));
        assertEquals("폰탈캡슐", DrugNameVerifier.correctedName("폰탈한캡슐", "폰탈캡슐250밀리그램(메페남산)"));
    }

    @Test
    void 회사명만_같은_다른_약은_교정하지_않는다() {
        assertFalse(DrugNameVerifier.isOneCharOff("신일우소데옥시콜산정60mg", "신일슈도에페드린정(염산슈도에페드린)"));
        assertFalse(DrugNameVerifier.isSameDrug("신일우소데옥시콜산정60mg", "신일슈도에페드린정(염산슈도에페드린)"));
        assertFalse(DrugNameVerifier.isOneCharOff("에이목정375mg", "에이클란정375밀리그램"));
    }

    @Test
    void 용량이_다르면_교정하지_않는다() {
        assertFalse(DrugNameVerifier.isOneCharOff("타이레놀정250mg", "타이레놀정500mg"));
    }

    @Test
    void 이름이_많이_다르면_교정하지_않는다() {
        assertFalse(DrugNameVerifier.isOneCharOff("씨스본이알서방정", "써스펜8시간이알서방정650밀리그램"));
        assertNull(DrugNameVerifier.findOneCharOff("에리우스정", List.of("에스로반연고")));
    }

    @Test
    void 겹친_괄호도_모두_제거() {
        assertEquals("에리우스정", DrugNameVerifier.displayName("에리우스정(데스로라타딘(미분화))"));
    }

    @Test
    void 용량_이후를_뺀_짧은_이름() {
        assertEquals("타이레놀정", DrugNameVerifier.shortName("타이레놀정500mg"));
        assertEquals("폰탈캡슐", DrugNameVerifier.shortName("폰탈캡슐(메페남산)"));
    }

    @Test
    void 편집거리() {
        assertEquals(1, DrugNameVerifier.distance("폰탈한캡슐", "폰탈캡슐"));
        assertEquals(0, DrugNameVerifier.distance("abc", "abc"));
    }

    @Test
    void 후보는_괄호를_빼고_중복없이_가까운_순으로() {
        var ranked = DrugNameVerifier.rankSuggestions("타이래놀정",
                java.util.List.of("타이레놀콜드에스정", "타이레놀정500밀리그람(아세트아미노펜)", "타이레놀정160밀리그램",
                        "타이레놀정500밀리그람(아세트아미노펜)", "타이레놀정"),
                3);
        org.junit.jupiter.api.Assertions.assertEquals(
                java.util.List.of("타이레놀정", "타이레놀정500밀리그람", "타이레놀정160밀리그램"), ranked);
    }

    @Test
    void 후보가_없으면_빈_목록() {
        org.junit.jupiter.api.Assertions.assertTrue(DrugNameVerifier.rankSuggestions("아무거나", java.util.List.of(), 5).isEmpty());
    }

    @Test
    void 연관검색어는_앞글자가_같은_이름_먼저_짧은_순() {
        var ranked = DrugNameVerifier.rankAutocomplete("타이레놀",
                java.util.List.of("어린이타이레놀현탁액", "타이레놀정500밀리그람(아세트아미노펜)", "타이레놀정160밀리그램",
                        "타이레놀정500밀리그람(아세트아미노펜)", "게보린정"),
                10);
        org.junit.jupiter.api.Assertions.assertEquals(
                java.util.List.of("타이레놀", "어린이타이레놀"), ranked);
    }

    @Test
    void 연관검색어는_띄어쓰기를_무시한다() {
        var ranked = DrugNameVerifier.rankAutocomplete("타이 레놀", java.util.List.of("타이레놀정160밀리그램"), 10);
        org.junit.jupiter.api.Assertions.assertEquals(java.util.List.of("타이레놀"), ranked);
    }

    @Test
    void 짧은_이름은_한글자_차이여도_교정하지_않는다() {
        org.junit.jupiter.api.Assertions.assertFalse(DrugNameVerifier.isOneCharOff("앙", "앙정"));
        org.junit.jupiter.api.Assertions.assertFalse(DrugNameVerifier.isOneCharOff("앙정", "앙코정"));
        org.junit.jupiter.api.Assertions.assertTrue(DrugNameVerifier.isOneCharOff("타이래놀정", "타이레놀정500밀리그람"));
    }

    @Test
    void 짧은_이름은_성분_용량_제형을_뺀다() {
        org.junit.jupiter.api.Assertions.assertEquals("타이레놀", DrugNameVerifier.simpleName("타이레놀정500밀리그람(아세트아미노펜)"));
        org.junit.jupiter.api.Assertions.assertEquals("아스피린프로텍트", DrugNameVerifier.simpleName("아스피린프로텍트정100밀리그램"));
        org.junit.jupiter.api.Assertions.assertEquals("판콜에이", DrugNameVerifier.simpleName("판콜에이내복액"));
        org.junit.jupiter.api.Assertions.assertEquals("타이레놀콜드에스", DrugNameVerifier.simpleName("타이레놀콜드에스정"));
    }

    @Test
    void 짧은_이름으로_고른_약도_같은_약으로_확인된다() {
        org.junit.jupiter.api.Assertions.assertTrue(DrugNameVerifier.isSameDrug("타이레놀", "타이레놀정500밀리그람(아세트아미노펜)"));
        org.junit.jupiter.api.Assertions.assertTrue(DrugNameVerifier.isSameDrug("타이레놀정", "타이레놀정500밀리그람(아세트아미노펜)"));
        org.junit.jupiter.api.Assertions.assertTrue(DrugNameVerifier.isSameDrug("판콜에이", "판콜에이내복액"));
        org.junit.jupiter.api.Assertions.assertFalse(DrugNameVerifier.isSameDrug("타이레놀", "타이레놀콜드에스정"));
        org.junit.jupiter.api.Assertions.assertFalse(DrugNameVerifier.isSameDrug("타이레놀정500mg", "타이레놀정160밀리그램"));
    }
}
