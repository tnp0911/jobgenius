package com.jobgenius.controllers;

import com.jobgenius.dto.EmailVerificationRequest;
import com.jobgenius.exceptions.EmailAlreadyVerifiedException;
import com.jobgenius.exceptions.ResendCooldownException;
import com.jobgenius.models.User;
import com.jobgenius.repositories.UserRepository;
import com.jobgenius.services.mailing.EmailVerificationService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class EmailVerificationController {
    private final EmailVerificationService emailVerificationService;
    private final UserRepository userRepository;

    private final Logger logger = LoggerFactory.getLogger(EmailVerificationController.class);

    @PostMapping("/send-verification-email")
    public ResponseEntity<?> sendVerificationEmail(@RequestBody EmailVerificationRequest request) {
        try {
            User user = userRepository.findByEmail(request.getEmail())
                    .orElse(null);

            if (user == null) {
                return ResponseEntity.status(404).body(Map.of(
                        "error", "USER_NOT_FOUND",
                        "message", "User not found"
                ));
            }

            emailVerificationService.sendVerificationEmail(user);
            return ResponseEntity.ok(Map.of(
                    "message", "Verification email has been sent successfully to " + user.getEmail()
            ));
        } catch (EmailAlreadyVerifiedException e) {
            return ResponseEntity.status(409).body(Map.of(
                    "error", "EMAIL_ALREADY_VERIFIED",
                    "message", e.getMessage()
            ));
        } catch (Exception e) {
            logger.error("Error sending verification email: {}", e.getMessage());
            return ResponseEntity.status(500).body(Map.of(
                    "error", "INTERNAL_SERVER_ERROR",
                    "message", e.getMessage()
            ));
        }
    }

    @GetMapping("/verify-email")
    public ResponseEntity<?> verifyEmail(@RequestParam("token") String token) {
        try {
            emailVerificationService.verify(token);
            return ResponseEntity.ok(Map.of(
                    "message", "Email has been verified successfully."
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(400).body(Map.of(
                    "error", "BAD_REQUEST",
                    "message", e.getMessage()
            ));
        } catch (Exception e) {
            logger.error("Error verifying email: {}", e.getMessage());
            return ResponseEntity.status(500).body(Map.of(
                    "error", "INTERNAL_SERVER_ERROR",
                    "message", e.getMessage()
            ));
        }
    }

    @PostMapping("/resend-verification-email")
    public ResponseEntity<?> resendVerificationEmail(@RequestBody EmailVerificationRequest request) {
        try {
            emailVerificationService.resend(request.getEmail());
            return ResponseEntity.ok(Map.of(
                    "message", "Verification email has been resent successfully to " + request.getEmail()
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of(
                    "error", "USER_NOT_FOUND",
                    "message", e.getMessage()
            ));
        } catch (EmailAlreadyVerifiedException e) {
            return ResponseEntity.status(409).body(Map.of(
                    "error", "EMAIL_ALREADY_VERIFIED",
                    "message", e.getMessage()
            ));
        } catch (ResendCooldownException e) {
            return ResponseEntity.status(429).body(Map.of(
                    "error", "RESEND_COOLDOWN",
                    "message", e.getMessage()
            ));
        } catch (Exception e) {
            logger.error("Error resending verification email: {}", e.getMessage());
            return ResponseEntity.status(500).body(Map.of(
                    "error", "INTERNAL_SERVER_ERROR",
                    "message", e.getMessage()
            ));
        }
    }
}
