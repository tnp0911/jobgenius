import asyncio
import base64
import json
import logging
from pathlib import Path

from app.ai_agents.agents.agent5_rerender import rerender_agent
from app.ai_agents.premium_multiagents import GraphState as PremiumGraphState
from app.ai_agents.premium_multiagents import build_premium_graph
from app.db.redis import get_redis_client
from app.db.s3 import get_s3_client
from app.helpers.arq_helper import update_progress
from app.helpers.resume_helper import (
    analyzer_result_to_text,
    format_analyzer_result,
    nested_agents_from_result,
)
from app.routers.resume_router import (
    JOB_FINDER_RESET_WINDOW,
    PREMIUM_ANALYZER_RESET_WINDOW,
)
from app.services.resume_analyzer import extract_text_from_resume
from app.services.resume_service import (
    overwrite_resume_in_s3,
    read_s3_object_bytes,
    store_resume_to_mongodb,
)

logger = logging.getLogger(__name__)


def _rerender_for_redis(rerender: dict) -> dict:
    """JSON-safe preview payload: PDF as base64, no raw bytes or TeX source."""
    payload = dict(rerender or {})
    pdf_bytes = payload.pop("pdf_bytes", None)
    payload.pop("tex", None)
    if isinstance(pdf_bytes, (bytes, bytearray)):
        payload["pdf_base64"] = base64.b64encode(pdf_bytes).decode("ascii")
    return payload


def _job_finder_jobs(job_finder) -> list:
    if isinstance(job_finder, list):
        return job_finder
    if isinstance(job_finder, dict):
        jobs = job_finder.get("jobs")
        return jobs if isinstance(jobs, list) else []
    return []


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
            "rerender": {},
            "feedback": {},
            "job_finder": {},
        }

        await update_progress(job_id, "ANALYZING_RESUME", 30)

        result = await premium_analyzer.ainvoke(state)
        returned_result = format_analyzer_result(result)
        returned_result["rerender"] = _rerender_for_redis(result.get("rerender") or {})
        returned_result["job_finder"] = (
            result.get("job_finder") if includes_job_finder else None
        )

        await update_progress(job_id, "FINALIZING_ANALYSIS", 90)

        store_payload = {
            key: value for key, value in result.items() if key != "rerender"
        }
        await update_progress(job_id, "SAVING_RESULTS", 95)
        resume_version = await store_resume_to_mongodb(
            user_id,
            resume_filename,
            resume_text,
            resume_bytes,
            store_payload,
        )
        if resume_version is None:
            raise RuntimeError("Failed to store resume to MongoDB.")
        returned_result["resume_version"] = resume_version
        returned_result["resume_id"] = f"{user_id}_{Path(resume_filename).stem}"
        returned_result["resume_filename"] = Path(resume_filename).stem
        # Save results to Redis
        results_json = json.dumps(returned_result)

        await redis_client.setex(
            f"resume_analysis:{job_id}:result", 60 * 60 * 24, results_json
        )  # Store for 24 hours

        count = await redis_client.incr(usage_key)
        if count == 1:
            await redis_client.expire(usage_key, PREMIUM_ANALYZER_RESET_WINDOW)
        job_finder = returned_result.get("job_finder")
        job_finder_jobs = _job_finder_jobs(job_finder)
        if includes_job_finder and job_finder_jobs:
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


# * Premium Rerender Function
async def rerender_resume_premium(
    job_id: str, user_id: int, resume_filename: str, version: int
):
    """
    If user accepts the optimizer's changes,
    we need to rerender the resume with the version of unhighlighted content
    from the optimizer's changes.

    Procedure:
    1. Get the optimizer's changes and other agents' responses from the Redis (stored in the key "resume_analysis:{job_id}:result" in 24 hours)
    2. Call rerender_agent (change highlight=False)
    3. Overwrite the resume in S3
    4. Extract the text from the rerendered resume
    5. Update the full_combined_text in the MongoDB (stored in the collection "resumes_for_job_recommendation")
    """
    try:
        # Get pdf from S3 and get the text from the pdf
        s3_client = await get_s3_client()
        extracted_filename = Path(resume_filename).stem
        pdf_bytes = read_s3_object_bytes(
            s3_client, f"{user_id}/{extracted_filename}_{version}.pdf"
        )
        if not pdf_bytes:
            raise Exception(
                f"PDF bytes not found for {resume_filename} - version {version}"
            )
        pdf_text = extract_text_from_resume(resume_filename, pdf_bytes)

        # Get the optimizer's changes and other agents' responses from the Redis (stored in the key "resume_analysis:{job_id}:result" in 24 hours)
        redis_client = get_redis_client()
        result = await redis_client.get(f"resume_analysis:{job_id}:result")
        if not result:
            raise Exception(f"Redis key not found for {job_id}")
        content = json.loads(result)
        agents = nested_agents_from_result(content)

        # Call rerender_agent (change highlight=False)
        rerender_result = await asyncio.to_thread(
            rerender_agent,
            pdf_text,
            agents["optimizer"],
            agents["analyzer"],
            agents["intent"],
            highlight=False,
        )
        rerendered_pdf_bytes = rerender_result.get("pdf_bytes")
        if not rerendered_pdf_bytes:
            raise Exception("Rerendered pdf bytes not found")

        # Extract the text from the rerendered resume
        rerendered_pdf_text = extract_text_from_resume(
            resume_filename, rerendered_pdf_bytes
        )
        full_combined_text = analyzer_result_to_text(rerendered_pdf_text, content)

        await overwrite_resume_in_s3(
            s3_client,
            user_id,
            extracted_filename,
            version,
            rerendered_pdf_bytes,
            full_combined_text,
        )
    except Exception as e:
        logger.exception(f"Error rerendering resume at rerender_resume_premium: {e}")
        raise
