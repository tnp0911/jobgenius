package com.jobgenius.models;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "jg_paymentprovider_customerid", indexes = {
        @Index(name = "idx_jg_paymentprovider_customerid", columnList = "uid")
})
@Getter
@Setter
public class JGPaymentProviderCustomerId {
    @EmbeddedId
    private PaymentProviderCusIdCompositeKey id;

    @MapsId("uid")
    @ManyToOne
    @JoinColumn(name = "uid", nullable = false, foreignKey = @ForeignKey(name = "fk_jg_paymentprovider_customerid_user"))
    private User user;

    @Column(name = "provider")
    private String provider;
}
