"""The mining day (06:00 to 06:00) and the windowing every report now uses.

The rule that matters: a crossing at 02:00 belongs to the PREVIOUS date's
report, because the night shift that produced it started the evening before.
Cutting at midnight instead splits every night shift across two sheets, so
neither reconciles against BIB's paperwork -- which is the whole reason the
site asked for this cut-off.
"""

from __future__ import annotations

from datetime import date, datetime

import pytest

from app.services import mining_day as md


def dt(text: str) -> datetime:
    return datetime.fromisoformat(text)


# --- which day does a moment belong to ----------------------------------------

@pytest.mark.parametrize("moment,expected", [
    ("2026-08-16T06:00:00", date(2026, 8, 16)),   # the boundary opens the day
    ("2026-08-16T12:30:00", date(2026, 8, 16)),
    ("2026-08-16T23:59:59", date(2026, 8, 16)),
    ("2026-08-17T00:30:00", date(2026, 8, 16)),   # past midnight, same shift
    ("2026-08-17T05:59:59", date(2026, 8, 16)),   # last second before rollover
    ("2026-08-17T06:00:00", date(2026, 8, 17)),   # rollover
])
def test_a_moment_lands_in_the_right_mining_day(moment, expected):
    assert md.mining_date(dt(moment)) == expected


def test_the_night_shift_is_not_split_across_two_reports():
    """The regression the cut-off exists to prevent."""
    before_midnight = md.mining_date(dt("2026-08-16T22:00:00"))
    after_midnight = md.mining_date(dt("2026-08-17T03:00:00"))
    assert before_midnight == after_midnight == date(2026, 8, 16)


def test_the_window_is_half_open():
    """06:00 belongs to its own day, not to the one that just ended."""
    start, end = md.day_window(date(2026, 8, 16))
    assert start == dt("2026-08-16T06:00:00")
    assert end == dt("2026-08-17T06:00:00")
    assert md.in_window("2026-08-16T06:00:00", start, end)
    assert not md.in_window("2026-08-17T06:00:00", start, end)


# --- query windows ------------------------------------------------------------

def test_one_date_resolves_to_one_full_working_day():
    since, until = md.resolve_window("2026-08-16", "2026-08-16")
    assert since == dt("2026-08-16T06:00:00")
    assert until == dt("2026-08-17T06:00:00")


def test_an_open_ended_window_stays_open():
    since, until = md.resolve_window("2026-08-16", None)
    assert since == dt("2026-08-16T06:00:00")
    assert until is None
    assert md.resolve_window(None, None) == (None, None)


def test_an_undated_crossing_is_excluded_from_a_bounded_window():
    """It cannot be shown to belong to the period, so it must not be counted.

    Folding it in would put haulage of unknown date into a sheet that gets
    signed. With no window at all it is kept -- nothing is being claimed then.
    """
    since, until = md.resolve_window("2026-08-16", "2026-08-16")
    assert not md.in_window(None, since, until)
    assert md.in_window(None, None, None)


def test_an_unparseable_timestamp_never_slips_into_a_window():
    since, until = md.resolve_window("2026-08-16", "2026-08-16")
    assert not md.in_window("kemarin sore", since, until)


def test_the_edge_z_suffix_form_still_compares():
    """Edge rows carry 'Z'; batch rows do not. Both have to sort together."""
    assert md.parse_dt("2026-08-16T12:00:00Z") is not None
    since, until = md.resolve_window("2026-08-16", "2026-08-16")
    assert md.in_window("2026-08-16T12:00:00", since, until)


# --- buckets ------------------------------------------------------------------

@pytest.mark.parametrize("granularity,expected", [
    ("day", "2026-08-16"),
    ("month", "2026-08"),
    ("year", "2026"),
])
def test_bucket_labels_are_sortable(granularity, expected):
    assert md.bucket_label(date(2026, 8, 16), granularity) == expected


def test_a_week_bucket_starts_on_monday():
    # 2026-08-16 is a Sunday; its week began Monday the 10th.
    assert md.bucket_start(date(2026, 8, 16), "week") == date(2026, 8, 10)


def test_walking_buckets_advances_exactly_one_period():
    assert md.next_bucket(date(2026, 8, 16), "day") == date(2026, 8, 17)
    assert md.next_bucket(date(2026, 8, 16), "week") == date(2026, 8, 17)
    assert md.next_bucket(date(2026, 8, 16), "month") == date(2026, 9, 1)
    assert md.next_bucket(date(2026, 8, 16), "year") == date(2027, 1, 1)


def test_month_rollover_crosses_the_year_end():
    assert md.next_bucket(date(2026, 12, 5), "month") == date(2027, 1, 1)
