package com.jobgenius.config;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.BucketConfiguration;
import io.github.bucket4j.Refill;
import io.github.bucket4j.distributed.ExpirationAfterWriteStrategy;
import io.github.bucket4j.distributed.proxy.ProxyManager;
import io.github.bucket4j.redis.lettuce.cas.LettuceBasedProxyManager;
import io.lettuce.core.RedisClient;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.codec.RedisCodec;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;

import java.time.Duration;
import java.util.function.Supplier;

@Configuration
public class BucketConfig {
        @Value("${REDIS_HOST}")
        private String redisHost;

        @Value("${REDIS_PORT}")
        private int redisPort;

        @Bean
        public ProxyManager<String> proxyManager() { // Configure Redis connection for Bucket4j
                RedisClient redisClient = RedisClient.create("redis://" + redisHost + ":" + redisPort);
                StatefulRedisConnection<String, byte[]> connection = redisClient.connect(RedisCodec.of(
                                new io.lettuce.core.codec.StringCodec(), new io.lettuce.core.codec.ByteArrayCodec()));
                return LettuceBasedProxyManager.builderFor(connection)
                                .withExpirationStrategy(
                                                ExpirationAfterWriteStrategy
                                                                .basedOnTimeForRefillingBucketUpToMax(
                                                                                java.time.Duration.ofMinutes(1)))
                                .build();
        }

        @Bean
        public Supplier<BucketConfiguration> bucketConfigurationSupplier() {
                return () -> BucketConfiguration.builder()
                                .addLimit(Bandwidth.classic(
                                                20,
                                                Refill.greedy(20, Duration.ofMinutes(1))))
                                .build();
        }
}
