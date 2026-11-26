package com.bank.yaksok.api.push;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;

import static org.junit.jupiter.api.Assertions.*;

class WebPushCryptoTest {

    @Test
    void 공개키는_65바이트로_왕복된다() throws Exception {
        KeyPair kp = WebPushCrypto.generateKeyPair();
        byte[] raw = WebPushCrypto.raw((ECPublicKey) kp.getPublic());
        assertEquals(65, raw.length);
        assertArrayEquals(raw, WebPushCrypto.raw(WebPushCrypto.publicKey(raw)));
        assertEquals(32, WebPushCrypto.raw((ECPrivateKey) kp.getPrivate()).length);
    }

    @Test
    void 암호문_헤더는_salt_레코드크기_임시공개키_순서() throws Exception {
        KeyPair ua = WebPushCrypto.generateKeyPair();
        byte[] body = WebPushCrypto.encrypt("{\"title\":\"t\"}".getBytes(StandardCharsets.UTF_8),
                WebPushCrypto.raw((ECPublicKey) ua.getPublic()), WebPushCrypto.randomBytes(16));
        assertEquals(4096, ((body[16] & 0xff) << 24) | ((body[17] & 0xff) << 16) | ((body[18] & 0xff) << 8) | (body[19] & 0xff));
        assertEquals(65, body[20]);
        assertEquals(0x04, body[21]);
        // 헤더 86 + 본문 13 + 구분자 1 + GCM 태그 16
        assertEquals(86 + 13 + 1 + 16, body.length);
    }

    @Test
    void VAPID_헤더_형식() throws Exception {
        KeyPair v = WebPushCrypto.generateKeyPair();
        String header = WebPushCrypto.vapidAuthorization("https://fcm.googleapis.com", "mailto:a@b.c", 2000000000L,
                WebPushCrypto.raw((ECPublicKey) v.getPublic()), WebPushCrypto.raw((ECPrivateKey) v.getPrivate()));
        assertTrue(header.startsWith("vapid t="));
        assertEquals(3, header.substring(8, header.indexOf(',')).split("\\.").length);
        assertTrue(header.contains(", k="));
    }
}
