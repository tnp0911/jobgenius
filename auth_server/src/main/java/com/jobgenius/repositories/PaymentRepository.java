package com.jobgenius.repositories;

import com.jobgenius.models.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    Optional<Payment> findByProviderPaymentRef(String providerPaymentRef);

    Optional<List<String>> findAllProviderPaymentRefByUser_Uid(Long uid);

    List<Payment> findByUser_Uid(Long uid);

    List<Payment> findByUser_UidAndStatus(Long uid, String status);

}
