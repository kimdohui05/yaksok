package com.bank.yaksok.api.drug.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class DrugCategoryTest {

    @Test
    void 분류_이름으로_카테고리를_정한다() {
        assertEquals("해열·진통", DrugCategory.of("[01140]해열.진통.소염제", "Acetaminophen"));
        assertEquals("소염·진통", DrugCategory.of("[01140]해열.진통.소염제", "Ibuprofen"));
        assertEquals("소화·위장", DrugCategory.of("[02320]소화성궤양용제", "Rebamipide"));
        assertEquals("혈압·심혈관", DrugCategory.of("[02140]혈압강하제", "Amlodipine"));
        assertEquals("당뇨", DrugCategory.of("[03960]당뇨병용제", "Metformin"));
        assertEquals("항생제", DrugCategory.of("[06180]주로 그람양성, 음성균에 작용하는 것", "Azithromycin"));
        assertEquals("알레르기", DrugCategory.of("[01410]항히스타민제", "Cetirizine"));
        assertEquals("감기·호흡기", DrugCategory.of("[02220]진해거담제", "Ambroxol"));
        assertEquals("수면·신경", DrugCategory.of("[01120]최면진정제", "Zolpidem"));
        assertEquals("영양제", DrugCategory.of("[03190]기타의 비타민제", null));
    }

    @Test
    void 글자로_모르면_분류번호로_정하고_그래도_모르면_기타() {
        assertEquals("혈압·심혈관", DrugCategory.of("[02190]기타의 순환계용약", null));
        assertEquals("소화·위장", DrugCategory.of("[02390]기타의 소화기관용약", null));
        assertEquals("기타", DrugCategory.of("[08990]기타의 마약", null));
    }

    @Test
    void 분류가_없으면_null() {
        assertNull(DrugCategory.of(null, "Acetaminophen"));
        assertNull(DrugCategory.of(" ", null));
    }
}
