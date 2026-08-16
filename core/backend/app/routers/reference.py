"""Reference-shaped Integrated Smart Hauling System endpoints backed by the real dataset."""

from __future__ import annotations

from fastapi import APIRouter

from app.services import reference

router = APIRouter(tags=["reference"])


@router.get("/crossings")
def list_crossings(
    camera_code: str | None = None,
    camera_id: int | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
):
    """Crossing log, optionally narrowed to one checkpoint's camera and a window.

    ``start_date``/``end_date`` are mining dates (06:00 to 06:00) and both ends
    are inclusive, so a single date returns that one full working day. This is
    what backs "click a checkpoint, see the trucks that passed it" -- each row
    already carries ``imageProofUrl``, the still frame the gate captured, so a
    cross-check never needs the video file opened.
    """
    return reference.build_crossings(
        camera_code=camera_code, camera_id=camera_id,
        start_date=start_date, end_date=end_date,
    )


@router.get("/cctv-detections")
def list_cctv_detections(camera_code: str | None = None, camera_id: int | None = None):
    return reference.build_cctv_detections(camera_code=camera_code, camera_id=camera_id)


@router.get("/fleet-registry")
def fleet_registry(camera_code: str | None = None, camera_id: int | None = None):
    return reference.build_fleet(camera_code=camera_code, camera_id=camera_id)


@router.get("/fleet-master")
def fleet_master():
    """The raw truck master registry (operator spreadsheet), for manual review."""
    return reference.build_fleet_master()


@router.get("/performance-kpis")
def performance_kpis():
    return reference.build_performance_kpis()


@router.get("/shift-report")
def shift_report(start_date: str | None = None, end_date: str | None = None):
    """The daily sheet, cut to the mining day (06:00 to 06:00)."""
    return reference.build_shift_report(start_date=start_date, end_date=end_date)


@router.get("/ritase")
def ritase(
    camera_code: str | None = None,
    camera_id: int | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
):
    """Ritase = IN paired with OUT, plus the flagged unpaired crossings.

    Includes ``perCheckpoint`` -- the CP 01..CP 04 breakdown the site plans and
    reports by. ``perGate`` is still there, grouping by area, for the map views.
    """
    return reference.build_ritase_report(
        camera_code=camera_code, camera_id=camera_id,
        start_date=start_date, end_date=end_date,
    )


@router.get("/ritase-trend")
def ritase_trend(
    granularity: str = "day",
    start_date: str | None = None,
    end_date: str | None = None,
    camera_code: str | None = None,
):
    """Ritase over time for the trend page.

    ``granularity`` is one of day/week/month/year; anything else falls back to
    day rather than erroring, so a stale bookmark still renders. Buckets are
    mining days (06:00 to 06:00), and empty ones are emitted so a stoppage shows
    as the gap it was.
    """
    return reference.build_ritase_trend(
        granularity=granularity, start_date=start_date,
        end_date=end_date, camera_code=camera_code,
    )


@router.get("/pit-occupancy")
def pit_occupancy_report():
    """Which trucks are inside the mining area right now, and on what evidence.

    A truck's most recent crossing decides where it is: inbound means inside,
    outbound means it has left. This is the same rule the outbound matcher uses
    to narrow its candidates, exposed so an operator can see the state the
    matcher is working from rather than infer it from a crossing list.
    """
    from app.services import pit_occupancy

    return pit_occupancy.build_occupancy()


@router.post("/sync-ritase")
def sync_ritase(payload: dict):
    return reference.sync_ritase(payload)

