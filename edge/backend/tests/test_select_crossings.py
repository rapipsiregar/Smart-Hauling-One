"""Which of a clip's Detection Windows become crossings.

These clips run ~8 s against a 6 s ``detect_window_sec``, so one truck pass
closes a window at the cap and opens another. Recording every window filed one
pass as several crossings -- and worse, a misreading second window became a
phantom truck once the first had already taken the real one out of the pit.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

os.environ.setdefault("SMART_GATE_RUN_AGENT", "false")
os.environ.setdefault(
    "SMART_GATE_EDGE_DB", str(Path(tempfile.mkdtemp()) / "edge-test.db")
)

from app.services.test_runs import select_crossings  # noqa: E402
from vendor.hull_matching import EXACT, UNREGISTERED, HullMatch  # noqa: E402


def _window(hull_id, *, outcome=EXACT, reads=8, conf=0.95, raw=None, direction=None):
    return {
        "hull_id": hull_id,
        "match": HullMatch(outcome=outcome, hull_code=raw, hull_id=hull_id,
                           raw_code=raw or (hull_id or "").replace("HD ", "")),
        "result": {"read_count": reads, "confidence": conf, "hull_id": hull_id},
        "direction": direction,
    }


def _hulls(selected):
    return sorted(e["hull_id"] for e in selected)


def test_repeat_windows_of_one_truck_become_one_crossing() -> None:
    selected = select_crossings([
        _window("HD 2152", reads=6),
        _window("HD 2152", reads=11),
    ])

    assert _hulls(selected) == ["HD 2152"]
    # The stronger window is the one kept.
    assert selected[0]["result"]["read_count"] == 11


def test_a_misreading_second_window_never_becomes_a_phantom_truck() -> None:
    """The 2254 case, exactly. Its first window identified 2264; the second
    misread it, and with 2264 already marked as departed there was nothing left
    to match against."""
    selected = select_crossings([
        _window("HD 2264", reads=9),
        _window("UNKNOWN", outcome=UNREGISTERED, reads=4, raw="2254"),
    ])

    assert _hulls(selected) == ["HD 2264"]


def test_two_different_trucks_in_one_clip_stay_two_crossings() -> None:
    """Reference footage sometimes carries several trucks; collapsing to one
    would lose a real pass."""
    selected = select_crossings([
        _window("HD 2152", reads=7),
        _window("HD 2264", reads=9),
    ])

    assert _hulls(selected) == ["HD 2152", "HD 2264"]


def test_an_unregistered_truck_still_gets_exactly_one_crossing() -> None:
    """Nothing was identified, so the strongest unresolved window stands alone --
    otherwise a truck missing from the master would produce no crossing at all."""
    selected = select_crossings([
        _window("UNKNOWN", outcome=UNREGISTERED, reads=5, raw="8901"),
        _window("UNKNOWN", outcome=UNREGISTERED, reads=14, raw="8901"),
        _window("UNKNOWN", outcome=UNREGISTERED, reads=9, raw="8901"),
    ])

    assert len(selected) == 1
    assert selected[0]["result"]["read_count"] == 14


def test_windows_that_read_nothing_produce_no_crossing() -> None:
    """A truck was seen but never read. That is not a crossing to file."""
    assert select_crossings([
        _window("UNKNOWN", outcome=UNREGISTERED, reads=0, raw=None),
    ]) == []


def test_no_windows_at_all_is_not_an_error() -> None:
    assert select_crossings([]) == []


def test_an_identified_truck_wins_over_a_longer_unresolved_window() -> None:
    """Read count breaks ties between equals, not between a match and a miss."""
    selected = select_crossings([
        _window("HD 2221", reads=3),
        _window("UNKNOWN", outcome=UNREGISTERED, reads=30, raw="9999"),
    ])

    assert _hulls(selected) == ["HD 2221"]


# --- direction carried across a split pass -----------------------------------

def test_a_direction_survives_when_the_clearest_window_missed_it() -> None:
    """The 6s cap splits one pass; the trailing fragment reads best but barely moves.

    Measured on the reference footage: window 1 travels 0.26-0.79 of frame width
    and resolves a direction, window 2 travels 0.006-0.16 and often resolves
    none — while carrying the better reading. Ranking ignores direction (it
    should: the clearest plate is not the window that saw movement), so without
    this the recorded crossing had no direction at all, which is exactly what
    leaves a ritase unpaired.
    """
    selected = select_crossings([
        _window("HD 2152", reads=6, direction="inbound"),
        _window("HD 2152", reads=14, direction=None),
    ])
    assert len(selected) == 1
    assert selected[0]["result"]["read_count"] == 14   # still the best reading
    assert selected[0]["direction"] == "inbound"       # ...with the observed direction


def test_a_window_with_its_own_direction_keeps_it() -> None:
    selected = select_crossings([
        _window("HD 2152", reads=6, direction="outbound"),
        _window("HD 2152", reads=14, direction="inbound"),
    ])
    assert selected[0]["direction"] == "inbound"


def test_disagreeing_windows_leave_the_direction_unknown() -> None:
    """A truck that reversed, or a second vehicle in frame — a real ambiguity.

    Picking a side would invent the one fact ritase pairing depends on. Observed
    on the 2264 arrival, whose two windows genuinely report opposite directions.
    """
    selected = select_crossings([
        _window("HD 2264", reads=6, direction="inbound"),
        _window("HD 2264", reads=5, direction="outbound"),
        _window("HD 2264", reads=14, direction=None),
    ])
    assert len(selected) == 1
    assert selected[0]["direction"] is None


def test_direction_is_not_borrowed_from_a_different_truck() -> None:
    selected = select_crossings([
        _window("HD 2152", reads=14, direction=None),
        _window("HD 2221", reads=6, direction="inbound"),
    ])
    by_hull = {e["hull_id"]: e for e in selected}
    assert by_hull["HD 2152"]["direction"] is None
    assert by_hull["HD 2221"]["direction"] == "inbound"


def test_an_unregistered_truck_also_keeps_its_direction() -> None:
    selected = select_crossings([
        _window("UNKNOWN", outcome=UNREGISTERED, reads=4, direction="outbound"),
        _window("UNKNOWN", outcome=UNREGISTERED, reads=9, direction=None),
    ])
    assert len(selected) == 1
    assert selected[0]["direction"] == "outbound"
