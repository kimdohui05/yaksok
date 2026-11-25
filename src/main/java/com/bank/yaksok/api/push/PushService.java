package com.bank.yaksok.api.push;

import com.bank.yaksok.api.push.dto.PushSubscribeRequest;
import com.bank.yaksok.api.push.entity.PushSubscriptionEntity;
import com.bank.yaksok.api.push.repository.PushSubscriptionRepository;
import com.bank.yaksok.user.entity.UserEntity;
import com.bank.yaksok.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class PushService {

    private final PushSubscriptionRepository subscriptionRepository;
    private final UserRepository userRepository;
    private final WebPushSender webPushSender;
    private final ObjectMapper objectMapper;

    public String publicKey() {
        if (!webPushSender.isConfigured()) {
            log.error("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY 환경변수가 설정되지 않았습니다.");
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "PC 알림 기능이 아직 설정되지 않았습니다.");
        }
        return webPushSender.publicKey();
    }

    /** 구독 저장. 같은 브라우저(endpoint)면 새 키·사용자로 갱신 */
    @Transactional
    public void subscribe(String email, PushSubscribeRequest request) {
        UserEntity user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "사용자를 찾을 수 없습니다."));
        validate(request);
        String endpoint = request.endpoint().trim();
        String p256dh = request.keys().p256dh().trim();
        String auth = request.keys().auth().trim();

        subscriptionRepository.findByEndpoint(endpoint).ifPresentOrElse(
                s -> s.update(user, p256dh, auth),
                () -> subscriptionRepository.save(PushSubscriptionEntity.builder()
                        .user(user).endpoint(endpoint).p256dh(p256dh).auth(auth).build()));
    }

    /** 구독 해제. 내 구독만 지운다 (없으면 그냥 성공) */
    @Transactional
    public void unsubscribe(String email, String endpoint) {
        if (endpoint == null || endpoint.isBlank()) return;
        subscriptionRepository.findByEndpoint(endpoint.trim())
                .filter(s -> s.getUser().getEmail().equals(email))
                .ifPresent(subscriptionRepository::delete);
    }

    /**
     * 사용자의 모든 브라우저로 알림을 보낸다. 만료된 구독은 지운다.
     * 내용 형식은 프론트 public/sw.js: { title, body, url, tag }
     * @return 보낸 브라우저 수
     */
    @Transactional
    public int sendToUser(Long userId, String title, String body, String url, String tag) {
        if (!webPushSender.isConfigured()) return 0;
        List<PushSubscriptionEntity> subs = subscriptionRepository.findByUserId(userId);
        if (subs.isEmpty()) return 0;

        Map<String, String> payload = new LinkedHashMap<>();
        payload.put("title", title);
        payload.put("body", body);
        if (url != null) payload.put("url", url);
        if (tag != null) payload.put("tag", tag);
        String json = objectMapper.writeValueAsString(payload);

        int sent = 0;
        for (PushSubscriptionEntity s : subs) {
            WebPushSender.Result result = webPushSender.send(s.getEndpoint(), s.getP256dh(), s.getAuth(), json);
            if (result == WebPushSender.Result.SENT) sent++;
            if (result == WebPushSender.Result.GONE) {
                log.info("만료된 푸시 구독 삭제: id={}", s.getId());
                subscriptionRepository.delete(s);
            }
        }
        return sent;
    }

    private static void validate(PushSubscribeRequest r) {
        if (r == null || r.endpoint() == null || !r.endpoint().trim().startsWith("https://")
                || r.keys() == null || r.keys().p256dh() == null || r.keys().auth() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "구독 정보가 올바르지 않습니다.");
        }
        if (r.endpoint().trim().length() > 700) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "구독 주소가 너무 깁니다.");
        }
        try {
            WebPushCrypto.publicKey(WebPushCrypto.decode(r.keys().p256dh()));
            if (WebPushCrypto.decode(r.keys().auth()).length != 16) throw new IllegalArgumentException();
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "구독 키가 올바르지 않습니다.");
        }
    }
}
