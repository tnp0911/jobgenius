package com.jobgenius.security;

import io.github.bucket4j.BucketConfiguration;
import io.github.bucket4j.distributed.proxy.ProxyManager;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.function.Supplier;

@RequiredArgsConstructor
@Component
public class RateLimitingFilter extends OncePerRequestFilter {
    private final ProxyManager<String> proxyManager;
    private final Supplier<BucketConfiguration> bucketConfigurationSupplier;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain)
            throws IOException, ServletException {
        Cookie[] cookies = request.getCookies();
        String anonymousUuid = "";
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if (cookie.getName().equals("access_token")) {
                    filterChain.doFilter(request, response); // Skip rate limiting for authenticated users
                    return;
                }
                if (cookie.getName().equals("anonymous_uuid")) {
                    anonymousUuid = cookie.getValue();
                }
            }
        }
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty()) {
            ip = request.getRemoteAddr();
        } else {
            // X-Forwarded-For can contain multiple IPs; the first one is the client
            ip = ip.split(",")[0].trim();
        }
        String anonymousKey = anonymousUuid + "_" + ip; // Combine anonymousUuid and IP to create a unique key
        String fullAnonymousKey = "spring_rate_limit:" + anonymousKey;
        // Get or create bucket for the client's IP address and anonymousUuid
        var bucket = proxyManager.builder().build(fullAnonymousKey, bucketConfigurationSupplier);

        if (bucket.tryConsume(1)) { // Consume 1 token for the request
            filterChain.doFilter(request, response); // Allow request to proceed
        } else {
            response.setStatus(429); // Too Many Requests
            response.getWriter().write("Too many requests. Please try again later.");
        }
    }
}
