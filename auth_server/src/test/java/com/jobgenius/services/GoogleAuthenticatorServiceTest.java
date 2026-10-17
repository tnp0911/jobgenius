package com.jobgenius.services;

import com.warrenstrange.googleauth.GoogleAuthenticator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.junit.jupiter.MockitoExtension;
import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class GoogleAuthenticatorServiceTest {
    @InjectMocks
    GoogleAuthenticatorService googleAuthenticatorService;

    @Test
    void isValid_returnFalseForNullSecret() {
        String secret = null;
        int code = 123456;
        boolean res = googleAuthenticatorService.isValid(secret, code);

        assertFalse(res);
    }

    @Test
    void isValid_returnFalseForBlankSecret() {
        String secret = "";
        int code = 123456;
        boolean res = googleAuthenticatorService.isValid(secret, code);

        assertFalse(res);
    }

    @Test
    void isValid_returnFalseForBlankWhiteSpaceSecret() {
        String secret = "          ";
        int code = 123456;
        boolean res = googleAuthenticatorService.isValid(secret, code);

        assertFalse(res);
    }

    @Test
    void generateKey_returnsNonNullKey() {
        String key = googleAuthenticatorService.generateKey();

        assertNotNull(key);
        assertFalse(key.isBlank());
    }

    @Test
    void isValid_returnTrueForValidCode() {
        String secret = googleAuthenticatorService.generateKey();
        int code = new GoogleAuthenticator().getTotpPassword(secret);
        boolean res = googleAuthenticatorService.isValid(secret, code);

        assertTrue(res);
    }

    @Test
    void isValid_returnFalseForInvalidCode() {
        String secret = googleAuthenticatorService.generateKey();
        int code = 123456; // Invalid code
        boolean res = googleAuthenticatorService.isValid(secret, code);

        assertFalse(res);
    }

    @Test
    void getQRBarcodeURL_returnNonNull() {
        String username = "user@test.com";
        String secret = googleAuthenticatorService.generateKey();
        String barCode = googleAuthenticatorService.getQRBarcodeURL(username, secret);

        assertNotNull(barCode);
        assertFalse(barCode.isBlank());
        assertInstanceOf(String.class, barCode);
    }
}