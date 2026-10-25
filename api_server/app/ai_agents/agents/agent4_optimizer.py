# LLM involved in this agent
import json
import logging
import re
from pathlib import Path
from typing import Any, Optional

from app.helpers.llm_call import llm_call, safe_parse_optimizer

logger = logging.getLogger(__name__)

_INSTRUCTIONS_PATH = (
    Path(__file__).parent.parent / "instructions" / "agent4_instructions.md"
)


def _pct(value: Any) -> float:
    """Normalize a 0–1 or already-percentage score to 0–100."""
    if value is None:
        return 0.0
    try:
        score = float(value)
    except (TypeError, ValueError):
        return 0.0
    if score <= 1.0:
        return round(score * 100, 2)
    return round(score, 2)


def _json_block(data: Any) -> str:
    return json.dumps(data if data is not None else {}, indent=2, default=str, ensure_ascii=False)


def _score_or_na(value: Any) -> str:
    return "N/A" if value is None else str(value)


def _section_text(sections: dict, key: str) -> str:
    value = sections.get(key, "")
    if value is None or value == "":
        return ""
    return value if isinstance(value, str) else _json_block(value)


def _fill_template(template: str, mapping: dict[str, str]) -> str:
    prompt = template
    for key, value in mapping.items():
        prompt = prompt.replace("{" + key + "}", value)
    return prompt


_GROUNDING_STOP = {
    "a",
    "an",
    "and",
    "at",
    "college",
    "corp",
    "inc",
    "in",
    "llc",
    "ltd",
    "of",
    "the",
    "to",
    "university",
}


def _normalize_for_match(text: str) -> str:
    return re.sub(r"[^a-z0-9#+.]+", " ", (text or "").lower()).strip()


def _has_word(word: str, resume_norm: str) -> bool:
    return bool(re.search(rf"\b{re.escape(word)}\b", resume_norm))


def _is_grounded(value: str, resume_norm: str) -> bool:
    """True when value is empty or its distinctive name appears in the resume."""
    norm = _normalize_for_match(value)
    if not norm:
        return True
    if norm in resume_norm:
        return True
    significant = [
        part
        for part in norm.split()
        if part not in _GROUNDING_STOP and len(part) >= 3
    ]
    if not significant:
        return _has_word(norm.split()[0], resume_norm) if norm.split() else True
    if len(significant) == 1:
        return _has_word(significant[0], resume_norm)
    matched = sum(1 for part in significant if _has_word(part, resume_norm))
    return matched >= 2


def _filter_skill_groups(groups: Any, resume_norm: str) -> list:
    if not isinstance(groups, list):
        return []
    grounded = []
    for group in groups:
        if not isinstance(group, dict):
            continue
        skills = [
            skill
            for skill in group.get("skills", [])
            if isinstance(skill, str) and _is_grounded(skill, resume_norm)
        ]
        category = group.get("category", "")
        if skills:
            grounded.append({"category": category, "skills": skills})
    return grounded


def _filter_named_entries(
    entries: Any,
    name_key: str,
    resume_norm: str,
    fallback_key: str | None = None,
) -> list:
    if not isinstance(entries, list):
        return []
    grounded = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        name = entry.get(name_key, "")
        fallback = entry.get(fallback_key, "") if fallback_key else ""
        if _is_grounded(str(name), resume_norm) and str(name).strip():
            grounded.append(entry)
        elif not str(name).strip() and fallback and _is_grounded(str(fallback), resume_norm):
            grounded.append(entry)
    return grounded


def _is_grounded_other_item(item: Any, resume_norm: str) -> bool:
    if isinstance(item, str):
        return _is_grounded(item, resume_norm)
    if not isinstance(item, dict):
        return False
    name = item.get("company") or item.get("organization") or ""
    title = item.get("title") or ""
    if str(name).strip() and _is_grounded(str(name), resume_norm):
        return True
    return not str(name).strip() and bool(title) and _is_grounded(str(title), resume_norm)


def _filter_other_sections(others: Any, resume_norm: str) -> list:
    if not isinstance(others, list):
        return []
    grounded = []
    for block in others:
        if not isinstance(block, dict):
            continue
        items = [
            item
            for item in block.get("items", [])
            if _is_grounded_other_item(item, resume_norm)
        ]
        if items:
            grounded.append({"category": block.get("category", ""), "items": items})
    return grounded


# def ground_optimizer_output(parsed: dict, resume_text: str) -> dict:
#     """Drop invented employers, schools, projects, skills, and certs."""
#     if not isinstance(parsed, dict) or parsed.get("error"):
#         return parsed

#     sections = parsed.get("optimized_sections")
#     if not isinstance(sections, dict):
#         return parsed

#     resume_norm = _normalize_for_match(resume_text)
#     before = json.dumps(sections, sort_keys=True, default=str)

#     sections["skills"] = _filter_skill_groups(sections.get("skills"), resume_norm)
#     sections["experience"] = _filter_named_entries(
#         sections.get("experience"), "company", resume_norm, "title"
#     )
#     sections["projects"] = _filter_named_entries(
#         sections.get("projects"), "project_title", resume_norm
#     )
#     sections["education"] = _filter_named_entries(
#         sections.get("education"), "school", resume_norm, "degree"
#     )
#     sections["other"] = _filter_other_sections(sections.get("other"), resume_norm)

#     keywords = parsed.get("keywords_integrated")
#     if isinstance(keywords, list):
#         parsed["keywords_integrated"] = [
#             keyword
#             for keyword in keywords
#             if isinstance(keyword, str) and _is_grounded(keyword, resume_norm)
#         ]

#     parsed["optimized_sections"] = sections
#     after = json.dumps(sections, sort_keys=True, default=str)
#     if before != after:
#         notes = parsed.get("optimization_notes") or ""
#         suffix = "Removed entries that were not supported by the original resume."
#         if suffix not in notes:
#             parsed["optimization_notes"] = f"{notes} {suffix}".strip()
#         logger.warning("Agent 4: stripped unsupported invented optimizer entries")

#     return parsed


async def optimizer_agent(
    resume_text: str,
    jd_text: Optional[str] = "",
    user_goal: Optional[str] = "",
    intent_agent_response: Optional[dict] = None,
    analyzer_agent_response: Optional[dict] = None,
    ats_agent_response: Optional[dict] = None,
):
    """
    Agent 4 — premium resume optimizer.

    Rewrites/optimizes the resume using:
      - Agent 1 intent (role, goals, keywords, strategy)
      - Agent 2 analyzer (sections, skills, JD gaps)
      - Agent 3 ATS scores (quality signals)

    Does NOT invent fake employers, dates, degrees, metrics, or skills.
    """
    intent = intent_agent_response or {}
    analyzer = analyzer_agent_response or {}
    ats = ats_agent_response or {}

    if user_goal == "":
        user_goal = "No specific goal provided."
    if jd_text == "":
        jd_text = "No job description provided."

    sections = analyzer.get("sections", {}) or {}

    template = _INSTRUCTIONS_PATH.read_text(encoding="utf-8")
    prompt = _fill_template(
        template,
        {
            "resume_text": resume_text,
            "user_goal": user_goal,
            "job_description": jd_text,
            "target_role": str(intent.get("target_role", "")),
            "seniority_level": str(intent.get("seniority_level", "")),
            "industry": str(intent.get("industry", "")),
            "priority_goals": _json_block(intent.get("priority_goals", [])),
            "focus_areas": _json_block(intent.get("focus_areas", [])),
            "top_keywords": _json_block(intent.get("top_keywords", [])),
            "optimization_strategy": _json_block(intent.get("optimization_strategy", {})),
            "hard_skills": _json_block(analyzer.get("hard_skills", [])),
            "soft_skills": _json_block(analyzer.get("soft_skills", [])),
            "years_exp": str(analyzer.get("years_exp", 0)),
            "sections": _json_block(sections),
            "summary": _section_text(sections, "summary"),
            "skills": _section_text(sections, "skills"),
            "experience": _section_text(sections, "experience"),
            "projects": _section_text(sections, "projects"),
            "education": _section_text(sections, "education"),
            "volunteer": _section_text(sections, "volunteer"),
            "metrics": _json_block(
                {
                    "has_metrics": analyzer.get("has_metrics", False),
                    "content": sections.get("metrics", ""),
                }
            ),
            "contact": _json_block(
                {
                    "emails": analyzer.get("emails", []),
                    "phone_numbers": analyzer.get("phone_numbers", []),
                }
            ),
            "missing_hard_skills": _json_block(analyzer.get("missing_hard_skills", [])),
            "missing_soft_skills": _json_block(analyzer.get("missing_soft_skills", [])),
            "matching_hard_skills_score": str(
                _pct(analyzer.get("matching_hard_skills_score", 0))
            ),
            "matching_soft_skills_score": str(
                _pct(analyzer.get("matching_soft_skills_score", 0))
            ),
            "resume_score": str(_pct(ats.get("resume_score", 0))),
            "section_score": str(_pct(ats.get("section_score", 0))),
            "experience_projects_score": str(
                _pct(ats.get("experience_projects_score", 0))
            ),
            "skills_quality_score": str(_pct(ats.get("skills_quality_score", 0))),
            "summary_quality_score": str(_pct(ats.get("summary_quality_score", 0))),
            "formatting_score": str(_pct(ats.get("formatting_score", 0))),
            "ats_score": _score_or_na(ats.get("ats_score", 0)),
            "hard_match_ats": _score_or_na(ats.get("hard_skills_score", 0)),
            "soft_match_ats": _score_or_na(ats.get("soft_skills_score", 0)),
            "certifications_score": str(ats.get("certifications_score", 0)),
            "languages_score": str(ats.get("languages_score", 0)),
            "professional_links_score": str(ats.get("professional_links_score", 0)),
            "volunteer_score": str(ats.get("volunteer_score", 0)),
        },
    )

    response = await llm_call(prompt, temperature=0.1)

    if response:
        logger.info("Agent 4: Optimizer agent response received")

    parsed = safe_parse_optimizer(response, "optimizer_agent")
    return parsed
    # return ground_optimizer_output(parsed, resume_text)
