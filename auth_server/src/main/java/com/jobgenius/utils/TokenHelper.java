package com.jobgenius.utils;

import com.jobgenius.models.RefreshToken;
import com.jobgenius.models.User;
import com.jobgenius.repositories.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;

@Component
@RequiredArgsConstructor
public class TokenHelper {
    private static final Logger logger = org.slf4j.LoggerFactory.getLogger(TokenHelper.class);
    private final RefreshTokenRepository refreshTokenRepository;
    private static final SecureRandom RANDOM = new SecureRandom();

    // Revoke all refresh tokens for the user
    public void refreshTokenList(User user) {
        logger.info("Revoking all refresh tokens for user: {}", user.getUid());
        List<RefreshToken> refreshTokenList = refreshTokenRepository.findByUser_Uid(user.getUid());

        if (refreshTokenList.isEmpty()) {
            return;
        }
        List<RefreshToken> refreshUnrevokedTokenList = refreshTokenRepository.findByUser_UidAndRevokedFalse(user.getUid());
        if (!refreshUnrevokedTokenList.isEmpty()) {
            refreshUnrevokedTokenList.forEach(token -> token.setRevoked(true));
            refreshTokenRepository.saveAll(refreshUnrevokedTokenList);
        }
    }
    public String generateVerificationToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);

        return Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(bytes);
    }

    public String hashVerificationToken(String token) {
        try {
            MessageDigest digest =
                    MessageDigest.getInstance("SHA-256");

            byte[] hash = digest.digest(
                    token.getBytes(StandardCharsets.UTF_8)
            );

            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(
                    "SHA-256 is unavailable", e
            );
        }
    }
}
