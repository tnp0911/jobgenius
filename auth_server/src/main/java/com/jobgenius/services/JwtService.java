package com.jobgenius.services;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;
import java.util.Map;

import com.jobgenius.models.RefreshToken;
import com.jobgenius.repositories.RefreshTokenRepository;
import org.slf4j.Logger;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.jobgenius.models.User;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import jakarta.transaction.Transactional;

@Service
public class JwtService {
    @Value("${jwt.secret}")
    private final String SECRET_KEY = System.getenv("JWT_SECRET_KEY");

    private final RefreshTokenRepository refreshTokenRepository;
    private static final Logger logger = org.slf4j.LoggerFactory.getLogger(JwtService.class);

    public JwtService(RefreshTokenRepository refreshTokenRepository) {
        this.refreshTokenRepository = refreshTokenRepository;
        if (SECRET_KEY == null || SECRET_KEY.isEmpty()) {
            throw new IllegalStateException("JWT_SECRET_KEY environment variable is not set");
        }
    }

    private Key getKey() {
        return Keys.hmacShaKeyFor(SECRET_KEY.getBytes(StandardCharsets.UTF_8));
    }

    public String generateAccessToken(User user) {
        return Jwts.builder()
                .setSubject(user.getEmail())
                .claim("role", user.getRole()) // Include role in the payload
                .claim("user_id", user.getUid()) // Include uid in the payload
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + 1000 * 60 * 15)) // 15 minutes
                .signWith(getKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    public String extractUsername(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getKey())
                .build()
                .parseClaimsJws(token)
                .getBody()
                .getSubject();
    }

    public String extractUserRole(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getKey())
                .build()
                .parseClaimsJws(token)
                .getBody()
                .get("role", String.class);
    }

    public Long extractUserId(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getKey())
                .build()
                .parseClaimsJws(token)
                .getBody()
                .get("user_id", Long.class);
    }

    public Date extractExpiration(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getKey())
                .build()
                .parseClaimsJws(token)
                .getBody()
                .getExpiration();
    }

    public boolean validateToken(String token) {
        Jwts.parserBuilder()
                .setSigningKey(getKey())
                .build()
                .parseClaimsJws(token);
        return true;
    }

    public String generateRefreshToken(User user) {
        return Jwts.builder()
                .setSubject(user.getEmail())
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + 1000 * 60 * 60 * 24 * 7)) // 7 days
                .signWith(getKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    @Transactional // For atomicity, ensure that the refresh token is revoked and the new token is generated in a single transaction
    public Map<String, String> refreshAccessToken(String refreshToken, User user) {
        RefreshToken token = refreshTokenRepository.findByRefreshToken(refreshToken)
                .orElseThrow(() -> new RuntimeException("Invalid refresh token"));

        if (token.isRevoked() || token.getExpiryDate().before(new Date())) {
            throw new RuntimeException("Refresh token is revoked or expired.");
        }

        if (!validateToken(refreshToken)) {
            throw new RuntimeException("Invalid refresh token");
        }

        token.setRevoked(true); // If the refresh token has been used once, revoke it to prevent reuse
        refreshTokenRepository.save(token);
        long MAX_SESSION_TIME = 30L * 24 * 60 * 60 * 1000; // 30 days

        if (System.currentTimeMillis() - token.getSessionStartAt().getTime() > MAX_SESSION_TIME) {
            throw new RuntimeException("Session expired. Please log in again.");
        }

        String newAccessToken = generateAccessToken(user);
        String newRefreshTokenStr = generateRefreshToken(user);
        // else generate new refresh token
        RefreshToken newToken = new RefreshToken();
        newToken.setRefreshToken(newRefreshTokenStr);
        newToken.setUser(user);
        newToken.setRevoked(false);
        newToken.setCreatedAt(new Date());
        newToken.setExpiryDate(new Date(System.currentTimeMillis() + 1000L * 60 * 60 * 24 * 7)); // 7 days
        newToken.setSessionStartAt(token.getSessionStartAt()); // Keep the original session start time
        refreshTokenRepository.save(newToken);

        return Map.of("access_token", newAccessToken, "refresh_token", newRefreshTokenStr);
    }

    @Transactional
    @Scheduled(fixedRate = 60 * 60 * 1000) // Run every hour
    public void cleanUpExpiredTokens() {
        Date now = new Date();
        int deleted = refreshTokenRepository.deleteByExpiryDateBeforeAndRevoked(now, true);
        logger.info("Cleaned up {} expired and revoked refresh tokens at {}", deleted, now);
    }
}
