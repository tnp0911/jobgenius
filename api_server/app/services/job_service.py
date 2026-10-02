import hashlib
from app.core.config import settings
from app.db.pinecone import get_pinecone_index
from app.helpers.job_api_helper import jsearch_format_data, jsearch_json_to_text
from app.services.resume_service import get_resume_for_job_recommendation_from_mongodb
from app.helpers.embedding_helper import embed_text
from app.db.mongo import get_mongo_client
import niquests
import logging
from typing import List, Optional
from fastmcp import FastMCP
from app.models.job import Job

logger = logging.getLogger(__name__)
mcp = FastMCP("job_service")



@mcp.tool("search_jobs", 
    description="""
    Search jobs through the third-party API (JSearch API)
    Parameters:
        query: The query to search for jobs
        country: The country to search for jobs (if given) - Default values: ca
        language: The language to search for jobs (if given) - Default values: en
        date_posted: Date posted (if given) - Default values: all, today, 3days, week, month
        employment_types (optional): Employment types (if given) - Default values: FULLTIME, CONTRACTOR, PARTTIME, INTERN
        job_requirements (optional): No default value - List of strings separated by commas: under_3_years_experience, more_than_3_years_experience, no_experience, no_degree
    Returns:
        A list of jobs in JSON format
    """)
async def search_jobs(query: str, country: str = "ca", language: str = "en", date_posted: str = "all", employment_types: Optional[List[str]] = None, job_requirements: Optional[List[str]] = None):
    params = {
        "query": query,
        "num_pages": 2,
        "country": country,
        "language": language,
        "date_posted": date_posted or "all"
    }
    if employment_types:
        params["employment_types"] = ",".join(employment_types)
    if job_requirements:
        params["job_requirements"] = ",".join(job_requirements)
    response = await niquests.aget(
        f"{settings.JSEARCH_HOST}/search-v2",
        headers=settings.JSEARCH_HEADERS,
        params=params,
        timeout=60,
    )
    response.raise_for_status()
    body = response.json()

    if body.get("status") != "OK":
        logger.error("JSearch request failed: %s", body)
        raise RuntimeError(f"Failed to search jobs: {body.get('status')}")

    data = body.get("data") or {}
    return data.get("jobs", [])


async def _store_jobs_to_mongodb(job_data, json_to_text: str, pinecone_id: Optional[str] = None, model: Optional[str] = None):
    mongo_client = get_mongo_client()
    mongo_db = mongo_client[settings.MONGODB_NAME]
    jobs_collection = mongo_db["jobs"]
    job = jsearch_format_data(job_data, json_to_text, pinecone_id, model)
    await jobs_collection.update_one(
        {"id": job["id"], "source": job["source"]},
        {"$set": job},
        upsert=True,
    )

async def get_job_from_mongodb(job_id: str) -> dict:
    try:
        mongo_client = get_mongo_client()
        mongo_db = mongo_client[settings.MONGODB_NAME]
        jobs_collection = mongo_db["jobs"]
        job = await jobs_collection.find_one({"id": job_id})
        if not job:
            return None
        return Job.model_validate(job).model_dump(mode="json")
    except Exception as e:
        logger.error(f"Error getting job from MongoDB: {e}")
        return None

def _pinecone_job_metadata(job_data: dict) -> dict:
    return {
        k: v
        for k, v in {
            "job_id": job_data.get("job_id"),
            "employer_name": job_data.get("employer_name"),
            "job_city": job_data.get("job_city").upper().strip() if job_data.get("job_city") else "",
            "job_country": job_data.get("job_country").upper().strip() if job_data.get("job_country") else "",
        }.items()
        if v is not None
    }


async def store_jobs_to_pinecone(data):
    """
    Store searched jobs from JSearch API to Pinecone, also store to MongoDB simultaneously
    Parameters:
        data: A list of jobs in JSON format from JSearch API
    Returns:
        True if all jobs are stored to MongoDB and Pinecone successfully, False otherwise
    """
    try:
        pinecone_index = get_pinecone_index()
        for job_data in data:
            job_id = job_data.get("job_id")
            if not job_id:
                logger.warning("Skipping job without job_id")
                continue

            pinecone_id = "vec" + hashlib.sha256(job_id.encode("utf-8")).hexdigest()
            logger.info(f"Pinecone ID: {pinecone_id}")
            if (await pinecone_index.fetch(ids=[pinecone_id])).vectors != {}:
                logger.warning(f"Job {job_id} already exists in Pinecone")
                continue
            json_to_text = jsearch_json_to_text(job_data)
            embedding = await embed_text(json_to_text)
            if not embedding:
                logger.error(f"Empty embedding for job {job_id}")
                continue

            await pinecone_index.upsert(
                vectors=[
                    {
                        "id": pinecone_id,
                        "values": embedding,
                        "metadata": _pinecone_job_metadata(job_data),
                    }
                ],
                namespace="jobs",
            )
            try:
                await _store_jobs_to_mongodb(
                    job_data,
                    json_to_text,
                    pinecone_id,
                    settings.EMBEDDING_MODEL,
                )
            except Exception as e:
                logger.error(f"Error storing job {job_id} to MongoDB: {e}")
                continue
        logger.info("All jobs stored to MongoDB and Pinecone successfully")
        return True
    except Exception as e:
        logger.error(f"Error storing jobs to MongoDB and Pinecone: {e}")
        return False

async def search_jobs_in_pinecone(query: str) -> List[dict]:
    try:
        pinecone_index = get_pinecone_index()
        embedding = await embed_text(query)
        if not embedding:
            logger.error("Empty embedding")
            return []
        total_ids = 0
        async for ids_batch in pinecone_index.list(namespace="jobs"):
            total_ids += len(ids_batch)
        logger.info(f"Total IDs in Pinecone: {total_ids}")
        results = await pinecone_index.query(
            vector=embedding,
            top_k=20,
            namespace="jobs",
            include_metadata=True,
        )
        matches = results.get("matches", [])
        if not matches:
            logger.error("No matches found in Pinecone")
            return []
        return matches
    except Exception as e:
        logger.error(f"Error getting jobs in Pinecone: {e}")
        return []

async def job_recommendation_with_pinecone(user_id: int, resume_id: str, job_city: str = "", job_country: str = "") -> dict:
    resume_text = ""
    try:
        resume = await get_resume_for_job_recommendation_from_mongodb(user_id, resume_id)
        if not resume:
            return {"error": "Resume not found"}
        resume_text = resume.get("full_combined_text") or ""
        if not resume_text.strip():
            return {"error": "Resume has no searchable text"}
        matches = await search_jobs_in_pinecone(resume_text)
        if not matches:
            logger.info("No jobs found in Pinecone")
            return {"error": "No jobs found", "resume_text": resume_text}
        
        
        lowest_similarity_threshold = min(m.get("score", 0) for m in matches)
        max_similarity_threshold = max(m.get("score", 0) for m in matches)

        logger.info(f"Number of jobs found in Pinecone: {len(matches)}")
        logger.info(f"Lowest similarity: {lowest_similarity_threshold}")
        logger.info(f"Max similarity: {max_similarity_threshold}")
        
        # Rules for filtering jobs:
        # 0. Filter jobs with similarity more than 0.4
        # 1. Filter jobs in the given city and country
        # 2. If less than 10 jobs are found, get more jobs from other cities
        # 3. If less than 10 jobs are found, get more jobs from other countries
        
        scored = [m for m in matches if m.get("score", 0) > 0.35]
        def meta(m):
            md = m.get("metadata") or {}
            return (
                (md.get("job_city") or "").upper().strip(),
                (md.get("job_country") or "").upper().strip(),
            )
        want_city = (job_city or "").upper().strip()
        want_country = (job_country or "").upper().strip()
        local = [m for m in scored if meta(m) == (want_city, want_country)]
        same_country = [
            m for m in scored
            if meta(m)[1] == want_country and meta(m)[0] != want_city
        ]
        other_country = [m for m in scored if meta(m)[1] != want_country]
        # Prefer local, then fill up to 10
        merged = local[:]
        if len(merged) < 10:
            merged.extend(same_country)
        if len(merged) < 10:
            merged.extend(other_country)
        matches = merged[:10]
        if not matches:
            logger.info("No jobs found above similarity threshold")
            return {"error": "No jobs above similarity threshold", "resume_text": resume_text}
        recommended_jobs = []
        for match in matches:
            match_metadata = (match.get("metadata") or {})
            job_id = match_metadata.get("job_id")
            if not job_id:
                continue
            job = await get_job_from_mongodb(job_id)
            if not job:
                logger.error(f"Job not found in MongoDB: {job_id}")
                continue
            if job and job.get("is_active", True):
                recommended_jobs.append({"job": job, "match_score": match["score"]})
        if not recommended_jobs:
            return {"error": "No recommended jobs found", "resume_text": resume_text}
        return recommended_jobs
    except Exception as e:
        logger.error(f"Error getting job recommendation: {e}")
        return {"error": "Failed to get job recommendations", "resume_text": resume_text}