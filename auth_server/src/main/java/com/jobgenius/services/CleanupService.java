package com.jobgenius.services;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;

import java.util.ArrayList;

@Service
@RequiredArgsConstructor
public class CleanupService {
    private final MongoClient mongoClient;
    private final S3Client s3Client;
    @Value("${S3_BUCKET_NAME}")
    private String bucketName;

    @Scheduled(fixedRate = 86400000) // Run every 24 hours
    public void cleanupOldData() {
        MongoDatabase db = mongoClient.getDatabase("job_recommendation_system");
        MongoCollection<Document> collection = db.getCollection("resumes");

        // Find resumes having 3 months older than the created date. Except for the latest version of the resume for each user.
        long cutoffTime = System.currentTimeMillis() - 90L * 24 * 60 * 60 * 1000;
        Document query = new Document("created_at", new Document("$lt", cutoffTime));

        ArrayList<Document> resumesToDelete = new ArrayList<>();
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

        // Delete the resumes from S3
        for (Document resumeToDelete : resumesToDelete) {
            String key = resumeToDelete.getString("storage_path");
            if(key != null && !key.isEmpty()) {
                s3Client.deleteObject(
                        DeleteObjectRequest.builder()
                                .bucket(bucketName)
                                .key(key)
                                .build()
                );
            }
            // Delete the resume from MongoDB
            collection.deleteOne(new Document("_id", resumeToDelete.getObjectId("_id")));
        }
    }
}
