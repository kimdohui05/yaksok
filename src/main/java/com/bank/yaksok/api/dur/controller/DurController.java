package com.bank.yaksok.api.dur.controller;

import com.bank.yaksok.api.dur.dto.DurResponse;
import com.bank.yaksok.api.dur.service.DurService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class DurController {

    private final DurService durService;

    @GetMapping("/api/dur/check")
    public List<DurResponse.Item> check(@RequestParam String itemName) {
        return durService.checkInteractions(itemName);
    }
}