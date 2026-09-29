import logging

from app.db.redis import get_redis_client
from app.routers.resume_router import ANALYZER_LIMIT, JOB_FINDER_LIMIT
from app.schemas.user import UserResponse
from fastapi import HTTPException
from redis.asyncio import RedisError

logger = logging.getLogger(__name__)


# Get the usage of the free and premium analyzer
async def get_analyzer_usage(current_user: UserResponse, is_premium_user: bool):
    try:
        redis_client = get_redis_client()
        usage_key = (
            f"free_resume_analyzer_usage:{current_user.uid}"
            if not is_premium_user
            else f"premium_resume_analyzer_usage:{current_user.uid}"
        )
        usage = await redis_client.get(usage_key)
        # remaining time in seconds
        remaining_time = await redis_client.ttl(usage_key)
        if usage:
            return int(usage), remaining_time, ANALYZER_LIMIT
        return 0, 0, ANALYZER_LIMIT
    except RedisError as e:
        logger.error(f"Redis error: {e}")
        raise HTTPException(status_code=500, detail=f"Redis error: {e}")
    except Exception as e:
        logger.error(f"Error getting analyzer usage: {e}")
        raise HTTPException(
            status_code=500, detail=f"Error getting analyzer usage: {e}"
        )


# Get the usage of the job finder/job search with prompt
async def get_job_finder_usage(current_user: UserResponse, is_premium_user: bool):
    try:
        redis_client = get_redis_client()
        usage_key = (
            f"job_search_with_prompt_premium_limit:{current_user.uid}"
            if is_premium_user
            else f"job_search_with_prompt_free_limit:{current_user.uid}"
        )
        usage = await redis_client.get(usage_key)
        # remaining time in seconds
        remaining_time = await redis_client.ttl(usage_key)
        if usage:
            return int(usage), remaining_time, JOB_FINDER_LIMIT
        return 0, 0, JOB_FINDER_LIMIT
    except RedisError as e:
        raise HTTPException(status_code=500, detail=f"Redis error: {e}")
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error getting job finder usage: {e}"
        )
