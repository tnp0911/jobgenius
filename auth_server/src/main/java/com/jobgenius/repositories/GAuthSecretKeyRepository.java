package com.jobgenius.repositories;

import com.jobgenius.models.GAuthSecretKey;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface GAuthSecretKeyRepository extends JpaRepository<GAuthSecretKey, Long> {
    Optional<GAuthSecretKey> findByUser_Uid(Long uid);
}
