from unittest.mock import AsyncMock, MagicMock

import pytest
from bson import ObjectId

from app.services import resume_service

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
        "section_order": ["summary", "experience"],
        "optimized_sections": {"summary": "Summary", "experience": "Experience"},
        "keywords_integrated": ["python"],
        "changes_made": [],
        "suggested_additions_if_true": [],
        "optimization_notes": "",
    },
}

UPDATED_ANALYSIS = {
    **SAMPLE_ANALYSIS,
    "intent": {**SAMPLE_ANALYSIS["intent"], "target_role": "Senior Software Engineer"},
    "feedback": {**SAMPLE_ANALYSIS["feedback"], "summary": "Updated analysis after re-run"},
}


def _collections():
    resume_collection = AsyncMock()
    rec_collection = AsyncMock()
    mongo_db = {
        "resumes": resume_collection,
        "resume_for_job_recommendation": rec_collection,
    }
    mongo_client = MagicMock()
    mongo_client.__getitem__.return_value = mongo_db
    return resume_collection, rec_collection, mongo_client


@pytest.mark.asyncio
async def test_same_pdf_updates_analysis_without_new_version(monkeypatch):
    pdf_bytes = b"%PDF-1.4 same"
    existing_id = ObjectId()
    resume_collection, rec_collection, mongo_client = _collections()
    resume_collection.find_one.return_value = {
        "_id": existing_id,
        "version": 1,
        "content_sha256": resume_service._pdf_sha256(pdf_bytes),
        "storage_path": "1/foo_1.pdf",
    }
    rec_collection.find_one.return_value = {"resume_id": "1_foo"}
    s3_client = MagicMock()

    monkeypatch.setattr(resume_service, "get_s3_client", AsyncMock(return_value=s3_client))
    monkeypatch.setattr(resume_service, "get_mongo_client", lambda: mongo_client)

    ok = await resume_service.store_resume_to_mongodb(
        1, "foo.pdf", "resume text", pdf_bytes, UPDATED_ANALYSIS
    )

    assert ok is True
    resume_collection.insert_one.assert_not_called()
    s3_client.put_object.assert_not_called()
    resume_collection.update_one.assert_awaited_once()
    filter_doc, update_doc = resume_collection.update_one.await_args.args
    assert filter_doc == {"_id": existing_id}
    assert update_doc["$set"]["analysis"]["target_role"] == "Senior Software Engineer"
    assert update_doc["$set"]["analysis"]["summary"] == "Updated analysis after re-run"
    rec_collection.update_one.assert_awaited_once()
    rec_set = rec_collection.update_one.await_args.args[1]["$set"]
    assert rec_set["version"] == 1
    assert "Senior Software Engineer" in rec_set["full_combined_text"]
    assert "Updated analysis after re-run" in rec_set["full_combined_text"]


@pytest.mark.asyncio
async def test_changed_pdf_inserts_new_version(monkeypatch):
    resume_collection, rec_collection, mongo_client = _collections()
    resume_collection.find_one.return_value = {
        "_id": ObjectId(),
        "version": 1,
        "content_sha256": resume_service._pdf_sha256(b"%PDF-1.4 old"),
        "storage_path": "1/foo_1.pdf",
    }
    rec_collection.find_one.return_value = {"resume_id": "1_foo"}
    s3_client = MagicMock()

    monkeypatch.setattr(resume_service, "get_s3_client", AsyncMock(return_value=s3_client))
    monkeypatch.setattr(resume_service, "get_mongo_client", lambda: mongo_client)
    monkeypatch.setattr(resume_service.asyncio, "to_thread", AsyncMock(return_value=None))

    ok = await resume_service.store_resume_to_mongodb(
        1, "foo.pdf", "resume text", b"%PDF-1.4 new", SAMPLE_ANALYSIS
    )

    assert ok is True
    resume_collection.update_one.assert_not_called()
    resume_collection.insert_one.assert_awaited_once()
    inserted = resume_collection.insert_one.await_args.args[0]
    assert inserted["version"] == 2
    assert inserted["storage_path"] == "1/foo_2.pdf"
    rec_collection.update_one.assert_awaited_once()
    assert rec_collection.update_one.await_args.args[1]["$set"]["version"] == 2
