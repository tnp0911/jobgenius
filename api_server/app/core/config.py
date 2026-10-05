from pathlib import Path
from typing import Dict, List

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    # 🧠 App
    APP_NAME: str = "JobGenius | api_server"
    DEBUG: bool = True
    API_KEY: str
    CORS_ALLOW_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://web.postman.co",
    ]
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: List[str] = ["*"]
    CORS_ALLOW_HEADERS: List[str] = ["*"]
    CORS_ALLOW_EXPOSE_HEADERS: List[str] = ["fallback"]

    # 🤖 AI
    OLLAMA_MODEL: str = "qwen2.5:7b"
    EMBEDDING_MODEL: str = "nomic-embed-text-v2-moe:latest"
    OLLAMA_HOST: str = "http://ollama.local:11434"

    # 🔎 Job Search API (RapidAPI - Global Jobs Search)
    JSEARCH_HOST: str = "https://jsearch.p.rapidapi.com"
    RAPIDAPI_KEY: str

    # 🔐 JWT
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"

    # 🛢 Database (SQL)
    SQL_DB_URL: str

    # ⚡ Redis
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    REDIS_ARQ_DB: int = 1  # keep cache/rate-limit on default db=0

    # 🛢 Localstack S3
    LOCALSTACK_HOST: str = "http://localstack:4566"
    LOCALSTACK_ACCESS_KEY: str = "test"
    LOCALSTACK_SECRET_ACCESS_KEY: str = "test"
    LOCALSTACK_REGION_NAME: str = "us-east-1"
    S3_BUCKET_NAME: str = "jobgenius-resume-bucket"

    # 🛢 Database (NoSQL)
    MONGODB_URI: str = "mongodb://mongodb:27017/"
    MONGODB_NAME: str = "job_recommendation_system"

    # 🛢 Vector Database
    PINECONE_API_KEY: str = "pc_local_api_key"
    PINECONE_HOST: str = "http://pinecone.local:5080"
    PINECONE_INDEX_NAME: str = "pc-job-recommendation-system-v1"

    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", env_file_encoding="utf-8") # class Config is deprecated, will be removed in the future

    # 🔥 Dynamic property (cleaner than hardcoding dict)
    @property
    def JSEARCH_HEADERS(self) -> Dict[str, str]:
        return {
            "Content-Type": "application/json",
            "x-rapidapi-host": "jsearch.p.rapidapi.com",
            "x-rapidapi-key": self.RAPIDAPI_KEY,
        }


# Singleton settings object
settings = Settings() # pyright: ignore[reportCallIssue]
