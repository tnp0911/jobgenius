package com.jobgenius.controllers;

import com.jobgenius.dto.UserResponse;
import com.jobgenius.dto.UserResponseAdmin;
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
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api")
public class UserController {
    private final UserService userService;
    private final SecurityService securityService;
    private final PasswordEncoder passwordEncoder;

    private Logger logger = LoggerFactory.getLogger(UserController.class);

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/users")
    public ResponseEntity<?> getAllUsers(Authentication auth) {
        try {
            List<User> users = userService.getAllUsers();
            // Filter output to return only the required fields for each user
            List<UserResponseAdmin> userResponses = users.stream()
                    .map(user -> new UserResponseAdmin(
                            user.getUid(),
                            user.getName(),
                            user.getEmail(),
                            user.getRole(),
                            user.getProvider(),
                            user.isFastAPISync()
                    ))
                    .toList();
            return ResponseEntity.ok(userResponses);
        }
        catch (Exception e) {
            logger.error("Error occurred while fetching all users: {}", e.getMessage(), e);
            return ResponseEntity.status(500)
                    .body(Map.of(
                        "error", "INTERNAL_SERVER_ERROR",
                        "message", e.getMessage()
                    ));
        }
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/users/{uid}")
    public ResponseEntity<?> getUserById(@PathVariable Long uid) {
        if (securityService.isOwner(uid)) {
            User user = userService.getUserById(uid);
            return ResponseEntity.ok(user);
        } else {
            User user = userService.getUserById(uid);
            if (user == null) {
                return ResponseEntity.status(404)
                        .body(Map.of(
                                "error", "NOT_FOUND",
                                "message", "User not found with id: " + uid
                        ));
            }
            String name = user.getName();
            return ResponseEntity.status(403)
                    .body(Map.of(
                            "error", "FORBIDDEN",
                            "message", "Access denied. You are not authorized to access user " + name + "'s information."
                    ));
        }
    }

    @GetMapping("/users/me")
    public ResponseEntity<UserResponse> getCurrentUser(Authentication auth) {
        User user = userService.getUserByEmail((String) auth.getPrincipal());
        UserResponse userResponse = new UserResponse(user.getName(), user.getEmail());
        return ResponseEntity.ok(userResponse);
    }

    @PreAuthorize("isAuthenticated()")
    @PatchMapping("/users/me/password")
    public ResponseEntity<?> updatePassword(Authentication auth, @RequestBody Map<String, String> requestBody) {
        try {
            String email = (String) auth.getPrincipal();
            User user = userService.getUserByEmail(email);
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

    @PatchMapping("/users/forgot-password")
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
