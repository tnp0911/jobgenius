import asyncio
import hashlib
import logging

from app.core.config import settings
from app.db.mongo import get_mongo_client
from app.db.s3 import get_s3_client
from app.helpers.resume_helper import analyzer_result_to_text, format_analyzer_result
from app.models.resume import Resume, ResumeAnalysis, ResumeForJobRecommendation
from botocore.exceptions import ClientError
from bson import ObjectId
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)


def _pdf_sha256(pdf_bytes: bytes) -> str:
    return hashlib.sha256(pdf_bytes).hexdigest()


def _read_s3_object_bytes(s3_client, key: str) -> bytes | None:
    try:
        obj = s3_client.get_object(Bucket=settings.S3_BUCKET_NAME, Key=key)
        body = obj.get("Body")
        if body is None:
            return None
        return body.read()
    except ClientError:
        return None


async def _is_same_pdf(
    s3_client, existing_resume: dict, pdf_bytes: bytes, digest: str
) -> bool:
    stored_digest = existing_resume.get("content_sha256")
    if stored_digest:
        return stored_digest == digest

    storage_path = existing_resume.get("storage_path") or ""
    if not storage_path:
        return False

    existing_bytes = await asyncio.to_thread(
        _read_s3_object_bytes, s3_client, storage_path
    )
    if existing_bytes is None:
        return False
    return existing_bytes == pdf_bytes


def _resume_to_mongo(resume: Resume) -> dict:
    document = resume.model_dump()
    document["_id"] = document.pop("id")
    return document


async def store_resume_to_mongodb(
    user_id: int, resume_filename: str, pdf_bytes: bytes, analyzed_result: dict
):
    try:
        s3_client = await get_s3_client()
        mongo_client = get_mongo_client()
        mongo_db = mongo_client[settings.MONGODB_NAME]
        resume_collection = mongo_db["resumes"]
        resume_for_job_recommendation_collection = mongo_db[
            "resume_for_job_recommendation"
        ]

        formatted_result = format_analyzer_result(analyzed_result)
        full_combined_text = analyzer_result_to_text(analyzed_result)
        resume_id_generator = f"{user_id}_{resume_filename}"

        existing_resume = await resume_collection.find_one(
            {"resume_id": resume_id_generator},
            sort=[("version", -1)],
        )
        digest = _pdf_sha256(pdf_bytes)
        if existing_resume and await _is_same_pdf(
            s3_client, existing_resume, pdf_bytes, digest
        ):
            logger.info(
                "Skip store: same PDF for resume_id=%s version=%s",
                resume_id_generator,
                existing_resume.get("version"),
            )
            return True

        next_version = (existing_resume["version"] + 1) if existing_resume else 1
        storage_key = f"{user_id}/{resume_filename}/{next_version}.pdf"

        await asyncio.to_thread(
            s3_client.put_object,
            Bucket=settings.S3_BUCKET_NAME,
            Key=storage_key,
            Body=pdf_bytes,
            ContentType="application/pdf",
            ContentDisposition="inline",
        )

        new_resume = Resume(
            id=ObjectId(),
            user_id=user_id,
            resume_id=resume_id_generator,
            version=next_version,
            filename=resume_filename,
            storage_path=storage_key,
            content_sha256=digest,
            analysis=formatted_result,
        )
        await resume_collection.insert_one(_resume_to_mongo(new_resume))

        existing_recommendation = (
            await resume_for_job_recommendation_collection.find_one(
                {"resume_id": resume_id_generator}
            )
        )
        if existing_recommendation is None:
            recommendation = ResumeForJobRecommendation(
                user_id=user_id,
                resume_id=resume_id_generator,
                version=next_version,
                full_combined_text=full_combined_text,
            )
            await resume_for_job_recommendation_collection.insert_one(
                recommendation.model_dump(mode="json")
            )
        else:
            await resume_for_job_recommendation_collection.update_one(
                {"resume_id": resume_id_generator},
                {
                    "$set": {
                        "user_id": user_id,
                        "full_combined_text": full_combined_text,
                        "version": next_version,
                    }
                },
            )

        return True
    except Exception as e:
        logger.error(f"Error storing resume to MongoDB: {e}")
        return False


async def get_resumes_from_mongodb(user_id: int):
    try:
        mongo_client = get_mongo_client()
        mongo_db = mongo_client[settings.MONGODB_NAME]
        resume_collection = mongo_db["resumes"]
        responses = resume_collection.find({"user_id": user_id})

        # Return indicated keys to user
        resumes = []
        async for response in responses:
            resumes.append(
                {
                    "resume_id": response["resume_id"],
                    "version": response["version"],
                    "filename": response["filename"],
                    "storage_path": f"{settings.LOCALSTACK_HOST}/{settings.S3_BUCKET_NAME}/{response["storage_path"]}",
                }
            )
        return resumes
    except Exception as e:
        logger.error(f"Error getting resume from MongoDB: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="INTERNAL_SERVER_ERROR: An error occurred while getting the resumes. Please try again later.",
        )


async def get_resume_by_id_and_version_from_mongodb(
    user_id: int, resume_id: str, version: int
):
    try:
        mongo_client = get_mongo_client()
        mongo_db = mongo_client[settings.MONGODB_NAME]
        resume_collection = mongo_db["resumes"]
        response = await resume_collection.find_one(
            {"user_id": user_id, "resume_id": resume_id, "version": version}
        )
        if response is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Resume {resume_id} version {version} of user {user_id} not found. Please run premium analysis first.",
            )
        analysis = ResumeAnalysis.model_validate(response["analysis"])
        return {
            "resume_id": response["resume_id"],
            "version": response["version"],
            "filename": response["filename"],
            "storage_path": f"{settings.LOCALSTACK_HOST}/{settings.S3_BUCKET_NAME}/{response["storage_path"]}",
            "analysis": analysis.model_dump(mode="json"),
        }
    except ValueError:
        raise
    except Exception as e:
        logger.error(f"Error getting resume by id and version from MongoDB: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="INTERNAL_SERVER_ERROR: An error occurred while getting the resume. Please try again later.",
        )


async def get_resume_by_id_from_mongodb(user_id: int, resume_id: str):
    try:
        mongo_client = get_mongo_client()
        mongo_db = mongo_client[settings.MONGODB_NAME]
        resume_collection = mongo_db["resumes"]
        responses = resume_collection.find({"user_id": user_id, "resume_id": resume_id})
        resumes = []
        async for response in responses:
            resumes.append(
                {
                    "resume_id": response["resume_id"],
                    "version": response["version"],
                    "filename": response["filename"],
                    "storage_path": f"{settings.LOCALSTACK_HOST}/{settings.S3_BUCKET_NAME}/{response["storage_path"]}",
                }
            )
        if not resumes:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Resume {resume_id} of user {user_id} not found. Please run premium analysis first.",
            )
        return resumes
    except Exception as e:
        logger.error(f"Error getting resumes by id from MongoDB: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="INTERNAL_SERVER_ERROR: An error occurred while getting the resume. Please try again later.",
        )


async def get_resume_for_job_recommendation_from_mongodb(user_id: int, resume_id: str):
    try:
        mongo_client = get_mongo_client()
        mongo_db = mongo_client[settings.MONGODB_NAME]
        resume_for_job_recommendation_collection = mongo_db[
            "resume_for_job_recommendation"
        ]
        return await resume_for_job_recommendation_collection.find_one(
            {"user_id": user_id, "resume_id": resume_id}
        )
    except Exception as e:
        logger.error(f"Error getting resume for job recommendation from MongoDB: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="INTERNAL_SERVER_ERROR: An error occurred while getting the resume for job recommendation. Please try again later.",
        )


async def delete_resume_by_id_and_version(user_id: int, resume_id: str, version: int):
    try:
        mongo_client = get_mongo_client()
        mongo_db = mongo_client[settings.MONGODB_NAME]
        resume_collection = mongo_db["resumes"]
        resume_for_job_recommendation_collection = mongo_db[
            "resume_for_job_recommendation"
        ]
        latest_version_in_job_recommendation = (
            await resume_for_job_recommendation_collection.find_one(
                {"user_id": user_id, "resume_id": resume_id}, sort=[("version", -1)]
            )
        )
        if latest_version_in_job_recommendation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Resume {resume_id} of user {user_id} not found.",
            )
        if version == latest_version_in_job_recommendation["version"]:
            raise ValueError(
                "We do not allow you to delete the latest version of the resume. Sorry for the inconvenience."
            )
        resume_doc = await resume_collection.find_one(
            {"user_id": user_id, "resume_id": resume_id, "version": version}
        )
        if resume_doc is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Resume {resume_id} version {version} of user {user_id} not found.",
            )
        delete_result = await resume_collection.delete_one(
            {"user_id": user_id, "resume_id": resume_id, "version": version}
        )
        if delete_result.deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Resume {resume_id} version {version} of user {user_id} not found.",
            )
        key = resume_doc.get("storage_path") or ""
        if key:
            s3_client = await get_s3_client()
            await asyncio.to_thread(
                s3_client.delete_object,
                Bucket=settings.S3_BUCKET_NAME,
                Key=key,
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Key (storage_path) for resume {resume_id} version {version} of user {user_id} not found.",
            )
    except ValueError:
        raise
    except Exception as e:
        logger.error(f"Error deleting resume from MongoDB: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="INTERNAL_SERVER_ERROR: An error occurred while deleting the resume. Please try again later.",
        )


async def get_latest_resume_id_for_user(user_id: int) -> str | None:
    try:
        mongo_client = get_mongo_client()
        mongo_db = mongo_client[settings.MONGODB_NAME]
        resume_collection = mongo_db["resumes"]
        latest = await resume_collection.find_one(
            {"user_id": user_id},
            sort=[("created_at", -1), ("version", -1)],
        )
        if latest is None:
            return None
        return latest["resume_id"]
    except ValueError:
        raise
    except Exception as e:
        logger.error(f"Error getting latest resume for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="INTERNAL_SERVER_ERROR: An error occurred while getting the latest resume for user. Please try again later.",
        )


async def resolve_resume_id_for_recommendations(
    user_id: int, resume_id: str | None = None
) -> str:
    try:
        if resume_id:
            rec = await get_resume_for_job_recommendation_from_mongodb(
                user_id, resume_id
            )
            if not rec:
                raise ValueError("Resume not found")
            if rec.get("user_id") != user_id:
                raise ValueError("Resume does not belong to this user")
            return resume_id

        latest_resume_id = await get_latest_resume_id_for_user(user_id)
        if not latest_resume_id:
            raise ValueError(
                "No stored resume found. Run premium resume analyze first."
            )
        return latest_resume_id
    except ValueError:
        logger.info(f"No stored resume found for user {user_id}")
        raise
    except Exception as e:
        logger.error(f"Error resolving resume id for recommendations: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="INTERNAL_SERVER_ERROR: An error occurred while resolving the resume id for recommendations. Please try again later.",
        )
