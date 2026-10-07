package com.jobgenius.services;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CleanupService {
    private final MongoClient mongoClient;
    private final S3Client s3Client;
    private final Logger logger = LoggerFactory.getLogger(CleanupService.class);
    @Value("${S3_BUCKET_NAME}")
    private String bucketName;

    @Scheduled(fixedRate = 24 * 60 * 60 * 1000) // Run once a day
    public void cleanupOldData() {
        MongoDatabase db = mongoClient.getDatabase("job_recommendation_system");
        MongoCollection<Document> collection = db.getCollection("resumes");

        // Find resumes having 3 months older than the created date. Except for the latest version of the resume for each user.
        long cutoffTime = System.currentTimeMillis() - 90L * 24 * 60 * 60 * 1000;
        Date cutoffDate = new Date(cutoffTime);

        List<Document> resumesToDelete = new ArrayList<>();

        /* Regular approach - Scaling disadvantage
        Document query = new Document("created_at", new Document("$lt", cutoffTime));
        collection.find(query).forEach(resume -> {
            String userId = resume.getString("user_id");
            // Check if this is the latest version of the resume for the user
            Document latestResume = collection.find(new Document("user_id", userId))
                    .sort(new Document("created_at", -1))
                    .first();
            if (latestResume != null && !latestResume.getObjectId("_id").equals(resume.getObjectId("_id"))) {
                resumesToDelete.add(resume);
            }
        });
         */

        // Optimized approach with aggregation pipeline
        List<Document> pipeline = List.of(

                // 1. Number each resume within each user.
                //    Newest resume gets rank = 1.
                new Document("$setWindowFields",
                        new Document("partitionBy", "$user_id")
                                .append("sortBy",
                                        new Document("created_at", -1))
                                .append("output",
                                        new Document("rank",
                                                new Document("$documentNumber",
                                                        new Document())))
                ),

                // 2. Create temporary isLatest field.
                new Document("$set",
                        new Document("isLatest",
                                new Document("$eq",
                                        List.of("$rank", 1)))
                ),

                // 3. Keep only old resumes that are NOT the latest.
                new Document("$match",
                        new Document("isLatest", false)
                                .append("created_at",
                                        new Document("$lt", cutoffDate)))
        );

        collection.aggregate(pipeline).forEach(resumesToDelete::add);

        // Delete the resumes from S3
        for (Document resumeToDelete : resumesToDelete) {
            String key = resumeToDelete.getString("storage_path");
            try {
                if (key != null && !key.isBlank()) {
                    s3Client.deleteObject(
                            DeleteObjectRequest.builder()
                                    .bucket(bucketName)
                                    .key(key)
                                    .build()
                    );
                }
                // Delete the resume from MongoDB
                collection.deleteOne(new Document("_id", resumeToDelete.getObjectId("_id")));
                logger.info("Deleted resume with ID {} from MongoDB, key in S3: {}", resumeToDelete.getObjectId("_id"), key);
            }
            catch (Exception e) {
                logger.error("Error deleting resume with ID {}: {}", resumeToDelete.getObjectId("_id"), e.getMessage());
            }
        }
    }
}
