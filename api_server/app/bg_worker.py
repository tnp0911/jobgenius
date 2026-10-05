import asyncio
import logging
from typing import ClassVar

from app.core.config import settings
from app.db.arq import close_arq_pool, init_arq_pool
from app.db.mongo import close_mongo, init_mongo
from app.db.pinecone import close_pinecone, init_pinecone
from app.db.redis import close_redis, init_redis
from app.db.s3 import close_s3_client, init_s3_client
from app.services.arq_logic import analyze_resume_premium
from app.services.job_service import store_jobs_to_pinecone
from app.services.resume_service import store_resume_to_mongodb
from arq.connections import RedisSettings

logger = logging.getLogger(__name__)


async def startup(ctx):
    await asyncio.gather(
        init_mongo(), init_pinecone(), init_s3_client(), init_redis(), init_arq_pool()
    )
    logger.info("Background ARQ worker started")


async def shutdown(ctx):
    await asyncio.gather(
        close_mongo(),
        close_pinecone(),
        close_s3_client(),
        close_redis(),
        close_arq_pool(),
    )
    logger.info("Background ARQ worker stopped")


async def store_jobs_to_pinecone_arq(ctx, jobs: list):
    await store_jobs_to_pinecone(jobs)
    logger.info(f"Jobs stored to Pinecone: {len(jobs)}")


async def store_resume_to_mongodb_arq(
    ctx, user_id: int, resume_filename: str, pdf_bytes: bytes, analyzed_result: dict
):
    await store_resume_to_mongodb(user_id, resume_filename, pdf_bytes, analyzed_result)
    logger.info(f"Resume stored to MongoDB: {resume_filename}")


async def analyze_resume_premium_arq(
    ctx,
    job_id: str,
    user_id: int,
    resume_filename: str,
    resume_bytes: bytes,
    jd_text: str,
    user_goal: str,
    includes_job_finder: bool,
    usage_key: str,
    job_finder_usage_key: str,
):
    await analyze_resume_premium(
        job_id,
        user_id,
        resume_filename,
        resume_bytes,
        jd_text,
        user_goal,
        includes_job_finder,
        usage_key,
        job_finder_usage_key,
    )
    logger.info(
        f"Resume analyzed for user_id: {user_id}, job_id: {job_id}, filename: {resume_filename}"
    )


class WorkerSettings:
    functions: ClassVar[list] = [
        store_jobs_to_pinecone_arq,
        store_resume_to_mongodb_arq,
        analyze_resume_premium_arq,
    ]
    redis_settings = RedisSettings(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        database=settings.REDIS_ARQ_DB,
    )
    on_startup = startup
    on_shutdown = shutdown
    max_jobs = 5
    job_timeout = 1000
    max_tries = 3
