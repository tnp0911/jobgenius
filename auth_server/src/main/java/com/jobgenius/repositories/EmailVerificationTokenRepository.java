package com.jobgenius.repositories;

import com.jobgenius.models.EmailVerificationToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EmailVerificationTokenRepository extends JpaRepository<EmailVerificationToken, Long> {
    Optional<EmailVerificationToken> findByTokenHash(String tokenHash);

    Optional<EmailVerificationToken> findTopByUser_UidOrderByCreatedAtDesc(Long uid);

    void deleteByUser_Uid(Long uid);
}
