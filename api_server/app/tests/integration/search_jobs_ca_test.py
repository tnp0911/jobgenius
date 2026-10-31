import pytest
from app.services.job_service import search_jobs_with_jsearch


@pytest.mark.asyncio
async def test_search_jobs_canada():
    result = await search_jobs_with_jsearch(
        "software engineer in Toronto, Canada", country="ca", language="en"
    )
    assert result is not None
    assert len(result) > 0
    assert "job_id" in result[0]
    assert "job_title" in result[0]
    assert "employer_name" in result[0]
    assert "job_city" in result[0]
    assert "job_state" in result[0]
    assert "job_country" in result[0]
    assert "job_apply_link" in result[0]
    assert "job_salary" in result[0]
    assert "job_min_salary" in result[0]
    assert "job_max_salary" in result[0]
    assert "job_description" in result[0]
    assert "job_highlights" in result[0]
    assert "employer_logo" in result[0]
    assert "employer_website" in result[0]
    assert "job_latitude" in result[0]
    assert "job_longitude" in result[0]
    assert "job_apply_link" in result[0]
    assert "job_is_remote" in result[0]
    assert "job_employment_type" in result[0]
    assert "job_posted_at_datetime_utc" in result[0]
    print(result)
