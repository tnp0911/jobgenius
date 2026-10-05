import asyncio
import logging

import redis.asyncio as redis
from app.core.config import settings

redis_client: redis.Redis | None = None

logger = logging.getLogger(__name__)

CACHE_GET_TIMEOUT = 5
CACHE_SET_TIMEOUT = 5
_reset_lock = asyncio.Lock()


def _build_redis_client() -> redis.Redis:
    return redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        decode_responses=True,
        encoding="utf-8",
        socket_connect_timeout=3,
        socket_timeout=5,
        socket_keepalive=True,
        max_connections=50,
        health_check_interval=15,
    )


async def init_redis():
    global redis_client
    redis_client = _build_redis_client()
    is_alive = await redis_client.ping()
    if not is_alive:
        raise RuntimeError("Failed to connect to Redis")
    logger.info("Redis client initialized and connected successfully")
    return redis_client, is_alive


async def close_redis():
    global redis_client
    if redis_client is not None:
        try:
            await redis_client.connection_pool.disconnect(inuse_connections=True)
        except Exception:
            logger.exception("Error disconnecting Redis pool")
        try:
            await redis_client.aclose()
        except Exception:
            logger.exception("Error closing Redis client")
        redis_client = None
        logger.info("Redis client closed successfully")


async def reset_redis_pool(reason: str = "") -> None:
    """Drop poisoned connections after cancel/timeout and recreate the client."""
    global redis_client
    async with _reset_lock:
        logger.warning("Resetting Redis pool%s", f": {reason}" if reason else "")
        old = redis_client
        redis_client = None
        if old is not None:
            try:
                await old.connection_pool.disconnect(inuse_connections=True)
            except Exception:
                logger.exception("Error disconnecting old Redis pool")
            try:
                await old.aclose()
            except Exception:
                logger.exception("Error closing old Redis client")
        redis_client = _build_redis_client()
        try:
            await redis_client.ping()
            logger.info("Redis pool reset successfully")
        except Exception:
            logger.exception("Redis pool reset ping failed")


def get_redis_client() -> redis.Redis | None:
    if redis_client is None:
        logger.error("Redis client not initialized")
        return None
    return redis_client


def _schedule_pool_reset(reason: str) -> None:
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return

    async def _run() -> None:
        try:
            await reset_redis_pool(reason)
        except Exception:
            logger.exception("Background Redis pool reset failed")

    loop.create_task(_run())


async def cache_get(key: str) -> str | None:
    """GET a cache value; timeout/cancel triggers pool reset."""
    try:
        client = get_redis_client()
        return await client.get(key)
    except (asyncio.TimeoutError, asyncio.CancelledError, Exception):
        logger.exception("Redis GET failed for key %s", key)
        _schedule_pool_reset(f"GET error key={key}")
        return None


async def cache_set(
    key: str,
    value: str,
    ex: int | None = None,
) -> bool:
    """
    SET a cache value. Returns False on timeout/error so callers can still
    return their payload without depending on Redis.
    """
    try:
        client = get_redis_client()
        await client.set(key, value, ex=ex)
        return True
    except (asyncio.TimeoutError, asyncio.CancelledError, Exception):
        logger.exception("Redis SET failed for key %s", key)
        _schedule_pool_reset(f"SET error key={key}")
        return False
