package com.jobgenius.models;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;

@Embeddable
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class PaymentProviderCusIdCompositeKey implements Serializable {

    @Column(name = "uid")
    private Long uid;

    @Column(name = "provider_customer_ref")
    private String providerCustomerRef;
}
