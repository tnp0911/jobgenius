package com.jobgenius.security;

import com.jobgenius.services.JwtService;
import com.jobgenius.services.RedisService;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RequiredArgsConstructor
@Component
public class JwtAuthFilter extends OncePerRequestFilter {
    private final Logger logger = LoggerFactory.getLogger(JwtAuthFilter.class);
    private final JwtService jwtservice;
    private final RedisService redisService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String path = request.getServletPath();
        if (path.startsWith("/auth/")) { // Skip authentication for /auth/** endpoints
            filterChain.doFilter(request, response);
            return;
        }

        // If already authenticated, skip
        if (SecurityContextHolder.getContext().getAuthentication() != null) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = null;

        // 🍪 Extract JWT from cookies
        if (request.getCookies() != null) {
            for (jakarta.servlet.http.Cookie cookie : request.getCookies()) {
                if ("access_token".equals(cookie.getName())) {
                    token = cookie.getValue();
                    break;
                }
            }
        }

        // No token → continue filter chain
        if (token == null) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            if (jwtservice.validateToken(token) && !redisService.isBlacklisted(token)) {
                String username = jwtservice.extractUsername(token); // username is the email in this case
                String role = jwtservice.extractUserRole(token);
                Long userId = jwtservice.extractUserId(token);
                List<GrantedAuthority> authorities = List.of(
                        new SimpleGrantedAuthority("ROLE_" + role));
                UsernamePasswordAuthenticationToken authenticationToken = new UsernamePasswordAuthenticationToken(
                        username, null, authorities);
                Map<String, Long> details = Map.of("user_id", userId);
                authenticationToken.setDetails(details);
                SecurityContextHolder.getContext().setAuthentication(authenticationToken);
            }
        } 
        catch (ExpiredJwtException e) {
            logger.warn("JWT token has expired: {}", e.getMessage());
            response.setStatus(401);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\": \"ACCESS_TOKEN_EXPIRED\"}");
            return;
        }
        catch (JwtException e) {
            logger.error("JWT validation failed: {}", e.getMessage());
            response.setStatus(401);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\": \"INVALID_ACCESS_TOKEN\"}");
            return;
        }
        catch (Exception e) {
            logger.error("Unexpected error during JWT validation: {}", e.getMessage());
            response.setStatus(500);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\": \"INTERNAL_SERVER_ERROR\"}");
            return;
        }
        filterChain.doFilter(request, response);
    }

}
