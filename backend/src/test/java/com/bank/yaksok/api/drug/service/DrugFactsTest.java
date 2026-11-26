package com.bank.yaksok.api.drug.service;

import com.bank.yaksok.api.dur.dto.DrugInfoResponse;
import com.bank.yaksok.api.dur.dto.DrugPermitResponse;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DrugFactsTest {

    @Test
    void e약은요_정보는_빈_항목을_빼고_담는다() {
        var s = new DrugInfoResponse.Summary("1", "타이레놀정500밀리그람", "켄뷰",
                "해열 및 진통", "1회 1~2정", null, " ", null, null, "실온 보관", null);
        DrugFacts facts = DrugFacts.fromEasyDrug(s);

        assertEquals("e약은요", facts.source());
        assertEquals("해열 및 진통", facts.fields().get("효능"));
        assertFalse(facts.fields().containsKey("사용상 주의사항"));
        assertTrue(facts.hasContent());
    }

    @Test
    void 허가정보는_분류와_주성분을_담는다() {
        var i = new DrugPermitResponse.Item("1", "지스로맥스정250밀리그램", "화이자", "전문의약품",
                "648900880", "Azithromycin", "[06180]주로 그람양성·음성균에 작용하는 것", "정상");
        DrugFacts facts = DrugFacts.fromPermit(i);

        assertEquals("의약품 허가정보", facts.source());
        assertEquals("Azithromycin", facts.fields().get("주성분"));
        assertTrue(facts.hasContent());
    }

    @Test
    void 제조사만_있으면_요약할_내용이_없다() {
        var i = new DrugPermitResponse.Item("1", "어떤약", "어떤회사", null, null, null, null, "정상");
        assertFalse(DrugFacts.fromPermit(i).hasContent());
    }

    @Test
    void 너무_긴_원문은_자른다() {
        String longText = "가".repeat(DrugFacts.MAX_FIELD_LENGTH + 100);
        var s = new DrugInfoResponse.Summary("1", "약", "회사", longText, null, null, null, null, null, null, null);
        assertEquals(DrugFacts.MAX_FIELD_LENGTH + 1, DrugFacts.fromEasyDrug(s).fields().get("효능").length());
    }

    @Test
    void 프롬프트에_원문과_출처가_들어간다() {
        var s = new DrugInfoResponse.Summary("1", "타이레놀정500밀리그람", "켄뷰",
                "해열 및 진통", null, null, null, null, null, null, null);
        String prompt = DrugSummaryService.buildPrompt(DrugFacts.fromEasyDrug(s));

        assertTrue(prompt.contains("타이레놀정500밀리그람"));
        assertTrue(prompt.contains("[효능]\n해열 및 진통"));
        assertTrue(prompt.contains("출처: e약은요"));
    }
}
