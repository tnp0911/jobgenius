package com.jobgenius.controllers;

import com.jobgenius.models.User;
import com.jobgenius.services.SecurityService;
import com.jobgenius.services.UserService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api")
public class PasswordModificationController {
    private final UserService userService;
    private final SecurityService securityService;
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

    @PatchMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody Map<String, String> requestBody) {
        try {
            String email = requestBody.get("email");
            if (email == null || email.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Map.of(
                                "error", "BAD_REQUEST",
                                "message", "Email is required"
                        ));
            }
            // Email verification should be implemented here
            // For now, just check if the email exists in the database then update the new password
            User user = userService.getUserByEmail(email);
            if (user == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of(
                                "error", "BAD_REQUEST",
                                "message", "Email does not exist"
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
            userService.updatePassword(email, newPassword);
            return ResponseEntity.ok("[FORGOT_PASSWORD] Password updated successfully");
        } catch (Exception e) {
            logger.error("Error occurred while updating password: {}", e.getMessage(), e);
            return ResponseEntity.status(500)
                    .body(Map.of(
                            "error", "INTERNAL_SERVER_ERROR",
                            "message", e.getMessage()
                    ));
        }
    }
}
