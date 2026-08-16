"""Per-checkpoint breakdown and the ritase trend series.

The meeting's decision: group by checkpoint (CP 01..CP 04), not by contractor
and not by area. `lane` holds the area, and two checkpoints share one -- so
grouping by it silently merges CP 02 and CP 03, which is exactly what the site
asked us to stop doing.
"""

from __future__ import annotations

from app.services.reference import _fill_buckets, build_ritase_trend
from app.services.ritase import build_ritase

CP1, CP2 = "CP 01", "CP 02"
AREA_SOUTH, AREA_NORTH = "Area Selatan", "Area Utara"


def _crossing(cid, hull, direction, crossed_at, checkpoint, lane):
    return {
        "id": cid, "hullId": hull, "hull_id": hull,
        "lane": lane, "checkpoint": checkpoint,
        "direction": direction,
        "crossedAt": crossed_at, "crossed_at": crossed_at,
        "known": True, "registered": True, "reads": 20, "confidence": 95.0,
    }


def _one_cycle(cid, hull, day, checkpoint, lane, in_hour="08", out_hour="14"):
    """One truck in and back out on the same mining day, at one checkpoint."""
    return [
        _crossing(cid, hull, "inbound", f"{day}T{in_hour}:00:00", checkpoint, lane),
        _crossing(cid + 1, hull, "outbound", f"{day}T{out_hour}:00:00", checkpoint, lane),
    ]


# --- per checkpoint -----------------------------------------------------------

def test_two_checkpoints_sharing_an_area_stay_separate():
    """The regression the meeting asked for: CP 02 and CP 03 are both 'Area Utara'."""
    rows = (
        _one_cycle(1, "HD 2152", "2026-08-16", CP2, AREA_NORTH)
        + _one_cycle(3, "HD 2221", "2026-08-16", "CP 03", AREA_NORTH)
    )
    result = build_ritase(rows)

    # Grouped by area they collapse into one row...
    assert len(result["perGate"]) == 1
    # ...but the checkpoint breakdown keeps them apart, one ritase each.
    by_cp = {c["checkpoint"]: c for c in result["perCheckpoint"]}
    assert set(by_cp) == {CP2, "CP 03"}
    assert by_cp[CP2]["ritase"] == 1
    assert by_cp["CP 03"]["ritase"] == 1


def test_checkpoint_totals_sum_to_the_site_total():
    """The point of a breakdown is that the parts add up."""
    rows = (
        _one_cycle(1, "HD 2152", "2026-08-16", CP1, AREA_SOUTH)
        + _one_cycle(3, "HD 2221", "2026-08-16", CP1, AREA_SOUTH)
        + _one_cycle(5, "HD 2241", "2026-08-16", CP2, AREA_NORTH)
    )
    result = build_ritase(rows)
    assert result["totalRitase"] == 3
    assert sum(c["ritase"] for c in result["perCheckpoint"]) == 3


def test_a_pair_is_credited_to_where_the_load_entered():
    """A truck may leave through a different checkpoint than it entered.

    Crediting both ends would double count; crediting the exit would file the
    cycle under a checkpoint that never saw the load arrive.
    """
    rows = [
        _crossing(1, "HD 2152", "inbound", "2026-08-16T08:00:00", CP1, AREA_SOUTH),
        _crossing(2, "HD 2152", "outbound", "2026-08-16T14:00:00", CP2, AREA_NORTH),
    ]
    result = build_ritase(rows)
    by_cp = {c["checkpoint"]: c for c in result["perCheckpoint"]}
    assert result["totalRitase"] == 1
    assert by_cp[CP1]["ritase"] == 1
    assert by_cp[CP2]["ritase"] == 0
    # Both still count as traffic where they physically happened.
    assert by_cp[CP1]["inbound"] == 1
    assert by_cp[CP2]["outbound"] == 1


# --- the trend series ---------------------------------------------------------

def test_the_series_buckets_by_mining_day(monkeypatch):
    rows = (
        _one_cycle(1, "HD 2152", "2026-08-16", CP1, AREA_SOUTH)
        + _one_cycle(3, "HD 2221", "2026-08-17", CP1, AREA_SOUTH)
    )
    monkeypatch.setattr("app.services.reference.build_crossings", lambda **k: rows)

    trend = build_ritase_trend(granularity="day")
    assert [b["bucket"] for b in trend["series"]] == ["2026-08-16", "2026-08-17"]
    assert [b["ritase"] for b in trend["series"]] == [1, 1]
    assert trend["dayStartHour"] == 6


def test_a_cycle_finishing_after_midnight_stays_on_its_own_day(monkeypatch):
    """In at 22:00, out at 02:00 -- one ritase, on the day it started."""
    rows = [
        _crossing(1, "HD 2152", "inbound", "2026-08-16T22:00:00", CP1, AREA_SOUTH),
        _crossing(2, "HD 2152", "outbound", "2026-08-17T02:00:00", CP1, AREA_SOUTH),
    ]
    monkeypatch.setattr("app.services.reference.build_crossings", lambda **k: rows)

    trend = build_ritase_trend(granularity="day")
    assert [b["bucket"] for b in trend["series"]] == ["2026-08-16"]
    assert trend["series"][0]["ritase"] == 1


def test_a_day_with_no_haulage_is_a_visible_zero(monkeypatch):
    """Skipping it would draw the line straight over a stoppage."""
    rows = (
        _one_cycle(1, "HD 2152", "2026-08-16", CP1, AREA_SOUTH)
        + _one_cycle(3, "HD 2221", "2026-08-19", CP1, AREA_SOUTH)
    )
    monkeypatch.setattr("app.services.reference.build_crossings", lambda **k: rows)

    trend = build_ritase_trend(granularity="day")
    assert [b["bucket"] for b in trend["series"]] == [
        "2026-08-16", "2026-08-17", "2026-08-18", "2026-08-19",
    ]
    assert [b["ritase"] for b in trend["series"]] == [1, 0, 0, 1]


def test_undated_crossings_are_reported_not_dropped(monkeypatch):
    rows = _one_cycle(1, "HD 2152", "2026-08-16", CP1, AREA_SOUTH) + [
        _crossing(9, "HD 2264", "inbound", None, CP1, AREA_SOUTH),
    ]
    monkeypatch.setattr("app.services.reference.build_crossings", lambda **k: rows)

    trend = build_ritase_trend(granularity="day")
    assert trend["undatedCrossings"] == 1
    assert sum(b["crossings"] for b in trend["series"]) == 2


def test_monthly_granularity_collapses_the_days(monkeypatch):
    rows = (
        _one_cycle(1, "HD 2152", "2026-08-16", CP1, AREA_SOUTH)
        + _one_cycle(3, "HD 2221", "2026-08-19", CP1, AREA_SOUTH)
        + _one_cycle(5, "HD 2241", "2026-09-02", CP1, AREA_SOUTH)
    )
    monkeypatch.setattr("app.services.reference.build_crossings", lambda **k: rows)

    trend = build_ritase_trend(granularity="month")
    assert [b["bucket"] for b in trend["series"]] == ["2026-08", "2026-09"]
    assert [b["ritase"] for b in trend["series"]] == [2, 1]


def test_an_unknown_granularity_falls_back_to_day(monkeypatch):
    """A stale bookmark should still render, not 500."""
    rows = _one_cycle(1, "HD 2152", "2026-08-16", CP1, AREA_SOUTH)
    monkeypatch.setattr("app.services.reference.build_crossings", lambda **k: rows)
    assert build_ritase_trend(granularity="dasawarsa")["granularity"] == "day"


def test_an_empty_range_yields_an_empty_series():
    assert _fill_buckets([], {}, "day") == []


def test_a_requested_window_is_shown_in_full(monkeypatch):
    """Asking for a week and getting one bar hides the six idle days.

    The idle days are the more useful half of that answer, so an explicit
    window wins even where it is wider than the data.
    """
    rows = _one_cycle(1, "HD 2152", "2026-08-16", CP1, AREA_SOUTH)
    monkeypatch.setattr("app.services.reference.build_crossings", lambda **k: rows)

    trend = build_ritase_trend(
        granularity="day", start_date="2026-08-14", end_date="2026-08-18"
    )
    assert [b["bucket"] for b in trend["series"]] == [
        "2026-08-14", "2026-08-15", "2026-08-16", "2026-08-17", "2026-08-18",
    ]
    assert [b["ritase"] for b in trend["series"]] == [0, 0, 1, 0, 0]


def test_a_window_with_no_data_at_all_still_draws_its_days(monkeypatch):
    monkeypatch.setattr("app.services.reference.build_crossings", lambda **k: [])
    trend = build_ritase_trend(
        granularity="day", start_date="2026-08-14", end_date="2026-08-16"
    )
    assert len(trend["series"]) == 3
    assert trend["totalRitase"] == 0
