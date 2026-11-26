package com.bank.yaksok.api.prescription.service;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** 간단한 메모리 캐시: 최대 개수를 넘으면 가장 오래 안 쓴 것부터, 유지 시간이 지나면 버린다. */
final class TtlCache {

    private record Entry(List<String> value, long expiresAt) {}

    private final long ttlMillis;
    private final Map<String, Entry> map;

    TtlCache(int maxSize, Duration ttl) {
        this.ttlMillis = ttl.toMillis();
        this.map = new LinkedHashMap<>(16, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<String, Entry> eldest) {
                return size() > maxSize;
            }
        };
    }

    synchronized List<String> get(String key) {
        Entry e = map.get(key);
        if (e == null) return null;
        if (System.currentTimeMillis() > e.expiresAt()) {
            map.remove(key);
            return null;
        }
        return e.value();
    }

    synchronized void put(String key, List<String> value) {
        map.put(key, new Entry(value, System.currentTimeMillis() + ttlMillis));
    }

    synchronized int size() {
        return map.size();
    }
}
