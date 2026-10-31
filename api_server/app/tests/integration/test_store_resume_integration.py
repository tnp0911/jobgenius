from pathlib import Path
from types import SimpleNamespace

import pytest

from app.core.config import settings
from app.db.mongo import close_mongo, get_mongo_client, init_mongo
from app.db.s3 import close_s3_client, get_s3_client, init_s3_client
from app.services.resume_service import store_resume_to_mongodb

SAMPLE_ANALYSIS = {
    "intent": {
        "target_role": "Software Engineer",
        "seniority_level": "mid",
        "industry": "tech",
        "priority_goals": ["grow"],
        "focus_areas": ["backend"],
        "top_keywords": ["python"],
        "optimization_strategy": {},
    },
    "analyzer": {
        "sections": {"experience": "built APIs"},
        "years_exp": 5,
        "emails": ["a@b.com"],
        "phone_numbers": [],
        "hard_skills": ["Python"],
        "soft_skills": ["communication"],
    },
    "ats": {
        "resume_score": 80,
        "section_score": 70,
        "experience_projects_score": 75,
        "skills_quality_score": 80,
        "summary_quality_score": 70,
        "formatting_score": 90,
    },
    "feedback": {
        "summary": "Solid resume",
        "skills_feedback": "Add keywords",
        "experience_feedback": "Quantify",
        "structure_feedback": "OK",
        "simple_suggestions": ["Add metrics"],
    },
    "optimizer": {
        "section_order": ["summary", "skills", "experience", "projects", "education"],
        "optimized_sections": {
            "summary": "Summary",
            "skills": "Skills",
            "experience": "Experience",
            "projects": "Projects",
            "education": "Education",
        },
        "keywords_integrated": ["python"],
        "changes_made": [],
        "suggested_additions_if_true": [],
        "optimization_notes": "",
    },
}

UPDATED_ANALYSIS = {
    **SAMPLE_ANALYSIS,
    "intent": {
        **SAMPLE_ANALYSIS["intent"],
        "target_role": "Senior Software Engineer",
    },
    "feedback": {
        **SAMPLE_ANALYSIS["feedback"],
        "summary": "Updated analysis after re-run",
    },
}

TEST_USER_ID = 999001
TEST_FILENAME = "integration_test_resume.pdf"


@pytest.fixture
async def infra():
    await init_mongo()
    await init_s3_client()
    yield
    await close_mongo()
    await close_s3_client()


@pytest.mark.asyncio
async def test_store_resume_to_mongodb_integration(infra, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)

    pdf_bytes = Path(r"D:\IT\My Projects\job_recommender_system\api_server\external\Tuong_Nguyen_Pham_Resume.pdf").read_bytes()
    extracted_filename = Path(TEST_FILENAME).stem
    resume_id = f"{TEST_USER_ID}_{extracted_filename}"
    resume_text = Path(r"D:\IT\My Projects\job_recommender_system\api_server\external\Tuong_Nguyen_Pham_Resume.txt").read_text()
    resume_text = resume_text.strip()

    mongo = get_mongo_client()
    db = mongo[settings.MONGODB_NAME]
    await db["resumes"].delete_many({"user_id": TEST_USER_ID})
    await db["resume_for_job_recommendation"].delete_many({"resume_id": resume_id})

    # Test store resume to MongoDB
    version = await store_resume_to_mongodb(TEST_USER_ID, TEST_FILENAME, resume_text, pdf_bytes, SAMPLE_ANALYSIS)
    assert version == 1

    doc = await db["resumes"].find_one(
        {"resume_id": resume_id},
        sort=[("version", -1)],
    )
    assert doc is not None
    assert doc["user_id"] == TEST_USER_ID
    assert doc["version"] == 1
    assert doc["filename"] == extracted_filename
    assert doc["storage_path"] == f"{TEST_USER_ID}/{extracted_filename}_1.pdf"
    assert doc.get("content_sha256")
    assert "analysis" in doc
    assert doc["analysis"]["target_role"] == "Software Engineer"

    rec = await db["resume_for_job_recommendation"].find_one({"resume_id": resume_id})
    assert rec is not None
    assert rec["version"] == 1
    assert "Software Engineer" in rec["full_combined_text"]

    s3 = await get_s3_client()
    head = s3.head_object(
        Bucket=settings.S3_BUCKET_NAME,
        Key=doc["storage_path"],
    )
    assert head["ResponseMetadata"]["HTTPStatusCode"] == 200
    view_url = s3.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.S3_BUCKET_NAME,
            "Key": doc["storage_path"],
        },
        ExpiresIn=3600,
    )
    assert view_url is not None
    assert view_url.startswith("https://") or view_url.startswith("http://")
    print(view_url)

    # Same PDF: keep version, replace analysis
    version_again = await store_resume_to_mongodb(
        TEST_USER_ID, TEST_FILENAME, resume_text, pdf_bytes, UPDATED_ANALYSIS
    )
    assert version_again == 1

    latest = await db["resumes"].find_one(
        {"resume_id": resume_id},
        sort=[("version", -1)],
    )
    assert latest["version"] == 1
    assert latest["storage_path"] == doc["storage_path"]
    assert latest.get("content_sha256") == doc.get("content_sha256")
    assert latest["analysis"]["target_role"] == "Senior Software Engineer"
    assert latest["analysis"]["summary"] == "Updated analysis after re-run"
    assert await db["resumes"].count_documents({"resume_id": resume_id}) == 1

    updated_rec = await db["resume_for_job_recommendation"].find_one(
        {"resume_id": resume_id}
    )
    assert updated_rec["version"] == 1
    assert "Senior Software Engineer" in updated_rec["full_combined_text"]
    assert "Updated analysis after re-run" in updated_rec["full_combined_text"]

    # Test store resume to MongoDB with changed PDF bytes
    changed_pdf = pdf_bytes + b"\x00"
    version_changed = await store_resume_to_mongodb(
        TEST_USER_ID, TEST_FILENAME, resume_text, changed_pdf, SAMPLE_ANALYSIS
    )
    assert version_changed == 2
    bumped = await db["resumes"].find_one(
        {"resume_id": resume_id},
        sort=[("version", -1)],
    )
    assert bumped["version"] == 2
    assert bumped["storage_path"] == f"{TEST_USER_ID}/{extracted_filename}_2.pdf"

    # Cleanup left out on purpose so you can inspect MongoDB + S3 after the run:
    # user_id=999001, resume_id=999001_integration_test_resume.pdf
    # S3: 999001/integration_test_resume.pdf/1.pdf and .../2.pdf
