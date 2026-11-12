package com.jobgenius.utils;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

@Component
@RequiredArgsConstructor
public class FrontendLinkBuilder {
    @Value("${FRONTEND_URL}")
    private String frontendUrl;
    public String buildVerificationLink(String rawToken, String path) {
        return UriComponentsBuilder
                .fromUriString(frontendUrl)
                .path(path)
                .queryParam("token", rawToken)
                .build()
                .encode()
                .toUriString();
    }
}
