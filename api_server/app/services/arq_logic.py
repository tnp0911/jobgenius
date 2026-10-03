import json
import logging

from app.ai_agents.premium_multiagents import GraphState as PremiumGraphState
from app.ai_agents.premium_multiagents import build_premium_graph
from app.db.arq import get_arq_pool
from app.db.redis import get_redis_client
from app.helpers.arq_helper import update_progress
from app.routers.resume_router import (
    JOB_FINDER_RESET_WINDOW,
    PREMIUM_ANALYZER_RESET_WINDOW,
)
from app.services.resume_analyzer import extract_text_from_resume

logger = logging.getLogger(__name__)


# * Premium Analyzer Function
async def analyze_resume_premium(
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
    try:
        await update_progress(job_id, "SETTING_UP", 5)
        redis_client = get_redis_client()
        arq_pool = get_arq_pool()
        await update_progress(job_id, "STARTED", 10)

        await update_progress(job_id, "EXTRACTING_TEXT_FROM_RESUME", 20)

        resume_text = extract_text_from_resume(resume_filename, resume_bytes)

        await update_progress(job_id, "PREPARING_ANALYZER", 25)

        premium_analyzer = await build_premium_graph()
        state: PremiumGraphState = {
            "resume_text": resume_text,
            "jd_text": jd_text,
            "user_goal": user_goal,
            "includes_job_finder": includes_job_finder,
            "intent": {},
            "analyzer": {},
            "ats": {},
            "optimizer": {},
            "feedback": {},
            "job_finder": {},
        }

        await update_progress(job_id, "ANALYZING_RESUME", 30)

        result = await premium_analyzer.ainvoke(state)
        content = {
            "intent": result["intent"],
            "analyzer": result["analyzer"],
            "ats": result["ats"],
            "optimizer": result["optimizer"],
            "feedback": result["feedback"],
            "job_finder": result.get("job_finder") if includes_job_finder else None,
        }

        await update_progress(job_id, "FINALIZING_ANALYSIS", 90)

        await arq_pool.enqueue_job(
            "store_resume_to_mongodb_arq",
            user_id,
            resume_filename,
            resume_bytes,
            result,
        )

        await update_progress(job_id, "SAVING_RESULTS", 95)

        # Save results to Redis
        results_json = json.dumps(content)

        await redis_client.setex(
            f"resume_analysis:{job_id}:result", 60 * 60 * 24, results_json
        )  # Store for 24 hours

        count = await redis_client.incr(usage_key)
        if count == 1:
            await redis_client.expire(usage_key, PREMIUM_ANALYZER_RESET_WINDOW)
        job_finder = content.get("job_finder") or {}
        job_finder_jobs = job_finder.get("jobs") or []
        if includes_job_finder and job_finder and len(job_finder_jobs) > 0:
            count = await redis_client.incr(job_finder_usage_key)
            if count == 1:
                await redis_client.expire(job_finder_usage_key, JOB_FINDER_RESET_WINDOW)

        await update_progress(
            job_id,
            "COMPLETED",
            100,
        )

    except Exception as e:
        logger.exception(f"Error analyzing resume: {e}")
        await update_progress(
            job_id,
            "FAILED",
            100,
        )
        raise
