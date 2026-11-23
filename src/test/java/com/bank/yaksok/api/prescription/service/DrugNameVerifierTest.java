package com.bank.yaksok.api.prescription.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class DrugNameVerifierTest {

    @Test
    void 괄호와_공백을_빼고_같으면_같은_약() {
        assertEquals("폰탈캡슐(메페남산)",
                DrugNameVerifier.findSame("폰탈캡슐", List.of("폰탈캡슐(메페남산)", "폰탈정")));
    }

    @Test
    void 한_글자_오인식은_가까운_공식명으로_교정() {
        assertEquals("폰탈캡슐(메페남산)",
                DrugNameVerifier.findClosest("폰탈한캡슐", List.of("폰탈캡슐(메페남산)", "폰탈정")));
    }

    @Test
    void 용량이_다르면_교정하지_않는다() {
        assertNull(DrugNameVerifier.findClosest("타이레놀정250mg", List.of("타이레놀정500mg")));
    }

    @Test
    void 차이가_크면_교정하지_않는다() {
        assertNull(DrugNameVerifier.findClosest("에리우스정", List.of("에스로반연고")));
    }

    @Test
    void 용량_이후를_뺀_짧은_이름() {
        assertEquals("타이레놀정", DrugNameVerifier.shortName("타이레놀정500mg"));
        assertEquals("폰탈캡슐", DrugNameVerifier.shortName("폰탈캡슐(메페남산)"));
    }

    @Test
    void 공식명의_밀리그램_표기와_처방전의_mg는_같게_본다() {
        assertEquals(DrugNameVerifier.normalize("지스로맥스정250mg"),
                DrugNameVerifier.normalize("지스로맥스정250밀리그램(아지트로마이신수화물)"));
        assertEquals("지스로맥스정250밀리그램(아지트로마이신수화물)",
                DrugNameVerifier.findSame("지스로맥스정250mg",
                        List.of("지스로맥스정250밀리그램(아지트로마이신수화물)")));
    }

    @Test
    void 같은_약이면_읽은_이름_유지_교정되면_원래_이름_남김() {
        var same = DrugNameVerifier.resultFor("폰탈캡슐", "폰탈캡슐(메페남산)");
        assertEquals("폰탈캡슐", same.name());
        assertNull(same.originalName());

        var corrected = DrugNameVerifier.resultFor("폰탈한캡슐", "폰탈캡슐(메페남산)");
        assertEquals("폰탈캡슐", corrected.name());
        assertEquals("폰탈한캡슐", corrected.originalName());
    }

    @Test
    void 보험코드_결과는_이름_앞부분이_같을_때만_인정() {
        assertEquals(true, DrugNameVerifier.sameStart("폰탈한캡슐", "폰탈캡슐(메페남산)"));
        assertEquals(false, DrugNameVerifier.sameStart("에리우스정", "타이레놀정500밀리그람"));
    }

    @Test
    void 겹친_괄호도_모두_제거() {
        assertEquals("에리우스정", DrugNameVerifier.displayName("에리우스정(데스로라타딘(미분화))"));
        var r = DrugNameVerifier.resultFor("에리우스정", "에리우스정(데스로라타딘(미분화))");
        assertEquals("에리우스정", r.name());
        assertNull(r.originalName());
    }

    @Test
    void 읽은_이름에_용량이_없으면_공식명_용량은_빼고_비교() {
        assertEquals("폰탈캡슐250밀리그램(메페남산)",
                DrugNameVerifier.findSame("폰탈캡슐", List.of("폰탈캡슐250밀리그램(메페남산)")));
        var same = DrugNameVerifier.resultFor("폰탈캡슐", "폰탈캡슐250밀리그램(메페남산)");
        assertEquals("폰탈캡슐", same.name());
        assertNull(same.originalName());

        var corrected = DrugNameVerifier.resultFor("폰탈한캡슐", "폰탈캡슐250밀리그램(메페남산)");
        assertEquals("폰탈캡슐", corrected.name());
        assertEquals("폰탈한캡슐", corrected.originalName());
    }

    @Test
    void 보험코드로_찾으면_공식명으로_교정() {
        var r = DrugNameVerifier.resultForExact("써스본이알서방정", "써스펜8시간이알서방정650밀리그램(아세트아미노펜)");
        assertEquals("써스펜8시간이알서방정650밀리그램", r.name());
        assertEquals("써스본이알서방정", r.originalName());
    }

    @Test
    void 편집거리() {
        assertEquals(1, DrugNameVerifier.distance("폰탈한캡슐", "폰탈캡슐"));
        assertEquals(0, DrugNameVerifier.distance("abc", "abc"));
    }
}
