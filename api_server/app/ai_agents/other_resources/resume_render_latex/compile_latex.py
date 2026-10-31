"""Compile an Awesome-CV resume.tex file to PDF bytes."""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

TEMPLATE_DIR = Path(__file__).resolve().parent / "template"
_CLASS_FILES = ("awesome-cv.cls", "luaotfload.conf")
_LATEXMKRC = """\
$pdf_mode = 4;
$lualatex = 'lualatex -interaction=nonstopmode -halt-on-error -file-line-error %O %S';
$out_dir = 'build';
"""
_DEFAULT_IMAGE = "resume_render_latex:latest"
_COMPILE_TIMEOUT_SECONDS = 180


def compile_tex_to_pdf(tex: str, workdir: Path | None = None) -> bytes:
    """Write tex into a workdir, run latexmk, and return PDF bytes."""
    if not (tex or "").strip():
        raise ValueError("Cannot compile empty TeX.")

    cleanup = False
    target = workdir
    if target is None:
        env_dir = os.environ.get("RESUME_RENDER_LATEX_WORKDIR")
        if env_dir:
            base = Path(env_dir)
            base.mkdir(parents=True, exist_ok=True)
            target = Path(tempfile.mkdtemp(prefix="awesome-cv-", dir=base))
        else:
            target = Path(tempfile.mkdtemp(prefix="awesome-cv-"))
        cleanup = True
    else:
        target.mkdir(parents=True, exist_ok=True)

    try:
        prepare_workdir(target, tex)
        _run_latexmk(target)
        pdf_path = target / "build" / "resume.pdf"
        if not pdf_path.is_file():
            raise RuntimeError(
                "latexmk finished without writing build/resume.pdf.\n"
                f"{_compile_error_detail(target)}"
            )
        return pdf_path.read_bytes()
    finally:
        if cleanup:
            shutil.rmtree(target, ignore_errors=True)


def prepare_workdir(workdir: Path, tex: str) -> Path:
    """Copy the Awesome-CV class files and write resume.tex. Returns workdir."""
    workdir.mkdir(parents=True, exist_ok=True)
    class_path = TEMPLATE_DIR / "awesome-cv.cls"
    if not class_path.is_file():
        raise FileNotFoundError(f"Awesome-CV class not found: {class_path}")
    for name in _CLASS_FILES:
        source = TEMPLATE_DIR / name
        if source.is_file():
            shutil.copy2(source, workdir / name)
    (workdir / "latexmkrc").write_text(_LATEXMKRC, encoding="utf-8")
    (workdir / "resume.tex").write_text(tex, encoding="utf-8")
    return workdir


def docker_mount_and_workdir(workdir: Path) -> tuple[str, str]:
    """Return (docker -v spec, container workdir) for latexmk.

    When the ARQ worker compiles via the host Docker socket, bind-mounting
    a container path like /tmp/awesome-cv-... fails: the daemon resolves it
    on the host. Share a named volume instead and run latexmk in the
    matching subdir under /doc.
    """
    volume = (os.environ.get("RESUME_RENDER_LATEX_DOCKER_VOLUME") or "").strip()
    base_raw = (os.environ.get("RESUME_RENDER_LATEX_WORKDIR") or "").strip()
    if volume and base_raw:
        base = Path(base_raw).resolve()
        resolved = workdir.resolve()
        try:
            rel = resolved.relative_to(base)
        except ValueError:
            rel = Path(".")
        container_wd = "/doc" if str(rel) == "." else f"/doc/{rel.as_posix()}"
        return f"{volume}:/doc", container_wd
    return f"{workdir.resolve()}:/doc", "/doc"


def _run_latexmk(workdir: Path) -> None:
    if shutil.which("latexmk"):
        _run_command(
            ["latexmk", "resume.tex"],
            cwd=workdir,
        )
        return

    image = os.environ.get("RESUME_RENDER_LATEX_IMAGE", _DEFAULT_IMAGE)
    if not shutil.which("docker"):
        raise RuntimeError(
            "Neither latexmk nor docker is available. Build the "
            "resume_render_latex image and retry."
        )
    mount, container_wd = docker_mount_and_workdir(workdir)
    _run_command(
        [
            "docker",
            "run",
            "--rm",
            "--volume",
            mount,
            "--workdir",
            container_wd,
            image,
            "latexmk",
            "resume.tex",
        ],
        cwd=workdir,
    )


def _run_command(command: list[str], cwd: Path) -> None:
    try:
        result = subprocess.run(
            command,
            cwd=cwd,
            capture_output=True,
            text=True,
            check=False,
            timeout=_COMPILE_TIMEOUT_SECONDS,
        )
    except FileNotFoundError as exc:
        raise RuntimeError(f"Command not found: {command[0]}") from exc
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(
            f"latexmk timed out after {_COMPILE_TIMEOUT_SECONDS} seconds."
        ) from exc
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip()
        raise RuntimeError(
            f"{' '.join(command)} failed with exit {result.returncode}.\n"
            f"{detail[-4000:]}\n{_compile_error_detail(cwd)}"
        )


def _compile_error_detail(workdir: Path) -> str:
    log_path = workdir / "build" / "resume.log"
    if not log_path.is_file():
        return ""
    try:
        return log_path.read_text(encoding="utf-8", errors="replace")[-4000:]
    except OSError:
        return ""
