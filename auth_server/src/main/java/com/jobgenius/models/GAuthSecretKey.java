package com.jobgenius.models;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "gauth_secret_key", indexes = {
        @Index(name = "idx_user_id", columnList = "uid")
})
@Getter
@Setter
public class GAuthSecretKey {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "totp")
    private String totp;

    @Column(name = "pending_totp")
    private String pendingTotp;

    @Column(nullable = false)
    private boolean activated = false;

    @OneToOne
    @JoinColumn(name = "uid", nullable = false, foreignKey = @ForeignKey(name = "fk_gauth_user"))
    private User user;
}
