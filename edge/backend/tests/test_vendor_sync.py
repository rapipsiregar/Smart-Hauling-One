"""The vendored copies must stay byte-identical to the core's originals.

edge/ and core/ are deliberately independent codebases -- each deploys on its own,
to different hardware, without the other. The cost of that choice is duplication,
and the risk of duplication is drift.

Drift here is not cosmetic. If the matcher or the voting maths diverges, the same
truck resolves one way at the gate and another way at the centre, and the ritase
reconciliation that the whole system exists to produce quietly stops agreeing with
itself. docs/edge-system/SRS.md §3.3 is explicit that both pipelines must call
identical voting code.

This test is the guard. When it fails, copy the core file across -- do not "fix"
the edge copy independently, because that is the failure mode being prevented.
"""

from __future__ import annotations

from pathlib import Path

import pytest

EDGE_BACKEND = Path(__file__).resolve().parents[1]
CORE_BACKEND = EDGE_BACKEND.parents[1] / "core" / "backend"

# (vendored copy, the core original it must match)
VENDORED = [
    (
        EDGE_BACKEND / "vendor" / "hull_matching.py",
        CORE_BACKEND / "app" / "services" / "hull_matching.py",
    ),
    (
        EDGE_BACKEND / "vendor" / "ocr_utils.py",
        CORE_BACKEND / "labs" / "custom_model" / "ocr_utils.py",
    ),
]


@pytest.mark.parametrize(
    "copy,original", VENDORED, ids=lambda p: p.name if isinstance(p, Path) else p
)
def test_vendored_copy_matches_core(copy: Path, original: Path):
    if not original.exists():
        pytest.skip(f"core original not present at {original} (edge deployed alone)")

    assert copy.exists(), f"vendored file missing: {copy}"

    copy_bytes = copy.read_bytes()
    original_bytes = original.read_bytes()
    assert copy_bytes == original_bytes, (
        f"{copy.name} has drifted from {original}.\n"
        f"Copy the core version across:\n"
        f"    cp {original} {copy}\n"
        "Do not edit the edge copy on its own -- divergent matching or voting is "
        "exactly what this check exists to prevent."
    )


def test_vendored_modules_import_without_core():
    """The copies must not reach back into core's package namespace."""
    for copy, _ in VENDORED:
        if not copy.exists():
            continue
        source = copy.read_text(encoding="utf-8")
        assert "from app." not in source and "import app." not in source, (
            f"{copy.name} imports from core's `app` package; the edge must be "
            "deployable without core/ present."
        )
