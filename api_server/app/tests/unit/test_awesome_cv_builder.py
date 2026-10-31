import json
from pathlib import Path

from app.ai_agents.agents.agent5_rerender import rerender_agent
from app.ai_agents.other_resources.resume_render_latex.awesome_cv_builder import (
    build_resume_tex,
)
from app.ai_agents.other_resources.resume_render_latex.compile_latex import (
    docker_mount_and_workdir,
    prepare_workdir,
)
from app.ai_agents.other_resources.resume_render_latex.text_escape import escape_tex
from app.ai_agents.tools.content_diff_tool import diff_resume_content
from app.tests.unit.test_content_diff_tool import MESSY_RESUME, OPTIMIZER

# SAMPLE_PATH = (
#     Path(__file__).resolve().parents[3] / "external" / "sample-response.json"
# )


def test_escape_tex_special_characters():
    assert r"C\#" in escape_tex("C#")
    assert r"100\%" in escape_tex("100%")
    assert r"a\_b" in escape_tex("a_b")
    assert "---" in escape_tex("AI Hackathon — Virtual Clinic")
    assert "\n" not in escape_tex("line\nwrapped")


def test_builder_highlights_changed_bullets_not_gpa():
    tex = build_resume_tex(
        OPTIMIZER,
        resume_text=MESSY_RESUME,
        contact={"first_name": "Tuong", "last_name": "Pham", "email": "a@b.com"},
        highlight=True,
    )
    assert r"\name{Tuong}{Pham}" in tex
    assert r"\email{a@b.com}" in tex
    assert r"\usepackage{lua-ul}" in tex
    assert r"\highLight{" in tex
    assert "Was the team lead" not in tex
    assert "Led a team of 4" in tex
    assert "GPA: 4.31/4.50" in tex
    assert r"\highLight{GPA" not in tex
    assert r"\cvsection{Education}" in tex
    assert r"\cvsection{Projects}" in tex
    assert r"\cventry" in tex


def test_summary_body_is_not_glued_to_heading():
    optimizer = {
        **OPTIMIZER,
        "optimized_sections": {
            **OPTIMIZER["optimized_sections"],
            "summary": (
                "Computer science and AI student with hands-on experience. "
                "Led multiple projects including virtual clinic simulations."
            ),
        },
    }
    tex = build_resume_tex(optimizer, resume_text=MESSY_RESUME, highlight=True)
    after_heading = tex.split(r"\cvsection{Summary}", 1)[1]
    before_env, rest = after_heading.split(r"\begin{cvparagraph}", 1)
    summary_body = rest.split(r"\end{cvparagraph}", 1)[0]
    assert r"\par" in before_env
    assert summary_body.count(r"\highLight{") == 2
    first_highlight = summary_body.split(r"\highLight{", 1)[1].split("}", 1)[0]
    assert "Led multiple" not in first_highlight


def test_builder_omits_highlight_when_disabled():
    tex = build_resume_tex(
        OPTIMIZER,
        resume_text=MESSY_RESUME,
        highlight=False,
    )
    assert r"\highLight" not in tex
    assert r"lua-ul" not in tex
    assert "Led a team of 4" in tex


def test_builder_escapes_skills_and_skips_empty_experience():
    optimizer = {
        "section_order": [
            "summary",
            "skills",
            "experience",
            "projects",
            "education",
            "other",
        ],
        "optimized_sections": {
            "summary": "",
            "skills": [
                {"category": "Languages", "skills": ["Python", "C#"]},
            ],
            "experience": [],
            "projects": [],
            "education": [],
            "other": [],
        },
    }
    tex = build_resume_tex(optimizer, highlight=False)
    assert r"\cvskill{Languages}{Python, C\#}" in tex
    assert r"\cvsection{Experience}" not in tex
    assert r"\cvsection{Summary}" not in tex


def test_builder_accepts_flat_other_and_category_items():
    optimizer = {
        "optimized_sections": {
            "summary": "",
            "skills": [],
            "experience": [],
            "projects": [],
            "education": [],
            "other": [
                {
                    "company": "Centennial College Orientation",
                    "title": "Volunteer",
                    "description": {"1": "Guided students."},
                },
                {
                    "category": "Certifications",
                    "items": ["First Aid"],
                },
            ],
        }
    }
    tex = build_resume_tex(optimizer, highlight=False)
    assert r"\cvsection{Other}" in tex
    assert "Centennial College Orientation" in tex
    assert r"\cvsection{Certifications}" in tex
    assert r"\cvhonor{First Aid}" in tex


def test_builder_drops_bogus_analyzer_phones():
    tex = build_resume_tex(
        OPTIMIZER,
        resume_text=MESSY_RESUME,
        analyzer={"phone_numbers": ["4.50", "2024"], "emails": []},
        highlight=False,
    )
    assert r"\mobile" not in tex


def test_diff_keys_match_highlighted_project_items():
    diff = diff_resume_content(MESSY_RESUME, OPTIMIZER)
    tex = build_resume_tex(OPTIMIZER, resume_text=MESSY_RESUME, diff=diff)
    assert len(diff["projects"][0]["bullets"]) == 2
    assert tex.count(r"\highLight{") >= 3


def test_prepare_workdir_copies_class_and_writes_tex(tmp_path):
    workdir = prepare_workdir(tmp_path, "\\documentclass{awesome-cv}\n")
    assert (workdir / "resume.tex").read_text(encoding="utf-8").startswith(
        "\\documentclass"
    )
    assert (workdir / "awesome-cv.cls").is_file()
    assert (workdir / "latexmkrc").is_file()
    assert (workdir / "luaotfload.conf").is_file()


# def test_builder_handles_sample_response_json():
#     payload = json.loads(SAMPLE_PATH.read_text(encoding="utf-8"))
#     resume_text = "\n".join(
#         str(value)
#         for value in (payload.get("analyzer") or {}).get("sections", {}).values()
#     )
#     tex = build_resume_tex(
#         payload["optimizer"],
#         resume_text=resume_text,
#         analyzer=payload.get("analyzer"),
#         intent=payload.get("intent"),
#         highlight=True,
#     )
#     assert r"\cvsection{Projects}" in tex
#     assert r"C\#" in tex
#     assert r"\highLight{GPA" not in tex
#     assert "Virtual Clinic Simulation" in tex


def test_agent5_returns_tex_without_compiling():
    result = rerender_agent(
        MESSY_RESUME,
        OPTIMIZER,
        contact={"first_name": "Jane", "last_name": "Doe"},
        compile_pdf=False,
    )
    assert result["pdf_bytes"] is None
    assert r"\name{Jane}{Doe}" in result["tex"]
    assert r"\makecvheader" in result["tex"]
    assert r"\extrainfo{~}" in result["tex"]


def test_builder_skips_placeholder_social_when_email_present():
    tex = build_resume_tex(
        OPTIMIZER,
        resume_text=MESSY_RESUME,
        contact={"first_name": "Jane", "last_name": "Doe", "email": "jane@example.com"},
        highlight=False,
    )
    assert r"\email{jane@example.com}" in tex
    assert r"\extrainfo{~}" not in tex


def test_docker_mount_uses_named_volume_subdir(tmp_path, monkeypatch):
    base = tmp_path / "latex_work"
    job = base / "awesome-cv-abc"
    job.mkdir(parents=True)
    monkeypatch.setenv("RESUME_RENDER_LATEX_DOCKER_VOLUME", "jobgenius_latex_compile")
    monkeypatch.setenv("RESUME_RENDER_LATEX_WORKDIR", str(base))
    mount, container_wd = docker_mount_and_workdir(job)
    assert mount == "jobgenius_latex_compile:/doc"
    assert container_wd == "/doc/awesome-cv-abc"


def test_docker_mount_falls_back_to_bind_path(tmp_path, monkeypatch):
    monkeypatch.delenv("RESUME_RENDER_LATEX_DOCKER_VOLUME", raising=False)
    monkeypatch.delenv("RESUME_RENDER_LATEX_WORKDIR", raising=False)
    mount, container_wd = docker_mount_and_workdir(tmp_path)
    assert mount == f"{tmp_path.resolve()}:/doc"
    assert container_wd == "/doc"
