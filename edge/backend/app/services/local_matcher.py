"""Resolve an OCR reading against the *local* master replica.

The edge matches on-device rather than sending raw digits upstream, so a gate
keeps identifying trucks correctly while the link to the core is down.

The algorithm itself is ``vendor/hull_matching.py`` -- a verbatim copy of the
core's ``app/services/hull_matching.py``. Only the candidate source differs: the
core queries its authoritative table, this queries the replica. Keeping the
algorithm byte-identical is what stops the same truck resolving one way at the
gate and another way at the centre; ``tests/test_vendor_sync.py`` enforces it.
"""

from __future__ import annotations

from app import store
from vendor.hull_matching import (  # noqa: F401 -- re-exported for callers/tests
    AMBIGUOUS,
    EXACT,
    FUZZY,
    UNREADABLE,
    UNREGISTERED,
    HullMatch,
    extract_code,
)
from vendor.hull_matching import match_code as _match_code_pure


def match_reading(text: str | None, candidates: list[str] | None = None) -> HullMatch:
    """Resolve a raw OCR reading using the local replica."""
    known = candidates if candidates is not None else store.all_hull_codes()
    result = _match_code_pure(extract_code(text), known)
    if not result.is_registered or not result.hull_code:
        return result
    truck = store.get_by_hull_code(result.hull_code)
    if truck is None:
        return result
    return HullMatch(
        outcome=result.outcome,
        hull_code=result.hull_code,
        hull_id=truck["hull_id"],
        raw_code=result.raw_code,
        distance=result.distance,
        candidates=result.candidates,
    )


def resolve_display_hull(text: str | None, candidates: list[str] | None = None) -> str:
    """The hull id to store, or ``UNKNOWN`` when not confidently registered.

    ``UNKNOWN`` is the sentinel the core already treats as unidentified, so a
    crossing submitted with it needs no special handling upstream.
    """
    result = match_reading(text, candidates=candidates)
    return result.hull_id if (result.is_registered and result.hull_id) else "UNKNOWN"
