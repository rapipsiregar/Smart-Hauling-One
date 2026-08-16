"""Reference-shaped read views for the Integrated Smart Hauling System frontend.

Everything here derives from the REAL dataset (``build_dataset`` +
``detections``/``runs``). No sensor telemetry or business targets are
fabricated; fields without a real source are simply omitted. Keys are camelCase
to match the frontend's TypeScript contract exactly.
"""

from __future__ import annotations

from app.core.config import RECONCILE_THRESHOLD
from app.repositories import truck_master_repo
from app.repositories.video_results_repo import detections_by_video, run_meta
from app.services import mining_day
from app.services.cctv import build_cctv_detections  # re-exported; see routers
from app.services.dataset import build_dataset, filter_by_camera
from app.services.ritase import build_ritase

# Shown when a crossing cannot be attributed to a camera at all, so it still
# appears in a per-checkpoint breakdown instead of vanishing from the totals.
UNASSIGNED_CHECKPOINT = "Tanpa Pos Cek"


def checkpoint_of(crossing: dict) -> str:
    """Which checkpoint a raw dataset crossing belongs to.

    The camera's ``name`` IS the checkpoint at this site ("CP 01"); ``lane``
    holds the wider area and is deliberately not used, because two checkpoints
    can share one area and grouping by it merges them.
    """
    return crossing.get("camera_name") or UNASSIGNED_CHECKPOINT


__all__ = [
    "build_crossings",
    "build_ritase_trend",
    "checkpoint_of",
    "build_fleet",
    "build_fleet_master",
    "build_performance_kpis",
    "build_shift_report",
    "build_ritase_report",
    "build_cctv_detections",
]


# --- Crossings ---------------------------------------------------------------

def build_crossings(
    camera_code: str | None = None,
    camera_id: int | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
) -> list[dict]:
    """Reference-shaped crossings, optionally narrowed to one camera and window.

    ``start_date``/``end_date`` are MINING dates (06:00 to 06:00, see
    ``app/services/mining_day.py``), inclusive of both ends. Omitting them
    returns everything, which is what every existing caller gets.
    """
    ds = build_dataset()
    meta = run_meta()
    det_map = detections_by_video()
    since, until = mining_day.resolve_window(start_date, end_date)
    crossings: list[dict] = []
    for c in ds["crossings"]:
        if not mining_day.in_window(c.get("crossed_at"), since, until):
            continue
        video = c["video"]
        ocr_reads = len(det_map.get(video, {}).get("reads", []))
        reconciled = bool(c["known"] and c["confidence"] >= RECONCILE_THRESHOLD)
        crossings.append({
            "id": c["id"],
            "hullId": c["hull_id"],
            "confidence": c["confidence"],
            "video": video,
            "lane": c["lane"],
            "direction": c["direction"],
            # The checkpoint this crossing belongs to ("CP 01"). The site plans,
            # staffs, and reports by checkpoint, so this -- not `lane`, which
            # holds the broader area ("Area Utara") and lumps two checkpoints
            # together -- is what the dashboard groups by.
            "checkpoint": checkpoint_of(c),
            "cameraId": c.get("camera_id"),
            "cameraCode": c.get("camera_code"),
            "cameraName": c.get("camera_name"),
            "rtspUrl": c.get("rtsp_url"),
            "reads": c["reads"],
            "frames": c["frames"],
            "known": c["known"],
            # known = "a number was read". registered = "that number is a unit in
            # the master". They come apart for a truck that is genuinely on site
            # but missing from the operator's spreadsheet, which the system now
            # records rather than discards -- so the UI has to be able to tell
            # them apart and label the second case.
            "registered": c["registered"],
            "isReconciled": reconciled,
            "reconciledBy": "auto-match@smartgate" if reconciled else None,
            "ocrReads": ocr_reads,
            "imageProofUrl": c["snapshot"],
            "contextImageUrl": c["annotated_video"],
            # When the truck actually crossed the gate — null until a real time
            # source supplies it. Distinct from processedAt, which is when the
            # detection run happened and is the same for every crossing.
            "crossedAt": c.get("crossed_at"),
            "processedAt": meta["timestamp"],
        })
    return filter_by_camera(crossings, camera_code, camera_id)


# --- Fleet -------------------------------------------------------------------

def build_fleet(
    camera_code: str | None = None, camera_id: int | None = None
) -> list[dict]:
    ds = build_dataset()
    meta = run_meta()
    seen: dict[str, list[str]] = {}
    for c in ds["crossings"]:
        if not c["known"]:
            continue
        label = c.get("camera_name") or c["lane"]
        bucket = seen.setdefault(c["hull_id"], [])
        if label and label not in bucket:
            bucket.append(label)
    fleet: list[dict] = []
    for f in ds["fleet"]:
        fleet.append({
            "id": f["hull_id"],
            "hullId": f["hull_id"],
            "status": f.get("status", "active"),
            "passages": f["passages"],
            "reads": f["reads"],
            "bestConf": f["best_conf"],
            "snapshot": f.get("snapshot"),
            "camerasSeen": seen.get(f["hull_id"], []),
            "lastActive": meta["timestamp"] if f["passages"] > 0 else None,
        })

    if camera_code is not None or camera_id is not None:
        # Keep only trucks actually observed at the requested camera.
        seen_at = {
            c["hullId"] for c in build_crossings(camera_code, camera_id) if c["known"]
        }
        fleet = [f for f in fleet if f["hullId"] in seen_at]
    return fleet


def build_fleet_master() -> list[dict]:
    """The full ``trucks`` registry, as-is — every field the operator's own
    spreadsheet carries, for manual verification rather than activity analysis.
    """
    return [
        {
            "hullId": t["hull_id"],
            "hullCode": t["hull_code"],
            "contractor": t.get("contractor"),
            "unitType": t.get("unit_type"),
            "brand": t.get("brand"),
            "modelType": t.get("model_type"),
            "year": t.get("year"),
            "status": t.get("status"),
        }
        for t in truck_master_repo.list_all()
    ]


# --- Performance KPIs (real aggregation) -------------------------------------

def build_performance_kpis() -> dict:
    crossings = build_crossings()
    kpis = build_dataset()["kpis"]
    per_gate: dict[str, dict] = {}
    for c in crossings:
        g = per_gate.setdefault(c["lane"], {"gate": c["lane"], "passages": 0, "identified": 0})
        g["passages"] += 1
        if c["known"]:
            g["identified"] += 1
    return {
        "totalPassages": len(crossings),
        "identified": kpis["identified"],
        "unknown": kpis["unknown"],
        "uniqueTrucks": kpis["unique_trucks"],
        "totalReads": kpis["total_reads"],
        "avgConfidence": kpis["avg_confidence"],
        "perGate": sorted(per_gate.values(), key=lambda x: x["gate"]),
    }



# --- Shift / daily report (real aggregation) ---------------------------------

def build_shift_report(
    start_date: str | None = None, end_date: str | None = None
) -> dict:
    """The signed-and-filed daily sheet, cut to the mining day.

    The reporting unit is the mining day (06:00 to 06:00), not the calendar day
    and no longer a 12-hour day/night shift: BIB cuts its own reports that way,
    and a sheet cut differently cannot be reconciled against theirs. The name
    ``shift-report`` is kept because it is the frontend's existing route.
    """
    crossings = build_crossings(start_date=start_date, end_date=end_date)
    meta = run_meta()
    kpis = build_performance_kpis()
    ritase = build_ritase(crossings)
    reconciled = sum(1 for c in crossings if c["isReconciled"])
    per_truck = [
        {
            "hullId": h["hullId"],
            # Carried through to the exports. Without it the PDF and the
            # spreadsheet -- the artefacts that get signed and filed -- show a
            # truck the master has never heard of as though it were a fleet unit.
            # That is the one place the flag matters most, because the point of
            # flagging is to get somebody to add the unit to the master.
            "registered": h["registered"],
            "ritase": h["ritase"],
            "inCount": h["inCount"],
            "outCount": h["outCount"],
            "unpaired": h["unpaired"],
            "reads": h["reads"],
            "bestConf": h["bestConf"],
            "avgCycleSeconds": h["avgCycleSeconds"],
        }
        for h in ritase["perHull"]
    ]
    return {
        "date": meta["timestamp"].split("T")[0],
        "model": meta["model"],
        "totalPassages": len(crossings),
        # Headline figure is paired ritase, not raw gate passages.
        "totalRitase": ritase["totalRitase"],
        # Of the headline figure, how much was hauled by units the master does
        # not list. Reported alongside the total rather than folded into it: a
        # shift partly hauled by unknown trucks is a registry gap to go and
        # close, and the number is what prompts closing it.
        "unregisteredRitase": ritase["unregisteredRitase"],
        "unregisteredHulls": ritase["unregisteredHulls"],
        "totalCrossings": ritase["totalCrossings"],
        "unpairedCount": ritase["unpairedCount"],
        "pairingBasis": ritase["pairingBasis"],
        "hasCrossingTimes": ritase["hasCrossingTimes"],
        "identified": kpis["identified"],
        "unknown": kpis["unknown"],
        "reconciled": reconciled,
        "uniqueTrucks": kpis["uniqueTrucks"],
        "totalReads": kpis["totalReads"],
        "avgConfidence": kpis["avgConfidence"],
        "perGate": ritase["perGate"],
        "perCheckpoint": ritase["perCheckpoint"],
        # The window this sheet actually covers, so the exported PDF/XLSX can
        # print it instead of the reader having to assume.
        "miningDayStartHour": mining_day.DAY_START_HOUR,
        "startDate": start_date,
        "endDate": end_date,
        "perTruck": per_truck,
        "unpaired": ritase["unpaired"],
    }


# --- Ritase (IN + OUT pairing) & Sync ----------------------------------------

def build_ritase_report(
    camera_code: str | None = None,
    camera_id: int | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
) -> dict:
    return build_ritase(build_crossings(
        camera_code=camera_code, camera_id=camera_id,
        start_date=start_date, end_date=end_date,
    ))


# --- Trend -------------------------------------------------------------------

def build_ritase_trend(
    granularity: str = "day",
    start_date: str | None = None,
    end_date: str | None = None,
    camera_code: str | None = None,
) -> dict:
    """Ritase over time, bucketed by mining day / week / month / year.

    Every bucket between the first and last observed one is emitted, including
    empty ones. A day the site hauled nothing is a fact worth seeing on the
    chart; omitting it would draw the line straight across the gap and hide a
    stoppage.

    Crossings with no recorded time cannot be placed on a timeline at all. They
    are excluded from the series and reported separately as ``undated`` -- the
    honest alternative to silently dropping them or parking them on an arbitrary
    date.
    """
    if granularity not in mining_day.GRANULARITIES:
        granularity = "day"

    crossings = build_crossings(
        camera_code=camera_code, start_date=start_date, end_date=end_date
    )

    # A ritase is credited to the mining day of its INBOUND leg, matching the
    # per-checkpoint breakdown -- a cycle belongs to the day the load started.
    report = build_ritase(crossings)
    dated: dict[str, dict] = {}
    undated = 0
    days_seen: list = []

    def cell(day) -> dict:
        label = mining_day.bucket_label(day, granularity)
        entry = dated.setdefault(label, {
            "bucket": label,
            "ritase": 0,
            "crossings": 0,
            "perCheckpoint": {},
        })
        return entry

    for crossing in crossings:
        moment = mining_day.parse_dt(crossing.get("crossedAt"))
        if moment is None:
            undated += 1
            continue
        day = mining_day.mining_date(moment)
        days_seen.append(day)
        cell(day)["crossings"] += 1

    for hull_events in _by_hull(crossings).values():
        from app.services.ritase import pair_hull_events

        pairs, _ = pair_hull_events(hull_events)
        for pair in pairs:
            moment = mining_day.parse_dt(pair["in"].get("crossedAt"))
            if moment is None:
                continue
            day = mining_day.mining_date(moment)
            days_seen.append(day)
            entry = cell(day)
            entry["ritase"] += 1
            checkpoint = pair["in"].get("checkpoint") or UNASSIGNED_CHECKPOINT
            entry["perCheckpoint"][checkpoint] = entry["perCheckpoint"].get(checkpoint, 0) + 1

    # When the caller named a window, the series spans THAT window -- asking for
    # 30 days and getting one bar because only one day had haulage hides the
    # 29 days of nothing, which is the more important half of the answer.
    # Without a window, fall back to the observed extent.
    requested_from = mining_day.parse_dt(start_date)
    requested_to = mining_day.parse_dt(end_date)
    series = _fill_buckets(
        days_seen, dated, granularity,
        first=requested_from.date() if requested_from else None,
        last=requested_to.date() if requested_to else None,
    )
    return {
        "granularity": granularity,
        "startDate": start_date,
        "endDate": end_date,
        "dayStartHour": mining_day.DAY_START_HOUR,
        "totalRitase": report["totalRitase"],
        "totalCrossings": len(crossings),
        # Crossings the timeline cannot place. Surfaced so a short series is
        # explainable rather than mysterious.
        "undatedCrossings": undated,
        "checkpoints": [c["checkpoint"] for c in report["perCheckpoint"]],
        "series": series,
    }


def _by_hull(crossings: list[dict]) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = {}
    for crossing in crossings:
        if crossing.get("known"):
            grouped.setdefault(crossing["hullId"], []).append(crossing)
    return grouped


def _fill_buckets(
    days_seen: list,
    dated: dict[str, dict],
    granularity: str,
    first=None,
    last=None,
) -> list[dict]:
    """Every bucket in the range, in order, empty ones included.

    ``first``/``last`` are the window the caller asked for; either falling back
    to the observed extent when not given. An explicit window wins even where it
    is wider than the data, because "we hauled nothing those days" is an answer
    and a missing bar is not.
    """
    bounds = [d for d in (first, last) if d is not None]
    if not days_seen and not bounds:
        return []
    known = days_seen + bounds
    cursor = mining_day.bucket_start(first if first is not None else min(known), granularity)
    last = mining_day.bucket_start(last if last is not None else max(known), granularity)
    series: list[dict] = []
    while cursor <= last:
        label = mining_day.bucket_label(cursor, granularity)
        series.append(dated.get(label, {
            "bucket": label, "ritase": 0, "crossings": 0, "perCheckpoint": {},
        }))
        cursor = mining_day.next_bucket(cursor, granularity)
    return series


def sync_ritase(payload: dict) -> dict:
    import json
    import time
    from app.core.config import SYNC_LOG

    crossings = payload.get("crossings")
    count = len(crossings) if isinstance(crossings, list) else len(build_crossings())
    receipt = {
        "syncedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "count": count,
        "source": payload.get("source", "Integrated Smart Hauling System"),
        "status": "success",
    }
    try:
        log = []
        if SYNC_LOG.exists():
            log = json.loads(SYNC_LOG.read_text(encoding="utf-8"))
        log.append(receipt)
        SYNC_LOG.write_text(json.dumps(log[-50:], indent=2), encoding="utf-8")
    except Exception as err:  # pragma: no cover - defensive
        print(f"reference: sync log write failed: {err}")
    return receipt
