"""Escape user-supplied strings for Awesome-CV / LuaLaTeX."""

from __future__ import annotations

import re

_REPLACEMENTS = (
    ("\\", r"\textbackslash{}"),
    ("{", r"\{"),
    ("}", r"\}"),
    ("$", r"\$"),
    ("&", r"\&"),
    ("%", r"\%"),
    ("#", r"\#"),
    ("_", r"\_"),
    ("~", r"\textasciitilde{}"),
    ("^", r"\textasciicircum{}"),
)


def escape_tex(text: str | None) -> str:
    """Return LaTeX-safe text. Empty or None becomes an empty string."""
    if not text:
        return ""
    value = str(text).replace("\r\n", "\n").replace("\r", "\n")
    value = value.replace("\n", " ").replace("\t", " ")
    value = re.sub(r"[ ]{2,}", " ", value).strip()
    value = value.replace("—", "---").replace("–", "--")
    value = value.replace("“", "``").replace("”", "''")
    for source, target in _REPLACEMENTS:
        value = value.replace(source, target)
    return value
