package com.jobgenius.repositories;

import com.jobgenius.models.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);

    Boolean existsByEmail(String email);

    List<User> findByFastAPISyncFalse();

    @Query(value = """
    SELECT DISTINCT u.uid FROM users u
    JOIN payments p ON p.uid = u.uid
    JOIN payment_metadata pm ON pm.payment_id = p.payment_id
    WHERE pm.period_end < CURRENT_TIMESTAMP AND p.status = 'PAID'
        AND NOT EXISTS (
            SELECT 1 FROM payments p2
            JOIN payment_metadata pm2 ON pm2.payment_id = p2.payment_id
            WHERE p2.uid = u.uid AND pm2.period_end >= CURRENT_TIMESTAMP
        )
    """, nativeQuery = true)
    List<Long> findAllUserIdsHavingExpiredPlan();

    // Update password
    @Modifying
    @Query(value = """
    UPDATE users SET password = :password WHERE email = :email
    """, nativeQuery = true)
    void updatePassword(@Param("email") String email, @Param("password") String password);
}
