package com.bank.yaksok.user.controller;

import com.bank.yaksok.config.token.JwtTokenResponse;
import com.bank.yaksok.user.dto.LoginDto;
import com.bank.yaksok.user.dto.RegisterDto;
import com.bank.yaksok.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/user")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @PostMapping("/register")
    public ResponseEntity<Void> register(@Valid @RequestBody RegisterDto request) {
        userService.register(request);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/login")
    public ResponseEntity<JwtTokenResponse> login(@Valid @RequestBody LoginDto request) {
        String token = userService.login(request);
        return ResponseEntity.ok(new JwtTokenResponse(token));
    }
}