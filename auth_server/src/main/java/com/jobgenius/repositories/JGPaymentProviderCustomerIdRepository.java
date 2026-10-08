package com.jobgenius.repositories;

import com.jobgenius.models.JGPaymentProviderCustomerId;
import com.jobgenius.models.PaymentProviderCusIdCompositeKey;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface JGPaymentProviderCustomerIdRepository extends JpaRepository<JGPaymentProviderCustomerId, PaymentProviderCusIdCompositeKey> {

    @Query("""
            select j.id.providerCustomerRef
            from JGPaymentProviderCustomerId j
            where j.user.uid = :userId and j.provider = :provider
            """)
    Optional<String> findProviderCustomerRefByUserIdAndProvider(
            @Param("userId") Long userId,
            @Param("provider") String provider);
}
