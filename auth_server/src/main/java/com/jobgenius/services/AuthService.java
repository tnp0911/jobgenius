package com.jobgenius.services;

import com.jobgenius.dto.FastAPICreateRequest;
import com.jobgenius.dto.LoginRequest;
import com.jobgenius.dto.RegisterRequest;
import com.jobgenius.models.RefreshToken;
import com.jobgenius.models.User;
import com.jobgenius.repositories.RefreshTokenRepository;
import com.jobgenius.repositories.UserRepository;
import com.jobgenius.utils.TokenHelper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Date;
import java.util.List;
import java.util.Map;

@RequiredArgsConstructor
@Service
public class AuthService {

    @Value("${API_KEY}")
    private String apiKey;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final RedisService redisService;
    private final WebClient webClient;
    private final Logger logger = LoggerFactory.getLogger(AuthService.class);
    private final TokenHelper tokenHelper;

    public void register(RegisterRequest registerRequest) {
        try {
            User user = userRepository.findByEmail(registerRequest.getEmail()).orElse(null);

            if (user != null) {
                if ("GOOGLE".equals(user.getProvider())) {
                    // MERGE: enable password login too
                    user.setPassword(passwordEncoder.encode(registerRequest.getPassword()));
                    user.setProvider("BOTH");
                    user.setVerified(true);
                }
            }

            else {
                user = new User();
                user.setName(registerRequest.getName());
                user.setEmail(registerRequest.getEmail());
                user.setPassword(passwordEncoder.encode(registerRequest.getPassword()));
            }
            user = userRepository.save(user);

            if (!user.isFastAPISync()) {
                webClient.post()
                        .uri("/internal/users/add")
                        .bodyValue(new FastAPICreateRequest(user.getUid()))
                        .retrieve()
                        .bodyToMono(String.class)
                        .block();

                user.setFastAPISync(true);
                userRepository.save(user);
            }
        } catch (Exception e) {
            logger.error("Error registering user: " + e.getMessage());
        }
    }

    public Map<String, String> login(LoginRequest loginRequest) {
        try {
            User user = userRepository.findByEmail(loginRequest.getEmail())
                    .orElseThrow(() -> new RuntimeException("User not found"));
            if (user.getPassword().equals("OAUTH2_USER") || "GOOGLE".equals(user.getProvider())
                    || user.getPassword() == null) {
                throw new RuntimeException("Error occurred during login. Please try again.");
            }
            if (!passwordEncoder.matches(loginRequest.getPassword(), user.getPassword())) {
                throw new RuntimeException("Invalid password");
            }
            // Generate access token
            String accessToken = jwtService.generateAccessToken(user);

            tokenHelper.refreshTokenList(user);

            String refreshTokenStr = jwtService.generateRefreshToken(user);
            // Generate refresh token
            RefreshToken refreshToken = new RefreshToken();
            refreshToken.setRefreshToken(refreshTokenStr);
            refreshToken.setUser(user);
            refreshToken.setRevoked(false);
            refreshToken.setCreatedAt(new Date());
            refreshToken.setExpiryDate(new Date(System.currentTimeMillis() + 1000L * 60 * 60 * 24 * 7)); // 7 days
            refreshToken.setSessionStartAt(new Date());
            refreshTokenRepository.save(refreshToken);

            Map<String, String> tokens = Map.of(
                    "accessToken", accessToken,
                    "refreshToken", refreshTokenStr);
            return tokens;
        } catch (Exception e) {
            throw new RuntimeException(e.getMessage());
        }
    }

    public void logout(String accessToken) {
        try {
            Long userId = jwtService.extractUserId(accessToken);
            // Store access token in redis with expiry same as token expiry
            long ttl = jwtService.extractExpiration(accessToken).getTime() - System.currentTimeMillis();
            redisService.addToBlacklist(accessToken, ttl);

            // Revoke refresh token in database
            List<RefreshToken> refreshTokenList = refreshTokenRepository.findByUser_UidAndRevokedFalse(userId);
            refreshTokenList.forEach(token -> {
                token.setRevoked(true);
                refreshTokenRepository.save(token);
            });
        } catch (Exception e) {
            throw new RuntimeException("Error logging out user: " + e.getMessage());
        }
    }
}