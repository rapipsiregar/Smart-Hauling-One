"""Resolve an OCR reading to a registered truck in the master registry.

A gate camera can only see the 4-digit code on the unit's panel -- the operator's
``"HD"`` prefix is not painted at readable size. So the pipeline reads 4 digits and
this module resolves them against ``trucks.hull_code``.

The matching *algorithm* lives in :mod:`app.services.hull_matching`, which is pure
and is duplicated verbatim into the edge (see that module's docstring, and
``tests/test_vendor_sync.py``). This file is the thin database-bound layer: it
supplies the candidate set and turns a matched code back into the display form.
"""

from __future__ import annotations

from app.repositories import truck_master_repo
from app.services.hull_matching import (  # re-exported for callers and tests
    AMBIGUOUS,
    EXACT,
    FUZZY,
    MAX_FUZZY_DISTANCE,
    UNREADABLE,
    UNREGISTERED,
    HullMatch,
    extract_code,
)
from app.services.hull_matching import match_code as _match_code_pure

__all__ = [
    "AMBIGUOUS", "EXACT", "FUZZY", "UNREADABLE", "UNREGISTERED",
    "MAX_FUZZY_DISTANCE", "HullMatch", "extract_code",
    "match_code", "match_reading", "match_outbound", "resolve_display_hull",
]


def _with_hull_id(result: HullMatch) -> HullMatch:
    """Attach the master's display form to a resolved match."""
    if not result.is_registered or not result.hull_code:
        return result
    truck = truck_master_repo.get_by_hull_code(result.hull_code)
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


def match_code(hull_code: str | None, candidates: list[str] | None = None) -> HullMatch:
    """Resolve an extracted 4-digit code against the master registry."""
    known = candidates if candidates is not None else truck_master_repo.all_hull_codes()
    return _with_hull_id(_match_code_pure(hull_code, known))


def match_reading(text: str | None, candidates: list[str] | None = None) -> HullMatch:
    """Extract a 4-digit code from raw OCR text, then resolve it.

    The single entry point callers should use. Pass ``candidates`` to reuse one
    master snapshot across a batch instead of re-querying per reading.
    """
    return match_code(extract_code(text), candidates=candidates)


def match_outbound(text: str | None) -> HullMatch:
    """Resolve a reading at an OUT gate, trying the trucks inside the pit first.

    A truck leaving must be one that came in and has not left again, so that set
    -- typically a handful -- is a far better candidate list than the full 276.
    Two things follow from the smaller set:

    * a fuzzy correction that is ambiguous against the whole master is often
      unambiguous here, because only one of the tied units is actually inside;
    * a reading that lands on a real but absent unit no longer resolves to it.

    Falling back to the master is not optional. The pit set is inferred from
    crossings, so a missed inbound detection would otherwise turn every
    subsequent departure of that truck into UNKNOWN -- punishing a truck twice
    for one missed frame. Better to name it from the master and let the ritase
    pairing show the missing half.

    Inbound gates are untouched: an arriving truck is, by definition, not in the
    pit yet, so there is no smaller set to prefer.

    **The pit set narrows an uncertain reading; it never overrules a certain
    one.** A code the device read cleanly and that names a real master unit is
    already the answer, so the master is consulted *first* and an EXACT hit
    returns immediately. Narrowing before that check is what let a unanimous
    read of ``2222`` be "corrected" to ``HD 2221`` -- distance 1 away, and the
    only unit the system believed was inside -- silently filing a real crossing
    of one truck against another. Worse, the pit set is itself derived from
    earlier directions, so one bad direction turned into a wrong hull id, which
    then unbalanced that truck's ritase too. An exact match is the one piece of
    evidence stronger than the occupancy guess, and it now wins.
    """
    from app.services import pit_occupancy

    code = extract_code(text)

    # Consult the master first: an exact hit is stronger evidence than occupancy.
    from_master = match_code(code)
    if from_master.outcome == EXACT:
        return from_master

    inside = pit_occupancy.hull_codes_inside()
    if inside:
        result = match_code(code, candidates=inside)
        if result.is_registered:
            return result
    return from_master


def resolve_display_hull(text: str | None, candidates: list[str] | None = None) -> str:
    """The hull identifier to store for a reading.

    A registered unit resolves to the operator's own format (``"HD 2152"``). Any
    other outcome resolves to ``"UNKNOWN"`` -- the sentinel the existing dataset
    layer already treats as unidentified (``UNIDENTIFIED_HULLS`` in
    ``app/core/config.py``), so nothing downstream needs to learn a new value.
    """
    result = match_reading(text, candidates=candidates)
    if result.is_registered and result.hull_id:
        return result.hull_id
    return "UNKNOWN"
