import logging
import re
from datetime import datetime

import pymupdf
from app.helpers.resume_helper import (
    match_variants,
    normalize_text,
    parse_proficiency_from_text,
    split_language_and_proficiency,
)
from app.internal_db.skills import (
    BUSINESS_SKILL_NORMALIZATION,
    IT_SKILL_NORMALIZATION,
    SOFT_SKILL_NORMALIZATION,
)
from app.services.jd import extract_skills_from_jd_text
from fastapi import UploadFile

_HTTP_URL_PATTERN = re.compile(r"https?://[^\s<>\"'\)\],]+", re.IGNORECASE)
_BARE_PROFILE_URL_PATTERN = re.compile(
    r"(?:www\.)?(?:"
    r"linkedin\.com/(?:in|pub|company)/[\w\-_%]+|"
    r"github\.com/[\w\-]+|"
    r"gitlab\.com/[\w\-/]+"
    r")",
    re.IGNORECASE,
)
_EXCLUDED_PORTFOLIO_DOMAINS = (
    "linkedin.com",
    "github.com",
    "gitlab.com",
    "twitter.com",
    "x.com",
    "facebook.com",
    "instagram.com",
    "youtube.com",
    "mailto",
)

logger = logging.getLogger(__name__)


############################### EXTRACT SECTIONS ################################
async def convert_file_to_bytes(file: UploadFile) -> bytes:
    try:
        if not file:
            raise ValueError("File is required.")
        file_bytes = await file.read()
        if not file_bytes:
            raise ValueError("File is empty.")
        return file_bytes
    except Exception as e:
        logger.error(f"Error converting file to bytes: {e}")
        raise ValueError("Error converting file to bytes.")


def extract_text_from_resume(filename: str, resume_bytes: bytes) -> str:
    try:
        if not filename or not filename.lower().endswith(".pdf"):
            raise ValueError("Unsupported file format. Please upload a PDF.")

        doc = pymupdf.open(stream=resume_bytes, filetype="pdf")
        text = ""
        for page in doc:
            text += page.get_text()  # type: ignore
        doc.close()
        return text
    except FileNotFoundError as e:
        logger.error(f"File not found: {filename}")
        raise e
    except ValueError as e:
        logger.error(f"Unsupported file format: {filename}")
        raise e
    except Exception as e:
        logger.error(f"Error extracting text from resume: {e}")
        raise e


def __extract_soft_skills_from_text(text: str):
    text = normalize_text(text)
    found_soft_skills = {
        canonical
        for canonical, variants in SOFT_SKILL_NORMALIZATION.items()
        if match_variants(text, variants)
    }
    return list(found_soft_skills)


def extract_skills_from_text_without_jd(text: str, field: str):
    text = normalize_text(text)
    found_soft_skills = __extract_soft_skills_from_text(text)
    if field == "it" or field == "technology" or field == "software" or field == "tech":
        skills_to_check = IT_SKILL_NORMALIZATION
    elif field == "business":
        skills_to_check = BUSINESS_SKILL_NORMALIZATION
    else:
        return {"skills": [], "soft_skills": found_soft_skills}

    found_skills = {
        canonical
        for canonical, variants in skills_to_check.items()
        if match_variants(text, variants)
    }

    return {
        "skills": list(found_skills),
        "soft_skills": list(found_soft_skills),
    }


def extract_skills_from_text_with_jd(text: str, jd_text: str, limit: int = 5):
    text = normalize_text(text)
    jd_text = normalize_text(jd_text)
    jd_skills = extract_skills_from_jd_text(jd_text)
    all_skills = {**IT_SKILL_NORMALIZATION, **BUSINESS_SKILL_NORMALIZATION}
    found_skills = {
        canonical
        for canonical, variants in all_skills.items()
        if match_variants(text, variants) and canonical in jd_skills
    }
    missing_skills = set(jd_skills) - found_skills
    matching_skills_score = len(found_skills) / len(jd_skills) if jd_skills else 0.1

    found_soft_skills_from_jd = set(__extract_soft_skills_from_text(jd_text))
    found_soft_skills_from_resume = set(__extract_soft_skills_from_text(text))

    missing_soft_skills = found_soft_skills_from_jd - found_soft_skills_from_resume
    matching_soft_skills = found_soft_skills_from_jd & found_soft_skills_from_resume
    matching_soft_skills_score = (
        len(matching_soft_skills) / len(found_soft_skills_from_jd)
        if found_soft_skills_from_jd
        else 0.1
    )
    return {
        "skills": list(found_skills),
        # Limit to top 5 missing skills for free users
        "missing_skills": list(missing_skills)[:limit],
        "matching_skills_score": min(matching_skills_score, 1.0),
        "soft_skills_in_resume": list(found_soft_skills_from_resume),
        "missing_soft_skills": list(missing_soft_skills)[:limit],
        "matching_soft_skills_score": min(matching_soft_skills_score, 1.0),
    }


def extract_sections_from_text(text: str):
    text = re.sub(r"\r\n", "\n", text)
    section_patterns = {
        "summary": r"^\s*(summary|objective|profile|professional summary|career objective|professional objective|summary of qualification)\b",
        "skills": r"^\s*(skills|technical skills)\b",
        "education": r"^\s*(education|academic background)\b",
        "experience": r"^\s*(experience|work experience|employment history|professional experience)\b",
        "projects": r"^\s*(projects|project experience)\b",
        "certifications": r"^\s*(certifications|certification|courses|training|qualifications|credentials|licenses)\b",
        "languages": r"^\s*(languages|language skills)\b",
        "volunteer": r"^\s*(volunteer|volunteering|volunteer experience|community service|community involvement)\b",
    }

    matches = []
    for section, pattern in section_patterns.items():
        for match in re.finditer(pattern, text, re.IGNORECASE | re.MULTILINE):
            matches.append((section, match.start()))

    matches.sort(key=lambda x: x[1])

    extracted = {}
    for i in range(len(matches)):
        section, start = matches[i]
        end = matches[i + 1][1] if i + 1 < len(matches) else len(text)

        content = text[start:end].strip()

        # keep longest match if duplicate section appears
        if section not in extracted or len(content) > len(extracted[section]):
            extracted[section] = content

    return extracted


def extract_contact_info(text: str):
    # Use regex to find potential email addresses and phone numbers
    email_pattern = r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
    phone_pattern = (
        r"\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}"
    )

    emails = re.findall(email_pattern, text)
    phones = re.findall(phone_pattern, text)

    return {"emails": emails, "phone_numbers": phones}


def extract_certifications(certifications_text: str) -> list[str]:
    """
    Extract certifications from the certifications section content
    returned by extract_sections_from_text.
    For premium users only.
    """
    if not certifications_text or not certifications_text.strip():
        return []

    certifications = []
    seen = set()
    for index, raw_line in enumerate(re.split(r"[\r\n]+", certifications_text.strip())):
        line = re.sub(r"^\s*(?:[-•*●+]|\d+[.)])\s*", "", raw_line.strip())
        line = re.sub(r"\s{2,}", " ", line).strip(" ,;")
        if not line or re.fullmatch(r"\d{4}", line):
            continue
        if index == 0 and re.match(
            r"^\s*(certifications|certification|courses|training|qualifications|credentials|licenses)\b",
            line,
            re.IGNORECASE,
        ):
            continue

        cleaned = re.sub(
            r"\s*[\(\[]?\s*(?:issued|exp(?:ires)?)?[:\s]*\d{4}.*$",
            "",
            line,
            flags=re.IGNORECASE,
        ).strip()
        cleaned = re.sub(r"\s*[-–—]\s*\d{4}.*$", "", cleaned).strip()
        if len(cleaned) < 2:
            continue

        key = cleaned.lower()
        if key not in seen:
            seen.add(key)
            certifications.append(cleaned)

    return certifications


def extract_languages(languages_text: str) -> list[dict[str, str]]:
    """
    Extract languages from the languages section content
    returned by extract_sections_from_text.
    For premium users only.

    Returns:
        List of {"language": str, "proficiency": str} dicts.
        Only languages present in the internal database are returned.
    """
    if not languages_text or not languages_text.strip():
        return []

    languages = []
    seen = set()

    for index, raw_line in enumerate(re.split(r"[\r\n]+", languages_text.strip())):
        line = re.sub(r"^\s*(?:[-•*●+]|\d+[.)])\s*", "", raw_line.strip())
        line = re.sub(r"\s{2,}", " ", line).strip(" ,;")
        if not line:
            continue
        if index == 0 and re.match(
            r"^\s*(languages|language skills)\b", line, re.IGNORECASE
        ):
            continue

        parts = (
            re.split(r"[,;]|\band\b", line, flags=re.IGNORECASE)
            if re.search(r"[,;]|\band\b", line, re.IGNORECASE)
            else [line]
        )
        for part in parts:
            token = part.strip(" ,;")
            if not token:
                continue

            matched_language, proficiency_text = split_language_and_proficiency(token)
            if not matched_language:
                continue

            proficiency = parse_proficiency_from_text(proficiency_text)

            key = (matched_language.lower(), proficiency)
            if key not in seen:
                seen.add(key)
                languages.append(
                    {"language": matched_language, "proficiency": proficiency}
                )

    return languages


def extract_professional_links(text: str) -> dict[str, str | list[str] | None]:
    """
    Extract professional profile links from resume text.
    For premium users only.

    Returns:
        Dict with linkedin, github, gitlab, portfolio, and other link fields.
    """
    result: dict[str, str | list[str] | None] = {
        "linkedin": None,
        "github": None,
        "gitlab": None,
        "portfolio": None,
        "other": [],
    }
    if not text or not text.strip():
        return result

    found_urls: list[str] = []
    seen_urls = set()

    for match in _HTTP_URL_PATTERN.findall(text):
        url = match.strip().rstrip(".,;:)")
        if url and url not in seen_urls:
            seen_urls.add(url)
            found_urls.append(url)

    for match in _BARE_PROFILE_URL_PATTERN.findall(text):
        url = f"https://{match.strip().rstrip('.,;:)')}"
        if url not in seen_urls:
            seen_urls.add(url)
            found_urls.append(url)

    other_links: list[str] = []
    for url in found_urls:
        normalized = (
            url if url.lower().startswith(("http://", "https://")) else f"https://{url}"
        )
        lowered = normalized.lower()

        if "linkedin.com" in lowered:
            if result["linkedin"] is None:
                result["linkedin"] = normalized
            continue
        if "github.com" in lowered:
            if result["github"] is None:
                result["github"] = normalized
            continue
        if "gitlab.com" in lowered:
            if result["gitlab"] is None:
                result["gitlab"] = normalized
            continue
        if any(domain in lowered for domain in _EXCLUDED_PORTFOLIO_DOMAINS):
            continue
        if result["portfolio"] is None:
            result["portfolio"] = normalized
        else:
            other_links.append(normalized)

    result["other"] = other_links
    return result


############################### RULE-BASED ANALYSIS ################################
def __estimate_experience_years(text: str):
    total_years = 0
    current_year = datetime.now().year

    # Match: 2020 - 2023 OR 2021 - Present
    date_ranges = re.findall(
        r"(20\d{2})\s*[-–—]\s*(20\d{2}|present)", text, re.IGNORECASE
    )

    for start, end in date_ranges:
        start = int(start)
        end = current_year if end.lower() == "present" else int(end)

        if end >= start:
            total_years += end - start

    # Fallback: "3+ years"
    explicit = re.search(r"(\d+)\+?\s+years", text, re.IGNORECASE)
    if explicit:
        total_years = max(total_years, int(explicit.group(1)))

    return total_years


def estimate_experience_years_from_sections(sections: dict):
    # ✅ prioritize real experience
    text = sections.get("experience", "")
    if not text:
        return 0
    return __estimate_experience_years(text)


def has_metrics(text: str):
    # Check for presence of numbers that could indicate metrics in the experience section and/or projects section
    sections = extract_sections_from_text(text)
    experience_text = sections.get("experience", "")
    projects_text = sections.get("projects", "")
    # Look for patterns including numbers, %, $, etc. in experience and projects sections
    metrics_pattern = r"(\d+[\w%$]*)"
    # Make sure every bullet point has some metrics
    experience_bullets = [b for b in re.split(r"[\r\n]+", experience_text) if b.strip()]
    projects_bullets = [b for b in re.split(r"[\r\n]+", projects_text) if b.strip()]
    experience_metrics = sum(
        bool(re.search(metrics_pattern, bullet)) for bullet in experience_bullets
    )
    projects_metrics = sum(
        bool(re.search(metrics_pattern, bullet)) for bullet in projects_bullets
    )
    total_bullets = len(experience_bullets) + len(projects_bullets)
    if total_bullets == 0:
        return 0.0
    metrics_ratio = (experience_metrics + projects_metrics) / total_bullets
    if metrics_ratio >= 0.7:
        return 1.0
    elif metrics_ratio >= 0.5:
        return 0.7
    elif metrics_ratio >= 0.3:
        return 0.4
    else:
        return 0.0
