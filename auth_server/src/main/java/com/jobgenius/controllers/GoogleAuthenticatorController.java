package com.jobgenius.controllers;

import com.jobgenius.dto.Login2FARequest;
import com.jobgenius.models.GAuthSecretKey;
import com.jobgenius.models.User;
import com.jobgenius.repositories.GAuthSecretKeyRepository;
import com.jobgenius.repositories.UserRepository;
import com.jobgenius.services.GoogleAuthenticatorService;
import com.jobgenius.services.JwtService;
import com.jobgenius.utils.TokenHelper;
import com.jobgenius.utils.TotpSecretCipher;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.Optional;

@RequiredArgsConstructor
@RestController
@RequestMapping("/auth")
public class GoogleAuthenticatorController {
    private final GoogleAuthenticatorService googleAuthenticatorService;
    private final UserRepository userRepository;
    private final GAuthSecretKeyRepository gAuthSecretKeyRepository;
    private final JwtService jwtService;
    private final TokenHelper tokenHelper;
    private final TotpSecretCipher totpSecretCipher;

    private final Logger logger = LoggerFactory.getLogger(GoogleAuthenticatorController.class);

    @PreAuthorize("isAuthenticated()")
    @PostMapping("/register-gauth")
    public ResponseEntity<?> registerGoogleAuthenticator(Authentication authentication) {
        try {
            User user = userRepository.findByEmail(authentication.getName())
                    .orElseThrow(() -> new Exception("User not found"));

            Optional<GAuthSecretKey> existing = gAuthSecretKeyRepository.findByUser_Uid(user.getUid());
            if (existing.isPresent() && existing.get().isActivated()) {
                return ResponseEntity.status(400).body("Google Authenticator is already registered for this user");
            }

            String secret = googleAuthenticatorService.generateKey();
            String qrCodeUrl = googleAuthenticatorService.getQRBarcodeURL(user.getEmail(), secret);
            if (qrCodeUrl == null) {
                return ResponseEntity.status(500).body("Error generating QR code");
            }

            String encryptedPending = totpSecretCipher.encrypt(secret);
            GAuthSecretKey gAuthSecretKey = existing.orElseGet(GAuthSecretKey::new);
            gAuthSecretKey.setUser(user);
            gAuthSecretKey.setPendingTotp(encryptedPending);
            gAuthSecretKey.setActivated(false);
            if (!existing.isPresent()) {
                gAuthSecretKey.setTotp(null);
            }
            gAuthSecretKeyRepository.save(gAuthSecretKey);

            Map<String, String> response = new HashMap<>();
            response.put("qrCodeUrl", qrCodeUrl);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Error registering Google Authenticator: {}", e.getMessage());
            return ResponseEntity.status(500).body("Error registering Google Authenticator");
        }
    }

    @PreAuthorize("isAuthenticated()")
    @PostMapping("/verify-gauth-for-registration")
    public ResponseEntity<?> verifyGAuthCode(Authentication authentication, @RequestBody Login2FARequest request) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Long> details = (Map<String, Long>) authentication.getDetails();
            Long userId = details.get("user_id");

            GAuthSecretKey gaKey = gAuthSecretKeyRepository.findByUser_Uid(userId)
                        .orElseThrow(() -> new NoSuchElementException("Google Authenticator secret key not found for user"));

            String pendingSecret = totpSecretCipher.decrypt(gaKey.getPendingTotp());
            boolean isCodeValid = googleAuthenticatorService.isValid(pendingSecret, request.getCode());

            if (isCodeValid) {
                gaKey.setTotp(gaKey.getPendingTotp());
                gaKey.setPendingTotp(null);
                gaKey.setActivated(true);
                gAuthSecretKeyRepository.save(gaKey);

                User user = gaKey.getUser();
                if (user == null) {
                    user = userRepository.findById(userId).orElse(null);
                }
                if (user != null) {
                    // Kill existing sessions so MFA cannot be bypassed via old refresh tokens
                    tokenHelper.refreshTokenList(user);
                }

                return ResponseEntity.ok("Google Authenticator code verified successfully");
            } else {
                return ResponseEntity.status(400).body("Invalid Google Authenticator code");
            }
        } catch (NoSuchElementException e) {
            logger.error("Error verifying Google Authenticator code: {}", e.getMessage());
            return ResponseEntity.status(404).body("Google Authenticator secret key not found for user");
        } catch (Exception e) {
            logger.error("Error verifying Google Authenticator code: {}", e.getMessage());
            return ResponseEntity.status(500).body("Error verifying Google Authenticator code");
        }
    }

    @PostMapping("/login-gauth")
    public ResponseEntity<?> loginWithGoogleAuthenticator(@RequestBody Login2FARequest login2FARequest,
                                                          HttpServletResponse response,
                                                          @CookieValue(value = "mfa_required_token") String mfaRequiredToken) {
        try {
            if (!jwtService.validate2FAChallengeToken(mfaRequiredToken)) {
                return ResponseEntity.status(401).body(
                        Map.of("error", "INVALID_CHALLENGE_TOKEN",
                                "message", "The provided MFA required token is invalid or expired"
                        )
                );
            }
            String userEmail = jwtService.extractUsername(mfaRequiredToken);
            User user = userRepository.findByEmail(userEmail)
                    .orElseThrow(() -> new Exception("User not found"));

            GAuthSecretKey gaKey = gAuthSecretKeyRepository.findByUser_Uid(user.getUid())
                    .orElseThrow(() -> new Exception("Google Authenticator secret key not found for user"));

            if (!gaKey.isActivated()) {
                return ResponseEntity.status(400).body("Google Authenticator is not activated for this user");
            }

            String totpSecret = totpSecretCipher.decrypt(gaKey.getTotp());
            boolean isCodeValid = googleAuthenticatorService.isValid(totpSecret, login2FARequest.getCode());

            if (isCodeValid) {
                Map<String, String> tokens = jwtService.generateTokensAfterAuthentication(user);
                String accessToken = tokens.get("accessToken");
                String refreshToken = tokens.get("refreshToken");
                ResponseCookie cookie = ResponseCookie.from("access_token", Objects.requireNonNull(accessToken))
                        .httpOnly(true)
                        .secure(true)
                        .path("/")
                        .sameSite("None")
                        .maxAge(15 * 60)
                        .build();

                ResponseCookie refreshCookie = ResponseCookie.from("refresh_token", Objects.requireNonNull(refreshToken))
                        .httpOnly(true)
                        .secure(true)
                        .path("/auth/refresh")
                        .sameSite("None")
                        .maxAge(7 * 24 * 60 * 60)
                        .build();

                ResponseCookie anonymousUuid = ResponseCookie.from("anonymous_uuid", "")
                        .httpOnly(true)
                        .secure(true)
                        .path("/")
                        .sameSite("None")
                        .maxAge(0)
                        .build();

                ResponseCookie mfaRequiredTokenCookie = ResponseCookie.from("mfa_required_token", "")
                        .httpOnly(true)
                        .secure(true)
                        .path("/auth/login-gauth")
                        .sameSite("None")
                        .maxAge(0)
                        .build();

                response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
                response.addHeader(HttpHeaders.SET_COOKIE, refreshCookie.toString());
                response.addHeader(HttpHeaders.SET_COOKIE, anonymousUuid.toString());
                response.addHeader(HttpHeaders.SET_COOKIE, mfaRequiredTokenCookie.toString());

                return ResponseEntity.ok("Login successful");
            } else {
                return ResponseEntity.status(400).body("Invalid Google Authenticator code");
            }
        } catch (Exception e) {
            logger.error("Error during Google Authenticator login: {}", e.getMessage());
            return ResponseEntity.status(500).body("Error during Google Authenticator login");
        }
    }

    @PreAuthorize("isAuthenticated()")
    @DeleteMapping("/disable-gauth")
    public ResponseEntity<?> disableGoogleAuthenticator(Authentication authentication,
                                                        @RequestBody Login2FARequest request) {
        try {
            User user = userRepository.findByEmail(authentication.getName())
                    .orElseThrow(() -> new Exception("User not found"));

            GAuthSecretKey gaKey = gAuthSecretKeyRepository.findByUser_Uid(user.getUid())
                    .orElseThrow(() -> new Exception("Google Authenticator secret key not found for user"));

            String totpSecret = totpSecretCipher.decrypt(gaKey.getTotp());
            if (!gaKey.isActivated() || !googleAuthenticatorService.isValid(totpSecret, request.getCode())) {
                return ResponseEntity.status(400).body(
                        Map.of("error", "INVALID_CODE",
                                "message", "Valid authenticator code is required to disable MFA")
                );
            }

            gAuthSecretKeyRepository.delete(gaKey);
            tokenHelper.refreshTokenList(user);

            return ResponseEntity.ok("Google Authenticator disabled successfully");
        } catch (Exception e) {
            logger.error("Error disabling Google Authenticator: {}", e.getMessage());
            return ResponseEntity.status(500).body("Error disabling Google Authenticator");
        }
    }
}
