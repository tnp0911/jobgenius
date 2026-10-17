package com.jobgenius.services;

import com.jobgenius.models.User;
import com.jobgenius.repositories.RefreshTokenRepository;
import com.jobgenius.utils.TokenHelper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class JwtServiceTest {
    @Mock
    RefreshTokenRepository refreshTokenRepository;

    @Mock
    TokenHelper tokenHelper;

    @InjectMocks
    private JwtService jwtService;

    User buildUser() {
        User user = new User();
        user.setUid(1L);
        user.setEmail("user@test.com");
        user.setPassword("hashed-password");
        user.setRole("USER");
        user.setProvider("LOCAL");
        return user;
    }

    @Test
    void generate2FAChallengeToken_containsSubjectAndIsValid() {
        User user = buildUser();

        String token = jwtService.generate2FAChallengeToken(user);

        assertNotNull(token);
        assertTrue(jwtService.validate2FAChallengeToken(token));
        assertEquals("user@test.com", jwtService.extractUsername(token));
        assertEquals(1L, jwtService.extractUserId(token));
    }

    @Test
    void validate2FAChallengeToken_returnsTrueForMfaToken() {
        String mfaToken = jwtService.generate2FAChallengeToken(buildUser());

        assertTrue(jwtService.validate2FAChallengeToken(mfaToken));
    }

    @Test
    void validate2FAChallengeToken_returnsFalseForAccessToken() {
        String accessToken = jwtService.generateAccessToken(buildUser());

        // Access tokens have no purpose=mfa_challenge claim
        assertFalse(jwtService.validate2FAChallengeToken(accessToken));
    }

    @Test
    void validate2FAChallengeToken_returnsFalseForGarbage() {
        assertFalse(jwtService.validate2FAChallengeToken("not-a-jwt"));
        assertFalse(jwtService.validate2FAChallengeToken(""));
        assertFalse(jwtService.validate2FAChallengeToken(null));
    }

    @Test
    void generateAccessToken_extractsClaims() {
        User user = buildUser();

        String accessToken = jwtService.generateAccessToken(user);

        assertEquals("user@test.com", jwtService.extractUsername(accessToken));
        assertEquals(1L, jwtService.extractUserId(accessToken));
        assertEquals("USER", jwtService.extractUserRole(accessToken));
        assertTrue(jwtService.validateToken(accessToken));
    }
}
