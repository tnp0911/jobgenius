package com.jobgenius.services;

import com.jobgenius.dto.LoginRequest;
import com.jobgenius.models.GAuthSecretKey;
import com.jobgenius.models.User;
import com.jobgenius.repositories.GAuthSecretKeyRepository;
import com.jobgenius.repositories.RefreshTokenRepository;
import com.jobgenius.repositories.UserRepository;
import com.jobgenius.utils.TokenHelper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AuthServiceTest {
    @Mock
    UserRepository userRepository;
    @Mock
    JwtService jwtService;
    @Mock
    PasswordEncoder passwordEncoder;
    @Mock
    GAuthSecretKeyRepository gAuthSecretKeyRepository;
    @Mock
    RefreshTokenRepository refreshTokenRepository;
    @Mock
    RedisService redisService;
    @Mock
    WebClient webClient;
    @Mock
    TokenHelper tokenHelper;

    @InjectMocks
    AuthService authService;

    LoginRequest buildLoginRequest() {
        LoginRequest request = mock(LoginRequest.class);
        when(request.getEmail()).thenReturn("user@test.com");
        when(request.getPassword()).thenReturn("plain-password");
        return request;
    }

    User buildUser() {
        User user = new User();
        user.setUid(1L);
        user.setEmail("user@test.com");
        user.setPassword("hashed-password");
        user.setProvider("LOCAL");
        return user;
    }

    @Test
    void login_invalidPassword_throws() {
        LoginRequest request = buildLoginRequest();
        User user = buildUser();

        when(userRepository.findByEmail("user@test.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("plain-password", "hashed-password")).thenReturn(false);

        RuntimeException exception = assertThrows(
                RuntimeException.class,
                () -> authService.login(request)
        );

        assertEquals("Invalid email or password", exception.getMessage());
        verify(jwtService, never()).generate2FAChallengeToken(any());
        verify(jwtService, never()).generateTokensAfterAuthentication(any());
    }

    @Test
    void login_mfaActivated_returnsChallengeToken() {
        LoginRequest request = buildLoginRequest();
        User user = buildUser();

        GAuthSecretKey gaKey = new GAuthSecretKey();
        gaKey.setActivated(true);
        gaKey.setUser(user);

        when(userRepository.findByEmail("user@test.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("plain-password", "hashed-password")).thenReturn(true);
        when(gAuthSecretKeyRepository.findByUser_Uid(1L)).thenReturn(Optional.of(gaKey));
        when(jwtService.generate2FAChallengeToken(user)).thenReturn("mfa-jwt");

        Map<String, String> result = authService.login(request);

        assertEquals(1, result.size());
        assertEquals("mfa-jwt", result.get("mfaRequiredToken"));
        verify(jwtService).generate2FAChallengeToken(user);
        verify(jwtService, never()).generateTokensAfterAuthentication(any());
    }

    @Test
    void login_noMfa_returnsAccessAndRefreshTokens() {
        LoginRequest request = buildLoginRequest();
        User user = buildUser();

        when(userRepository.findByEmail("user@test.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("plain-password", "hashed-password")).thenReturn(true);
        when(gAuthSecretKeyRepository.findByUser_Uid(1L)).thenReturn(Optional.empty());
        when(jwtService.generateTokensAfterAuthentication(user)).thenReturn(
                Map.of("accessToken", "access-jwt", "refreshToken", "refresh-jwt")
        );

        Map<String, String> result = authService.login(request);

        assertEquals("access-jwt", result.get("accessToken"));
        assertEquals("refresh-jwt", result.get("refreshToken"));
        verify(jwtService).generateTokensAfterAuthentication(user);
        verify(jwtService, never()).generate2FAChallengeToken(any());
    }

    @Test
    void login_googleOnlyUser_throws() {
        LoginRequest request = buildLoginRequest();
        User user = buildUser();
        user.setProvider("GOOGLE");
        user.setPassword("OAUTH2_USER");

        when(userRepository.findByEmail("user@test.com")).thenReturn(Optional.of(user));

        RuntimeException exception = assertThrows(
                RuntimeException.class,
                () -> authService.login(request)
        );

        assertTrue(exception.getMessage().contains("Error occurred during login"));
        verify(passwordEncoder, never()).matches(anyString(), anyString());
        verify(jwtService, never()).generateTokensAfterAuthentication(any());
    }
}
