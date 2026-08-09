"""Dashboard read endpoints plus fleet/crossing mutations."""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.schemas.common import StatusResponse
from app.schemas.crossing import CrossingUpdate
from app.schemas.fleet import TruckCreate, TruckUpdate
from app.services import registry, reset_crossings
from app.services.dataset import build_dataset

router = APIRouter(tags=["dashboard"])


# --- Reads -------------------------------------------------------------------

@router.get("/dataset")
def dataset():
    return build_dataset()


@router.get("/kpis")
def kpis():
    return build_dataset()["kpis"]


@router.get("/map")
def gate_map():
    """Where each truck is now: one bucket per hull, decided by its last crossing.

    This used to return every inbound crossing as "inside" and every outbound one
    as "outside". A truck that entered and left therefore appeared in BOTH lists,
    and the totals counted crossings rather than trucks -- so a fleet of 5 that
    had each done one round trip reported 5 inside and 5 outside at the same time.

    A truck is in exactly one place, so it is counted once, by its most recent
    crossing. Crossings with no time fall back to ingest order, which is the only
    ordering available for them.
    """
    ds = build_dataset()
    latest: dict[str, dict] = {}
    for crossing in ds["crossings"]:
        if not crossing["known"]:
            continue
        hull = crossing["hull_id"]
        current = latest.get(hull)
        if current is None or _crossing_order(crossing) >= _crossing_order(current):
            latest[hull] = crossing

    inside = [c for c in latest.values() if c["direction"] == "inbound"]
    outside = [c for c in latest.values() if c["direction"] == "outbound"]
    return {
        "inside": inside,
        "outside": outside,
        "total_inside": len(inside),
        "total_outside": len(outside),
        "total_trucks": ds["kpis"]["unique_trucks"],
        # The registered gates, not a hardcoded four. A site with three gates was
        # previously told it had four.
        "active_lanes": sorted(
            {c["lane"] for c in ds["crossings"] if c.get("lane")}
        ),
    }


def _crossing_order(crossing: dict) -> tuple[str, int]:
    """Sort key: real crossing time first, ingest order as the tie-break."""
    return (crossing.get("crossed_at") or "", int(crossing.get("id") or 0))


@router.get("/fleet")
def fleet():
    ds = build_dataset()
    return {"fleet": ds["fleet"], "kpis": ds["kpis"]}


@router.get("/reports")
def reports():
    return build_dataset()


@router.get("/crossings/{crossing_id}")
def get_crossing(crossing_id: int):
    for c in build_dataset()["crossings"]:
        if c["id"] == crossing_id:
            return c
    return JSONResponse({"error": "Crossing not found"}, status_code=404)


# --- Mutations ---------------------------------------------------------------

@router.put("/crossings/{crossing_id}", response_model=StatusResponse)
def update_crossing(crossing_id: int, payload: CrossingUpdate):
    if not registry.update_crossing(crossing_id, payload.hull_id, payload.confidence):
        return JSONResponse({"error": "Crossing not found"}, status_code=404)
    return {"status": "success"}


# --- Development reset --------------------------------------------------------

@router.get("/crossings-reset-preview")
def crossings_reset_preview():
    """What a reset would delete. Shown before anything is removed."""
    return reset_crossings.count_crossings()


@router.post("/crossings-reset")
def reset_all_crossings():
    """Delete every recorded crossing so a test can be repeated from empty.

    Deliberately narrow: it removes what detection PRODUCED, never what the
    system was configured WITH. The truck master, the camera registry and the
    device API keys all survive -- see app/services/reset_crossings.py for why
    each of those would be painful to lose.
    """
    return reset_crossings.reset()


@router.post("/fleet", response_model=StatusResponse)
def add_truck(payload: TruckCreate):
    hull_id = payload.hull_id.strip()
    if not hull_id:
        return JSONResponse({"error": "Hull ID is required"}, status_code=400)
    if not registry.add_truck(hull_id, payload.status):
        return JSONResponse({"error": "Truck already exists"}, status_code=400)
    return {"status": "success"}


@router.put("/fleet/{hull_id}", response_model=StatusResponse)
def update_truck(hull_id: str, payload: TruckUpdate):
    if not registry.update_truck(hull_id, payload.hull_id.strip(), payload.status):
        return JSONResponse({"error": "Truck not found"}, status_code=404)
    return {"status": "success"}


@router.delete("/fleet/{hull_id}", response_model=StatusResponse)
def delete_truck(hull_id: str):
    if not registry.delete_truck(hull_id):
        return JSONResponse({"error": "Truck not found"}, status_code=404)
    return {"status": "success"}
