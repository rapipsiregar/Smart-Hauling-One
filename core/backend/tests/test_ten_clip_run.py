"""The ten-clip reference run, end to end: 5 ritase, nobody left in the pit.

Five trucks, each filmed arriving and leaving through the same gate. That is the
whole expected answer -- 5 ritase, 0 inside -- and the run reported 3 inside, 1
outside and one crossing in neither list. Three separate defects produced that,
each locked down below and each fixed in its own module:

* the edge read direction against a hardcoded left-to-right axis, so every
  crossing was stored as its own opposite (agent/pipeline.py);
* one crossing came back with no direction at all and was silently filed as a
  departure (app/services/pit_occupancy.py);
* an outbound reading of a truck the pit set did not contain was fuzzy-corrected
  into one it did (app/services/hull_matcher.py).
"""

from __future__ import annotations

from app.services import pit_occupancy
from app.services.ritase import build_ritase

GATE = "Gate A"
TRUCKS = ["HD 2152", "HD 2221", "HD 2222", "HD 2241", "HD 2264"]


def _crossing(cid, hull, direction, crossed_at):
    return {
        "id": cid,
        "hullId": hull,
        "hull_id": hull,
        "lane": GATE,
        "direction": direction,
        "crossedAt": crossed_at,
        "crossed_at": crossed_at,
        "known": True,
        "registered": True,
        "reads": 20,
        "confidence": 95.0,
    }


def _ten_clip_run():
    """One IN then one OUT per truck, ten minutes apart, in capture order."""
    rows = []
    cid = 0
    for index, hull in enumerate(TRUCKS):
        hour = 8 + index
        for direction, minute in (("inbound", "00"), ("outbound", "30")):
            cid += 1
            rows.append(
                _crossing(cid, hull, direction, f"2023-10-27T{hour:02d}:{minute}:00")
            )
    return rows


def test_the_reference_run_is_five_ritase():
    result = build_ritase(_ten_clip_run())
    assert result["totalRitase"] == 5
    assert result["unpairedCount"] == 0
    assert result["pairingBasis"] == "chronological"
    assert all(hull["ritase"] == 1 for hull in result["perHull"])


def test_the_reference_run_leaves_nobody_in_the_pit():
    occupancy = pit_occupancy.build_occupancy(_ten_clip_run())
    assert occupancy["insideCount"] == 0
    assert occupancy["outsideCount"] == len(TRUCKS)
    assert occupancy["undeterminedCount"] == 0


def test_a_reversed_axis_is_exactly_what_the_broken_run_looked_like():
    """Proof the symptom really was the axis, not the pairing.

    Flipping every direction leaves the ritase total intact -- an IN and an OUT
    still pair -- while putting every truck inside the pit. That is the shape of
    the bad run, which is why the fix belongs at the point direction is decided
    and not in the counting.
    """
    flipped = [
        {**row, "direction": "outbound" if row["direction"] == "inbound" else "inbound"}
        for row in _ten_clip_run()
    ]
    assert build_ritase(flipped)["totalRitase"] == 5
    assert pit_occupancy.build_occupancy(flipped)["insideCount"] == len(TRUCKS)


def test_a_crossing_with_no_direction_is_reported_not_absorbed():
    """The crossing that went missing: it must land in `undetermined`.

    HD 2264's departure arrived with direction=None. It used to fall through to
    the `outside` list, which made a truck the system could not orient
    indistinguishable from one it had confidently seen leave.
    """
    rows = _ten_clip_run()
    rows[-1] = {**rows[-1], "direction": None}

    occupancy = pit_occupancy.build_occupancy(rows)
    assert occupancy["undeterminedCount"] == 1
    assert occupancy["undetermined"][0]["hullId"] == "HD 2264"
    assert occupancy["outsideCount"] == len(TRUCKS) - 1
    assert occupancy["insideCount"] == 0

    # And ritase flags it rather than counting a cycle that was never proven.
    result = build_ritase(rows)
    assert result["totalRitase"] == 4
    assert result["unpairedCount"] == 2
