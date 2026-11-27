package com.bank.yaksok.api.drug.service;

import java.util.List;
import java.util.regex.Pattern;

/**
 * 식약처 의약품 허가정보의 분류(PRDUCT_TYPE, 예: "[01140]해열.진통.소염제")와 주성분으로
 * 프론트 카테고리(frontend categories.js 의 key)를 정한다. 정할 수 없으면 null (프론트가 이름 키워드로 추정).
 */
public final class DrugCategory {

    // 프론트 categories.js 와 같은 이름이어야 한다 (가운뎃점 · 포함)
    public static final String FEVER = "해열·진통";
    public static final String NSAID = "소염·진통";
    public static final String COLD = "감기·호흡기";
    public static final String DIGESTIVE = "소화·위장";
    public static final String CARDIO = "혈압·심혈관";
    public static final String DIABETES = "당뇨";
    public static final String ANTIBIOTIC = "항생제";
    public static final String ALLERGY = "알레르기";
    public static final String NEURO = "수면·신경";
    public static final String SUPPLEMENT = "영양제";
    public static final String OTHER = "기타";

    /** 해열·진통·소염제 중 소염진통제(NSAID) 주성분 (허가정보 주성분은 영문) */
    private static final Pattern NSAID_INGREDIENT = Pattern.compile(
            "ibuprofen|naproxen|loxoprofen|diclofenac|celecoxib|aceclofenac|meloxicam|ketoprofen|"
                    + "pelubiprofen|zaltoprofen|etodolac|piroxicam|indomethacin|talniflumate|polmacoxib|"
                    + "이부프로펜|나프록센|록소프로펜|디클로페낙|세레콕시브|아세클로페낙|멜록시캄|케토프로펜|펠루비프로펜",
            Pattern.CASE_INSENSITIVE);

    /** 분류 이름(글자)으로 판단. 위에서부터 먼저 맞는 것 */
    private static final List<Object[]> LABEL_RULES = List.of(
            new Object[]{FEVER, Pattern.compile("해열|진통|소염")},
            new Object[]{COLD, Pattern.compile("진해|거담|호흡|기침|감기|비강|인후")},
            new Object[]{ALLERGY, Pattern.compile("히스타민|알레르기")},
            new Object[]{DIABETES, Pattern.compile("당뇨")},
            // "혈압강하제"의 "하제"가 소화(하제·완장제)로 잡히지 않게 심혈관을 먼저 본다
            new Object[]{CARDIO, Pattern.compile("혈압|순환|심장|강심|부정맥|혈관|동맥경화|고지혈|이뇨")},
            new Object[]{DIGESTIVE, Pattern.compile("소화|궤양|건위|정장|제산|완장|변비|지사|위장|진토|이담|장관")},
            new Object[]{ANTIBIOTIC, Pattern.compile("항생|항균|그람|결핵|화학요법|세균")},
            new Object[]{NEURO, Pattern.compile("최면|진정|정신|항불안|수면|항전간|신경")},
            new Object[]{SUPPLEMENT, Pattern.compile("비타민|무기질|자양|강장|영양|칼슘|철분|철제")}
    );

    private DrugCategory() {}

    public static String of(String productType, String ingredient) {
        if (productType == null || productType.isBlank()) return null;
        String category = byLabel(productType);
        if (category == null) category = byCode(productType);
        if (category == null) return OTHER;
        if (FEVER.equals(category) && ingredient != null && NSAID_INGREDIENT.matcher(ingredient).find()) {
            return NSAID;
        }
        return category;
    }

    private static String byLabel(String productType) {
        String label = productType.replaceAll("\\[[^]]*]", "");
        for (Object[] rule : LABEL_RULES) {
            if (((Pattern) rule[1]).matcher(label).find()) return (String) rule[0];
        }
        return null;
    }

    /** 분류 번호(약효분류 3자리)로 판단. "[01140]" → "114" */
    private static String byCode(String productType) {
        java.util.regex.Matcher m = Pattern.compile("\\[(\\d{3,5})]").matcher(productType);
        if (!m.find()) return null;
        String digits = m.group(1);
        String code = digits.length() == 5 ? digits.substring(1, 4) : digits.substring(0, 3);
        if (code.equals("114")) return FEVER;
        if (code.equals("112") || code.equals("113") || code.equals("117")) return NEURO;
        if (code.equals("141")) return ALLERGY;
        if (code.equals("396")) return DIABETES;
        if (code.startsWith("21")) return CARDIO;
        if (code.startsWith("22")) return COLD;
        if (code.startsWith("23")) return DIGESTIVE;
        if (code.startsWith("31") || code.startsWith("32")) return SUPPLEMENT;
        if (code.startsWith("61") || code.startsWith("62")) return ANTIBIOTIC;
        return null;
    }
}
