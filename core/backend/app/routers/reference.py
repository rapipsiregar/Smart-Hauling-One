"""Reference-shaped Integrated Smart Hauling System endpoints backed by the real dataset."""

from __future__ import annotations

from fastapi import APIRouter

from app.services import reference

router = APIRouter(tags=["reference"])


@router.get("/crossings")
def list_crossings(camera_code: str | None = None, camera_id: int | None = None):
    return reference.build_crossings(camera_code=camera_code, camera_id=camera_id)


@router.get("/cctv-detections")
def list_cctv_detections(camera_code: str | None = None, camera_id: int | None = None):
    return reference.build_cctv_detections(camera_code=camera_code, camera_id=camera_id)


@router.get("/fleet-registry")
def fleet_registry(camera_code: str | None = None, camera_id: int | None = None):
    return reference.build_fleet(camera_code=camera_code, camera_id=camera_id)


@router.get("/performance-kpis")
def performance_kpis():
    return reference.build_performance_kpis()


@router.get("/shift-report")
def shift_report():
    return reference.build_shift_report()


@router.get("/ritase")
def ritase(camera_code: str | None = None, camera_id: int | None = None):
    """Ritase = IN paired with OUT, plus the flagged unpaired crossings."""
    return reference.build_ritase_report(camera_code=camera_code, camera_id=camera_id)


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

