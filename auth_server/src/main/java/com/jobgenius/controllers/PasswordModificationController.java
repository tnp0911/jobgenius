package com.jobgenius.controllers;

import com.jobgenius.models.User;
import com.jobgenius.services.AuthService;
import com.jobgenius.services.SecurityService;
import com.jobgenius.services.UserService;
import com.jobgenius.services.mailing.ForgotPassword_EmailService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RequiredArgsConstructor
@RestController
@RequestMapping("/auth")
public class PasswordModificationController {
    private final UserService userService;
    private final SecurityService securityService;
    private final AuthService authService;
    private final ForgotPassword_EmailService forgotPassword_emailService;
    private final PasswordEncoder passwordEncoder;

    private final Logger logger = LoggerFactory.getLogger(PasswordModificationController.class);
    @PreAuthorize("isAuthenticated()")
    @PatchMapping("/update-password")
    public ResponseEntity<?> updatePassword(Authentication auth, @RequestBody Map<String, String> requestBody) {
        try {
            String email = (String) auth.getPrincipal();
            User user = userService.getUserByEmail(email);
            if (!securityService.isOwner(user.getUid())) {
                return ResponseEntity.status(401)
                        .body(Map.of(
                                "error", "UNAUTHORIZED",
                                "message", "You must be the owner of this account to change the password"
                        ));
            }
            String oldPassword = requestBody.get("oldPassword");
            if (oldPassword == null || oldPassword.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Map.of(
                                "error", "BAD_REQUEST",
                                "message", "Old password is required"
                        ));
            }
            String newPassword = requestBody.get("newPassword");
            if (newPassword == null || newPassword.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Map.of(
                                "error", "BAD_REQUEST",
                                "message", "New password is required"
                        ));
            }
            if (!passwordEncoder.matches(oldPassword, user.getPassword())) {
                return ResponseEntity.badRequest()
                        .body(Map.of(
                                "error", "BAD_REQUEST",
                                "message", "Old password is incorrect"
                        ));
            }
            userService.updatePassword(email, newPassword);
            return ResponseEntity.ok("Password updated successfully");
        } catch (Exception e) {
            logger.error("Error occurred while updating password: {}", e.getMessage(), e);
            return ResponseEntity.status(500)
                    .body(Map.of(
                            "error", "INTERNAL_SERVER_ERROR",
                            "message", e.getMessage()
                    ));
        }
    }

    @PostMapping("/forgot-password-send-verification-link")
    public ResponseEntity<?> forgotPasswordSendVerificationLink(@RequestBody Map<String, String> requestBody) {
        try {
            String email = requestBody.get("email");
            if (email == null || email.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Map.of(
                                "error", "BAD_REQUEST",
                                "message", "Email is required"
                        ));
            }
            User user = userService.getUserByEmail(email);
            if (user == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of(
                                "error", "BAD_REQUEST",
                                "message", "Email does not exist"
                        ));
            }
            forgotPassword_emailService.sendForgotPasswordTokenVerificationLink(email);
            return ResponseEntity.ok(
                    Map.of(
                            "message", "Please check your email to proceed with the password reset process."
                    )
            );
        } catch (Exception e) {
            logger.error("Error occurred while updating password: {}", e.getMessage(), e);
            return ResponseEntity.status(500)
                    .body(Map.of(
                            "error", "INTERNAL_SERVER_ERROR",
                            "message", e.getMessage()
                    ));
        }
    }

    @PatchMapping("/forgot-password-update")
    public ResponseEntity<?> forgotPasswordUpdate(@RequestBody Map<String, String> requestBody) {
        String token = requestBody.get("token");
        Optional<String> email = authService.verifyForgotPasswordToken(token);
        if(email.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of(
                            "error", "BAD_REQUEST",
                            "message", "Invalid or expired token. Please submit a new request."
                    ));
        }
        String newPassword = requestBody.get("newPassword");
        if (newPassword == null || newPassword.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of(
                            "error", "BAD_REQUEST",
                            "message", "New password is required"
                    ));
        }
        userService.updatePassword(email.get(), newPassword);
        return ResponseEntity.ok(
                Map.of("message", "Password updated successfully")
        );
    }

}
