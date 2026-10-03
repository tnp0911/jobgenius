import logging
import time

from app.auth.jwt_handler import decode_jwt
from app.db.redis import get_redis_client
from app.helpers.limit_helper import MONTH_LIMIT, MONTH_WINDOW, RATE_LIMIT, RATE_WINDOW
from app.helpers.user_helper import get_user_ip_address
from fastapi import FastAPI, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger(__name__)


class MyBaseHTTPMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: FastAPI):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)
        start = time.time()
        logger.info("[START] Request: %s %s", request.method, request.url)
        try:
            if (
                request.url.path.startswith("/internal/")
                or request.url.path == "/health" 
                or request.url.path == "/docs" 
                or request.url.path == "/openapi.json" 
                or request.url.path == "/redoc"
            ):
                response = await call_next(request)
                logger.info("[STATUS CODE] Response: %s", response.status_code)
                return response
            redis_client = get_redis_client()
            access_token = request.cookies.get("access_token")
            if access_token:
                payload = decode_jwt(access_token)
                if payload.get("user_id") is not None:
                    response = await call_next(request)
                    logger.info("[STATUS CODE] Response: %s", response.status_code)
                    return response

            ip = get_user_ip_address(request)
            if not ip:
                return JSONResponse(
                    status_code=status.HTTP_407_PROXY_AUTHENTICATION_REQUIRED,
                    content={
                        "detail": "Proxy authentication required. Please configure your proxy to include the client-ip-address header."
                    },
                )
            anonymous_uuid = request.cookies.get("anonymous_uuid")
            if not anonymous_uuid:
                logger.info("[STATUS CODE] Response: %s", 400)
                return JSONResponse(
                    status_code=400, content={"detail": "Anonymous UUID is required"}
                )
            anonymous_uuid = str(anonymous_uuid)
            rate_key = f"rate:{anonymous_uuid}_{ip}"
            count = await redis_client.incr(rate_key)
            if count == 1:
                await redis_client.expire(rate_key, RATE_WINDOW)
            if count > RATE_LIMIT:
                logger.warning(
                    "Rate limit exceeded for anonymous UUID: %s on IP: %s",
                    anonymous_uuid,
                    ip,
                )
                logger.info("[STATUS CODE] Response: %s", 429)
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many requests. Please try again later."},
                )
            if request.url.path.startswith("/api/recommendations"):
                response = await call_next(request)
                logger.info("[STATUS CODE] Response: %s", response.status_code)
                return response

            usage_key = f"usage:{anonymous_uuid}"
            usage = await redis_client.get(usage_key)
            if usage and int(usage) > MONTH_LIMIT:
                logger.warning(
                    "Monthly limit exceeded for anonymous UUID: %s", anonymous_uuid
                )
                logger.info("[STATUS CODE] Response: %s", 429)
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": "Monthly limit for unlogged-in users exceeded. Please login to continue."
                    },
                )
            response = await call_next(request)
            logger.info("[STATUS CODE] Response: %s", response.status_code)
            return response
        except RuntimeError as e:
            if "No response returned." in str(e) and await request.is_disconnected():
                logger.error("Request disconnected: %s", request.url)
                logger.info("[STATUS CODE] Response: %s", status.HTTP_204_NO_CONTENT)
                return Response(status_code=status.HTTP_204_NO_CONTENT)
            raise
        except Exception as e:
            logger.error("Error: %s", e)
            logger.info(
                "[STATUS CODE] Response: %s", status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            return JSONResponse(
                status_code=500, content={"detail": "Internal server error"}
            )
        finally:
            logger.info(
                "[END] Request processing time: %s seconds", time.time() - start
            )
