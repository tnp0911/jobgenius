import asyncio
import codecs
import json
import logging
import re
from typing import Any

from langchain_ollama import OllamaLLM

from app.core.config import settings

logger = logging.getLogger(__name__)


async def llm_call(prompt: str, temperature: float = 0.5):
    try:
        client = OllamaLLM(
            model=settings.OLLAMA_MODEL,
            temperature=temperature,
            base_url=settings.OLLAMA_HOST,
        )
        response = await client.ainvoke(prompt)
        return response
    except asyncio.TimeoutError:
        logger.error("[ERROR] LLM call timed out")
        return ""
    except Exception as e:
        logger.error(f"[ERROR] LLM call failed: {e}")
        return ""


def safe_parse(response: str, agent_name="unknown"):
    if not response or not isinstance(response, str):
        return {
            "error": "Empty or invalid response",
            "agent": agent_name,
            "raw": response
        }

    response = response.strip()

    if response.startswith("```"):
        # remove opening ```json
        response = re.sub(r"^```[a-zA-Z]*\n?", "", response)
        # remove closing ```
        response = re.sub(r"\n?```$", "", response)

    # 1. Direct parse
    try:
        return json.loads(response)
    except json.JSONDecodeError:
        pass

    # 2. Extract multiple JSON candidates (non-greedy)
    try:
        matches = re.findall(r"\{.*?\}", response, re.DOTALL)
        for match in matches:
            try:
                return json.loads(match)
            except json.JSONDecodeError:
                continue
    except Exception:
        pass

    # 3. Attempt quick fixes (very useful)
    try:
        fixed = response.replace("'", '"')
        fixed = re.sub(r",\s*}", "}", fixed)
        return json.loads(fixed)
    except Exception:
        pass

    # 4. Final fallback
    logger.error(f"[ERROR] {agent_name} returned invalid JSON")
    logger.error(f"Response: {response}")

    return {
        "error": "Invalid JSON",
        "agent": agent_name,
        "raw": response
    }

_OPTIMIZER_SECTION_KEYS = (
    "summary",
    "skills",
    "experience",
    "projects",
    "education",
    "other",
)


def _strip_code_fences(text: str) -> str:
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json|JSON)?[ \t]*\n?", "", cleaned)
    cleaned = re.sub(r"\n?```[ \t]*$", "", cleaned)
    if "```" not in cleaned:
        return cleaned.strip()

    fenced = re.search(
        r"```(?:json|JSON)?\s*(\{.*\})\s*```",
        cleaned,
        re.DOTALL,
    )
    if fenced:
        return fenced.group(1).strip()

    unclosed = re.search(r"```(?:json|JSON)?\s*(\{.*)", cleaned, re.DOTALL)
    if unclosed:
        return unclosed.group(1).strip()
    return cleaned.strip()


def _looks_escaped_json(text: str) -> bool:
    return bool(re.search(r'\\n|\\t|\\"|\\r', text)) and "{" in text


def _unescape_json_text(text: str) -> str:
    try:
        return codecs.decode(text, "unicode_escape")
    except Exception:
        return (
            text.replace("\\n", "\n")
            .replace("\\r", "\r")
            .replace("\\t", "\t")
            .replace('\\"', '"')
        )


def _unwrap_json_string(text: str) -> str:
    stripped = text.strip()
    if len(stripped) >= 2 and stripped[0] == '"' and stripped[-1] == '"':
        try:
            inner = json.loads(stripped)
        except json.JSONDecodeError:
            return text
        if isinstance(inner, str):
            return inner
    return text


def _normalize_optimizer_payload(parsed: Any) -> Any:
    if not isinstance(parsed, dict) or parsed.get("error"):
        return parsed
    sections = parsed.get("optimized_sections")
    if isinstance(sections, dict):
        return parsed
    lifted = {
        key: parsed[key] for key in _OPTIMIZER_SECTION_KEYS if key in parsed
    }
    if not lifted:
        return parsed
    normalized = {
        key: value
        for key, value in parsed.items()
        if key not in _OPTIMIZER_SECTION_KEYS
    }
    normalized["optimized_sections"] = lifted
    return normalized


def _extract_json_object(text: str) -> str | None:
    start = text.find("{")
    if start < 0:
        return None
    depth = 0
    in_str = False
    escape = False
    for i, ch in enumerate(text[start:], start):
        if in_str:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return None


def _fix_trailing_commas(text: str) -> str:
    return re.sub(r",(\s*[}\]])", r"\1", text)


def _is_optimizer_payload(parsed: Any) -> bool:
    if not isinstance(parsed, dict) or parsed.get("error"):
        return False
    sections = parsed.get("optimized_sections")
    if not isinstance(sections, dict):
        return False
    return any(key in sections for key in _OPTIMIZER_SECTION_KEYS)


def _optimizer_candidates(response: str) -> list[str]:
    texts = [response, _unwrap_json_string(response)]
    if _looks_escaped_json(response):
        texts.append(_unescape_json_text(response))
        texts.append(_unescape_json_text(_unwrap_json_string(response)))

    candidates: list[str] = []
    for text in texts:
        stripped = _strip_code_fences(text)
        if _looks_escaped_json(stripped):
            stripped = _unescape_json_text(stripped)
        extracted = _extract_json_object(stripped)
        if extracted:
            candidates.append(extracted)
        candidates.append(stripped)
    return candidates


def safe_parse_optimizer(response: str, agent_name="optimizer_agent"):
    """Parse Agent 4 JSON without the shared safe_parse regex / quote-swap."""
    if not response or not isinstance(response, str):
        return {
            "error": "Empty or invalid response",
            "agent": agent_name,
            "raw": response,
        }

    seen = set()
    for candidate in _optimizer_candidates(response):
        if not candidate or candidate in seen:
            continue
        seen.add(candidate)
        for text in (candidate, _fix_trailing_commas(candidate)):
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError:
                continue
            parsed = _normalize_optimizer_payload(parsed)
            if _is_optimizer_payload(parsed):
                return parsed

    logger.error("[ERROR] %s returned invalid optimizer JSON", agent_name)
    logger.error("Response: %s", response)
    return {
        "error": "Invalid JSON",
        "agent": agent_name,
        "raw": response,
    }


def _normalize_jobfinder_jobs(raw_jobs: Any) -> list[dict]:
    """Accept MCP / JSearch / JSON string shapes → list of job dicts."""
    try:
        if not raw_jobs:
            logger.error("[ERROR] agent7_jobfinder: returned no jobs")
            return []

        # List
        if isinstance(raw_jobs, list):
            # Already a list of JSearch jobs
            if all(
                isinstance(job, dict) and "job_id" in job
                for job in raw_jobs
            ):
                return raw_jobs

            # LangChain MCP content blocks
            for item in raw_jobs:
                if not isinstance(item, dict) or "text" not in item:
                    continue

                text = item["text"]

                if not isinstance(text, str) or not text.strip():
                    continue

                parsed = safe_parse(text)

                if isinstance(parsed, list):
                    return parsed

                if isinstance(parsed, dict):
                    return [parsed]

            logger.error(
                "[ERROR] agent7_jobfinder: MCP returned no valid jobs"
            )
            return []

        # Single JSON string
        if isinstance(raw_jobs, str):
            parsed = safe_parse(raw_jobs)

            if parsed is None:
                logger.error(
                    "[ERROR] agent7_jobfinder: returned invalid/empty JSON"
                )
                return []

            if isinstance(parsed, list):
                return parsed

            if isinstance(parsed, dict):
                return [parsed]

            return []

        # Single job dict
        if isinstance(raw_jobs, dict):
            return [raw_jobs]

        logger.error(
            "[ERROR] agent7_jobfinder: unsupported type: %s",
            type(raw_jobs).__name__,
        )
        return []

    except Exception:
        logger.exception(
            "[ERROR] Failed to normalize agent7 jobfinder jobs"
        )
        return []


def _last_assistant_content(messages: list) -> str:
    try:
        if not messages:
            return ""
        last = messages[-1]
        if isinstance(last, dict):
            content = last.get("content", "")
        else:
            content = getattr(last, "content", "")
        content = content if isinstance(content, str) else str(content)
        if content.startswith("```"):
            content = re.sub(r"^```[a-zA-Z]*\n?", "", content)
        if content.endswith("```"):
            content = re.sub(r"\n?```$", "", content)
        content = content.strip()
        if content:
            return codecs.decode(content, "unicode_escape")
        return content
    except Exception as e:
        logger.error(f"[ERROR] Failed to get last assistant content: {e}")
        return ""


def agent7_jobfinder_format_result(messages: list[dict[str, Any]], raw_jobs: list[dict[str, Any]]):
    try:
        formatted_message = _last_assistant_content(messages)
        formatted_jobs = _normalize_jobfinder_jobs(raw_jobs)
        if not formatted_jobs:
            return {
                "message": formatted_message,
                "jobs": [],
                "error": "No jobs found"
            }
        else:
            return {
                "message": formatted_message,
                "jobs": formatted_jobs
            }
    except Exception as e:
        logger.error(f"[ERROR] Failed to format agent7 jobfinder result: {e}")
        return {
            "message": _last_assistant_content(messages) or "Job search completed with formatting error.",
            "jobs": [],
            "error": str(e),
        }
