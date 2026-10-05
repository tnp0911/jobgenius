# LLM involved in this agent
import json
import logging
from typing import Any, Optional

from app.helpers.llm_call import llm_call, safe_parse

logger = logging.getLogger(__name__)


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
    section_flags = {
        "has_summary": analyzer.get("has_summary", False),
        "has_skills": analyzer.get("has_skills", False),
        "has_experience": analyzer.get("has_experience", False),
        "has_projects": analyzer.get("has_projects", False),
        "has_education": analyzer.get("has_education", False),
        "has_metrics": analyzer.get("has_metrics", False),
        "has_contact": bool(analyzer.get("emails") or analyzer.get("phone_numbers")),
    }
    sections = analyzer.get("sections", {})

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
    ats_score = ats.get("ats_score", 0)
    hard_match_ats = ats.get("hard_skills_score", 0)
    soft_match_ats = ats.get("soft_skills_score", 0)
    certifications_score = ats.get("certifications_score", 0)
    languages_score = ats.get("languages_score", 0)
    professional_links_score = ats.get("professional_links_score", 0)
    volunteer_score = ats.get("volunteer_score", 0)

    if jd_text != "No job description provided.":
        jd_block = f"""
            === JOB DESCRIPTION ===
            {jd_text}

            === AGENT 2 — JD SKILL MATCH ===
            Hard skills on resume: {_json_block(hard_skills)}
            Soft skills on resume: {_json_block(soft_skills)}
            Missing hard skills (JD, not on resume): {_json_block(missing_hard_skills)}
            Missing soft skills (JD, not on resume): {_json_block(missing_soft_skills)}
            Matching hard skills score: {matching_hard_skills_score}%
            Matching soft skills score: {matching_soft_skills_score}%

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
            Optional Scores:
            - Certifications Score: {certifications_score}%
            - Languages Score: {languages_score}%
            - Professional Links Score: {professional_links_score}%
            - Volunteer Score: {volunteer_score}%
            """
    else:
        jd_block = f"""
            === JOB DESCRIPTION ===
            No job description provided. Optimize for the target role and user goal only.
            Do NOT invent a JD or invent missing-JD skill claims.

            === AGENT 2 — DETECTED SKILLS ===
            Hard skills: {_json_block(hard_skills)}
            Soft skills: {_json_block(soft_skills)}

            === AGENT 3 — QUALITY SCORES ===
            - Overall Resume Score: {resume_score}%
            - Necessary Sections Score: {section_score}%
            - Experience/Projects Score: {experience_projects_score}%
            - Skills Quality Score: {skills_quality_score}%
            - Summary Quality Score: {summary_quality_score}%
            - Formatting Score: {formatting_score}%
            Optional Scores:
            - Certifications Score: {certifications_score}%
            - Languages Score: {languages_score}%
            - Professional Links Score: {professional_links_score}%
            - Volunteer Score: {volunteer_score}%
            """

    prompt = f"""
        You are an expert premium resume/CV optimizer for a job recommender system.

        Your job: rewrite and optimize the user's resume for clarity, impact, ATS-friendly structure,
        and alignment with the target role — using structured signals from earlier agents.

        === ORIGINAL RESUME ===
        {resume_text}

        === USER GOAL ===
        {user_goal}

        === AGENT 1 — INTENT & GOALS ===
        Target role: {target_role}
        Seniority: {seniority_level}
        Industry: {industry}
        Priority goals: {_json_block(priority_goals)}
        Focus areas: {_json_block(focus_areas)}
        Top keywords: {_json_block(top_keywords)}
        Optimization strategy: {_json_block(optimization_strategy)}

        === AGENT 2 — STRUCTURE & SECTIONS ===
        Estimated years of experience (from Experience section only; 0 if no Experience heading): {years_exp}
        Section presence flags: {_json_block(section_flags)}
        Extracted section contents (may be empty): {_json_block(sections)}
        Contact emails: {_json_block(analyzer.get("emails", []))}
        Phone numbers: {_json_block(analyzer.get("phone_numbers", []))}
        {jd_block}

        === HARD RULES (must follow) ===
        1. Do NOT invent employers, job titles, dates, degrees, certifications, metrics, or skills
        that are not present or clearly implied in the original resume.
        2. You MAY rephrase, reorganize, strengthen wording, add clear section headings, and
        convert weak bullets into stronger action-verb bullets — only using existing facts.
        3. You MAY surface skills from Agent 2 / the original text more clearly in a Skills section.
        4. If JD is provided:
        - Emphasize overlapping keywords and skills already on the resume
        - For missing skills: you may note them only under "suggested_additions_if_true"
            (things the candidate should add IF they have them) — never claim them as fact
        5. If the resume has no clear section headings, produce a structured resume with standard
        headings: Summary, Skills, Experience (or Projects), Education as applicable.
        6. Prefer quantified impact ONLY when numbers already exist; otherwise use clear qualitative impact.
        7. Align tone to seniority_level and target_role from Agent 1.
        8. Follow optimization_strategy.must_have as emphasis priorities; honor avoid list
        (e.g. no generic fluff, no fake metrics).
        9. Keep the optimized resume realistic, scannable, and suitable for ATS (plain text sections, clear headings).
        10. If years_exp is 0 only because headings are missing, do NOT claim the candidate has zero experience;
            structure whatever career content exists under Experience or Projects.

        === OPTIMIZATION PRIORITIES ===
        - Raise structure/readability (section_score, missing headings)
        - Strengthen Summary for target_role
        - Make Skills scannable and keyword-rich (without inventing)
        - Rewrite Experience/Projects bullets for impact and clarity
        - Integrate top_keywords naturally where already supported by content
        - Address low ATS / match scores by emphasizing true overlaps (when JD exists)

        === OUTPUT FORMAT ===
        MUST RETURN VALID JSON.
        Return ONLY valid JSON (no markdown fences):
        {{
        "optimized_resume": "",
        "optimized_sections": {{
            "summary": "",
            "skills": "",
            "experience": "",
            "projects": "",
            "education": "",
            "other": ""
        }},
        "keywords_integrated": [],
        "changes_made": [],
        "suggested_additions_if_true": [],
        "optimization_notes": ""
        }}

        Field rules:
        - optimized_resume: full plain-text optimized CV with clear headings and line breaks (\\n)
        - optimized_sections: same content broken into parts (empty string if N/A)
        - keywords_integrated: max 12 keywords from Agent 1 / JD that you intentionally emphasized
        - changes_made: max 8 short bullets describing what you improved (structure, wording, emphasis)
        - suggested_additions_if_true: max 5 optional items the user could add IF true (metrics, missing JD skills they actually have)
        - optimization_notes: 2–4 sentences on strategy used (role, scores, JD fit if any)
        
        Return a valid JSON is a MUST.
        """

    response = await llm_call(prompt)

    if response:
        logger.info("Agent 4: Optimizer agent response received")

    return safe_parse(response, "optimizer_agent")
