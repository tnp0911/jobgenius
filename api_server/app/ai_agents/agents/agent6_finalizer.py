import json
import logging
from pathlib import Path
from typing import Any, Optional

from app.helpers.llm_call import llm_call, safe_parse

logger = logging.getLogger(__name__)

_INSTRUCTIONS_PATH = (
    Path(__file__).parent.parent / "instructions" / "agent6_instructions.md"
)


def _pct(value: Any) -> float:
    """Normalize a 0–1 or already-percentage score to 0–100."""
    try:
        score = float(value)
    except (TypeError, ValueError):
        return 0.0
    if score <= 1.0:
        return round(score * 100, 2)
    return round(score, 2)


def _json_block(data: Any) -> str:
    return json.dumps(data, indent=2, default=str, ensure_ascii=False)


def _load_template(tier: str) -> str:
    raw = _INSTRUCTIONS_PATH.read_text(encoding="utf-8")
    start = f"<!-- AGENT6_TEMPLATE {tier} -->"
    end = "<!-- /AGENT6_TEMPLATE -->"
    start_idx = raw.find(start)
    if start_idx < 0:
        raise ValueError(f"Agent 6 instructions missing template: {tier}")
    body = raw[start_idx + len(start) :]
    end_idx = body.find(end)
    if end_idx < 0:
        raise ValueError(f"Agent 6 instructions missing end marker for: {tier}")
    return body[:end_idx].strip()


def _fill_template(template: str, mapping: dict[str, str]) -> str:
    prompt = template
    for key, value in mapping.items():
        prompt = prompt.replace("{" + key + "}", value)
    return prompt


async def finalizer_agent_free_tier(
    resume_text: str,
    intent: dict,
    analyzer: dict,
    ats: dict,
    jd_text: Optional[str] = "",
    user_goal: Optional[str] = "",
):
    """
    Agent 6 — final free-tier feedback.

    Args:
        resume_text: Original resume text.
        intent: Agent 1 output (target role, goals, keywords, strategy).
        analyzer: Agent 2 output (sections, skills, JD match fields if any).
        ats: Agent 3 output (resume quality / ATS scores).
        jd_text: The text of the job description.
        user_goal: The original user goal string.
    """
    intent = intent or {}
    analyzer = analyzer or {}
    ats = ats or {}

    if user_goal == "":
        user_goal = "No specific goal provided."
    if jd_text == "":
        jd_text = "No job description provided."

    # Agent 1 fields used for light personalization (still free-tier / general)
    target_role = intent.get("target_role", "")
    seniority_level = intent.get("seniority_level", "")
    industry = intent.get("industry", "")
    priority_goals = intent.get("priority_goals", [])
    focus_areas = intent.get("focus_areas", [])
    top_keywords = intent.get("top_keywords", [])
    optimization_strategy = intent.get("optimization_strategy", {})

    # Agent 2 — structure & skills
    hard_skills = analyzer.get("hard_skills", [])
    soft_skills = analyzer.get("soft_skills", [])
    years_exp = analyzer.get("years_exp", 0)
    section_flags = {
        "has_summary": analyzer.get("has_summary", False),
        "has_skills": analyzer.get("has_skills", False),
        "has_experience": analyzer.get("has_experience", False),
        "has_projects": analyzer.get("has_projects", False),
        "has_education": analyzer.get("has_education", False),
        "has_metrics": analyzer.get("has_metrics", False),
        "has_contact": bool(analyzer.get("emails") or analyzer.get("phone_numbers")),
    }

    missing_hard_skills = analyzer.get("missing_hard_skills", [])
    missing_soft_skills = analyzer.get("missing_soft_skills", [])
    matching_hard_skills_score = _pct(analyzer.get("matching_hard_skills_score", 0))
    matching_soft_skills_score = _pct(analyzer.get("matching_soft_skills_score", 0))

    # Agent 3 — quality / ATS scores
    resume_score = _pct(ats.get("resume_score", 0))
    section_score = _pct(ats.get("section_score", 0))
    experience_projects_score = _pct(ats.get("experience_projects_score", 0))
    skills_quality_score = _pct(ats.get("skills_quality_score", 0))
    summary_quality_score = _pct(ats.get("summary_quality_score", 0))
    formatting_score = _pct(ats.get("formatting_score", 0))
    ats_score = ats.get("ats_score")  # already 0–100 when present
    hard_match_ats = ats.get("hard_skills_score")
    soft_match_ats = ats.get("soft_skills_score")

    if jd_text != "No job description provided.":
        jd_scores_block = f"""
            === AGENT 2 — JD SKILL MATCH ===
            Hard skills on resume: {_json_block(hard_skills)}
            Soft skills on resume: {_json_block(soft_skills)}
            Missing hard skills (in JD, not on resume): {_json_block(missing_hard_skills)}
            Missing soft skills (in JD, not on resume): {_json_block(missing_soft_skills)}
            Matching hard skills score: {matching_hard_skills_score}%
            Matching soft skills score: {matching_soft_skills_score}%

            Job description (reference only; do not quote at length):
            {jd_text}

            === AGENT 3 — QUALITY & ATS SCORES ===
            - Overall Resume Score: {resume_score}%
            - Necessary Sections Score: {section_score}%
            - Experience/Projects Score: {experience_projects_score}%
            - Skills Quality Score: {skills_quality_score}%
            - Summary Quality Score: {summary_quality_score}%
            - Formatting Score: {formatting_score}%
            - ATS Fit Score: {ats_score if ats_score is not None else "N/A"}%
            - Hard Skills Match (ATS): {hard_match_ats if hard_match_ats is not None else "N/A"}%
            - Soft Skills Match (ATS): {soft_match_ats if soft_match_ats is not None else "N/A"}%
            """
    else:
        jd_scores_block = f"""
            === AGENT 2 — DETECTED SKILLS (no JD) ===
            Hard skills: {_json_block(hard_skills)}
            Soft skills: {_json_block(soft_skills)}
            No job description was provided — do NOT invent missing skills, JD fit, or matching scores.

            === AGENT 3 — QUALITY SCORES (no JD) ===
            - Overall Resume Score: {resume_score}%
            - Necessary Sections Score: {section_score}%
            - Experience/Projects Score: {experience_projects_score}%
            - Skills Quality Score: {skills_quality_score}%
            - Summary Quality Score: {summary_quality_score}%
            - Formatting Score: {formatting_score}%
            """

    prompt = _fill_template(
        _load_template("free"),
        {
            "resume_text": resume_text,
            "user_goal": user_goal,
            "target_role": str(target_role),
            "seniority_level": str(seniority_level),
            "industry": str(industry),
            "priority_goals": _json_block(priority_goals),
            "focus_areas": _json_block(focus_areas),
            "top_keywords": _json_block(top_keywords),
            "optimization_strategy": _json_block(optimization_strategy),
            "years_exp": str(years_exp),
            "section_flags": _json_block(section_flags),
            "jd_scores_block": jd_scores_block,
        },
    )

    response = await llm_call(prompt)

    if response:
        logger.info("Agent 6: Finalizer agent response received")
    return safe_parse(response, "finalizer_agent_free_tier")


async def finalizer_agent_premium(
    resume_text: str,
    intent: dict,
    analyzer: dict,
    ats: dict,
    optimizer: dict,
    jd_text: Optional[str] = "",
    user_goal: Optional[str] = "",
):
    """
    Agent 6 — final premium feedback.

    Args:
        resume_text: Original resume text.
        intent: Agent 1 output (target role, goals, keywords, strategy).
        analyzer: Agent 2 premium output (sections, skills, certifications, languages, links).
        ats: Agent 3 premium output (quality / ATS scores + bonus scores).
        optimizer: Agent 4 output (optimized resume and change notes).
        jd_text: The text of the job description.
        user_goal: The original user goal string.
    """
    intent = intent or {}
    analyzer = analyzer or {}
    ats = ats or {}
    optimizer = optimizer or {}

    if user_goal == "":
        user_goal = "No specific goal provided."
    if jd_text == "":
        jd_text = "No job description provided."

    target_role = intent.get("target_role", "")
    seniority_level = intent.get("seniority_level", "")
    industry = intent.get("industry", "")
    priority_goals = intent.get("priority_goals", [])
    focus_areas = intent.get("focus_areas", [])
    top_keywords = intent.get("top_keywords", [])
    optimization_strategy = intent.get("optimization_strategy", {})

    hard_skills = analyzer.get("hard_skills", [])
    soft_skills = analyzer.get("soft_skills", [])
    years_exp = analyzer.get("years_exp", 0)
    certifications = analyzer.get("certifications", [])
    languages = analyzer.get("languages", [])
    professional_links = analyzer.get("professional_links", [])
    section_flags = {
        "has_summary": analyzer.get("has_summary", False),
        "has_skills": analyzer.get("has_skills", False),
        "has_experience": analyzer.get("has_experience", False),
        "has_projects": analyzer.get("has_projects", False),
        "has_volunteer": analyzer.get("has_volunteer", False),
        "has_education": analyzer.get("has_education", False),
        "has_metrics": analyzer.get("has_metrics", False),
        "has_contact": bool(analyzer.get("emails") or analyzer.get("phone_numbers")),
    }

    missing_hard_skills = analyzer.get("missing_hard_skills", [])
    missing_soft_skills = analyzer.get("missing_soft_skills", [])
    matching_hard_skills_score = _pct(analyzer.get("matching_hard_skills_score", 0))
    matching_soft_skills_score = _pct(analyzer.get("matching_soft_skills_score", 0))

    resume_score = _pct(ats.get("resume_score", 0))
    section_score = _pct(ats.get("section_score", 0))
    experience_projects_score = _pct(ats.get("experience_projects_score", 0))
    skills_quality_score = _pct(ats.get("skills_quality_score", 0))
    summary_quality_score = _pct(ats.get("summary_quality_score", 0))
    formatting_score = _pct(ats.get("formatting_score", 0))
    ats_score = ats.get("ats_score")
    hard_match_ats = ats.get("hard_skills_score")
    soft_match_ats = ats.get("soft_skills_score")
    certifications_score = ats.get("certifications_score", 0)
    languages_score = ats.get("languages_score", 0)
    professional_links_score = ats.get("professional_links_score", 0)

    section_order = optimizer.get("section_order", [])
    optimized_sections = optimizer.get("optimized_sections", None) or {}
    keywords_integrated = optimizer.get("keywords_integrated", [])
    changes_made = optimizer.get("changes_made", [])
    suggested_additions_if_true = optimizer.get("suggested_additions_if_true", [])
    optimization_notes = optimizer.get("optimization_notes", "")

    has_jd = jd_text != "No job description provided."
    score_dashboard = f"""
        Overall Resume: {resume_score}% | Sections: {section_score}% | Experience/Projects: {experience_projects_score}%
        Skills Quality: {skills_quality_score}% | Summary: {summary_quality_score}% | Formatting: {formatting_score}%
        ATS Fit: {ats_score if ats_score is not None else "N/A"}%
        Premium bonuses — Certifications: {certifications_score} | Languages: {languages_score} | Links: {professional_links_score}
        """

    if has_jd:
        jd_scores_block = f"""
            === AGENT 2 — JD SKILL MATCH (PREMIUM) ===
            Hard skills on resume: {_json_block(hard_skills)}
            Soft skills on resume: {_json_block(soft_skills)}
            Missing hard skills (in JD, not on resume): {_json_block(missing_hard_skills)}
            Missing soft skills (in JD, not on resume): {_json_block(missing_soft_skills)}
            Matching hard skills score: {matching_hard_skills_score}%
            Matching soft skills score: {matching_soft_skills_score}%

            Certifications detected: {_json_block(certifications)}
            Languages detected: {_json_block(languages)}
            Professional links detected: {_json_block(professional_links)}

            Job description (reference only; do not quote at length):
            {jd_text}

            === AGENT 3 — QUALITY & ATS SCORES (PREMIUM) ===
            {score_dashboard}
            - Hard Skills Match (ATS): {hard_match_ats if hard_match_ats is not None else "N/A"}%
            - Soft Skills Match (ATS): {soft_match_ats if soft_match_ats is not None else "N/A"}%
            """
    else:
        jd_scores_block = f"""
            === AGENT 2 — DETECTED PROFILE (no JD) ===
            Hard skills: {_json_block(hard_skills)}
            Soft skills: {_json_block(soft_skills)}
            Certifications detected: {_json_block(certifications)}
            Languages detected: {_json_block(languages)}
            Professional links detected: {_json_block(professional_links)}
            No job description — do NOT invent JD fit, missing skills, or matching scores.

            === AGENT 3 — QUALITY SCORES (PREMIUM) ===
            {score_dashboard}
            """

    prompt = _fill_template(
        _load_template("premium"),
        {
            "score_dashboard": score_dashboard,
            "resume_text": resume_text,
            "user_goal": user_goal,
            "target_role": str(target_role),
            "seniority_level": str(seniority_level),
            "industry": str(industry),
            "priority_goals": _json_block(priority_goals),
            "focus_areas": _json_block(focus_areas),
            "top_keywords": _json_block(top_keywords),
            "optimization_strategy": _json_block(optimization_strategy),
            "years_exp": str(years_exp),
            "section_flags": _json_block(section_flags),
            "jd_scores_block": jd_scores_block,
            "optimization_notes": str(optimization_notes),
            "keywords_integrated": _json_block(keywords_integrated),
            "changes_made": _json_block(changes_made),
            "suggested_additions_if_true": _json_block(suggested_additions_if_true),
            "optimized_sections": _json_block(optimized_sections),
            "section_order": _json_block(list(section_order)),
        },
    )

    response = await llm_call(prompt)
    if response:
        logger.info("Agent 6: Finalizer agent response received")

    return safe_parse(response, "finalizer_agent_premium")
