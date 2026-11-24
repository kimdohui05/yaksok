package com.bank.yaksok.api.push.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** 브라우저 PushSubscription.toJSON() 그대로: { endpoint, expirationTime, keys: { p256dh, auth } } */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PushSubscribeRequest(String endpoint, Long expirationTime, Keys keys) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Keys(String p256dh, String auth) {}
}
