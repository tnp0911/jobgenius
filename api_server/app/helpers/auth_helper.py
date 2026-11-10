import secrets
from typing import Annotated

from app.core.config import settings
from app.schemas.user import PlanEnum, UserResponse
from app.services.user_service import get_current_user
from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader

API_KEY_HEADER = APIKeyHeader(name="x-api-key", auto_error=True)


def is_owner(
    user_id: int, current_user: Annotated[UserResponse, Depends(get_current_user)]
):
    if current_user.uid != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action.",
        )
    return True


def verify_api_key(x_api_key: Annotated[str, Depends(API_KEY_HEADER)]):
    if not secrets.compare_digest(x_api_key, settings.API_KEY):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Invalid API Key"
        )


def is_premium_user(
    current_user: Annotated[UserResponse | None, Depends(get_current_user)],
):
    if not current_user:
        return False
    return current_user.plan == PlanEnum.PREMIUM
