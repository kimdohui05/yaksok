package com.bank.yaksok.config.token;

public class JwtTokenResponse {

    private final String token;

    public JwtTokenResponse(String token) {
        this.token = token;
    }

    public String getToken() {
        return token;
    }
}