"""The mining day: 06:00 to 06:00 the next morning.

The site's reporting cycle does not start at midnight. A shift that begins at
06:00 and the haulage it produces belong to the same working day even though the
clock rolls over halfway through, and BIB's own reports are cut that way -- so a
crossing recorded at 02:00 belongs to the *previous* calendar date's report.

Counting on calendar days instead is not a rounding difference: it splits every
night shift across two reports, so both disagree with the operator's paperwork
and neither can be reconciled against it. Every windowed figure in this codebase
resolves its bounds through this module, so there is exactly one definition of
"today" to get wrong.

Naive datetimes throughout, matching what ``video_results.crossed_at`` stores
(see ``app/services/edge_ingest.py::normalize_crossed_at``).
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

# When the mining day rolls over. Site standard, confirmed against BIB's
# reporting cycle -- not a preference, so it is a constant rather than a setting.
DAY_START_HOUR = 6

GRANULARITIES = ("day", "week", "month", "year")


def parse_dt(value: str | None) -> datetime | None:
    """Parse a stored/queried timestamp into a naive datetime, or None.

    Accepts the naive form the pipeline writes and the ``Z``-suffixed form the
    edge contract uses; an aware value is converted to UTC and flattened, so a
    mix of both still compares.
    """
    if not value:
        return None
    text = str(value).strip().replace(" ", "T")
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        # A bare date is a legitimate query input ("2026-08-16").
        try:
            parsed = datetime.strptime(text[:10], "%Y-%m-%d")
        except ValueError:
            return None
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(tz=None).replace(tzinfo=None)
    return parsed


def mining_date(moment: datetime) -> date:
    """Which mining day a moment falls in.

    Before 06:00 the moment still belongs to the previous day's report -- the
    night shift that started yesterday evening has not ended yet.
    """
    if moment.hour < DAY_START_HOUR:
        return (moment - timedelta(days=1)).date()
    return moment.date()


def day_window(day: date) -> tuple[datetime, datetime]:
    """``[06:00 on day, 06:00 next day)`` -- half-open, so no crossing is double counted."""
    start = datetime(day.year, day.month, day.day, DAY_START_HOUR)
    return start, start + timedelta(days=1)


def _week_start(day: date) -> date:
    """Monday of ``day``'s week -- the site reports weeks Monday to Sunday."""
    return day - timedelta(days=day.weekday())


def bucket_start(day: date, granularity: str) -> date:
    """The first mining date of the bucket ``day`` belongs to."""
    if granularity == "week":
        return _week_start(day)
    if granularity == "month":
        return day.replace(day=1)
    if granularity == "year":
        return day.replace(month=1, day=1)
    return day


def bucket_label(day: date, granularity: str) -> str:
    """A stable, sortable key for a bucket. Also what the chart's x-axis shows."""
    start = bucket_start(day, granularity)
    if granularity == "week":
        iso_year, iso_week, _ = start.isocalendar()
        return f"{iso_year}-W{iso_week:02d}"
    if granularity == "month":
        return start.strftime("%Y-%m")
    if granularity == "year":
        return start.strftime("%Y")
    return start.isoformat()


def next_bucket(day: date, granularity: str) -> date:
    """The start of the bucket after the one containing ``day``.

    Used to walk a range and emit empty buckets: a day with no haulage is a real
    zero on the trend, and skipping it would draw a line straight over an outage.
    """
    start = bucket_start(day, granularity)
    if granularity == "week":
        return start + timedelta(days=7)
    if granularity == "month":
        return (start.replace(day=28) + timedelta(days=4)).replace(day=1)
    if granularity == "year":
        return start.replace(year=start.year + 1, month=1, day=1)
    return start + timedelta(days=1)


def resolve_window(
    start_date: str | None = None,
    end_date: str | None = None,
) -> tuple[datetime | None, datetime | None]:
    """Turn query dates into a half-open ``[from, until)`` of real moments.

    Both bounds are mining dates, inclusive of the end day: asking for
    ``2026-08-16`` to ``2026-08-16`` yields 06:00 on the 16th to 06:00 on the
    17th, which is the one full day the caller meant. ``None`` for either side
    leaves that side unbounded rather than inventing a default range.
    """
    since = None
    until = None
    if start_date:
        parsed = parse_dt(start_date)
        if parsed is not None:
            since = day_window(parsed.date())[0]
    if end_date:
        parsed = parse_dt(end_date)
        if parsed is not None:
            until = day_window(parsed.date())[1]
    return since, until


def in_window(
    crossed_at: str | None,
    since: datetime | None,
    until: datetime | None,
) -> bool:
    """Whether a crossing falls in ``[since, until)``.

    A crossing with no recorded time is EXCLUDED from any bounded window. It
    cannot be shown to belong to the period, and quietly folding it in would put
    haulage of unknown date into a report that gets signed. With no bounds at
    all it is kept, because then nothing is being claimed about when it happened.
    """
    if since is None and until is None:
        return True
    moment = parse_dt(crossed_at)
    if moment is None:
        return False
    if since is not None and moment < since:
        return False
    if until is not None and moment >= until:
        return False
    return True
