import logging

from app.core.config import settings
from arq import create_pool
from arq.connections import RedisSettings

logger = logging.getLogger(__name__)
_arq_pool = None


async def init_arq_pool():
    global _arq_pool
    _arq_pool = await create_pool(
        RedisSettings(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            database=settings.REDIS_ARQ_DB,
        )
    )
    logger.info("ARQ pool initialized")
    return _arq_pool


async def close_arq_pool():
    global _arq_pool
    if _arq_pool:
        await _arq_pool.close()
        _arq_pool = None
    logger.info("ARQ pool closed")


def get_arq_pool():
    if _arq_pool is None:
        logger.error("ARQ pool not initialized")
        return None
    return _arq_pool
