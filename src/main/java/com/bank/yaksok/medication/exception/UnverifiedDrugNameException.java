package com.bank.yaksok.medication.exception;

import java.util.List;

/** 공공데이터에서 확인되지 않은 약 이름으로 저장하려 할 때 (사용자 확인 필요) */
public class UnverifiedDrugNameException extends RuntimeException {

    private final String inputName;
    private final List<String> suggestions;

    public UnverifiedDrugNameException(String inputName, List<String> suggestions) {
        super("등록된 약 이름을 찾지 못했습니다. 약 이름을 확인해 주세요.");
        this.inputName = inputName;
        this.suggestions = suggestions;
    }

    public String getInputName() { return inputName; }
    public List<String> getSuggestions() { return suggestions; }
}
