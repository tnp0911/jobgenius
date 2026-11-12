package com.jobgenius.services;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@RequiredArgsConstructor
@Service
public class RedisService {
    private final StringRedisTemplate redisTemplate;

    private static final String BLACKLIST_PREFIX = "blacklist:";
    private static final String FORGOT_PASSWORD_VERIFICATION_TOKEN_PREFIX = "forgot_password_verification_token:";

    public void addToBlacklist(String token, long ttl) {
        redisTemplate.opsForValue().set(
                BLACKLIST_PREFIX + token, "1", ttl, TimeUnit.MILLISECONDS);
    }

    public boolean isBlacklisted(String token) {
        return Boolean.TRUE.equals(
                redisTemplate.hasKey(BLACKLIST_PREFIX + token));
    }

    public void addForgotPasswordVerificationToken(String token, String email, long ttl) {
        redisTemplate.opsForValue().set(
                FORGOT_PASSWORD_VERIFICATION_TOKEN_PREFIX + token, email, ttl, TimeUnit.MILLISECONDS);
    }

    public String getEmailByForgotPasswordVerificationToken(String token) {
        return redisTemplate.opsForValue().get(FORGOT_PASSWORD_VERIFICATION_TOKEN_PREFIX + token);
    }
}
