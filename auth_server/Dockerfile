# Builder stage
FROM eclipse-temurin:17-jdk-noble AS builder
WORKDIR /app

COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .

# make wrapper executable
RUN chmod +x mvnw
RUN ./mvnw dependency:go-offline

COPY src ./src
RUN ./mvnw clean package -DskipTests

# Runtime stage
FROM eclipse-temurin:17-jdk-noble
ARG REVISION
ARG CREATED
LABEL org.opencontainers.image.title="JobGenius Auth Server - SpringBoot" \ 
      org.opencontainers.image.description="SpringBoot backend service for JobGenius" \
      org.opencontainers.image.source="https://github.com/tnp0911/jobgenius" \
      org.opencontainers.image.url="https://github.com/tnp0911/jobgenius" \
      org.opencontainers.image.licenses="AGPL-3.0" \
      org.opencontainers.image.vendor="tnp0911" \
      org.opencontainers.image.authors="Tuong Nguyen Pham" \
      org.opencontainers.image.revision="${REVISION}" \
      org.opencontainers.image.created="${CREATED}"

WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
# Make the application files accessible to the non-root user
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home nonrootuser \
    && chown -R nonrootuser:nonrootuser /app

# Run the application as the non-root user
USER nonrootuser
EXPOSE 5000
CMD ["java", "-jar", "app.jar"]