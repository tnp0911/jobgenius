package com.jobgenius.repositories;

import com.jobgenius.models.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    Optional<Payment> findByProviderPaymentRef(String providerPaymentRef);

    @Query("""
            select p.providerPaymentRef
            from Payment p
            where p.user.uid = :uid
            """)
    List<String> findAllProviderPaymentRefByUserUid(@Param("uid") Long uid);

    List<Payment> findByUser_Uid(Long uid);

    List<Payment> findByUser_UidAndStatus(Long uid, String status);
}
