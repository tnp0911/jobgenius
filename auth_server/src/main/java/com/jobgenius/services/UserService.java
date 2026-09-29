package com.jobgenius.services;

import com.jobgenius.dto.FastAPICreateRequest;
import com.jobgenius.models.User;
import com.jobgenius.repositories.UserRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import com.jobgenius.utils.FastAPIUpdates;

import java.util.List;

@RequiredArgsConstructor
@Service
public class UserService {
    private final WebClient webClient;
    private final UserRepository userRepository;
    private final FastAPIUpdates fastAPIUpdates;
    private final PasswordEncoder passwordEncoder;
    private final Logger logger = LoggerFactory.getLogger(UserService.class);

    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    public User getUserByEmail(String email) {
        return userRepository.findByEmail(email).orElse(null);
    }

    public User getUserById(Long id) {
        return userRepository.findById(id).orElse(null);
    }

    @Transactional
    public void updatePassword(String email, String newPassword) {
        String newHashPassword = passwordEncoder.encode(newPassword);
        userRepository.updatePassword(email, newHashPassword);
    }

    @Transactional
    public void saveOrUpdateOAuthUser(OidcUser oidcUser) {
        String email = oidcUser.getEmail();
        userRepository.findByEmail(email)
                .map(existingUser -> {
                    existingUser.setName(oidcUser.getFullName());
                    return userRepository.save(existingUser);
                })
                .orElseGet(() -> {
                    User newUser = new User();
                    newUser.setEmail(email);
                    newUser.setName(oidcUser.getFullName());
                    newUser.setPassword("OAUTH2_USER");
                    newUser.setProvider("GOOGLE");
                    return userRepository.save(newUser);
                });
    }

    @Scheduled(fixedRate = 60000)
    public void fastAPISync() {
        List<User> unsyncedUsers = userRepository.findByFastAPISyncFalse();

        for (User user : unsyncedUsers) {
            try {
                webClient.post()
                        .uri("/internal/users/add")
                        .bodyValue(new FastAPICreateRequest(user.getUid()))
                        .retrieve()
                        .bodyToMono(String.class)
                        .block();

                user.setFastAPISync(true);
                userRepository.save(user);

                logger.info("Synced user {}", user.getEmail());

            } catch (Exception e) {
                logger.error("Failed syncing user {}: {}",
                        user.getEmail(), e.getMessage());
            }
        }
    }

    @Scheduled(fixedRate = 60000)
    public void fastAPISyncPlan() {
        List<Long> uids = userRepository.findAllUserIdsHavingExpiredPlan();

        for (Long uid: uids) {
            fastAPIUpdates.updatePlanFastAPI(uid.toString(), "FREE", "");
        }
    }
}