package com.bank.yaksok.api.push.repository;

import com.bank.yaksok.api.push.entity.PushSubscriptionEntity;
import com.bank.yaksok.user.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscriptionEntity, Long> {
    Optional<PushSubscriptionEntity> findByEndpoint(String endpoint);
    List<PushSubscriptionEntity> findByUserId(Long userId);
}
