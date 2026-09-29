package com.bank.yaksok.api.dur.service;

import com.bank.yaksok.api.dur.client.DurApiClient;
import com.bank.yaksok.api.dur.dto.DurResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DurService {

    private final DurApiClient durApiClient;

    public List<DurResponse.Item> checkInteractions(String itemName) {
        DurResponse response = durApiClient.getUsjntTaboo(itemName);

        if (response.body().items() == null) {
            return Collections.emptyList();
        }

        return response.body().items();
    }
}