package com.jobgenius.utils;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TotpSecretCipherTest {
    private TotpSecretCipher totpSecretCipher;

    @BeforeEach
    void setUp() {
        // Uses JWT_SECRET_KEY from surefire (pom.xml) when MFA_ENCRYPTION_KEY is unset
        totpSecretCipher = new TotpSecretCipher();
    }

    @Test
    void encrypt_decrypt_roundTrip() {
        String plaintext = "JBSWY3DPEHPK3PXP";

        String encrypted = totpSecretCipher.encrypt(plaintext);
        String decrypted = totpSecretCipher.decrypt(encrypted);

        assertTrue(encrypted.startsWith("enc:"));
        assertNotEquals(plaintext, encrypted);
        assertEquals(plaintext, decrypted);
    }

    @Test
    void encrypt_returnsNullForNull() {
        assertNull(totpSecretCipher.encrypt(null));
    }

    @Test
    void encrypt_returnsBlankUnchanged() {
        assertEquals("", totpSecretCipher.encrypt(""));
        assertEquals("   ", totpSecretCipher.encrypt("   "));
    }

    @Test
    void encrypt_doesNotDoubleEncrypt() {
        String plaintext = "JBSWY3DPEHPK3PXP";
        String encryptedOnce = totpSecretCipher.encrypt(plaintext);
        String encryptedTwice = totpSecretCipher.encrypt(encryptedOnce);

        assertEquals(encryptedOnce, encryptedTwice);
        assertEquals(plaintext, totpSecretCipher.decrypt(encryptedTwice));
    }

    @Test
    void decrypt_returnsLegacyPlaintextUnchanged() {
        String legacy = "LEGACY_PLAINTEXT_SECRET";

        assertFalse(legacy.startsWith("enc:"));
        assertEquals(legacy, totpSecretCipher.decrypt(legacy));
    }

    @Test
    void decrypt_returnsNullForNull() {
        assertNull(totpSecretCipher.decrypt(null));
    }

    @Test
    void decrypt_returnsBlankUnchanged() {
        assertEquals("", totpSecretCipher.decrypt(""));
    }
}
