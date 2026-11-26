package com.bank.yaksok.api.prescription.service;

import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Iterator;

/**
 * 처방전 사진 화질 판단.
 *
 * 1) 해상도: 짧은 변 기준
 *    - MIN_SHORT_SIDE 미만 → 인식 불가 (AI 호출 전에 거절해서 할당량도 아낀다)
 *    - LOW_SHORT_SIDE 미만 → 인식은 하되 경고
 * 2) AI 판단: Gemini 가 글씨가 잘 읽히는지 readability(GOOD/PARTIAL/POOR)로 함께 알려준다.
 *
 * 크기를 읽을 수 없는 형식(webp, heic 등)은 해상도 검사를 건너뛰고 AI 판단만 쓴다.
 */
@Component
public class ImageQualityChecker {

    static final int MIN_SHORT_SIDE = 500;
    static final int LOW_SHORT_SIDE = 900;

    public static final String UNREADABLE_MESSAGE =
            "사진 화질이 낮아 인식할 수 없습니다. 처방전 전체가 선명하게 나오도록 밝은 곳에서 가까이 다시 촬영해 주세요.";
    public static final String WARNING_MESSAGE =
            "사진 화질이 좋지 않아 일부 내용을 정확히 인식하지 못했을 수 있습니다. 결과를 꼭 확인하고, 가능하면 더 선명하게 다시 촬영해 주세요.";

    public enum Resolution { TOO_LOW, LOW, OK, UNKNOWN }

    /** 사진 크기로 판단 */
    public Resolution checkResolution(byte[] bytes) {
        int[] size = readSize(bytes);
        if (size == null) {
            return Resolution.UNKNOWN;
        }
        return classify(Math.min(size[0], size[1]));
    }

    static Resolution classify(int shortSide) {
        if (shortSide < MIN_SHORT_SIDE) return Resolution.TOO_LOW;
        if (shortSide < LOW_SHORT_SIDE) return Resolution.LOW;
        return Resolution.OK;
    }

    /** AI 가 판단한 가독성이 나쁜지 (PARTIAL, POOR) */
    public static boolean isPoorReadability(String readability) {
        return "PARTIAL".equalsIgnoreCase(readability) || "POOR".equalsIgnoreCase(readability);
    }

    /** 이미지 전체를 디코딩하지 않고 헤더에서 가로·세로만 읽는다. 실패하면 null */
    private static int[] readSize(byte[] bytes) {
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            if (in == null) return null;
            Iterator<ImageReader> readers = ImageIO.getImageReaders(in);
            if (!readers.hasNext()) return null;
            ImageReader reader = readers.next();
            try {
                reader.setInput(in);
                return new int[]{reader.getWidth(0), reader.getHeight(0)};
            } finally {
                reader.dispose();
            }
        } catch (IOException | RuntimeException e) {
            return null;
        }
    }
}
