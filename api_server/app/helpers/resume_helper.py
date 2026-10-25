import re
from typing import Any, List

from app.models.resume import ResumeAnalysis

from app.internal_db.spoken_languages import SPOKEN_LANGUAGES, PROFICIENCY_LEVELS

def normalize_text(text: str) -> str:
    return " ".join(text.lower().split())

def clean_text(text: str) -> str:
    pass

def match_variants(text: str, variants: List[str]) -> bool:
    for variant in variants:
        pattern = rf"\b{re.escape(variant.lower())}\b"
        if re.search(pattern, text):
            return True
    return False

_SPOKEN_LANGUAGES_BY_LENGTH = sorted(set(SPOKEN_LANGUAGES), key=len, reverse=True)
_PROFICIENCY_LEVELS_BY_LENGTH = sorted(set(PROFICIENCY_LEVELS), key=len, reverse=True)

def parse_proficiency_from_text(proficiency_text: str) -> str:
    normalized = normalize_text(proficiency_text)
    normalized = re.sub(r"\s+proficiency$", "", normalized).strip()
    if not normalized:
        return ""

    for level in _PROFICIENCY_LEVELS_BY_LENGTH:
        if match_variants(normalized, [level]):
            return level
    return ""


def split_language_and_proficiency(token: str) -> tuple[str | None, str]:
    """
    Match a known language at the start of the token and return the remainder
    as raw proficiency text. Works with any separator (dash, colon, spaces, etc.)
    because normalize_text collapses whitespace first.
    """
    normalized_token = normalize_text(token)
    for language in _SPOKEN_LANGUAGES_BY_LENGTH:
        match = re.match(rf"^{re.escape(language)}\b\s*(.*)$", normalized_token, re.IGNORECASE)
        if not match:
            continue

        remainder = match.group(1).strip()
        remainder = re.sub(r"^[\(\[\-:–—\|]+\s*", "", remainder).strip()
        remainder = re.sub(r"[\)\]]+\s*$", "", remainder).strip()
        return language.title(), remainder

    return None, ""


def _as_dict(value: Any) -> dict:
    return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if item is not None and str(item).strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def _as_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _as_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _section_names(sections: Any) -> list[str]:
    if isinstance(sections, dict):
        return [name for name, content in sections.items() if name and str(content).strip()]
    return _as_list(sections)



def format_analyzer_result(result: dict) -> dict:
    """
    Format the result of the multi-agents to a proper format before saving to the database (MongoDB)
    """
    intent = _as_dict(result.get("intent"))
    analyzer = _as_dict(result.get("analyzer"))
    ats = _as_dict(result.get("ats"))
    feedback = _as_dict(result.get("feedback"))
    optimizer = _as_dict(result.get("optimizer"))

    analysis = ResumeAnalysis(
        target_role=str(intent.get("target_role") or ""),
        seniority_level=str(intent.get("seniority_level") or ""),
        industry=str(intent.get("industry") or ""),
        priority_goals=_as_list(intent.get("priority_goals")),
        focus_areas=_as_list(intent.get("focus_areas")),
        top_keywords=_as_list(intent.get("top_keywords")),
        optimization_strategy=_as_dict(intent.get("optimization_strategy")),
        sections=_section_names(analyzer.get("sections")),
        years_exp=_as_int(analyzer.get("years_exp")),
        emails=_as_list(analyzer.get("emails")),
        phone_numbers=_as_list(analyzer.get("phone_numbers")),
        hard_skills=_as_list(analyzer.get("hard_skills")),
        soft_skills=_as_list(analyzer.get("soft_skills")),
        missing_hard_skills=_as_list(analyzer.get("missing_hard_skills")) or None,
        matching_hard_skills_score=(
            _as_float(analyzer["matching_hard_skills_score"])
            if analyzer.get("matching_hard_skills_score") is not None
            else None
        ),
        missing_soft_skills=_as_list(analyzer.get("missing_soft_skills")) or None,
        matching_soft_skills_score=(
            _as_float(analyzer["matching_soft_skills_score"])
            if analyzer.get("matching_soft_skills_score") is not None
            else None
        ),
        resume_score=_as_float(ats.get("resume_score")),
        section_score=_as_float(ats.get("section_score")),
        experience_projects_score=_as_float(ats.get("experience_projects_score")),
        skills_quality_score=_as_float(ats.get("skills_quality_score")),
        summary_quality_score=_as_float(ats.get("summary_quality_score")),
        formatting_score=_as_float(ats.get("formatting_score")),
        ats_score=_as_float(ats["ats_score"]) if ats.get("ats_score") is not None else None,
        hard_skills_score=_as_float(ats["hard_skills_score"]) if ats.get("hard_skills_score") is not None else None,
        soft_skills_score=_as_float(ats["soft_skills_score"]) if ats.get("soft_skills_score") is not None else None,
        section_order=_as_list(optimizer.get("section_order")),
        optimized_sections=_as_dict(optimizer.get("optimized_sections")) or None,
        keywords_integrated=_as_list(optimizer.get("keywords_integrated")),
        changes_made=_as_list(optimizer.get("changes_made") or []),
        suggested_additions_if_true=_as_list(optimizer.get("suggested_additions_if_true") or []),
        optimization_notes=str(optimizer.get("optimization_notes") or ""),
        summary=str(feedback.get("summary") or ""),
        skills_feedback=str(feedback.get("skills_feedback") or ""),
        experience_feedback=str(feedback.get("experience_feedback") or ""),
        structure_feedback=str(feedback.get("structure_feedback") or ""),
        simple_suggestions=_as_list(feedback.get("simple_suggestions")),
        strength_highlights=_as_list(feedback.get("strength_highlights")),
        growth_opportunities=_as_list(feedback.get("growth_opportunities")),
        jd_fit_analysis=str(feedback.get("jd_fit_analysis") or ""),
        certifications_feedback=str(feedback.get("certifications_feedback") or ""),
        languages_feedback=str(feedback.get("languages_feedback") or ""),
        professional_links_feedback=str(feedback.get("professional_links_feedback") or ""),
        optimizer_review=str(feedback.get("optimizer_review") or ""),
        interview_talking_points=_as_list(feedback.get("interview_talking_points")),
        priority_action_plan=_as_list(feedback.get("priority_action_plan")),
        recruiter_lens=str(feedback.get("recruiter_lens") or ""),
        competitive_positioning=str(feedback.get("competitive_positioning") or ""),
    )

    return analysis.model_dump(mode="json")


def analyzer_result_to_text(resume_text: str, result: dict) -> str:
    """
    Convert the result of the multi-agents to a single meaningful text for job recommendation
    """
    intent = _as_dict(result.get("intent"))
    analyzer = _as_dict(result.get("analyzer"))
    feedback = _as_dict(result.get("feedback") or result.get("finalizer"))
    resume_text = resume_text.strip()

    hard_skills = ", ".join(_as_list(analyzer.get("hard_skills")))
    soft_skills = ", ".join(_as_list(analyzer.get("soft_skills")))
    top_keywords = ", ".join(_as_list(intent.get("top_keywords")))
    priority_goals = "; ".join(_as_list(intent.get("priority_goals")))
    focus_areas = ", ".join(_as_list(intent.get("focus_areas")))

    parts = [
        f"Target role: {intent.get('target_role')}",
        f"Seniority level: {intent.get('seniority_level')}",
        f"Industry: {intent.get('industry')}",
        f"Years of experience: {analyzer.get('years_exp')}",
        f"Hard skills: {hard_skills}" if hard_skills else None,
        f"Soft skills: {soft_skills}" if soft_skills else None,
        f"Top keywords: {top_keywords}" if top_keywords else None,
        f"Priority goals: {priority_goals}" if priority_goals else None,
        f"Focus areas: {focus_areas}" if focus_areas else None,
        feedback.get("summary"),
        feedback.get("skills_feedback"),
        feedback.get("experience_feedback"),
        feedback.get("jd_fit_analysis"),
        feedback.get("competitive_positioning"),
        feedback.get("optimizer_review"),
        resume_text,
    ]

    return "\n".join(part.strip() for part in parts if isinstance(part, str) and part.strip())
