import json

from app.db.redis import get_redis_client

RESULT_TTL_SECONDS = 60 * 60 * 24  # 24 hours — matches analysis result TTL


def pending_analysis_key(user_id: int) -> str:
    return f"resume_analysis:pending:{user_id}"


def result_analysis_key(job_id: str) -> str:
    return f"resume_analysis:{job_id}:result"


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
        await redis.expire(progress_key, 60 * 60 * 24 * 3)  # 3 days
        await redis.publish(progress_key, json.dumps(event))


async def remove_key_from_redis(key: str):
    redis = get_redis_client()
    deleted = await redis.delete(key)
    return deleted > 0

async def refund_usage(key: str) -> None:
    if not key:
        return
    redis = get_redis_client()
    value = await redis.decr(key)
    if value <= 0:
        await redis.delete(key)


async def add_pending_analysis(user_id: int, job_id: str) -> None:
    """Track a completed analysis the user still needs to accept/reject."""
    redis = get_redis_client()
    key = pending_analysis_key(user_id)
    await redis.sadd(key, job_id)  # type: ignore[misc]
    await redis.expire(key, RESULT_TTL_SECONDS)


async def remove_pending_analysis(user_id: int, job_id: str) -> None:
    """Drop a job from the user's pending set after accept/reject."""
    redis = get_redis_client()
    key = pending_analysis_key(user_id)
    await redis.srem(key, job_id)  # type: ignore[misc]
    if await redis.scard(key) == 0:  # type: ignore[misc]
        await redis.delete(key)


async def list_pending_analyses(user_id: int) -> list[dict]:
    """
    Return pending jobs that still have a result payload.
    Stale job_ids (expired results) are pruned from the set.
    """
    redis = get_redis_client()
    key = pending_analysis_key(user_id)
    job_ids = await redis.smembers(key)  # type: ignore[misc]
    if not job_ids:
        return []

    pending: list[dict] = []
    stale: list[str] = []

    for raw_job_id in job_ids:
        job_id = (
            raw_job_id.decode()
            if isinstance(raw_job_id, (bytes, bytearray))
            else str(raw_job_id)
        )
        result_json = await redis.get(result_analysis_key(job_id))
        if not result_json:
            stale.append(job_id)
            continue

        resume_filename = None
        try:
            payload = json.loads(result_json)
            filename = payload.get("resume_filename")
            if filename:
                resume_filename = str(filename)
        except (TypeError, ValueError, json.JSONDecodeError):
            pass

        pending.append(
            {
                "job_id": job_id,
                "resume_filename": resume_filename,
            }
        )

    if stale:
        await redis.srem(key, *stale)  # type: ignore[misc]
        if await redis.scard(key) == 0:  # type: ignore[misc]
            await redis.delete(key)

    return pending
