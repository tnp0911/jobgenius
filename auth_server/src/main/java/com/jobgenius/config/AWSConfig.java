package com.jobgenius.config;


import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

import java.net.URI;

@Configuration
public class AWSConfig {
    @Value("${AWS_REGION:us-east-1}")
    private String region;

    @Value("${LOCALSTACK_URI:http://localhost:4566}")
    private String localstackEndpoint;

    @Bean
    public S3Client s3Client() {
        return S3Client.builder()
                .region(Region.of(region))
                .credentialsProvider(DefaultCredentialsProvider.create())
                .endpointOverride(URI.create(localstackEndpoint))
                .forcePathStyle(true)
                .build();
    }
}
