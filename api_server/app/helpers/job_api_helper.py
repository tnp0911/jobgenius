from datetime import datetime
from typing import Any, Optional

from app.models.job import Company, EmbeddingInfo, Job, Location, Salary

JSEARCH_SOURCE = "JSearch API"


def _parse_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def _to_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _extract_string_list(data: dict, *keys: str) -> list[str]:
    for key in keys:
        value = data.get(key)
        if isinstance(value, list):
            return [str(item).strip() for item in value if item]
        if isinstance(value, str) and value.strip():
            return [value.strip()]
    return []


def _extract_highlight_items(data: dict, *sections: str) -> list[str]:
    highlights = data.get("job_highlights")
    if not isinstance(highlights, dict):
        return []

    items: list[str] = []
    for section in sections:
        section_items = highlights.get(section)
        if isinstance(section_items, list):
            items.extend(str(item).strip() for item in section_items if item)
    return items


def jsearch_json_to_text(data: dict) -> str:
    """Combine key JSearch fields into one text blob for embedding/search."""
    parts = [
        data.get("job_title"),
        ", ".join(
            filter(
                None,
                [
                    data.get("job_city"),
                    data.get("job_state"),
                    data.get("job_country"),
                ],
            )
        ),
        data.get("job_description"),
    ]
    return "\n".join(part.strip() for part in parts if isinstance(part, str) and part.strip())


def jsearch_format_data(data: dict, json_to_text: str, pinecone_id: Optional[str] = None, model: Optional[str] = None) -> dict:
    """Map a single JSearch job object to a MongoDB-ready Job document."""
    job_id = data.get("job_id")
    if not job_id:
        raise ValueError("JSearch job missing required field: job_id")

    skills = _extract_string_list(data, "job_required_skills", "job_skills")
    requirements = _extract_string_list(
        data, "job_required_experience", "job_required_education"
    )
    requirements.extend(
        _extract_highlight_items(
            data, "Qualifications", "qualifications", "Requirements", "requirements"
        )
    )

    job = Job(
        id=str(job_id),
        source=JSEARCH_SOURCE,
        title=data.get("job_title") or "Untitled",
        company=Company(
            employer_name=data.get("employer_name") or "Unknown",
            employer_logo=data.get("employer_logo"),
            employer_website=data.get("employer_website"),
        ),
        location=Location(
            city=data.get("job_city") or "",
            province=data.get("job_state") or "",
            country=data.get("job_country").upper() if data.get("job_country") else "",
            latitude=data.get("job_latitude"),
            longitude=data.get("job_longitude"),
            remote=bool(data.get("job_is_remote")),
        ),
        apply_link=data.get("job_apply_link"),
        salary=Salary(
            job_salary_string=data.get("job_salary"),
            job_salary_min=_to_int(data.get("job_min_salary")),
            job_salary_max=_to_int(data.get("job_max_salary")),
            job_salary_currency="CAD",
        ),
        employment_type=data.get("job_employment_type"),
        job_description=data.get("job_description"),
        skills=skills,
        requirements=requirements,
        posted_at=_parse_datetime(data.get("job_posted_at_datetime_utc")),
        full_combined_text=json_to_text,
        embedding_info=EmbeddingInfo(
            status="pending" if pinecone_id is None else "completed",
            pinecone_id=pinecone_id,
            model=model,
        ),
    )

    return job.model_dump(mode="json")