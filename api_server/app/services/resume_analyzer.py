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
async def convert_file_to_bytes(file: UploadFile | None) -> bytes:
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
        "summary": (
            r"summary of qualifications|professional summary|"
            r"career objective|professional objective|summary|objective|profile"
        ),
        "skills": (
            r"technical skills|core competencies|technical expertise|"
            r"technical proficiencies|skills"
        ),
        "education": r"academic background|educational qualifications|education",
        "experience": (
            r"professional experience|work experience|employment history|"
            r"relevant experience|work history|experience"
        ),
        "projects": r"project experience|personal projects|selected projects|projects",
        "certifications": (
            r"licenses and certifications|certifications|certification|"
            r"courses|training|credentials|licenses"
        ),
        "languages": r"language skills|languages",
        "volunteer": (
            r"volunteer experience|community service|community involvement|"
            r"volunteering|volunteer"
        ),
    }

    matches = []
    for section, aliases in section_patterns.items():
        # Heading at the start of a line. Allow same-line content after an
        # optional colon (PDF text often looks like "Languages: Python").
        # \b keeps "experience" from matching "experiences".
        pattern = re.compile(
            rf"^[^\S\n]*\*{{0,2}}(?:{aliases})\*{{0,2}}\b[^\S\n]*:?",
            re.IGNORECASE | re.MULTILINE,
        )

        for match in pattern.finditer(text):
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


_PHONE_PATTERN = re.compile(
    r"""
    (?<!\d)
    (?:
        \+\d{1,3}[-.\s]*\(?\d{2,4}\)?[-.\s]*\d{3,4}[-.\s]*\d{3,4}
        |
        \(\d{3}\)[-.\s]*\d{3}[-.\s]*\d{4}
        |
        \d{3}[-.\s]\d{3}[-.\s]\d{4}
    )
    (?!\d)
    """,
    re.VERBOSE,
)


def _is_phone_number(value: str) -> bool:
    digits = re.sub(r"\D", "", value)
    return 10 <= len(digits) <= 15


def extract_contact_info(text: str):
    # Use regex to find potential email addresses and phone numbers
    email_pattern = r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"

    emails = list(set(re.findall(email_pattern, text)))
    phones = [
        match.group(0)
        for match in _PHONE_PATTERN.finditer(text or "")
        if _is_phone_number(match.group(0))
    ]
    phones = list(dict.fromkeys(phones))

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


_MONTH_NAME = (
    r"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|"
    r"jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|"
    r"oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
)
_BULLET_MARK = r"[•●▪‣○◆►·∙\-–—*+]"
_BULLET_PREFIX = re.compile(
    rf"^\s*(?:{_BULLET_MARK}|\d{{1,2}}[.)]|\(\d{{1,2}}\))\s*"
)
_BULLET_ONLY = re.compile(
    rf"^\s*(?:{_BULLET_MARK}|\d{{1,2}}[.)]|\(\d{{1,2}}\))\s*$"
)
_SECTION_HEADING_LINE = re.compile(
    r"^\s*(?:(?:work|professional|project)\s+)?"
    r"(?:experience|projects|employment(?:\s+history)?)\s*:?\s*$",
    re.IGNORECASE,
)
# Employment / project dates only — not currency or plain counts.
_DATE_FRAGMENT = re.compile(
    rf"""
    (?:
        {_MONTH_NAME}\.?\s+\d{{1,2}}(?:st|nd|rd|th)?,?\s*(?:19|20)\d{{2}}
        |
        \d{{1,2}}(?:st|nd|rd|th)?\s+{_MONTH_NAME}\.?,?\s*(?:19|20)\d{{2}}
        |
        {_MONTH_NAME}\.?\s+(?:19|20)\d{{2}}
        |
        \d{{1,2}}[/.]\d{{1,2}}[/.](?:\d{{2}}|(?:19|20)\d{{2}})
        |
        \d{{1,2}}[/.](?:19|20)\d{{2}}
        |
        (?:19|20)\d{{2}}\s*[-–—]\s*(?:(?:19|20)\d{{2}}|present|current|now)
        |
        \b(?:present|current|now)\b
    )
    """,
    re.IGNORECASE | re.VERBOSE,
)
# Measurable outcomes only. [KMB] must not start a longer word (May, March, Mbps).
_METRICS_PATTERN = re.compile(
    r"""
    (?:
        \$\s*\d[\d,]*(?:\.\d+)?(?:\s*[KMB])?
        |
        \b\d+(?:\.\d+)?\s*(?:%|percent\b)
        |
        \b\d+(?:\.\d+)?\s*x\b
        |
        \b\d+(?:\.\d+)?\s*[KMB](?![A-Za-z])
        |
        \b\d+(?:\.\d+)?\s*(?:thousand|million|billion)\b
    )
    """,
    re.IGNORECASE | re.VERBOSE,
)
_SENTENCE_END = re.compile(r"""[.!?]"?$""")


def _looks_like_date_or_heading(line: str) -> bool:
    cleaned = line.strip()
    if not cleaned or _SECTION_HEADING_LINE.match(cleaned):
        return True
    if re.fullmatch(r"(?:19|20)\d{2}", cleaned):
        return True
    remainder = _DATE_FRAGMENT.sub(" ", cleaned)
    remainder = re.sub(r"(?i)\b(?:to|present|current|now)\b", " ", remainder)
    remainder = re.sub(r"[\s,|:;()\[\]/–—\-]+", "", remainder)
    return len(remainder) < 3


def _should_join_wrapped_line(current: str, nxt: str) -> bool:
    if not current:
        return True
    if not _SENTENCE_END.search(current):
        return True
    return bool(nxt) and nxt[0].islower()


def _extract_metric_bullets(section_text: str) -> list[str]:
    """Collect accomplishment bullets, joining PDF-wrapped lines.

    Skips job/project headings and start–end date lines. PDF extractors often
    emit a bullet mark on its own line, with the text (and wrapped overflow)
    on the following lines.
    """
    if not section_text:
        return []

    lines = section_text.splitlines()
    bullets: list[str] = []
    index = 0
    while index < len(lines):
        stripped = lines[index].strip()
        if not (_BULLET_ONLY.match(stripped) or _BULLET_PREFIX.match(stripped)):
            index += 1
            continue

        content = _BULLET_PREFIX.sub("", stripped).strip()
        index += 1
        while index < len(lines):
            nxt = lines[index].strip()
            if not nxt:
                index += 1
                # PDF extractors often emit "•" then a blank line, then the text.
                if not content:
                    continue
                break
            if _BULLET_ONLY.match(nxt) or _BULLET_PREFIX.match(nxt):
                break
            if _looks_like_date_or_heading(nxt):
                break
            if not _should_join_wrapped_line(content, nxt):
                break
            content = f"{content} {nxt}".strip() if content else nxt
            index += 1

        if content and not _looks_like_date_or_heading(content):
            bullets.append(content)

    return bullets


def _bullet_has_metric(bullet: str) -> bool:
    without_dates = _DATE_FRAGMENT.sub(" ", bullet)
    return bool(_METRICS_PATTERN.search(without_dates))


def has_metrics(text: str) -> float:
    sections = extract_sections_from_text(text)
    bullets = _extract_metric_bullets(sections.get("experience", "")) + _extract_metric_bullets(
        sections.get("projects", "")
    )

    if not bullets:
        return 0.0

    metrics_count = sum(_bullet_has_metric(bullet) for bullet in bullets)
    metrics_ratio = metrics_count / len(bullets)

    if metrics_ratio >= 0.7:
        return 1.0
    if metrics_ratio >= 0.5:
        return 0.7
    if metrics_ratio >= 0.3:
        return 0.4
    if metrics_count > 0.01:
        return 0.2
    return 0.0
