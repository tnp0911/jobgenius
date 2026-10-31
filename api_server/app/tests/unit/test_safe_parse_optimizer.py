from app.helpers.llm_call import safe_parse_optimizer


def test_safe_parse_optimizer_nested_object_not_first_brace():
    raw = """Here is the JSON:
```json
{
  "section_order": ["summary", "projects"],
  "optimized_sections": {
    "summary": "Backend engineer",
    "skills": "Python, FastAPI",
    "experience": "",
    "projects": "Built an ATS analyzer",
    "education": "BSc",
    "other": ""
  },
  "keywords_integrated": ["Python"],
  "changes_made": ["Rewrote summary"],
  "suggested_additions_if_true": [],
  "optimization_notes": "Kept original projects."
}
```
"""
    parsed = safe_parse_optimizer(raw)
    assert "error" not in parsed
    assert parsed["section_order"] == ["summary", "projects"]
    assert parsed["optimized_sections"]["projects"] == "Built an ATS analyzer"


def test_safe_parse_optimizer_trailing_comma_and_preface():
    raw = """Sure.
{
  "section_order": ["skills",],
  "optimized_sections": {
    "summary": "",
    "skills": "Python",
    "experience": "",
    "projects": "",
    "education": "",
    "other": "",
  },
  "keywords_integrated": [],
  "changes_made": [],
  "suggested_additions_if_true": [],
  "optimization_notes": "ok",
}
"""
    parsed = safe_parse_optimizer(raw)
    assert parsed["optimized_sections"]["skills"] == "Python"


def test_safe_parse_optimizer_does_not_swap_apostrophes():
    raw = """{
  "section_order": ["summary"],
  "optimized_sections": {
    "summary": "Improved the team's API",
    "skills": "",
    "experience": "",
    "projects": "",
    "education": "",
    "other": ""
  }
}"""
    parsed = safe_parse_optimizer(raw)
    assert parsed["optimized_sections"]["summary"] == "Improved the team's API"


def test_safe_parse_optimizer_escaped_json_fence():
    raw = (
        "```json\\n{\\n"
        '  \\"education\\": [\\n'
        "    {\\n"
        '      \\"degree\\": \\"Advanced Diploma\\",\\n'
        '      \\"school\\": \\"Centennial College\\"\\n'
        "    }\\n"
        "  ]\\n"
        "}\\n```"
    )
    parsed = safe_parse_optimizer(raw)
    assert "error" not in parsed
    assert parsed["optimized_sections"]["education"][0]["school"] == (
        "Centennial College"
    )


def test_safe_parse_optimizer_unclosed_fence_and_top_level_sections():
    raw = """```json
{
  "education": [
    {
      "degree": "Advanced Diploma",
      "school": "Centennial College"
    }
  ],
  "skills": [
    {
      "category": "Languages",
      "skills": ["Python"]
    }
  ]
}
"""
    parsed = safe_parse_optimizer(raw)
    assert "error" not in parsed
    assert parsed["optimized_sections"]["education"][0]["school"] == (
        "Centennial College"
    )
    assert parsed["optimized_sections"]["skills"][0]["skills"] == ["Python"]
