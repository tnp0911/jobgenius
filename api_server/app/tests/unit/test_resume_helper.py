from app.helpers.resume_helper import (
    analyzer_result_to_text,
    format_analyzer_result,
    nested_agents_from_result,
)
from app.tests.unit.test_store_resume import SAMPLE_ANALYSIS


def test_nested_agents_from_flat_formatted_result():
    flat = format_analyzer_result(SAMPLE_ANALYSIS)
    assert "intent" not in flat
    agents = nested_agents_from_result(flat)
    assert agents["intent"]["target_role"] == "Software Engineer"
    assert agents["analyzer"]["hard_skills"] == ["Python"]
    assert agents["optimizer"]["optimized_sections"]["summary"] == "Summary"
    assert agents["feedback"]["summary"] == "Solid resume"


def test_nested_agents_from_graph_state_unchanged():
    agents = nested_agents_from_result(SAMPLE_ANALYSIS)
    assert agents["intent"]["target_role"] == "Software Engineer"
    assert agents["optimizer"]["section_order"] == ["summary", "experience"]


def test_analyzer_result_to_text_accepts_flat_dump():
    flat = format_analyzer_result(SAMPLE_ANALYSIS)
    text = analyzer_result_to_text("raw resume", flat)
    assert "Target role: Software Engineer" in text
    assert "Hard skills: Python" in text
    assert "Solid resume" in text
    assert "raw resume" in text
