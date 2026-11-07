import json

from app.db.redis import get_redis_client, init_redis


async def update_progress(
    job_id: str, status: str, progress: int, task: str = "resume"
):
    event = {
        "job_id": job_id,
        "status": status,
        "progress": progress,
    }
    redis = get_redis_client()
    
    if task == "resume":
        progress_key = f"resume_analysis:{job_id}:progress"
        # Persist latest state so late-connecting clients see current progress
        await redis.hset(  # type: ignore[misc]
            progress_key,
            mapping={"status": status, "progress": progress},
        )
        await redis.expire(progress_key, 60 * 60 * 24) # 24 hours
        await redis.publish(progress_key, json.dumps(event))
