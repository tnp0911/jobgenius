# Builder stage
FROM eclipse-temurin:17-jdk-noble AS builder
LABEL org.opencontainers.image.authors="Tuong Nguyen Pham <tuongnguyen2004danang@gmail.com>"
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