package com.bank.yaksok.api.push;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;

/** 푸시 서비스(FCM·Mozilla·Windows 등)로 암호화된 알림을 보낸다. */
@Slf4j
@Component
public class WebPushSender {

    /** 결과: 성공 / 구독 만료(지워야 함) / 기타 실패 */
    public enum Result { SENT, GONE, FAILED }

    private final String publicKey;
    private final String privateKey;
    private final String subject;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    public WebPushSender(@Value("${push.vapid.public-key:}") String publicKey,
                         @Value("${push.vapid.private-key:}") String privateKey,
                         @Value("${push.vapid.subject:mailto:admin@yaksok.local}") String subject) {
        this.publicKey = publicKey.trim();
        this.privateKey = privateKey.trim();
        this.subject = subject.trim();
    }

    public boolean isConfigured() {
        return !publicKey.isEmpty() && !privateKey.isEmpty();
    }

    public String publicKey() {
        return publicKey;
    }

    public Result send(String endpoint, String p256dh, String auth, String payloadJson) {
        try {
            byte[] body = WebPushCrypto.encrypt(payloadJson.getBytes(StandardCharsets.UTF_8),
                    WebPushCrypto.decode(p256dh), WebPushCrypto.decode(auth));
            URI uri = URI.create(endpoint);
            String audience = uri.getScheme() + "://" + uri.getAuthority();
            long exp = Instant.now().plus(Duration.ofHours(12)).getEpochSecond();
            String authorization = WebPushCrypto.vapidAuthorization(audience, subject, exp,
                    WebPushCrypto.decode(publicKey), WebPushCrypto.decode(privateKey));

            HttpRequest request = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(10))
                    .header("Authorization", authorization)
                    .header("Content-Encoding", "aes128gcm")
                    .header("Content-Type", "application/octet-stream")
                    .header("TTL", "3600")          // 브라우저가 꺼져 있으면 1시간까지 보관 후 전달
                    .header("Urgency", "high")
                    .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            int status = response.statusCode();
            if (status >= 200 && status < 300) return Result.SENT;
            if (status == 404 || status == 410) return Result.GONE; // 구독 해제·만료된 브라우저
            log.warn("웹 푸시 실패: status={}, host={}, body={}", status, uri.getHost(), response.body());
            return Result.FAILED;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Result.FAILED;
        } catch (Exception e) {
            log.warn("웹 푸시 실패: {}", e.getMessage());
            return Result.FAILED;
        }
    }
}
