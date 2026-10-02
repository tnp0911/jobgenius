import logging
from typing import Annotated

from app.helpers.auth_helper import is_premium_user
from app.schemas.user import UserResponse
from app.services.usage_service import get_analyzer_usage, get_job_finder_usage
from app.services.user_service import get_current_user
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/usage", tags=["usage"])


@router.get("/analyzer")
async def get_analyzer_usage_endpoint(
    current_user: Annotated[UserResponse | None, Depends(get_current_user)],
    is_premium_user: Annotated[bool, Depends(is_premium_user)],
):
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Unauthorized")
        usage, remaining_time, max_analyzer_limit = await get_analyzer_usage(current_user, is_premium_user)
        return JSONResponse(
            content={"usage": usage, "remaining_time": remaining_time, "max_limit": max_analyzer_limit},
            status_code=status.HTTP_200_OK,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting free analyzer usage: {e}")
        raise HTTPException(
            status_code=500, detail=f"Error getting free analyzer usage: {e}"
        )


@router.get("/job-finder")
async def get_job_finder_usage_endpoint(
    current_user: Annotated[UserResponse | None, Depends(get_current_user)],
    is_premium_user: Annotated[bool, Depends(is_premium_user)],
):
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Unauthorized")
        usage, remaining_time, max_job_finder_limit = await get_job_finder_usage(
            current_user, is_premium_user
        )
        return JSONResponse(
            content={"usage": usage, "remaining_time": remaining_time, "max_limit": max_job_finder_limit},
            status_code=status.HTTP_200_OK,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting job finder usage: {e}")
        raise HTTPException(
            status_code=500, detail=f"Error getting job finder usage: {e}"
        )
