package com.bank.yaksok.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;

@Getter
public class RegisterDto {

    @NotBlank
    @Email
    private String email;

    @NotBlank
    @Size(min = 4, message = "비밀번호는 4자 이상이어야 합니다.")
    private String password;

    @NotBlank
    @Size(min = 3, max = 5, message = "이름은 3글자 ~ 5글자 사이여야합니다.")
    private String name;
}