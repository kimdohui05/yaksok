package com.bank.yaksok.api.prescription.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ImageQualityCheckerTest {

    @Test
    void 짧은_변_기준으로_화질을_나눈다() {
        assertEquals(ImageQualityChecker.Resolution.TOO_LOW, ImageQualityChecker.classify(300));
        assertEquals(ImageQualityChecker.Resolution.LOW, ImageQualityChecker.classify(700));
        assertEquals(ImageQualityChecker.Resolution.OK, ImageQualityChecker.classify(1240));
    }

    @Test
    void 이미지가_아니면_UNKNOWN() {
        assertEquals(ImageQualityChecker.Resolution.UNKNOWN, new ImageQualityChecker().checkResolution(new byte[]{1, 2, 3}));
    }

    @Test
    void AI_가독성_판단() {
        assertTrue(ImageQualityChecker.isPoorReadability("PARTIAL"));
        assertTrue(ImageQualityChecker.isPoorReadability("POOR"));
        assertFalse(ImageQualityChecker.isPoorReadability("GOOD"));
        assertFalse(ImageQualityChecker.isPoorReadability(null));
    }
}
