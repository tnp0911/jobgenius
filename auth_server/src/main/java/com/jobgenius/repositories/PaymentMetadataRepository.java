package com.jobgenius.repositories;

import com.jobgenius.models.PaymentMetadata;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface PaymentMetadataRepository extends JpaRepository<PaymentMetadata, Long> {
    Optional<PaymentMetadata> findByPayment_PaymentId(Long paymentId);

    PaymentMetadata findByKeyAndValue(String key, String value);

    @Query(value = """
    SELECT pm.payment_metadata_value FROM payment_metadata pm
    JOIN payments p ON p.payment_id = pm.payment_id
    WHERE pm.period_end >= CURRENT_TIMESTAMP AND p.uid = :userId ORDER BY pm.period_end DESC LIMIT 1
    """, nativeQuery = true)
    Optional<String> findLatestSubscriptionIdByUserId(@Param("userId") Long userId);

    @Query(value = """
    SELECT COUNT(*) FROM payment_metadata pm
    JOIN payments p ON p.payment_id = pm.payment_id
    WHERE pm.amount = 0 AND p.uid = :userId
    """, nativeQuery = true)
    long existsFreeTrialByUserId(@Param("userId") Long userId);

    @Query(value = """
    SELECT COUNT(*) FROM payment_metadata pm
    JOIN payments p ON p.payment_id = pm.payment_id
    WHERE pm.amount > 0 AND p.uid = :userId AND pm.payment_metadata_value = :subscriptionId
    """, nativeQuery = true)
    long existsSubscriptionByUserIdAndSubscriptionId(@Param("userId") Long userId, @Param("subscriptionId") String subscriptionId);
}
