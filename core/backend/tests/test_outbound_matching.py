"""Outbound readings resolve against the trucks in the pit before the master.

A truck leaving must be one that came in and has not left again. That set is a
handful; the master is 276. Narrowing to it turns corrections that are ambiguous
fleet-wide into unambiguous ones, and stops a misread landing on a real unit that
is nowhere near the gate.

The knowledge lives here and only here: a device sees its own gate, not who
entered through the other three.
"""

from __future__ import annotations

from app.services import hull_matcher, pit_occupancy
from app.services.hull_matching import AMBIGUOUS, EXACT, FUZZY


def _crossing(hull_id, direction, crossed_at, cid, known=True):
    return {
        "hull_id": hull_id, "direction": direction, "crossed_at": crossed_at,
        "id": cid, "known": known,
    }


# --- who is inside ------------------------------------------------------------

def test_last_crossing_decides_where_a_truck_is():
    rows = [
        _crossing("HD 2152", "inbound", "2026-08-03T08:00:00", 1),
        _crossing("HD 2152", "outbound", "2026-08-03T09:00:00", 2),
        _crossing("HD 2221", "inbound", "2026-08-03T08:30:00", 3),
    ]
    assert pit_occupancy.hull_ids_inside(rows) == {"HD 2221"}


def test_a_truck_that_came_back_is_inside_again():
    rows = [
        _crossing("HD 2152", "inbound", "2026-08-03T08:00:00", 1),
        _crossing("HD 2152", "outbound", "2026-08-03T09:00:00", 2),
        _crossing("HD 2152", "inbound", "2026-08-03T10:00:00", 3),
    ]
    assert pit_occupancy.hull_ids_inside(rows) == {"HD 2152"}


def test_unidentified_crossings_put_nobody_in_the_pit():
    rows = [_crossing("UNKNOWN", "inbound", "2026-08-03T08:00:00", 1, known=False)]
    assert pit_occupancy.hull_ids_inside(rows) == set()


def test_ingest_order_breaks_ties_when_there_is_no_time():
    """Crossings without a real time still have to order somehow."""
    rows = [
        _crossing("HD 2152", "inbound", None, 1),
        _crossing("HD 2152", "outbound", None, 2),
    ]
    assert pit_occupancy.hull_ids_inside(rows) == set()


def test_codes_are_extracted_from_display_ids():
    rows = [_crossing("HD 2152", "inbound", "2026-08-03T08:00:00", 1)]
    assert pit_occupancy.hull_codes_inside(rows) == ["2152"]


# --- the outbound strategy ----------------------------------------------------

def test_a_fleetwide_tie_is_resolved_by_who_is_actually_inside(monkeypatch):
    """2152 and 2153 are both one edit from 2154, but only one is in the pit.

    Fleet-wide this is AMBIGUOUS and correctly refuses to guess. At an OUT gate
    the other unit cannot be the one leaving, so the answer is not a guess.
    """
    master = ["2152", "2153", "9999"]
    monkeypatch.setattr(
        hull_matcher.truck_master_repo, "all_hull_codes", lambda: master
    )
    monkeypatch.setattr(
        hull_matcher.truck_master_repo, "get_by_hull_code",
        lambda code: {"hull_id": f"HD {code}"},
    )

    assert hull_matcher.match_code("2154", candidates=master).outcome == AMBIGUOUS

    monkeypatch.setattr(pit_occupancy, "hull_codes_inside", lambda *a, **k: ["2152"])
    result = hull_matcher.match_outbound("2154")
    assert result.outcome == FUZZY
    assert result.hull_id == "HD 2152"


def test_an_exact_read_of_a_truck_inside_stays_exact(monkeypatch):
    monkeypatch.setattr(
        hull_matcher.truck_master_repo, "all_hull_codes", lambda: ["2152", "2221"]
    )
    monkeypatch.setattr(
        hull_matcher.truck_master_repo, "get_by_hull_code",
        lambda code: {"hull_id": f"HD {code}"},
    )
    monkeypatch.setattr(pit_occupancy, "hull_codes_inside", lambda *a, **k: ["2152"])

    result = hull_matcher.match_outbound("2152")
    assert result.outcome == EXACT
    assert result.hull_id == "HD 2152"


def test_it_falls_back_to_the_master_when_the_pit_set_misses(monkeypatch):
    """A missed inbound detection must not make every later departure UNKNOWN.

    Punishing the truck twice for one dropped frame is worse than naming it from
    the master and letting ritase pairing show the missing half.
    """
    monkeypatch.setattr(
        hull_matcher.truck_master_repo, "all_hull_codes", lambda: ["2152", "2221"]
    )
    monkeypatch.setattr(
        hull_matcher.truck_master_repo, "get_by_hull_code",
        lambda code: {"hull_id": f"HD {code}"},
    )
    # 2221 is leaving, but its inbound crossing was never recorded.
    monkeypatch.setattr(pit_occupancy, "hull_codes_inside", lambda *a, **k: ["2152"])

    result = hull_matcher.match_outbound("2221")
    assert result.is_registered
    assert result.hull_id == "HD 2221"


def test_an_empty_pit_behaves_exactly_like_the_plain_matcher(monkeypatch):
    monkeypatch.setattr(
        hull_matcher.truck_master_repo, "all_hull_codes", lambda: ["2152"]
    )
    monkeypatch.setattr(
        hull_matcher.truck_master_repo, "get_by_hull_code",
        lambda code: {"hull_id": f"HD {code}"},
    )
    monkeypatch.setattr(pit_occupancy, "hull_codes_inside", lambda *a, **k: [])

    assert hull_matcher.match_outbound("2152").hull_id == "HD 2152"


def test_an_unreadable_outbound_reading_is_still_unreadable(monkeypatch):
    monkeypatch.setattr(pit_occupancy, "hull_codes_inside", lambda *a, **k: ["2152"])
    monkeypatch.setattr(
        hull_matcher.truck_master_repo, "all_hull_codes", lambda: ["2152"]
    )
    assert not hull_matcher.match_outbound("no digits here").is_registered
