package com.bank.yaksok.api.push.entity;

import com.bank.yaksok.user.entity.UserEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/** 브라우저 한 곳의 웹 푸시 구독 정보 (한 사용자가 PC·노트북 등 여러 개 가질 수 있음) */
@Entity
@Table(name = "push_subscription")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class PushSubscriptionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    /** 푸시 서비스 주소 (브라우저마다 고유). MySQL 인덱스 길이 제한 때문에 700자 */
    @Column(nullable = false, unique = true, length = 700)
    private String endpoint;

    /** 브라우저 공개키 (keys.p256dh, base64url) */
    @Column(nullable = false, length = 200)
    private String p256dh;

    /** 인증 비밀값 (keys.auth, base64url) */
    @Column(nullable = false, length = 100)
    private String auth;

    @Column(updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    /** 같은 브라우저가 다시 구독하면 키와 사용자를 새 값으로 바꾼다 */
    public void update(UserEntity user, String p256dh, String auth) {
        this.user = user;
        this.p256dh = p256dh;
        this.auth = auth;
    }
}
