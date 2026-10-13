package com.jobgenius.services.mailing;

import com.jobgenius.exceptions.EmailAlreadyVerifiedException;
import com.jobgenius.exceptions.ResendCooldownException;
import com.jobgenius.models.EmailVerificationToken;
import com.jobgenius.models.User;
import com.jobgenius.repositories.EmailVerificationTokenRepository;
import com.jobgenius.repositories.UserRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.HexFormat;

@Service
@RequiredArgsConstructor
public class EmailVerificationService {
    @Value("${FRONTEND_URL}")
    private String frontendUrl;

    private static final int TOKEN_EXPIRATION_TIME = 24;
    private static final int RESEND_COOLDOWN_TIME = 5;

    private final EmailService emailService;
    private final EmailVerificationTokenRepository emailVerificationTokenRepository;
    private final UserRepository userRepository;

    private static final SecureRandom RANDOM = new SecureRandom();
    private String generateToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);

        return Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(bytes);
    }

    private String hashToken(String token) {
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

    private String buildVerificationLink(String rawToken) {
        return UriComponentsBuilder
                .fromUriString(frontendUrl)
                .path("/register/verify_email")
                .queryParam("token", rawToken)
                .build()
                .encode()
                .toUriString();
    }

    private void createAndSendToken(User user) {
        // Remove the previous token before creating a new one.
        emailVerificationTokenRepository.deleteByUser_Uid(user.getUid());
        emailVerificationTokenRepository.flush();

        String rawToken = generateToken();
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        EmailVerificationToken token = new EmailVerificationToken();
        token.setUser(user);
        token.setTokenHash(hashToken(rawToken));
        token.setCreatedAt(now);
        token.setExpiresAt(now.plusHours(TOKEN_EXPIRATION_TIME));
        emailVerificationTokenRepository.save(token);

        String link = buildVerificationLink(rawToken);
        String plainText = """
                Hi there,

                Thank you for signing up to JobGenius!

                Please verify your account by opening this link:
                %s

                This link will expire in %d hours.

                If you did not request this verification, please ignore this email.

                Best regards,
                The JobGenius Team
                """.formatted(link, TOKEN_EXPIRATION_TIME);

        String htmlBody = """
                <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#1f2937;max-width:560px;margin:0 auto;padding:24px;">
                  <p style="margin:0 0 16px;">Hi there,</p>
                  <p style="margin:0 0 16px;">Thank you for signing up to JobGenius!</p>
                  <p style="margin:0 0 24px;">Please click the button below to verify your account:</p>
                  <p style="margin:0 0 24px;text-align:center;">
                    <a href="%s"
                       style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px;">
                      Verify my email
                    </a>
                  </p>
                  <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">
                    This link will expire in %d hours.
                  </p>
                  <p style="margin:0 0 16px;">If you did not request this verification, please ignore this email.</p>
                  <p style="margin:0;">Best regards,<br>The JobGenius Team</p>
                </div>
                """.formatted(link, TOKEN_EXPIRATION_TIME);

        emailService.sendHtmlEmail(
                user.getEmail(),
                "Verify your JobGenius account",
                plainText,
                htmlBody
        );
    }

    @Transactional
    public void sendVerificationEmail(User user) {
        if (user.isVerified()) {
            throw new EmailAlreadyVerifiedException();
        }

        createAndSendToken(user);
    }

    @Transactional
    public void verify(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new IllegalArgumentException(
                    "Verification token is required."
            );
        }
        EmailVerificationToken token =
                emailVerificationTokenRepository.findByTokenHash(hashToken(rawToken))
                        .orElseThrow(() ->
                                new IllegalArgumentException(
                                        "Invalid or expired verification link."
                                ));

        if (!token.getExpiresAt().isAfter(OffsetDateTime.now(ZoneOffset.UTC))) {
            throw new IllegalArgumentException(
                    "Invalid or expired verification link."
            );
        }

        User user = token.getUser();
        user.setVerified(true);
        userRepository.save(user);

        emailVerificationTokenRepository.delete(token);
    }

    @Transactional
    public void resend(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException(
                        "No user found with the provided email."
                ));

        if (user.isVerified()) {
            throw new EmailAlreadyVerifiedException();
        }

        EmailVerificationToken existingToken = emailVerificationTokenRepository
                .findTopByUser_UidOrderByCreatedAtDesc(user.getUid())
                .orElse(null);

        if (existingToken != null) {
            long minutesSinceLastSent = Duration.between(
                    existingToken.getCreatedAt(),
                    OffsetDateTime.now(ZoneOffset.UTC)
            ).toMinutes();
            if (minutesSinceLastSent < RESEND_COOLDOWN_TIME) {
                throw new ResendCooldownException(RESEND_COOLDOWN_TIME);
            }
        }

        createAndSendToken(user);
    }
}