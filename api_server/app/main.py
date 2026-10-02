import asyncio
import logging
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.logging_config import setup_logging
from app.db.arq import close_arq_pool, init_arq_pool
from app.db.base import Base
from app.db.mcp import close_mcp_client, init_mcp_client
from app.db.mongo import close_mongo, init_mongo
from app.db.pinecone import close_pinecone, init_pinecone
from app.db.redis import close_redis, init_redis
from app.db.s3 import close_s3_client, init_s3_client
from app.db.session import engine
from app.middlewares.mybasehttpmiddleware import MyBaseHTTPMiddleware
from app.routers.job_recommender_router import router as job_recommender_router
from app.routers.job_search_with_prompt_router import (
    router as job_search_with_prompt_router,
)
from app.routers.resume_router import router as resume_router
from app.routers.usage_router import router as usage_router
from app.routers.user_router import router as user_router
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        # STARTUP LOGIC
        logger.info("Initializing application...")
        await asyncio.gather(
            init_redis(),
            init_mongo(),
            init_pinecone(),
            init_s3_client(),
            init_arq_pool(),
            init_mcp_client(),
        )
        Base.metadata.create_all(bind=engine)

        yield
    except Exception:
        logger.error("Error during application lifespan")
        raise
    finally:
        # SHUTDOWN LOGIC
        logger.info("Shutting down application...")
        await asyncio.gather(
            close_redis(),
            close_mongo(),
            close_pinecone(),
            close_s3_client(),
            close_arq_pool(),
            close_mcp_client(),
        )


app = FastAPI(
    title=settings.APP_NAME, 
    debug=settings.DEBUG, 
    lifespan=lifespan,
    # docs_url = None,
    # redoc_url=None,
    # openapi_url=None,
    version = "2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOW_ORIGINS,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=settings.CORS_ALLOW_METHODS,
    allow_headers=settings.CORS_ALLOW_HEADERS,
    expose_headers=settings.CORS_ALLOW_EXPOSE_HEADERS,
)


@app.get("/health")
async def health_check():
    return {"status": "ok"}


app.add_middleware(MyBaseHTTPMiddleware)

app.include_router(user_router)
app.include_router(resume_router)
app.include_router(job_recommender_router)
app.include_router(job_search_with_prompt_router)
app.include_router(usage_router)
