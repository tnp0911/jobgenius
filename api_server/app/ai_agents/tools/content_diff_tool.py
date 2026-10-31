"""
Compare Agent 4 optimized_sections with the original resume text.

Returns only description / bullet-point differences. Original wording is
kept intact after cleaning PDF artifacts (wrapped newlines, tabs, lone
bullet glyphs). Unchanged bullets are omitted.
"""

from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Any

from app.services.resume_analyzer import extract_sections_from_text

_OTHER_SOURCE_SECTIONS = ("volunteer", "certifications", "languages")

_BULLET_CHARS = (
    r"•●▪‣○◆►·∙■□*+"
    r"\-\u2013\u2014"
    r"\u2022\u25cf\u25e6\u2043\uf0b7\u00b7\u25cb"
    r""
)
_BULLET_PREFIX = re.compile(
    rf"^\s*(?:[{_BULLET_CHARS}]|\d{{1,2}}[.)]|\(\d{{1,2}}\))\s*"
)
_BULLET_ONLY = re.compile(
    rf"^\s*(?:[{_BULLET_CHARS}]|\d{{1,2}}[.)]|\(\d{{1,2}}\))\s*$"
)
_HEADING_LINE = re.compile(
    r"^\s*(?:(?:professional|technical|work|project|career|core)\s+)?"
    r"(?:summary(?:\s+of\s+qualifications)?|objective|profile|"
    r"skills|competencies|expertise|education|experience|"
    r"employment(?:\s+history)?|projects|certifications?|"
    r"languages?|volunteer(?:ing|er)?|community\s+service)\s*:?\s*$",
    re.IGNORECASE,
)
_SENTENCE_END = re.compile(r"""[.!?]"?$""")
_DATE_OR_META = re.compile(
    r"(?:"
    r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}"
    r"|\d{1,2}/\d{4}"
    r"|\d{4}\s*[-–—]\s*(?:\d{4}|present|current)"
    r")",
    re.IGNORECASE,
)


def diff_resume_content(
    resume_text: str, optimizer: dict[str, Any] | None
) -> dict[str, Any]:
    """
    Diff original resume descriptions against Agent 4 optimized_sections.

    Parameters:
        resume_text: Raw extracted resume text (may contain \\n, \\t, PDF wraps).
        optimizer: Agent 4 payload, or a graph result that contains ``optimizer``.
    """
    empty = _empty_diff()
    sections = _optimizer_sections(optimizer)
    if not resume_text or not isinstance(sections, dict):
        return empty

    original_sections = extract_sections_from_text(resume_text)
    empty["summary"] = _diff_summary(
        original_sections.get("summary", ""), sections.get("summary", "")
    )
    empty["experience"] = _diff_named_entries(
        original_sections.get("experience", ""),
        sections.get("experience"),
        name_keys=("company", "title"),
        description_key="description",
        extra_keys=("company", "title"),
    )
    empty["projects"] = _diff_named_entries(
        original_sections.get("projects", ""),
        sections.get("projects"),
        name_keys=("project_title", "role"),
        description_key="project_description",
        extra_keys=("project_title", "role"),
    )
    empty["education"] = _diff_named_entries(
        original_sections.get("education", ""),
        sections.get("education"),
        name_keys=("school", "degree"),
        description_key="description",
        extra_keys=("school", "degree"),
        include_non_bullet_lines=True,
    )
    empty["other"] = _diff_other(
        original_sections,
        sections.get("other"),
    )
    return empty


def _empty_diff() -> dict[str, Any]:
    return {
        "summary": None,
        "experience": [],
        "projects": [],
        "education": [],
        "other": [],
    }


def _optimizer_sections(optimizer: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(optimizer, dict):
        return None
    if isinstance(optimizer.get("optimized_sections"), dict):
        return optimizer["optimized_sections"]
    nested = optimizer.get("optimizer")
    if isinstance(nested, dict) and isinstance(nested.get("optimized_sections"), dict):
        return nested["optimized_sections"]
    return None


def _diff_summary(original_section: str, optimized: Any) -> dict[str, str] | None:
    optimized_text = optimized.strip() if isinstance(optimized, str) else ""
    original_text = _clean_paragraph(_strip_heading(original_section))
    if not optimized_text and not original_text:
        return None
    if _comparable(original_text) == _comparable(optimized_text):
        return None
    if not original_text and not optimized_text:
        return None
    return {
        "original": original_text,
        "optimized": optimized_text,
    }


def _diff_named_entries(
    original_section: str,
    optimized_entries: Any,
    name_keys: tuple[str, ...],
    description_key: str,
    extra_keys: tuple[str, ...],
    include_non_bullet_lines: bool = False,
) -> list[dict[str, Any]]:
    if not isinstance(optimized_entries, list):
        return []

    groups = _original_entry_groups(original_section, include_non_bullet_lines)
    used_groups: set[int] = set()
    diffs: list[dict[str, Any]] = []

    for entry in optimized_entries:
        if not isinstance(entry, dict):
            continue
        opt_bullets = _bullets_from_description(entry.get(description_key))
        if not opt_bullets:
            continue
        group_index = _match_group(entry, groups, name_keys, used_groups)
        original_units = groups[group_index]["units"] if group_index is not None else []
        if group_index is not None:
            used_groups.add(group_index)
        bullet_diffs = _align_bullets(original_units, opt_bullets)
        if not bullet_diffs:
            continue
        payload = {key: str(entry.get(key) or "") for key in extra_keys}
        payload["bullets"] = bullet_diffs
        diffs.append(payload)
    return diffs


def _diff_other(
    original_sections: dict[str, str], other: Any
) -> list[dict[str, Any]]:
    if not isinstance(other, list):
        return []

    source = "\n".join(
        original_sections.get(key, "") for key in _OTHER_SOURCE_SECTIONS
    )
    groups = _original_entry_groups(source, include_non_bullet_lines=True)
    used_groups: set[int] = set()
    diffs: list[dict[str, Any]] = []

    for block in other:
        if not isinstance(block, dict):
            continue
        category = str(block.get("category") or "")
        items = block.get("items")
        if items is None and ("company" in block or "description" in block):
            items = [block]
        if isinstance(items, list) and items and isinstance(items[0], str):
            opt_bullets = [
                (str(index + 1), item.strip())
                for index, item in enumerate(items)
                if isinstance(item, str) and item.strip()
            ]
            original_units = _flatten_units(groups)
            bullet_diffs = _align_bullets(original_units, opt_bullets)
            if bullet_diffs:
                diffs.append(
                    {
                        "category": category,
                        "company": "",
                        "title": "",
                        "bullets": bullet_diffs,
                    }
                )
            continue
        if not isinstance(items, list):
            continue
        for item in items:
            if not isinstance(item, dict):
                continue
            opt_bullets = _bullets_from_description(item.get("description"))
            if not opt_bullets:
                continue
            group_index = _match_group(
                item, groups, ("company", "title"), used_groups
            )
            original_units = groups[group_index]["units"] if group_index is not None else []
            if group_index is not None:
                used_groups.add(group_index)
            bullet_diffs = _align_bullets(original_units, opt_bullets)
            if not bullet_diffs:
                continue
            diffs.append(
                {
                    "category": category,
                    "company": str(item.get("company") or ""),
                    "title": str(item.get("title") or ""),
                    "bullets": bullet_diffs,
                }
            )
    return diffs


def _original_entry_groups(
    section_text: str, include_non_bullet_lines: bool
) -> list[dict[str, Any]]:
    prepared = _prepare_extracted_text(section_text)
    if not prepared.strip():
        return []

    lines = [line.strip() for line in prepared.splitlines()]
    groups: list[dict[str, Any]] = []
    current: dict[str, Any] = {"header": "", "units": []}

    def _commit() -> None:
        nonlocal current
        if current["units"] or current["header"]:
            groups.append(current)
        current = {"header": "", "units": []}

    index = 0
    while index < len(lines):
        line = lines[index]
        if not line or _HEADING_LINE.match(line):
            index += 1
            continue
        if _BULLET_ONLY.match(line) or _BULLET_PREFIX.match(line):
            content = _BULLET_PREFIX.sub("", line).strip()
            index += 1
            content, index = _join_wrapped(content, lines, index)
            if content:
                current["units"].append(content)
            continue
        if _is_entry_header(line) and current["units"]:
            _commit()
            current["header"] = line
            index += 1
            continue
        if not current["header"] and _is_entry_header(line):
            current["header"] = line
            index += 1
            continue
        if include_non_bullet_lines and not _is_entry_header(line):
            content, index = _join_wrapped(line, lines, index + 1)
            if content:
                current["units"].append(content)
            continue
        if not current["header"]:
            current["header"] = line
        index += 1

    _commit()
    if not groups:
        paragraph = _clean_paragraph(_strip_heading(section_text))
        if paragraph:
            return [{"header": "", "units": [paragraph]}]
    return groups


def _join_wrapped(content: str, lines: list[str], index: int) -> tuple[str, int]:
    while index < len(lines):
        nxt = lines[index].strip()
        if not nxt:
            index += 1
            if not content:
                continue
            break
        if _BULLET_ONLY.match(nxt) or _BULLET_PREFIX.match(nxt):
            break
        if _HEADING_LINE.match(nxt) or _is_entry_header(nxt):
            break
        if content and _SENTENCE_END.search(content) and nxt[0].isupper():
            break
        content = f"{content} {nxt}".strip() if content else nxt
        index += 1
    return _clean_inline(content), index


def _align_bullets(
    original_units: list[str],
    optimized_bullets: list[tuple[str, str]],
) -> list[dict[str, str]]:
    originals = [unit for unit in original_units if unit]
    optimized = [(key, text) for key, text in optimized_bullets if text]
    if not originals and not optimized:
        return []

    pairs: list[tuple[str, str, str]] = []
    if len(originals) == len(optimized):
        for original, (key, opt) in zip(originals, optimized):
            pairs.append((key, original, opt))
    else:
        matcher = SequenceMatcher(
            a=[_comparable(unit) for unit in originals],
            b=[_comparable(text) for _, text in optimized],
            autojunk=False,
        )
        used_original: set[int] = set()
        used_optimized: set[int] = set()
        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == "equal" or tag == "replace":
                shared = min(i2 - i1, j2 - j1)
                for offset in range(shared):
                    key, opt = optimized[j1 + offset]
                    pairs.append((key, originals[i1 + offset], opt))
                    used_original.add(i1 + offset)
                    used_optimized.add(j1 + offset)
                for extra in range(i1 + shared, i2):
                    pairs.append((str(extra + 1), originals[extra], ""))
                    used_original.add(extra)
                for extra in range(j1 + shared, j2):
                    key, opt = optimized[extra]
                    pairs.append((key, "", opt))
                    used_optimized.add(extra)
            elif tag == "delete":
                for extra in range(i1, i2):
                    pairs.append((str(extra + 1), originals[extra], ""))
                    used_original.add(extra)
            elif tag == "insert":
                for extra in range(j1, j2):
                    key, opt = optimized[extra]
                    pairs.append((key, "", opt))
                    used_optimized.add(extra)

    diffs: list[dict[str, str]] = []
    for key, original, opt in pairs:
        if _comparable(original) == _comparable(opt):
            continue
        if not original and not opt:
            continue
        diffs.append(
            {
                "key": key,
                "original": original,
                "optimized": opt,
            }
        )
    return diffs


def _match_group(
    entry: dict[str, Any],
    groups: list[dict[str, Any]],
    name_keys: tuple[str, ...],
    used: set[int],
) -> int | None:
    needles = [
        _comparable(str(entry.get(key) or ""))
        for key in name_keys
        if str(entry.get(key) or "").strip()
    ]
    best_index = None
    best_score = 0.0
    for index, group in enumerate(groups):
        if index in used:
            continue
        header = _comparable(group.get("header") or "")
        blob = " ".join([header, *(_comparable(unit) for unit in group["units"])])
        score = 0.0
        for needle in needles:
            if needle and needle in blob:
                score += 1.0
            elif needle:
                score += SequenceMatcher(a=needle, b=header).ratio()
        if score > best_score:
            best_score = score
            best_index = index
    if best_index is not None and best_score >= 0.6:
        return best_index
    unused = [index for index in range(len(groups)) if index not in used]
    if len(unused) == 1:
        return unused[0]
    if not needles and unused:
        return unused[0]
    return best_index if best_score >= 0.45 else (unused[0] if unused else None)


def _bullets_from_description(description: Any) -> list[tuple[str, str]]:
    if isinstance(description, dict):
        def _sort_key(key: Any) -> tuple[int, str]:
            raw = str(key)
            return (int(raw), raw) if raw.isdigit() else (10**9, raw)

        items = []
        for key in sorted(description, key=_sort_key):
            text = _clean_inline(str(description[key] or ""))
            if text:
                items.append((str(key), text))
        return items
    if isinstance(description, list):
        return [
            (str(index + 1), _clean_inline(str(item)))
            for index, item in enumerate(description)
            if str(item).strip()
        ]
    if isinstance(description, str) and description.strip():
        return [("1", _clean_inline(description))]
    return []


def _flatten_units(groups: list[dict[str, Any]]) -> list[str]:
    units: list[str] = []
    for group in groups:
        units.extend(group.get("units") or [])
    return units


def _prepare_extracted_text(text: str) -> str:
    if not text:
        return ""
    prepared = text.replace("\r\n", "\n").replace("\r", "\n").replace("\t", " ")
    prepared = prepared.replace("\xa0", " ")
    prepared = re.sub(r"[\uf0b7\u2022\u25cf\u25e6\u2043]", "•", prepared)
    return prepared


def _strip_heading(section_text: str) -> str:
    prepared = _prepare_extracted_text(section_text)
    lines = prepared.splitlines()
    if lines and _HEADING_LINE.match(lines[0].strip()):
        lines = lines[1:]
    return "\n".join(lines)


def _clean_paragraph(text: str) -> str:
    prepared = _prepare_extracted_text(text)
    pieces: list[str] = []
    for raw in prepared.splitlines():
        line = raw.strip()
        if not line or _HEADING_LINE.match(line) or _BULLET_ONLY.match(line):
            continue
        line = _BULLET_PREFIX.sub("", line).strip()
        if not line:
            continue
        if pieces and not _SENTENCE_END.search(pieces[-1]) and (
            line[0].islower() or not line[0].isalpha()
        ):
            pieces[-1] = f"{pieces[-1]} {line}"
        else:
            pieces.append(line)
    return _clean_inline(" ".join(pieces))


def _clean_inline(text: str) -> str:
    cleaned = _prepare_extracted_text(text)
    cleaned = cleaned.replace("\n", " ")
    cleaned = re.sub(r"[ ]{2,}", " ", cleaned)
    return cleaned.strip(" \t\n\r-–—*•")


def _comparable(text: str) -> str:
    normalized = _clean_inline(text).lower()
    normalized = re.sub(r"[^a-z0-9+#.\s]+", " ", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def _is_entry_header(line: str) -> bool:
    stripped = line.strip()
    if not stripped or _HEADING_LINE.match(stripped):
        return False
    if _BULLET_PREFIX.match(stripped):
        return False
    if _DATE_OR_META.search(stripped) and len(stripped) < 80:
        return True
    if "—" in stripped or "|" in stripped or " - " in stripped:
        return True
    if re.search(r"\d", stripped):
        return False
    words = re.findall(r"[A-Za-z]+", stripped)
    if len(words) >= 2 and all(word.isupper() for word in words) and len(words) <= 8:
        return True
    return False
