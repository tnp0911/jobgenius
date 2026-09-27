package com.jobgenius.config;

import com.jobgenius.models.RefreshToken;
import com.jobgenius.models.User;
import com.jobgenius.repositories.RefreshTokenRepository;
import com.jobgenius.repositories.UserRepository;
import com.jobgenius.security.APIKeyFilter;
import com.jobgenius.security.APILoggingFilter;
import com.jobgenius.security.JwtAuthFilter;
import com.jobgenius.security.RateLimitingFilter;
import com.jobgenius.services.JwtService;
import com.jobgenius.services.UserService;
import com.jobgenius.utils.TokenHelper;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfigurationSource;

import java.util.Date;
import java.util.Objects;

@RequiredArgsConstructor
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    @Value("${REACT_URL}")
    private String reactUrl;
    private final APILoggingFilter apiLoggingFilter;
    private final JwtAuthFilter jwtAuthFilter;
    private final RateLimitingFilter rateLimitingFilter;
    private final UserService userService;
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtService jwtService;
    private final APIKeyFilter apiKeyFilter;
    private final TokenHelper tokenHelper;
    private final Logger logger = LoggerFactory.getLogger(SecurityConfig.class);

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // CORS config:
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        org.springframework.web.cors.CorsConfiguration configuration = new org.springframework.web.cors.CorsConfiguration();
        configuration.setAllowedOrigins(java.util.List.of("http://localhost:3000")); // Adjust as needed for frontend URL
        configuration.setAllowedMethods(java.util.List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(java.util.List.of("Content-Type"));
        configuration.setAllowCredentials(true);
        org.springframework.web.cors.UrlBasedCorsConfigurationSource source = new org.springframework.web.cors.UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .authorizeHttpRequests(auth -> auth
                        // Allow unauthenticated access to auth endpoints and Stripe webhook
                        .requestMatchers(
                                "/auth/**",
                                "/api/stripe/webhook",
                                "/health",
                                "/anonymous_ready"
                                ).permitAll()
                        .anyRequest().authenticated())
                .oauth2Login(oauth2 -> oauth2
                        .userInfoEndpoint(userInfo -> userInfo.oidcUserService(oidcUserService()))
                        .successHandler((req, res, auth) -> {
                                OidcUser oidcUser = (OidcUser) auth.getPrincipal();
                                String email = oidcUser.getEmail();
                                User user = userRepository.findByEmail(email)
                                            .orElseThrow(() ->
                                                new RuntimeException("User not found"));
                                logger.info("OAuth2 login successful for user: {}",
                                        user.getEmail());

                                // Generate access token
                                String accessToken = jwtService.generateAccessToken(user);
                                String refreshTokenValue = jwtService.generateRefreshToken(user);

                                tokenHelper.refreshTokenList(user);

                                // Generate refresh token
                                RefreshToken refreshToken = new RefreshToken();
                                refreshToken.setRefreshToken(refreshTokenValue);
                                refreshToken.setUser(user);
                                refreshToken.setRevoked(false);
                                refreshToken.setCreatedAt(new Date());
                                refreshToken.setExpiryDate(new Date(System.currentTimeMillis()
                                        + 1000L * 60 * 60 * 24 * 7)); // 7 days
                                refreshToken.setSessionStartAt(new Date());
                                refreshTokenRepository.save(refreshToken);

                                ResponseCookie cookie = ResponseCookie
                                        .from("access_token", Objects.requireNonNull(accessToken))
                                        .httpOnly(true)
                                        .secure(true)
                                        .path("/")
                                        .sameSite("None") // REQUIRED for React cross-origin
                                        .maxAge(15 * 60)
                                        .build();

                                ResponseCookie refreshCookie = ResponseCookie
                                        .from("refresh_token", Objects.requireNonNull(refreshTokenValue))
                                        .httpOnly(true)
                                        .secure(true)
                                        .path("/auth/refresh") // Meaning: only send this cookie when the request is made to /auth/refresh endpoint
                                        .sameSite("None")
                                        .maxAge(7 * 24 * 60 * 60) // 7 days
                                        .build();

                                // remove anonymousUuid from cookie
                                ResponseCookie anonymousUuid = ResponseCookie
                                        .from("anonymous_uuid", "")
                                        .httpOnly(true)
                                        .secure(true)
                                        .path("/")
                                        .sameSite("None") // REQUIRED for React cross-origin
                                        .maxAge(0)
                                        .build();

                                // Return JSON response
                                res.setStatus(HttpServletResponse.SC_OK);
                                res.setContentType("application/json");
                                res.setCharacterEncoding("UTF-8");
                                res.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
                                res.addHeader(HttpHeaders.SET_COOKIE, refreshCookie.toString());
                                res.addHeader(HttpHeaders.SET_COOKIE,
                                        anonymousUuid.toString());
                        
                                res.sendRedirect(reactUrl); 
                                })
                                .failureUrl("http://localhost:3000/error") // Redirect after failed
                        // OAuth2 login, change this
                        // to client URL
                )
                .addFilterBefore(apiLoggingFilter, APIKeyFilter.class)
                .addFilterBefore(apiKeyFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(rateLimitingFilter, APIKeyFilter.class)
                .addFilterAfter(jwtAuthFilter, RateLimitingFilter.class)
                // Explanation: STATELESS/IF_REQUIRED
                // STATELESS policy
                // IF_REQUIRED policy
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(
                                (req, res, e) -> res.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Unauthorized"))
                        .accessDeniedHandler(
                                (req, res, e) -> res.sendError(HttpServletResponse.SC_FORBIDDEN, "Forbidden")))
                // Explanation: Disable default HTTP Basic auth, since we're using JWTs for
                // authentication. This prevents browsers from showing a login dialog when
                // accessing protected endpoints without a valid token.
                .httpBasic(httpBasic -> httpBasic.disable())

                // Explanation: Disable form-based login, as we are not using traditional
                // username/password form authentication. This ensures that Spring Security does
                // not attempt to handle login requests with a form, which is unnecessary in a
                // JWT-based stateless authentication setup.
                .formLogin(formLogin -> formLogin.disable())

                // Explanation: Disable logout functionality, since in a stateless JWT
                // authentication system, there is no server-side session to invalidate. Logout
                // can be handled on the client side by simply deleting the JWT token.
                .logout(logout -> logout.disable())

                .cors(cors -> cors.configurationSource(corsConfigurationSource())); // Enable CORS with the defined configuration
        return http.build();
    }

    // ---------------- OAuth 2.0 Login Configuration ----------------
    @Bean
    public OAuth2UserService<OidcUserRequest, OidcUser> oidcUserService() {

        OidcUserService delegate = new OidcUserService();

        return userRequest -> {
            OidcUser oidcUser = delegate.loadUser(userRequest);

            userService.saveOrUpdateOAuthUser(oidcUser);

            return oidcUser;
        };
    }
}