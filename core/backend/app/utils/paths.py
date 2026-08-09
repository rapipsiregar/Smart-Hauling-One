"""Path helpers for turning absolute filesystem paths into web-relative URLs."""

from __future__ import annotations

from pathlib import Path

from app.core.config import ROOT


def relative_to_root(path: Path | None) -> str | None:
    """Return ``path`` as a POSIX string relative to the project root.

    Returns ``None`` for ``None`` input. Paths outside the root are returned
    as their own POSIX string unchanged.
    """
    if path is None:
        return None
    path = Path(path)
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return path.as_posix()
