"""Which trucks are currently inside the pit.

A truck is in exactly one place, decided by its most recent crossing: inbound
means it is inside, outbound means it has left. Crossings with no recorded time
fall back to ingest order, which is the only ordering available for them.

This is the same rule ``app/routers/dashboard.py::gate_map`` shows on screen,
kept here so the outbound matcher and the map can never disagree about who is
in the pit.
"""

from __future__ import annotations

from app.services.dataset import build_dataset
from app.services.hull_matching import extract_code

INBOUND = "inbound"
OUTBOUND = "outbound"


def _order(crossing: dict) -> tuple[str, int]:
    return (crossing.get("crossed_at") or "", int(crossing.get("id") or 0))


def latest_by_hull(crossings: list[dict] | None = None) -> dict[str, dict]:
    """Each identified truck's most recent crossing."""
    rows = crossings if crossings is not None else build_dataset()["crossings"]
    latest: dict[str, dict] = {}
    for crossing in rows:
        if not crossing.get("known"):
            continue
        hull = crossing["hull_id"]
        current = latest.get(hull)
        if current is None or _order(crossing) >= _order(current):
            latest[hull] = crossing
    return latest


def hull_ids_inside(crossings: list[dict] | None = None) -> set[str]:
    """Display ids (``"HD 2152"``) of trucks whose last crossing was inbound."""
    return {
        hull for hull, crossing in latest_by_hull(crossings).items()
        if crossing.get("direction") == INBOUND
    }


def build_occupancy(crossings: list[dict] | None = None) -> dict:
    """Who is inside the pit right now, and who has left, with the evidence.

    The same rule as everything else here -- a truck's most recent crossing says
    where it is -- but returned as a report rather than a set, so an operator can
    see *why* the system believes a given truck is inside: which gate, at what
    time, read how confidently.

    Unregistered trucks appear alongside master units, flagged. A truck the
    spreadsheet has never heard of is still occupying the pit, and leaving it out
    of the count would mean the number on screen is not the number on site.
    """
    latest = latest_by_hull(crossings)
    inside, outside, undetermined = [], [], []
    for hull, crossing in sorted(latest.items()):
        entry = {
            "hullId": hull,
            "registered": bool(crossing.get("registered", True)),
            "lastGate": crossing.get("lane"),
            "lastCameraCode": crossing.get("camera_code"),
            "lastDirection": crossing.get("direction"),
            "lastCrossedAt": crossing.get("crossed_at"),
            "confidence": crossing.get("confidence"),
        }
        direction = crossing.get("direction")
        if direction == INBOUND:
            inside.append(entry)
        elif direction == OUTBOUND:
            outside.append(entry)
        else:
            # Neither, and it must not be quietly filed as either. The device
            # could not tell which way this truck moved, so the honest report is
            # a third list an operator can act on. The old code sent it to
            # `outside` by falling through the else -- which is how a truck
            # whose only crossing had no direction disappeared from the count
            # entirely instead of raising a question.
            undetermined.append(entry)

    return {
        "insideCount": len(inside),
        "unregisteredInside": sum(1 for e in inside if not e["registered"]),
        "inside": inside,
        "outsideCount": len(outside),
        "outside": outside,
        # Trucks whose last crossing carried no direction. Surfaced, not hidden:
        # each one is a real crossing the gate saw but could not orient.
        "undeterminedCount": len(undetermined),
        "undetermined": undetermined,
    }


def hull_codes_inside(crossings: list[dict] | None = None) -> list[str]:
    """The 4-digit codes of the trucks currently inside.

    Codes, not display ids, because that is what the matcher compares against.
    A display id with no extractable code is dropped rather than guessed at.
    """
    codes = []
    for hull_id in hull_ids_inside(crossings):
        code = extract_code(hull_id)
        if code:
            codes.append(code)
    return sorted(set(codes))
