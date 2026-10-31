from app.services.resume_analyzer import (
    estimate_experience_years_from_sections,
    extract_certifications,
    extract_contact_info,
    extract_languages,
    extract_professional_links,
    extract_sections_from_text,
    extract_skills_from_text_with_jd,
    extract_skills_from_text_without_jd,
    has_metrics,
)


def analyzer_agent_free_tier(resume_text, industry: str = "", jd_text: str = ""):
    """
    No languages and certifications are checked for now.
    """
    sections = extract_sections_from_text(resume_text)
    years_exp = estimate_experience_years_from_sections(sections)
    has_summary_bool = "summary" in sections
    has_skills_bool = "skills" in sections
    has_experience_bool = "experience" in sections
    has_projects_bool = "projects" in sections
    has_education_bool = "education" in sections
    contact_info = extract_contact_info(resume_text)
    skills_info = None
    has_metrics_bool = has_metrics(resume_text) > 0.0

    if jd_text == "":
        skills_info = extract_skills_from_text_without_jd(resume_text, industry)
        return {
            "sections": sections,
            "years_exp": years_exp,
            "has_summary": has_summary_bool,
            "has_skills": has_skills_bool,
            "has_experience": has_experience_bool,
            "has_projects": has_projects_bool,
            "has_education": has_education_bool,
            "emails": contact_info["emails"],
            "phone_numbers": contact_info["phone_numbers"],
            "has_metrics": has_metrics_bool,
            "hard_skills": skills_info["skills"],
            "soft_skills": skills_info["soft_skills"],
        }
    else:
        skills_info = extract_skills_from_text_with_jd(resume_text, jd_text, limit=5)
        return {
            "sections": sections,
            "years_exp": years_exp,
            "has_summary": has_summary_bool,
            "has_skills": has_skills_bool,
            "has_experience": has_experience_bool,
            "has_projects": has_projects_bool,
            "has_education": has_education_bool,
            "emails": contact_info["emails"],
            "phone_numbers": contact_info["phone_numbers"],
            "has_metrics": has_metrics_bool,
            "hard_skills": skills_info["skills"],
            "soft_skills": skills_info["soft_skills_in_resume"],
            "missing_hard_skills": skills_info["missing_skills"],
            "matching_hard_skills_score": skills_info["matching_skills_score"],
            "missing_soft_skills": skills_info["missing_soft_skills"],
            "matching_soft_skills_score": skills_info["matching_soft_skills_score"],
        }


def analyzer_agent_premium(resume_text, industry: str = "", jd_text: str = ""):
    """
    Premium users have access to all the features of the free tier, plus:
    - Certifications
    - Languages
    - Professional links
    - Volunteer section
    """
    results = {}
    analyzer_agent_free_tier_result = analyzer_agent_free_tier(
        resume_text, industry, jd_text
    )
    for key, value in analyzer_agent_free_tier_result.items():
        results[key] = value
    sections = extract_sections_from_text(resume_text)
    has_volunteer_bool = "volunteer" in sections
    results["certifications"] = extract_certifications(
        sections.get("certifications", "")
    )
    results["languages"] = extract_languages(sections.get("languages", ""))
    results["professional_links"] = extract_professional_links(resume_text)
    if has_volunteer_bool:
        results["has_volunteer"] = True
    else:
        results["has_volunteer"] = False
    return results
