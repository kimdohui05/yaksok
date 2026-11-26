package com.bank.yaksok.config.token;

public class JwtTokenResponse {

    private final String token;
    private final String name;

    public JwtTokenResponse(String token, String name) {
        this.token = token;
        this.name = name;
    }

    public String getToken() {
        return token;
    }

    public String getName() {
        return name;
    }
}