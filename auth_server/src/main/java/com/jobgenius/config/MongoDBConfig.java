package com.jobgenius.config;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;

@Configuration
public class MongoDBConfig {
    @Value("${MONGODB_URI}")
    private String mongodbUri;

    @Bean
    public MongoClient mongoClient() {
        return MongoClients.create(mongodbUri);
    }
}
