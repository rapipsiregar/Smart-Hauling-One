"""Confidently-read but unregistered trucks, and the ritase they make.

A truck that is genuinely on site but missing from the operator's spreadsheet
used to reach the centre as an anonymous UNKNOWN -- indistinguishable from a
Detection Window that read nothing -- so it could never be counted, paired, or
chased up. It is now recorded by its number and flagged, which means two claims
have to stay separate everywhere: "a number was read" (``known``) and "that
number is a master unit" (``registered``).
"""

from __future__ import annotations

import pytest

from app.schemas.edge import CrossingPayload
from app.services import ritase
from app.services.edge_ingest import UNREGISTERED_MIN_CONFIDENCE, unregistered_hull
from app.services.pit_occupancy import build_occupancy


def _payload(**overrides) -> CrossingPayload:
    base = {
        "camera_code": "CAM-GATE-A",
        "detected_at": "2026-08-08T01:00:00Z",
        "window_sec": 4.0,
        "hull_id": "UNKNOWN",
        "raw_code": "8901",
        "confidence": 0.95,
        "read_count": 12,
        "votes": [],
    }
    return CrossingPayload(**{**base, **overrides})


# --- what earns a number -----------------------------------------------------

def test_a_confident_four_digit_reading_is_kept() -> None:
    assert unregistered_hull(_payload()) == "8901"


def test_a_low_confidence_reading_is_not_promoted() -> None:
    """OCR noise must not invent trucks -- each phantom would count its own ritase."""
    assert unregistered_hull(_payload(confidence=UNREGISTERED_MIN_CONFIDENCE - 0.01)) is None


def test_the_threshold_itself_passes() -> None:
    assert unregistered_hull(_payload(confidence=UNREGISTERED_MIN_CONFIDENCE)) == "8901"


def test_an_empty_window_is_not_promoted() -> None:
    """Zero reads means nothing was seen, whatever the vote share says."""
    assert unregistered_hull(_payload(read_count=0)) is None


@pytest.mark.parametrize("code", [None, "", "890", "89012", "89O1", "HD 8901"])
def test_anything_that_is_not_four_digits_is_refused(code) -> None:
    assert unregistered_hull(_payload(raw_code=code)) is None


def test_a_device_that_sends_no_raw_code_still_submits() -> None:
    """Older firmware predates the field; it simply cannot report unregistered
    trucks by number."""
    payload = CrossingPayload(
        camera_code="CAM-GATE-A", detected_at="2026-08-08T01:00:00Z",
        window_sec=4.0, hull_id="UNKNOWN", confidence=0.95, read_count=12, votes=[],
    )
    assert payload.raw_code is None
    assert unregistered_hull(payload) is None


# --- ritase over a mixed fleet -----------------------------------------------

def _crossing(hull, direction, at, *, registered=True, cid=1):
    return {
        "id": cid, "hullId": hull, "lane": f"Gate {direction[:1].upper()}",
        "direction": direction, "crossedAt": at, "known": True,
        "registered": registered, "reads": 5, "confidence": 95.0,
    }


def test_one_in_and_one_out_makes_one_ritase() -> None:
    report = ritase.build_ritase([
        _crossing("HD 2152", "inbound", "2026-08-08T01:00:00", cid=1),
        _crossing("HD 2152", "outbound", "2026-08-08T03:00:00", cid=2),
    ])

    assert report["totalRitase"] == 1
    assert report["pairingBasis"] == "chronological"
    assert report["perHull"][0]["hullId"] == "HD 2152"
    assert report["perHull"][0]["avgCycleSeconds"] == 7200.0


def test_an_in_with_no_out_is_flagged_not_counted() -> None:
    """The truck is still in the pit -- that is not a ritase yet."""
    report = ritase.build_ritase([
        _crossing("HD 2152", "inbound", "2026-08-08T01:00:00", cid=1),
    ])

    assert report["totalRitase"] == 0
    assert [f["reason"] for f in report["unpaired"]] == ["missing-out"]


def test_an_unregistered_truck_still_makes_a_ritase_and_is_flagged() -> None:
    """It really crossed twice. Dropping it under-reports haulage; hiding the
    flag would grow the fleet by stealth."""
    report = ritase.build_ritase([
        _crossing("8901", "inbound", "2026-08-08T01:00:00", registered=False, cid=1),
        _crossing("8901", "outbound", "2026-08-08T02:00:00", registered=False, cid=2),
        _crossing("HD 2152", "inbound", "2026-08-08T01:10:00", cid=3),
        _crossing("HD 2152", "outbound", "2026-08-08T02:10:00", cid=4),
    ])

    assert report["totalRitase"] == 2
    assert report["unregisteredRitase"] == 1
    assert report["unregisteredHulls"] == ["8901"]
    by_hull = {h["hullId"]: h for h in report["perHull"]}
    assert by_hull["8901"]["registered"] is False
    assert by_hull["HD 2152"]["registered"] is True


def test_a_second_round_trip_counts_twice() -> None:
    report = ritase.build_ritase([
        _crossing("HD 2152", "inbound", "2026-08-08T01:00:00", cid=1),
        _crossing("HD 2152", "outbound", "2026-08-08T02:00:00", cid=2),
        _crossing("HD 2152", "inbound", "2026-08-08T03:00:00", cid=3),
        _crossing("HD 2152", "outbound", "2026-08-08T04:00:00", cid=4),
    ])
    assert report["totalRitase"] == 2
    assert report["perHull"][0]["ritase"] == 2


# --- pit occupancy -----------------------------------------------------------

def _ds_crossing(hull, direction, at, *, registered=True, cid=1):
    return {
        "id": cid, "hull_id": hull, "known": True, "registered": registered,
        "direction": direction, "crossed_at": at, "lane": "Gate",
        "camera_code": "CAM-GATE-A", "confidence": 98.0,
    }


def test_a_truck_that_came_in_and_has_not_left_is_inside() -> None:
    report = build_occupancy([_ds_crossing("HD 2152", "inbound", "2026-08-08T01:00:00")])

    assert report["insideCount"] == 1
    assert report["inside"][0]["hullId"] == "HD 2152"
    assert report["outsideCount"] == 0


def test_a_truck_that_left_is_no_longer_inside() -> None:
    report = build_occupancy([
        _ds_crossing("HD 2152", "inbound", "2026-08-08T01:00:00", cid=1),
        _ds_crossing("HD 2152", "outbound", "2026-08-08T02:00:00", cid=2),
    ])

    assert report["insideCount"] == 0
    assert report["outsideCount"] == 1
    assert report["outside"][0]["lastDirection"] == "outbound"


def test_unregistered_trucks_are_counted_inside_and_flagged() -> None:
    """The number on screen has to be the number on site."""
    report = build_occupancy([
        _ds_crossing("HD 2152", "inbound", "2026-08-08T01:00:00", cid=1),
        _ds_crossing("8901", "inbound", "2026-08-08T01:05:00", registered=False, cid=2),
    ])

    assert report["insideCount"] == 2
    assert report["unregisteredInside"] == 1
    assert {e["hullId"]: e["registered"] for e in report["inside"]} == {
        "HD 2152": True, "8901": False,
    }
