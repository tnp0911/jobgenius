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
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api")
public class UserController {
    private final UserService userService;
    private final SecurityService securityService;

    private final Logger logger = LoggerFactory.getLogger(UserController.class);

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
}
