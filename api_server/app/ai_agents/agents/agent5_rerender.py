"""
Agent 5:
Replace the content of each section with the new content.
Create a new resume pdf with the new content using latex template.
Return the rerendered resume with highlighted content.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from app.ai_agents.other_resources.resume_render_latex.awesome_cv_builder import (
    build_resume_tex,
)
from app.ai_agents.other_resources.resume_render_latex.compile_latex import (
    compile_tex_to_pdf,
)


def rerender_agent(
    resume_text: str,
    optimizer: dict[str, Any] | None,
    analyzer: dict[str, Any] | None = None,
    intent: dict[str, Any] | None = None,
    *,
    contact: dict[str, Any] | None = None,
    highlight: bool = True,
    compile_pdf: bool = True,
    workdir: Path | None = None,
) -> dict[str, Any]:
    """Fill Awesome-CV from Agent 4 JSON and optionally compile to PDF.

    highlight=True wraps content_diff changes in \\highLight (review PDF).
    Keep/S3 should call again with highlight=False for the ATS copy.
    """
    tex = build_resume_tex(
        optimizer,
        resume_text=resume_text or "",
        analyzer=analyzer,
        intent=intent,
        contact=contact,
        highlight=highlight,
    )
    pdf_bytes = compile_tex_to_pdf(tex, workdir=workdir) if compile_pdf else None
    return {"tex": tex, "pdf_bytes": pdf_bytes}
