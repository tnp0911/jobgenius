import hashlib
import json
import logging
from typing import Annotated

from app.ai_agents.agents.agent7_jobfinder import jobfinder_agent
from app.auth.dependencies import get_current_user_id
from app.db.redis import cache_get, cache_set, get_redis_client
from app.helpers.auth_helper import is_premium_user
from app.helpers.job_indexing import schedule_job_indexing
from app.helpers.llm_call import agent7_jobfinder_format_result
from app.helpers.user_helper import get_user_city_and_country, get_user_ip_address
from app.schemas.user import UserResponse
from app.services.job_service import job_recommendation_with_pinecone, search_jobs
from app.services.resume_service import (
    get_resume_for_job_recommendation_from_mongodb,
    resolve_resume_id_for_recommendations,
)
from app.services.user_service import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

UNLOGGED_IN_RECOMMENDATIONS_CACHE_TTL = 60 * 60 * 24 * 15  # 15 days
FREE_RECOMMENDATIONS_CACHE_TTL = 60 * 60 * 24 * 10  # 10 days
PREMIUM_RECOMMENDATIONS_CACHE_TTL = 60 * 60 * 24 * 3  # 3 days


async def _cache_and_return_premium_recommendations(
    cache_key: str,
    content: dict,
) -> JSONResponse:
    ok = await cache_set(
        cache_key,
        json.dumps(content),
        ex=PREMIUM_RECOMMENDATIONS_CACHE_TTL,
    )
    if not ok:
        logger.warning("Premium recommendations cache write failed for %s", cache_key)
    return JSONResponse(status_code=status.HTTP_200_OK, content=content)


@router.get("/recommendations")
async def get_job_recommendations_unlogged_in_user(request: Request):
    try:
        ip = get_user_ip_address(request)
        if not ip:
            raise HTTPException(
                status_code=status.HTTP_407_PROXY_AUTHENTICATION_REQUIRED,
                detail="Proxy authentication required. Please configure your proxy to include the client-ip-address header.",
            )
        city, country, country_code = await get_user_city_and_country(ip)
        if not city or not country or not country_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to get user's city and country",
            )

        cache_input = f"{city}_{country_code}".lower().strip()
        cache_hash = hashlib.sha256(cache_input.encode()).hexdigest()[:16]
        recommendations_cache_key = f"recommendations_cache:{cache_hash}"
        recommendations = await cache_get(recommendations_cache_key)
        if recommendations:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "provider": "search_jobs",
                    "jobs": json.loads(recommendations),
                },
            )

        query = f"any job in {city}, {country}"
        jobs = await search_jobs(query, country=country_code, language="en")
        if not jobs:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="No jobs found"
            )
        schedule_job_indexing(jobs)
        ok = await cache_set(
            recommendations_cache_key,
            json.dumps(jobs),
            ex=UNLOGGED_IN_RECOMMENDATIONS_CACHE_TTL,
        )
        if not ok:
            logger.warning(
                "Unlogged recommendations cache write failed for %s",
                recommendations_cache_key,
            )
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"provider": "search_jobs", "jobs": jobs},
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"No jobs found: {e!s}"
        )
    except Exception as e:
        logger.error(f"Error getting job recommendations: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get job recommendations",
        )


@router.get("/recommendations/free")
async def get_job_recommendations_free_user(
    request: Request,
    current_user: Annotated[UserResponse | None, Depends(get_current_user)],
    target_role: Annotated[str, Query()] = "any job",
    seniority_level: Annotated[str, Query()] = ""
):
    """
    Get job recommendations for a free user.
    Description:
    - If the user has not run the analysis, the industry parameter is any job by default.
    - If the user has run the analysis, the industry parameter is the industry of the resume.
    - Returned jobs from job search API will be stored in Redis cache for 10 days.
    Required Args:
        request: Request object
        target_role: Target role to search for
        seniority_level: Seniority level to search for
    Returns:
        JSONResponse: JSON response containing job recommendations
    """
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized"
        )
    try:
        ip = get_user_ip_address(request)
        if not ip:
            raise HTTPException(
                status_code=status.HTTP_407_PROXY_AUTHENTICATION_REQUIRED,
                detail="Proxy authentication required. Please configure your proxy to include the client-ip-address header.",
            )
        city, country, country_code = await get_user_city_and_country(ip)
        if not city or not country or not country_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to get user's city and country",
            )
        redis_client = get_redis_client()
        if target_role == "any job" and seniority_level == "":
            saved_target_role = await redis_client.get(f"target_role:{current_user.uid}")
            saved_seniority_level = await redis_client.get(f"seniority_level:{current_user.uid}")
            if saved_target_role:
                target_role = saved_target_role
            if saved_seniority_level:
                seniority_level = saved_seniority_level
        else:
            target_role_key = f"target_role:{current_user.uid}"
            seniority_level_key = f"seniority_level:{current_user.uid}"
            await redis_client.set(target_role_key, target_role, ex=FREE_RECOMMENDATIONS_CACHE_TTL)
            await redis_client.set(seniority_level_key, seniority_level, ex=FREE_RECOMMENDATIONS_CACHE_TTL)


        cache_input = f"{target_role}_{seniority_level}_{city}_{country_code}".lower().strip()
        logger.info(
            "cache_input=%r role=%r seniority=%r city=%r country=%r",
            cache_input,
            target_role,
            seniority_level,
            city,
            country_code,
        )
        cache_hash = hashlib.sha256(cache_input.encode()).hexdigest()[:16]
        recommendations_cache_key = f"recommendations_cache:free:{cache_hash}"
        recommendations = await cache_get(recommendations_cache_key)
        if recommendations:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "provider": "search_jobs",
                    "jobs": json.loads(recommendations),
                },
            )
        query = ""
        if seniority_level == "":
            query = f"{target_role.strip()} in {city}, {country}"
        else:
            query = f"{target_role.strip()} at {seniority_level.strip()} level in {city}, {country}"
        jobs = await search_jobs(query, country=country_code, language="en")
        if not jobs:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="No jobs found"
            )
        
        ok = await cache_set(
            recommendations_cache_key,
            json.dumps(jobs),
            ex=FREE_RECOMMENDATIONS_CACHE_TTL,
        )
        if not ok:
            logger.warning(
                "Free recommendations cache write failed for %s",
                recommendations_cache_key,
            )
        schedule_job_indexing(jobs)
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"provider": "search_jobs", "jobs": jobs},
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"No jobs found: {e!s}"
        )
    except Exception as e:
        logger.error(f"Error getting free job recommendations: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get job recommendations",
        )


@router.get("/recommendations/premium")
async def get_job_recommendations_premium_user(
    request: Request,
    current_user_id: Annotated[int, Depends(get_current_user_id)],
    is_premium: Annotated[bool, Depends(is_premium_user)],
    resume_id: Annotated[str | None, Query()] = None,
    target_role: Annotated[str, Query()] = "any job",
    seniority_level: Annotated[str, Query()] = "",
):
    """
    Get job recommendations for a premium user.
    Uses Pinecone similarity on stored resume text; falls back to jobfinder agent
    when no Pinecone matches are found.
    """
    if not is_premium:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action is only available to PREMIUM users.",
        )
    city = ""
    country = ""
    country_code = ""
    try:
        ip = get_user_ip_address(request)
        if not ip:
            raise HTTPException(
                status_code=status.HTTP_407_PROXY_AUTHENTICATION_REQUIRED,
                detail="Proxy authentication required. Please configure your proxy to include the client-ip-address header.",
            )
        city, country, country_code = await get_user_city_and_country(ip)
        if not city or not country or not country_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to get user's city and country",
            )
            
        resolved_resume_id = await resolve_resume_id_for_recommendations(
            current_user_id, resume_id
        )

        cache_input = f"{resolved_resume_id}_{city}_{country_code}".lower().strip()
        cache_hash = hashlib.sha256(cache_input.encode()).hexdigest()[:16]
        recommendations_cache_key = f"recommendations_cache:premium:{cache_hash}"
        cached = await cache_get(recommendations_cache_key)
        if cached:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=json.loads(cached),
            )

        result = await job_recommendation_with_pinecone(
            current_user_id,
            resolved_resume_id,
            job_city=city,
            job_country=country_code,
        )

        if isinstance(result, list) and result:
            return await _cache_and_return_premium_recommendations(
                recommendations_cache_key,
                {"provider": "pinecone", "jobs": result},
            )

        if isinstance(result, dict) and result.get("error"):
            resume_text = result.get("resume_text") or ""
            if not resume_text:
                stored = await get_resume_for_job_recommendation_from_mongodb(
                    current_user_id, resolved_resume_id
                )
                resume_text = (stored or {}).get("full_combined_text") or ""

            if not resume_text:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail=result["error"]
                )
            if not city or not country:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to get user's city and country",
                )

            logger.info("Could not find jobs in Pinecone. Falling back to agent7_jobfinder")
            user_requirements = (
                f"I have provided my resume text. Help me find the best jobs for me "
                f"in {city}, {country}."
            )
            agent_messages, raw_jobs = await jobfinder_agent(
                resume_text=resume_text,
                user_requirements=user_requirements,
            )
            formatted_response = agent7_jobfinder_format_result(
                agent_messages, raw_jobs
            )
            if formatted_response.get("error"):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=formatted_response["error"],
                )

            jobs = formatted_response.get("jobs") or []
            if not jobs:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="No jobs found"
                )
            schedule_job_indexing(jobs)
            return await _cache_and_return_premium_recommendations(
                recommendations_cache_key,
                {"provider": "agent7_jobfinder", "jobs": jobs},
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No jobs found"
        )
    except HTTPException:
        raise
    except ValueError as e:
        if "No stored resume found" in str(e):
            
            if cached:
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=json.loads(cached),
                    headers={"fallback": "true"},
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"No jobs found: {e!s}"
            )
    except Exception as e:
        logger.error(f"Error getting premium job recommendations: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get job recommendations",
        )