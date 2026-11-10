import logging
from typing import Annotated

from app.db.session import get_db
from app.helpers.auth_helper import is_premium_user, verify_api_key
from app.schemas.user import UserCreate, UserPlanUpdate, UserResponse
from app.services.user_service import (
    add_user_to_db,
    get_current_user,
    get_user_by_id,
    update_user_plan,
)
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.security import APIKeyHeader
from sqlalchemy.orm import Session

API_KEY_HEADER = APIKeyHeader(name="x-api-key", auto_error=True)

router = APIRouter(tags=["users"])


logger = logging.getLogger(__name__)


@router.get("/api/users/me", response_model=UserResponse)
def get_current_user_info(
    current_user: Annotated[UserResponse | None, Depends(get_current_user)],
):
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized"
        )
    return current_user


@router.get("/api/users/me/plan/expires_at")
def get_current_user_plan_expires_at(
    current_user: Annotated[UserResponse | None, Depends(get_current_user)],
    is_premium_user: Annotated[bool, Depends(is_premium_user)],
):
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized"
        )
    if not is_premium_user:
        raise HTTPException(
            detail="User is not a premium user", status_code=status.HTTP_403_FORBIDDEN
        )
    expires_at = current_user.plan_expiry
    if expires_at is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User has no plan expiry date"
        )
    return JSONResponse(
        status_code=status.HTTP_200_OK, content={"expires_at": expires_at}
    )


@router.post("/internal/users/add", response_model=UserResponse)
def add_user(
    db: Annotated[Session, Depends(get_db)],
    x_api_key: Annotated[str | None, Depends(API_KEY_HEADER)],
    data: UserCreate,
):
    verify_api_key(x_api_key)
    existing_user = get_user_by_id(db, data.uid)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="User already exists"
        )
    new_user = add_user_to_db(data.uid, db)
    return new_user


@router.put("/internal/users/{user_id}/plan/update", response_model=UserResponse)
def update_user_subscription_plan(
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
    x_api_key: Annotated[str | None, Depends(API_KEY_HEADER)],
    data: UserPlanUpdate,
):
    verify_api_key(x_api_key)
    logger.info(f"Received request to update plan for user {user_id} with data: {data}")

    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    updated_user = update_user_plan(user_id=user_id, data=data, db=db)
    return updated_user
