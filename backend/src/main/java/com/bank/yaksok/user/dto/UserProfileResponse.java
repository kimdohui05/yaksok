package com.bank.yaksok.user.dto;

/** 내 정보 (프론트 MyPage: profile.name, profile.email) */
public record UserProfileResponse(String name, String email) {}
