package com.jobgenius.config;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.BucketConfiguration;
import io.github.bucket4j.Refill;
import io.github.bucket4j.distributed.ExpirationAfterWriteStrategy;
import io.github.bucket4j.distributed.proxy.ProxyManager;
import io.github.bucket4j.redis.lettuce.cas.LettuceBasedProxyManager;
import io.lettuce.core.ClientOptions;
import io.lettuce.core.RedisClient;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.codec.RedisCodec;
import io.lettuce.core.resource.DnsResolvers;
import io.lettuce.core.resource.DefaultClientResources;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;
import java.util.function.Supplier;

@Configuration
public class BucketConfig {
        @Value("${REDIS_HOST}")
        private String redisHost;

        @Value("${REDIS_PORT}")
        private int redisPort;

        @Bean(destroyMethod = "shutdown")
        public DefaultClientResources redisClientResources() {
                return DefaultClientResources.builder()
                        .dnsResolver(DnsResolvers.JVM_DEFAULT)
                        .build();
        }

        @Bean(destroyMethod = "shutdown")
        public RedisClient redisClient() {
                RedisClient client = RedisClient.create("redis://" + redisHost + ":" + redisPort);

                client.setOptions(
                        ClientOptions.builder()
                                .autoReconnect(true)
                                .build()
                );

                return client;
        }

        @Bean(destroyMethod = "close")
        public StatefulRedisConnection<String, byte[]> redisConnection(RedisClient redisClient) {
                return redisClient.connect(RedisCodec.of(
                        new io.lettuce.core.codec.StringCodec(), new io.lettuce.core.codec.ByteArrayCodec()));
        }

        @Bean
        public ProxyManager<String> proxyManager(
                        StatefulRedisConnection<String, byte[]> connection
        ) { // Configure Redis connection for Bucket4j
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
