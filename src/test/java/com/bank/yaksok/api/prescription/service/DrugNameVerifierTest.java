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
    void 편집거리() {
        assertEquals(1, DrugNameVerifier.distance("폰탈한캡슐", "폰탈캡슐"));
        assertEquals(0, DrugNameVerifier.distance("abc", "abc"));
    }
}
