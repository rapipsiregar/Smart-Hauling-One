"""Multi-period isolated dashboard statistics service.

Calculates daily, weekly, monthly, and custom date range metrics strictly from
real recorded crossings without mock data or assumptions.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from app.services.reference import build_crossings
from app.services.ritase import build_ritase

ISO_DATE = "%Y-%m-%d"
ISO_TIME = "%Y-%m-%dT%H:%M:%S"


def _parse_dt(ts: str | None) -> datetime | None:
    if not ts:
        return None
    try:
        parsed = datetime.fromisoformat(str(ts).replace(" ", "T").replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is not None:
        return parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def _format_date_label(dt: datetime) -> str:
    months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"]
    return f"{dt.day:02d} {months[dt.month - 1]} {dt.year}"


def get_dashboard_stats(
    period: str = "daily",
    start_date: str | None = None,
    end_date: str | None = None,
) -> dict:
    all_crossings = build_crossings()

    # Find fallback date if not provided
    valid_dts = [_parse_dt(c.get("crossedAt")) for c in all_crossings]
    valid_dts = [d for d in valid_dts if d is not None]
    max_dt = max(valid_dts) if valid_dts else datetime.now()

    if period == "weekly":
        ref_end = _parse_dt(end_date) if end_date else max_dt
        end_dt = datetime(ref_end.year, ref_end.month, ref_end.day, 23, 59, 59)
        start_dt = datetime(end_dt.year, end_dt.month, end_dt.day, 0, 0, 0) - timedelta(days=6)
        period_label = f"Mingguan ({_format_date_label(start_dt)} - {_format_date_label(end_dt)})"
    elif period == "monthly":
        ref_end = _parse_dt(end_date) if end_date else max_dt
        end_dt = datetime(ref_end.year, ref_end.month, ref_end.day, 23, 59, 59)
        start_dt = datetime(end_dt.year, end_dt.month, end_dt.day, 0, 0, 0) - timedelta(days=29)
        period_label = f"Bulanan ({_format_date_label(start_dt)} - {_format_date_label(end_dt)})"
    elif period == "custom":
        start_ref = _parse_dt(start_date) if start_date else (max_dt - timedelta(days=30))
        end_ref = _parse_dt(end_date) if end_date else max_dt
        start_dt = datetime(start_ref.year, start_ref.month, start_ref.day, 0, 0, 0)
        end_dt = datetime(end_ref.year, end_ref.month, end_ref.day, 23, 59, 59)
        period_label = f"Rentang Kustom ({_format_date_label(start_dt)} - {_format_date_label(end_dt)})"
    else:
        # Default: daily
        period = "daily"
        ref_day = _parse_dt(start_date) if start_date else max_dt
        start_dt = datetime(ref_day.year, ref_day.month, ref_day.day, 6, 0, 0)
        end_dt = start_dt + timedelta(days=1) - timedelta(seconds=1)
        period_label = f"Harian ({_format_date_label(start_dt)})"

    # Filter crossings strictly within start_dt and end_dt
    filtered: list[dict] = []
    for c in all_crossings:
        dt = _parse_dt(c.get("crossedAt"))
        if dt is not None and (start_dt <= dt <= end_dt):
            filtered.append(c)

    if not filtered:
        # Build empty time-series buckets
        ts_buckets = _build_empty_buckets(period, start_dt, end_dt)
        return {
            "period": period,
            "periodLabel": period_label,
            "startDate": start_dt.strftime(ISO_DATE),
            "endDate": end_dt.strftime(ISO_DATE),
            "totalPassages": 0,
            "totalRitase": 0,
            "identifiedCount": 0,
            "unidentifiedCount": 0,
            "uniqueTrucks": 0,
            "avgConfidence": 0.0,
            "pairingBasis": "count",
            "unpairedCount": 0,
            "timeSeries": ts_buckets,
            "perGate": [],
            "perTruck": [],
            "unpaired": [],
        }

    ritase = build_ritase(filtered)
    known = [c for c in filtered if c.get("known")]
    avg_conf = (
        round(sum(c.get("confidence", 0.0) for c in known) / len(known), 1)
        if known
        else 0.0
    )
    unique_trucks = len({c["hullId"] for c in known if c.get("hullId")})

    ts_buckets = _build_time_series(period, start_dt, end_dt, filtered)

    return {
        "period": period,
        "periodLabel": period_label,
        "startDate": start_dt.strftime(ISO_DATE),
        "endDate": end_dt.strftime(ISO_DATE),
        "totalPassages": len(filtered),
        "totalRitase": ritase["totalRitase"],
        "identifiedCount": len(known),
        "unidentifiedCount": len(filtered) - len(known),
        "uniqueTrucks": unique_trucks,
        "avgConfidence": avg_conf,
        "pairingBasis": ritase["pairingBasis"],
        "unpairedCount": ritase["unpairedCount"],
        "timeSeries": ts_buckets,
        "perGate": ritase["perGate"],
        "perTruck": ritase["perHull"],
        "unpaired": ritase["unpaired"],
    }


def _build_empty_buckets(period: str, start_dt: datetime, end_dt: datetime) -> list[dict]:
    if period == "daily":
        hours = [(6 + i) % 24 for i in range(24)]
        return [{"label": f"{h:02d}:00", "total": 0} for h in hours]
    cur = start_dt
    buckets = []
    while cur <= end_dt:
        buckets.append({"label": f"{cur.day:02d}/{cur.month:02d}", "total": 0})
        cur += timedelta(days=1)
    return buckets


def _build_time_series(period: str, start_dt: datetime, end_dt: datetime, crossings: list[dict]) -> list[dict]:
    if period == "daily":
        hours = [(6 + i) % 24 for i in range(24)]
        counts = {h: 0 for h in hours}
        for c in crossings:
            dt = _parse_dt(c.get("crossedAt"))
            if dt and (start_dt <= dt <= end_dt):
                counts[dt.hour] += 1
        return [{"label": f"{h:02d}:00", "total": counts[h]} for h in hours]

    cur = start_dt
    counts_by_day: dict[str, int] = {}
    day_labels: list[tuple[str, str]] = []
    while cur <= end_dt:
        key = cur.strftime(ISO_DATE)
        label = f"{cur.day:02d}/{cur.month:02d}"
        counts_by_day[key] = 0
        day_labels.append((key, label))
        cur += timedelta(days=1)

    for c in crossings:
        dt = _parse_dt(c.get("crossedAt"))
        if dt:
            key = dt.strftime(ISO_DATE)
            if key in counts_by_day:
                counts_by_day[key] += 1

    return [{"label": label, "total": counts_by_day[key]} for key, label in day_labels]
